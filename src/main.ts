import { App, Modal, Notice, Plugin, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import {
  ArchiveProjectSettings,
  ArchiveProjectSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";
import {
  generateArchiveDestination,
  getFolderName,
  isTopLevelProjectFolder,
} from "./utils";

/** Maximum retries for rename operation on collision */
const MAX_RENAME_RETRIES = 3;

class ArchiveConfirmModal extends Modal {
  private folderName: string;
  private destPath: string;
  private onConfirm: () => void;
  private onCancel: () => void;
  private confirmed = false;

  constructor(
    app: App,
    folderName: string,
    destPath: string,
    onConfirm: () => void,
    onCancel: () => void
  ) {
    super(app);
    this.folderName = folderName;
    this.destPath = destPath;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Archive Project?" });
    contentEl.createEl("p", { text: `Move "${this.folderName}" to:` });
    contentEl.createEl("p", { text: this.destPath, cls: "archive-dest-path" });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const confirmBtn = buttonContainer.createEl("button", { text: "Archive", cls: "mod-cta" });
    confirmBtn.addEventListener("click", () => {
      this.confirmed = true;
      this.onConfirm();
      this.close();
    });

    // Focus confirm button for keyboard users
    confirmBtn.focus();

    // Handle Enter key to confirm
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        this.confirmed = true;
        this.onConfirm();
        this.close();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    };
    contentEl.addEventListener("keydown", handleKeydown);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.confirmed) {
      this.onCancel();
    }
  }
}

export default class ArchiveProjectPlugin extends Plugin {
  settings: ArchiveProjectSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new ArchiveProjectSettingTab(this.app, this));

    // Register context menu item for file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        // Only show for folders or files (not other abstract types)
        if (!(file instanceof TFolder) && !(file instanceof TFile)) {
          return;
        }

        // Only show for direct children of projectsPath
        const projectsPath = normalizePath(this.settings.projectsPath);
        if (!isTopLevelProjectFolder(file.path, projectsPath)) {
          return;
        }

        menu.addItem((item) => {
          item
            .setTitle("Archive it")
            .setIcon("archive")
            .onClick(async () => {
              await this.archiveItem(file);
            });
        });
      })
    );
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Validate loaded settings - catch invalid manual edits to data.json
    if (this.settings.projectsPath === this.settings.archivePath) {
      new Notice("Archive Project: Invalid settings detected (paths match), resetting to defaults");
      this.settings.projectsPath = DEFAULT_SETTINGS.projectsPath;
      this.settings.archivePath = DEFAULT_SETTINGS.archivePath;
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Archive an item (file or folder) by moving it to the archive path.
   * Shows a confirmation dialog if enabled in settings.
   * Uses retry logic to handle case-sensitivity differences across filesystems.
   */
  async archiveItem(item: TAbstractFile): Promise<void> {
    // Re-normalize paths for defense-in-depth (settings may come from older plugin versions)
    const archivePath = normalizePath(this.settings.archivePath);
    const itemName = getFolderName(item.path);

    try {
      // Ensure archive folder exists
      await this.ensureFolderExists(archivePath);

      // Get all existing folders in archive to check for collisions
      const existingPaths = this.getExistingArchivePaths(archivePath);

      // Generate unique destination path
      const destPath = generateArchiveDestination(
        archivePath,
        itemName,
        existingPaths
      );

      // Show confirmation if enabled
      if (this.settings.confirmBeforeArchive) {
        return new Promise<void>((resolve) => {
          new ArchiveConfirmModal(
            this.app,
            itemName,
            destPath,
            async () => {
              await this.performArchive(item, destPath, itemName, archivePath);
              resolve();
            },
            () => resolve() // onCancel - just resolve without archiving
          ).open();
        });
      } else {
        await this.performArchive(item, destPath, itemName, archivePath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to archive "${itemName}": ${message}`);
      console.error("Archive Project: Failed to archive item", error);
    }
  }

  /**
   * Perform the actual archive operation.
   * Called either directly or after confirmation dialog is accepted.
   */
  private async performArchive(item: TAbstractFile, destPath: string, itemName: string, archivePath: string): Promise<void> {
    const originalDestPath = destPath; // Track original path

    // Move the item with retry logic for filesystem case-sensitivity edge cases
    // On macOS/Windows (case-insensitive), collision detection might miss case variants
    // If rename fails, assume collision and retry with updated paths
    for (let attempt = 0; attempt < MAX_RENAME_RETRIES; attempt++) {
      try {
        await this.app.vault.rename(item, destPath);
        break; // Success - exit retry loop
      } catch (renameError) {
        if (attempt === MAX_RENAME_RETRIES - 1) {
          throw renameError; // Final attempt failed, propagate error
        }
        // Assume collision due to case-insensitive filesystem - refresh and retry
        const refreshedPaths = this.getExistingArchivePaths(archivePath);
        // Add the failed path to force a new name (handles case-insensitive match)
        refreshedPaths.add(destPath);
        destPath = generateArchiveDestination(archivePath, itemName, refreshedPaths);
      }
    }

    // Notify user - mention if path changed due to conflict
    if (destPath !== originalDestPath) {
      new Notice(`Archived "${itemName}" to ${destPath} (path changed due to conflict)`);
    } else {
      new Notice(`Archived "${itemName}" to ${destPath}`);
    }

    // Focus back on projects folder if enabled
    if (this.settings.focusAfterArchive) {
      await this.focusProjectsFolder();
    }
  }

  /**
   * Ensure a folder exists, creating it if necessary.
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    } else if (!(folder instanceof TFolder)) {
      throw new Error(`"${folderPath}" exists but is not a folder`);
    }
  }

  /**
   * Get all existing paths in the archive folder.
   */
  private getExistingArchivePaths(archivePath: string): Set<string> {
    const paths = new Set<string>();
    const archiveFolder = this.app.vault.getAbstractFileByPath(archivePath);

    if (archiveFolder instanceof TFolder) {
      for (const child of archiveFolder.children) {
        paths.add(normalizePath(child.path));
      }
    }

    return paths;
  }

  /**
   * Focus the file explorer on the projects folder.
   * Best-effort: logs errors but doesn't notify user since archive succeeded.
   *
   * WARNING: Uses undocumented internal Obsidian API (revealInFolder).
   * Tested on Obsidian 1.7.x. May break in future versions.
   * If it breaks, the archive still succeeds - only the focus feature fails.
   */
  private async focusProjectsFolder(): Promise<void> {
    const projectsPath = normalizePath(this.settings.projectsPath);
    const projectsFolder = this.app.vault.getAbstractFileByPath(projectsPath);

    if (!projectsFolder) {
      return;
    }

    try {
      // Get the file explorer leaf
      const fileExplorer = this.app.workspace.getLeavesOfType("file-explorer")[0];
      if (!fileExplorer) {
        return;
      }

      // INTERNAL API: revealInFolder is not in Obsidian's public type definitions
      // This is a best-effort feature - archive succeeds even if this fails
      const fileExplorerView = fileExplorer.view as {
        revealInFolder?: (file: TAbstractFile) => void;
      };

      if (typeof fileExplorerView.revealInFolder === "function") {
        fileExplorerView.revealInFolder(projectsFolder as TAbstractFile);
      }
    } catch (error) {
      // Best-effort: log for debugging but don't bother user (archive succeeded)
      console.debug("Archive Project: Could not focus Projects folder", error);
    }
  }
}
