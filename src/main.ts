import { Notice, Plugin, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { around } from "monkey-around";
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
  compareByLastModified,
  extractDateFormatFromProjectFormat,
} from "./utils";
import { ArchiveConfirmModal, NameInputModal } from "./modals";
import { ensureFolderExists, getExistingPaths, focusFolder, getFolderLastModifiedTime } from "./folder-ops";
import type { FileExplorerView } from "./obsidian-internals";

declare global {
  interface Window {
    moment: typeof import("moment");
  }
}

/** Maximum retries for rename operation on collision */
const MAX_RENAME_RETRIES = 3;

/** Interface for Templater plugin API */
interface TemplaterPlugin {
  templater: {
    parse_template(options: { template_file: TFile; target_file: TFile }): Promise<string>;
  };
}

export default class ParaManagerPlugin extends Plugin {
  settings: ParaManagerSettings = DEFAULT_SETTINGS;
  private archivingItems = new Set<string>();
  private sortingPatchUninstaller: (() => void) | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Install sorting patch for projects folder once layout is ready
    // (file explorer may not exist yet during onload)
    this.app.workspace.onLayoutReady(() => {
      this.installSortingPatch();
    });

    // Re-install when file explorer might have changed
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.installSortingPatch();
      })
    );

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

  onunload(): void {
    this.sortingPatchUninstaller?.();
    this.archivingItems.clear();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Validate loaded settings - catch invalid manual edits to data.json
    const sourceFolders = this.getSourceFolders();
    const archivePath = normalizePath(this.settings.archivePath);

    // Check if archive path matches any source folder
    if (sourceFolders.includes(archivePath)) {
      new Notice("aPARAtus: Invalid settings detected (archive matches source folder), resetting to defaults");
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
      new Notice("aPARAtus: Invalid settings detected (source folders match), resetting to defaults");
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
      new Notice(`aPARAtus: Invalid settings detected (${nestedError}), resetting to defaults`);
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
   * Check if Templater plugin is available and enabled.
   * @returns True if Templater is available
   */
  private isTemplaterAvailable(): boolean {
    try {
      return !!(this.app as any).plugins?.plugins?.["templater-obsidian"];
    } catch {
      return false;
    }
  }

  /**
   * Check if core Templates plugin is available and enabled.
   * @returns True if core Templates plugin is available
   */
  private isCoreTemplatesAvailable(): boolean {
    try {
      return !!(this.app as any).internalPlugins?.plugins?.["templates"];
    } catch {
      return false;
    }
  }

  /**
   * Apply a template to a file using Templater if available, otherwise use core templates.
   * If template path is empty, uses default content (just "# Name").
   * Supports both Templater and core Templates plugins.
   *
   * @param file - The target file to apply template to
   * @param templatePath - Path to template file (empty string means no template)
   * @param itemName - The name of the item (replaces {{name}} in templates)
   * @returns The final content, or null if template application failed but should continue
   */
  private async applyTemplate(
    file: TFile,
    templatePath: string,
    itemName: string
  ): Promise<string | null> {
    // If no template configured, use default
    if (!templatePath.trim()) {
      return `# ${itemName}\n`;
    }

    // Try to find the template file
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (!(templateFile instanceof TFile)) {
      console.warn(`aPARAtus: Template file not found at ${templatePath}, using default`);
      return `# ${itemName}\n`;
    }

    try {
      // Prefer Templater if available
      if (this.isTemplaterAvailable()) {
        const templater = ((this.app as any).plugins?.plugins?.["templater-obsidian"] as TemplaterPlugin)?.templater;
        if (templater) {
          const result = await templater.parse_template({ template_file: templateFile, target_file: file });
          return result;
        }
      }

      // Fall back to core Templates plugin
      if (this.isCoreTemplatesAvailable()) {
        const content = await this.app.vault.read(templateFile);
        // Core templates use simple variable substitution
        // Replace {{name}} with the item name
        const processed = content.replace(/{{name}}/g, itemName);
        return processed;
      }

      // No template plugin available, read template content and do simple substitution
      const content = await this.app.vault.read(templateFile);
      const processed = content.replace(/{{name}}/g, itemName);
      return processed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.warn(`aPARAtus: Failed to apply template: ${message}, using default`);
      return `# ${itemName}\n`;
    }
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
    const now = window.moment();

    // Replace {{name}} with escaped name (square brackets prevent Moment.js interpretation)
    // e.g., "fruit ball" contains 'a' (AM/PM) and 'll' (localized date) tokens
    const result = format.replace(/\{\{name\}\}/g, `[${name}]`);

    // Format Moment.js tokens - the name inside [] is preserved literally
    return now.format(result);
  }

  /**
   * Create a new PARA item (Project, Area, or Resource).
   * Creates a folder and an index note inside it, then opens the note.
   * Applies configured template if available.
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

      // Get the appropriate template path based on item type
      let templatePath = "";
      if (settingsKey === "projectsPath") {
        templatePath = this.settings.projectTemplatePath;
      } else if (settingsKey === "areasPath") {
        templatePath = this.settings.areaTemplatePath;
      } else if (settingsKey === "resourcesPath") {
        templatePath = this.settings.resourceTemplatePath;
      }

      // Create the file first (empty)
      const file = await this.app.vault.create(indexPath, "");

      // Apply template to the file
      const indexContent = await this.applyTemplate(file, templatePath, name);
      if (indexContent) {
        await this.app.vault.modify(file, indexContent);
      }

      // Open the note
      await this.app.workspace.getLeaf().openFile(file);

      new Notice(`Created ${itemType.toLowerCase()} "${name}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to create ${itemType.toLowerCase()}: ${message}`);
      console.error(`aPARAtus: Failed to create ${itemType}`, error);
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
   * Install a monkey patch on the file explorer's getSortedFolderItems method
   * to intercept and sort projects when the Projects folder is being displayed.
   * The patch is only active if projectSortOrder is not 'disabled'.
   * Public so settings can re-install patch when sort order changes.
   *
   * Reference implementation: https://github.com/SebastianMC/obsidian-custom-sort
   * Key patterns borrowed:
   * - Wait for onLayoutReady before patching (file explorer may not exist during onload)
   * - Re-install patch when settings change (not just call requestSort)
   * - Verify getSortedFolderItems/requestSort exist before patching (undocumented APIs)
   */
  installSortingPatch(): void {
    // Clean up existing patch
    this.sortingPatchUninstaller?.();
    this.sortingPatchUninstaller = null;

    if (this.settings.projectSortOrder === "disabled") {
      return;
    }

    const fileExplorerLeaf = this.app.workspace.getLeavesOfType("file-explorer")[0];
    if (!fileExplorerLeaf) {
      console.warn("aPARAtus: File explorer not found, cannot install sorting patch");
      return;
    }

    const view = fileExplorerLeaf.view as FileExplorerView;

    // Verify that the methods we need exist (undocumented APIs can change)
    if (typeof view.getSortedFolderItems !== "function") {
      console.warn("aPARAtus: getSortedFolderItems not found on file explorer view");
      return;
    }
    if (typeof view.requestSort !== "function") {
      console.warn("aPARAtus: requestSort not found on file explorer view");
      return;
    }

    const projectsPath = normalizePath(this.settings.projectsPath);
    const plugin = this;

    console.log("aPARAtus: Installing sorting patch for", projectsPath, "with order", this.settings.projectSortOrder);

    this.sortingPatchUninstaller = around(view.constructor.prototype, {
      getSortedFolderItems(original) {
        return function (this: any, folder: TFolder) {
          // Only intercept for Projects folder
          if (folder.path !== projectsPath) {
            // Debug: log when we check the Projects folder path
            if (folder.path.includes("Projects") || folder.path.includes("1 -")) {
              console.log("aPARAtus: Checking folder:", JSON.stringify(folder.path), "vs configured:", JSON.stringify(projectsPath), "match:", folder.path === projectsPath);
            }
            return original.call(this, folder);
          }

          console.log("aPARAtus: Sorting Projects folder, order:", plugin.settings.projectSortOrder);

          try {
            const items = original.call(this, folder);
            // Debug: inspect what items actually are
            console.log("aPARAtus: Items type:", typeof items, Array.isArray(items));
            if (items.length > 0) {
              console.log("aPARAtus: First item:", items[0]);
              console.log("aPARAtus: First item keys:", Object.keys(items[0]));
              console.log("aPARAtus: First item.file:", items[0].file);
            }
            const sorted = plugin.sortProjectItems(items);
            return sorted;
          } catch (e) {
            console.error("aPARAtus: Sorting failed, using default", e);
            return original.call(this, folder);
          }
        };
      },
    });
  }

  /**
   * Sort project items according to the configured sort order.
   * Applies the sort order setting to reorder folder items.
   *
   * Note: Items are file explorer UI wrappers, not TAbstractFile directly.
   * The actual file is in the .file property (undocumented Obsidian internal).
   *
   * @param items - The wrapper items to sort
   * @returns The sorted wrapper items
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sortProjectItems(items: any[]): any[] {
    const sorted = [...items];

    if (this.settings.projectSortOrder === "lastModified") {
      sorted.sort((a, b) => {
        // Items are wrappers - actual file is in .file property
        const fileA = a.file as TAbstractFile;
        const fileB = b.file as TAbstractFile;
        // Use safe access - stat may be undefined for some files
        const mtimeA =
          fileA instanceof TFolder ? getFolderLastModifiedTime(fileA) : ((fileA as TFile).stat?.mtime ?? 0);
        const mtimeB =
          fileB instanceof TFolder ? getFolderLastModifiedTime(fileB) : ((fileB as TFile).stat?.mtime ?? 0);
        return compareByLastModified({ mtime: mtimeA }, { mtime: mtimeB });
      });
    } else if (this.settings.projectSortOrder === "datePrefix") {
      // Extract the date format from user's projectFolderFormat setting
      const dateFormat = extractDateFormatFromProjectFormat(this.settings.projectFolderFormat);

      sorted.sort((a, b) => {
        // Items are wrappers - actual file is in .file property
        const fileA = a.file as TAbstractFile;
        const fileB = b.file as TAbstractFile;

        // Parse dates using moment with the user's configured format
        const dateA = window.moment(fileA.name, dateFormat, true);
        const dateB = window.moment(fileB.name, dateFormat, true);

        // Valid dates sort by date (newer first), invalid dates go to end
        const validA = dateA.isValid();
        const validB = dateB.isValid();

        if (validA && validB) {
          return dateB.valueOf() - dateA.valueOf(); // Newer first
        }
        if (validA && !validB) return -1; // A has date, B doesn't - A first
        if (!validA && validB) return 1;  // B has date, A doesn't - B first
        return 0; // Neither has valid date - keep original order
      });
    }

    return sorted;
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
      console.error("aPARAtus: Failed to archive item", error);
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
