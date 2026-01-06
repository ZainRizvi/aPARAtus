import { App, Modal, Notice, Plugin, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import {
  ArchiveProjectSettings,
  ArchiveProjectSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";
import {
  generateArchiveDestination,
  getItemName,
  isTopLevelProjectFolder,
  arePathsNested,
} from "./utils";

/** Maximum retries for rename operation on collision */
const MAX_RENAME_RETRIES = 3;

class ArchiveConfirmModal extends Modal {
  private folderName: string;
  private destPath: string;
  private onConfirm: () => void;
  private onCancel: () => void;
  private confirmed = false;
  private keydownHandler?: (e: KeyboardEvent) => void;

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
    this.keydownHandler = (e: KeyboardEvent) => {
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
    contentEl.addEventListener("keydown", this.keydownHandler);
  }

  onClose() {
    const { contentEl } = this;
    if (this.keydownHandler) {
      contentEl.removeEventListener("keydown", this.keydownHandler);
    }
    contentEl.empty();
    if (!this.confirmed) {
      this.onCancel();
    }
  }
}

export default class ArchiveProjectPlugin extends Plugin {
  settings: ArchiveProjectSettings = DEFAULT_SETTINGS;
  private archivingItems = new Set<string>();

  async onload(): Promise<void> {
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new ArchiveProjectSettingTab(this.app, this));

    // Register command palette command
    this.addCommand({
      id: "archive-item",
      name: "Archive Item",
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          return false;
        }

        const topLevelItem = this.findTopLevelItem(activeFile);
        if (!topLevelItem) {
          return false;
        }

        if (!checking) {
          this.archiveItem(topLevelItem);
        }
        return true;
      },
    });

    // Register context menu item for file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        // Only show for folders or files (not other abstract types)
        if (!(file instanceof TFolder) && !(file instanceof TFile)) {
          return;
        }

        // Only show for direct children of any source folder (Projects, Areas, Resources)
        const sourceFolders = this.getSourceFolders();
        const isArchivable = sourceFolders.some(srcPath =>
          isTopLevelProjectFolder(file.path, srcPath)
        );

        if (!isArchivable) {
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
    const sourceFolders = this.getSourceFolders();
    const archivePath = normalizePath(this.settings.archivePath);

    // Check if archive path matches any source folder
    if (sourceFolders.includes(archivePath)) {
      new Notice("Archive Project: Invalid settings detected (archive matches source folder), resetting to defaults");
      this.settings.projectsPath = DEFAULT_SETTINGS.projectsPath;
      this.settings.areasPath = DEFAULT_SETTINGS.areasPath;
      this.settings.resourcesPath = DEFAULT_SETTINGS.resourcesPath;
      this.settings.archivePath = DEFAULT_SETTINGS.archivePath;
      await this.saveSettings();
      return;
    }

    // Check if source folders match each other
    const uniqueFolders = new Set(sourceFolders);
    if (uniqueFolders.size !== sourceFolders.length) {
      new Notice("Archive Project: Invalid settings detected (source folders match), resetting to defaults");
      this.settings.projectsPath = DEFAULT_SETTINGS.projectsPath;
      this.settings.areasPath = DEFAULT_SETTINGS.areasPath;
      this.settings.resourcesPath = DEFAULT_SETTINGS.resourcesPath;
      await this.saveSettings();
      return;
    }

    // Check if any PARA folders are nested within each other
    const allPaths = [
      this.settings.projectsPath,
      this.settings.areasPath,
      this.settings.resourcesPath,
      this.settings.archivePath,
    ];
    const nestedError = arePathsNested(allPaths);
    if (nestedError) {
      new Notice(`Archive Project: Invalid settings detected (${nestedError}), resetting to defaults`);
      this.settings.projectsPath = DEFAULT_SETTINGS.projectsPath;
      this.settings.areasPath = DEFAULT_SETTINGS.areasPath;
      this.settings.resourcesPath = DEFAULT_SETTINGS.resourcesPath;
      this.settings.archivePath = DEFAULT_SETTINGS.archivePath;
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Get all source folders as normalized paths.
   * Returns an array of all PARA component source folders (Projects, Areas, Resources).
   */
  private getSourceFolders(): string[] {
    return [
      normalizePath(this.settings.projectsPath),
      normalizePath(this.settings.areasPath),
      normalizePath(this.settings.resourcesPath),
    ];
  }

  /**
   * Find the top-level PARA item (file or folder) for the given file.
   * Walks up the directory tree to find a direct child of any source folder.
   * If the file itself is a direct child of a source folder, returns the file.
   * Returns null if file is not inside a PARA source folder.
   *
   * @param file - The file to find the top-level item for
   * @returns The top-level item, or null if not in a PARA source folder
   */
  private findTopLevelItem(file: TFile): TAbstractFile | null {
    const sourceFolders = this.getSourceFolders();

    // Check if the file itself is a direct child of a source folder
    if (sourceFolders.some(src => isTopLevelProjectFolder(file.path, src))) {
      return file;
    }

    // Walk up to find the top-level folder
    let current = file.parent;
    while (current) {
      if (sourceFolders.some(src => isTopLevelProjectFolder(current!.path, src))) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Archive an item (file or folder) by moving it to the archive path.
   * Shows a confirmation dialog if enabled in settings.
   * Uses retry logic to handle case-sensitivity differences across filesystems.
   * After archiving, focuses on the source folder the item was from.
   */
  async archiveItem(item: TAbstractFile): Promise<void> {
    // Prevent double-click race condition
    if (this.archivingItems.has(item.path)) {
      return; // Already archiving this item
    }
    this.archivingItems.add(item.path);

    // Re-normalize paths for defense-in-depth (settings may come from older plugin versions)
    const archivePath = normalizePath(this.settings.archivePath);
    const itemName = getItemName(item.path);

    try {
      // Determine which source folder this item is in
      const sourceFolders = this.getSourceFolders();
      const sourceFolder = sourceFolders.find(src =>
        isTopLevelProjectFolder(item.path, src)
      );

      // Extract the source folder name (e.g., "Projects" from "Projects" or "My Projects" from "Work/My Projects")
      // This is used to create subfolders within the Archive for organization
      const sourceFolderName = sourceFolder ? getItemName(sourceFolder) : "";

      // Ensure archive folder exists
      await this.ensureFolderExists(archivePath);

      // Create subfolder within archive that matches source folder name
      // e.g., Archive/Projects, Archive/Areas, Archive/Resources, or Archive/My Projects
      const archiveSubfolder = sourceFolderName
        ? normalizePath(`${archivePath}/${sourceFolderName}`)
        : archivePath;
      await this.ensureFolderExists(archiveSubfolder);

      // Get all existing folders in the subfolder to check for collisions
      const existingPaths = this.getExistingArchivePaths(archiveSubfolder);

      // Generate unique destination path within the subfolder
      const destPath = generateArchiveDestination(
        archiveSubfolder,
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
              await this.performArchive(item, destPath, itemName, archiveSubfolder, sourceFolder);
              resolve();
            },
            () => resolve() // onCancel - just resolve without archiving
          ).open();
        });
      } else {
        await this.performArchive(item, destPath, itemName, archiveSubfolder, sourceFolder);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to archive "${itemName}": ${message}`);
      console.error("Archive Project: Failed to archive item", error);
    } finally {
      this.archivingItems.delete(item.path);
    }
  }

  /**
   * Perform the actual archive operation.
   * Called either directly or after confirmation dialog is accepted.
   * After successful archive, focuses on the source folder.
   *
   * @param item - The item being archived
   * @param destPath - The destination path for the archive
   * @param itemName - The name of the item
   * @param archiveSubfolder - The archive subfolder path (e.g., Archive/Projects)
   * @param sourceFolder - The source folder the item is from (Projects, Areas, or Resources)
   */
  private async performArchive(item: TAbstractFile, destPath: string, itemName: string, archiveSubfolder: string, sourceFolder?: string): Promise<void> {
    const originalDestPath = destPath; // Track original path

    // Move the item with retry logic for filesystem case-sensitivity edge cases
    // On macOS/Windows (case-insensitive), collision detection might miss case variants
    // If rename fails, assume collision and retry with updated paths
    //
    // DESIGN DECISION: We treat all vault.rename errors as potential collisions and retry,
    // rather than checking specific error types. This is intentional:
    // - Obsidian doesn't document error types well, making type-checking unreliable
    // - Non-collision errors (permissions, disk full, path too long) fail consistently
    //   across all 3 retries anyway - users see the final error in the notice
    // - 3 retries is cheap (milliseconds), so defense-in-depth retry is a reasonable tradeoff
    // - The collision detection catches most cases; retry handles edge cases on case-insensitive
    //   filesystems (like macOS/Windows) where filesystem case variants can conflict
    for (let attempt = 0; attempt < MAX_RENAME_RETRIES; attempt++) {
      try {
        await this.app.vault.rename(item, destPath);
        break; // Success - exit retry loop
      } catch (renameError) {
        if (attempt === MAX_RENAME_RETRIES - 1) {
          throw renameError; // Final attempt failed, propagate error
        }
        // Assume collision due to case-insensitive filesystem - refresh and retry
        const refreshedPaths = this.getExistingArchivePaths(archiveSubfolder);
        // Add the failed path to force a new name (handles case-insensitive match)
        refreshedPaths.add(destPath);
        destPath = generateArchiveDestination(archiveSubfolder, itemName, refreshedPaths);
      }
    }

    // Notify user - mention if path changed due to conflict
    if (destPath !== originalDestPath) {
      new Notice(`Archived "${itemName}" to ${destPath} (path changed due to conflict)`);
    } else {
      new Notice(`Archived "${itemName}" to ${destPath}`);
    }

    // Focus back on source folder if enabled
    if (this.settings.focusAfterArchive && sourceFolder) {
      await this.focusSourceFolder(sourceFolder);
    }
  }

  /**
   * Ensure a folder exists, creating it and any parent directories if necessary.
   * Handles deeply nested archive paths by recursively creating parents.
   * @throws If an intermediate path exists as a file rather than a folder.
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (folder) {
      // Path already exists - verify it's a folder, not a file
      if (!(folder instanceof TFolder)) {
        throw new Error(`"${normalizedPath}" exists but is not a folder`);
      }
      return;
    }

    // Split path into segments and create each parent if needed
    const segments = normalizedPath.split("/").filter(Boolean);

    // Build each parent path and ensure it exists
    for (let i = 1; i <= segments.length; i++) {
      const parentPath = segments.slice(0, i).join("/");
      const parentFile = this.app.vault.getAbstractFileByPath(parentPath);

      if (!parentFile) {
        // Parent doesn't exist - create it
        await this.app.vault.createFolder(parentPath);
      } else if (!(parentFile instanceof TFolder)) {
        // Parent exists but is a file - error
        throw new Error(
          `Cannot create folder "${normalizedPath}": intermediate path "${parentPath}" exists but is not a folder`
        );
      }
      // If parent exists and is a folder, continue to next segment
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
   * Focus the file explorer on a source folder (Projects, Areas, or Resources).
   * Best-effort: logs errors but doesn't notify user since archive succeeded.
   *
   * @param sourcePath - The path to the source folder to focus on
   *
   * WARNING: Uses undocumented internal Obsidian API (revealInFolder).
   * Tested on Obsidian 1.7.x. May break in future versions.
   * If it breaks, the archive still succeeds - only the focus feature fails.
   */
  private async focusSourceFolder(sourcePath: string): Promise<void> {
    const normalizedPath = normalizePath(sourcePath);
    const sourceFolder = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (!sourceFolder) {
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
        fileExplorerView.revealInFolder(sourceFolder as TAbstractFile);
      }
    } catch (error) {
      // Best-effort: log for debugging but don't bother user (archive succeeded)
      console.debug("Archive Project: Could not focus source folder", error);
    }
  }
}
