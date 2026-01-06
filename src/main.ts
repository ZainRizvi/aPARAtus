import { Notice, Plugin, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import {
  ParaManagerSettings,
  ParaManagerSettingTab,
  DEFAULT_SETTINGS,
} from "./settings";
import {
  generateArchiveDestination,
  getItemName,
  isTopLevelProjectFolder,
  arePathsNested,
} from "./utils";
import { ArchiveConfirmModal, NameInputModal } from "./modals";
import { ensureFolderExists, getExistingPaths, focusFolder } from "./folder-ops";

/** Maximum retries for rename operation on collision */
const MAX_RENAME_RETRIES = 3;

export default class ParaManagerPlugin extends Plugin {
  settings: ParaManagerSettings = DEFAULT_SETTINGS;
  private archivingItems = new Set<string>();

  async onload(): Promise<void> {
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new ParaManagerSettingTab(this.app, this));

    // Register command palette commands
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

    this.addCommand({
      id: "create-project",
      name: "Create Project",
      callback: () => {
        new NameInputModal(
          this.app,
          "Create Project",
          "Project name",
          (name) => this.createParaItem(name, "projectsPath", "Project")
        ).open();
      },
    });

    this.addCommand({
      id: "create-area",
      name: "Create Area",
      callback: () => {
        new NameInputModal(
          this.app,
          "Create Area",
          "Area name",
          (name) => this.createParaItem(name, "areasPath", "Area")
        ).open();
      },
    });

    this.addCommand({
      id: "create-resource",
      name: "Create Resource",
      callback: () => {
        new NameInputModal(
          this.app,
          "Create Resource",
          "Resource name",
          (name) => this.createParaItem(name, "resourcesPath", "Resource")
        ).open();
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
      new Notice("PARA Manager: Invalid settings detected (archive matches source folder), resetting to defaults");
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
      new Notice("PARA Manager: Invalid settings detected (source folders match), resetting to defaults");
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
      new Notice(`PARA Manager: Invalid settings detected (${nestedError}), resetting to defaults`);
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
   * Format a project name using Moment.js date tokens and {{name}} placeholder.
   * Obsidian exposes moment globally as window.moment.
   *
   * @param name - The project name (will replace {{name}} placeholder)
   * @param format - The format string with Moment.js tokens and {{name}} placeholder
   * @returns The formatted folder name
   */
  private formatProjectName(name: string, format: string): string {
    // window.moment is globally available in Obsidian - no import needed
    const now = (window as any).moment();

    // Replace {{name}} with escaped name (square brackets prevent Moment.js interpretation)
    // e.g., "fruit ball" contains 'a' (AM/PM) and 'll' (localized date) tokens
    const result = format.replace(/\{\{name\}\}/g, `[${name}]`);

    // Format Moment.js tokens - the name inside [] is preserved literally
    return now.format(result);
  }

  /**
   * Create a new PARA item (Project, Area, or Resource).
   * Creates a folder and an index note inside it, then opens the note.
   *
   * @param name - The name for the new item
   * @param settingsKey - Which settings path to use (projectsPath, areasPath, resourcesPath)
   * @param itemType - Human-readable type for messages (Project, Area, Resource)
   */
  private async createParaItem(
    name: string,
    settingsKey: "projectsPath" | "areasPath" | "resourcesPath",
    itemType: string
  ): Promise<void> {
    const basePath = this.settings[settingsKey];

    // For projects only, apply the folder name format
    let folderName = name;
    if (settingsKey === "projectsPath") {
      folderName = this.formatProjectName(name, this.settings.projectFolderFormat);
    }

    const itemPath = normalizePath(`${basePath}/${folderName}`);

    // Check if folder already exists
    if (this.app.vault.getAbstractFileByPath(itemPath)) {
      new Notice(`${itemType} "${name}" already exists`);
      return;
    }

    try {
      // Ensure parent folder exists
      await ensureFolderExists(this.app, basePath);

      // Create the item folder
      await this.app.vault.createFolder(itemPath);

      // Create index note (title uses just the name, not the formatted folder name)
      const indexPath = normalizePath(`${itemPath}/index.md`);
      const indexContent = `# ${name}\n`;
      const file = await this.app.vault.create(indexPath, indexContent);

      // Open the note
      await this.app.workspace.getLeaf().openFile(file);

      new Notice(`Created ${itemType.toLowerCase()} "${name}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to create ${itemType.toLowerCase()}: ${message}`);
      console.error(`PARA Manager: Failed to create ${itemType}`, error);
    }
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
      await ensureFolderExists(this.app, archivePath);

      // Create subfolder within archive that matches source folder name
      // e.g., Archive/Projects, Archive/Areas, Archive/Resources, or Archive/My Projects
      const archiveSubfolder = sourceFolderName
        ? normalizePath(`${archivePath}/${sourceFolderName}`)
        : archivePath;
      await ensureFolderExists(this.app, archiveSubfolder);

      // Get all existing folders in the subfolder to check for collisions
      const existingPaths = getExistingPaths(this.app, archiveSubfolder);

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
      console.error("PARA Manager: Failed to archive item", error);
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
        const refreshedPaths = getExistingPaths(this.app, archiveSubfolder);
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
      await focusFolder(this.app, sourceFolder);
    }
  }
}
