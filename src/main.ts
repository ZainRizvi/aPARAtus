import { Notice, Plugin, TFolder, normalizePath } from "obsidian";
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

export default class ArchiveProjectPlugin extends Plugin {
  settings: ArchiveProjectSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new ArchiveProjectSettingTab(this.app, this));

    // Register context menu item for file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        // Only show for folders
        if (!(file instanceof TFolder)) {
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
            .onClick(() => this.archiveFolder(file));
        });
      })
    );
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Archive a folder by moving it to the archive path.
   */
  async archiveFolder(folder: TFolder): Promise<void> {
    const archivePath = normalizePath(this.settings.archivePath);
    const folderName = getFolderName(folder.path);

    try {
      // Ensure archive folder exists
      await this.ensureFolderExists(archivePath);

      // Get all existing folders in archive to check for collisions
      const existingPaths = this.getExistingArchivePaths(archivePath);

      // Generate unique destination path
      const destPath = generateArchiveDestination(
        archivePath,
        folderName,
        existingPaths
      );

      // Move the folder
      await this.app.vault.rename(folder, destPath);

      new Notice(`Archived "${folderName}" to ${destPath}`);

      // Focus back on projects folder if enabled
      if (this.settings.focusAfterArchive) {
        await this.focusProjectsFolder();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to archive "${folderName}": ${message}`);
      console.error("Archive Project: Failed to archive folder", error);
    }
  }

  /**
   * Ensure a folder exists, creating it if necessary.
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
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
   * Best-effort: silently fails if the folder or view doesn't exist.
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

      // Reveal the folder in the file explorer
      // Using the internal API - may need adjustment for different Obsidian versions
      const fileExplorerView = fileExplorer.view as {
        revealInFolder?: (file: TFolder) => void;
      };

      if (typeof fileExplorerView.revealInFolder === "function") {
        fileExplorerView.revealInFolder(projectsFolder as TFolder);
      }
    } catch {
      // Silently fail - this is best-effort functionality
    }
  }
}
