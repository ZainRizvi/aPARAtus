/**
 * Folder operations for the aPARAtus plugin.
 * These functions interact with the Obsidian vault to manage folders.
 */

import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";

/**
 * Ensure a folder exists, creating it and any parent directories if necessary.
 * Handles deeply nested paths by recursively creating parents.
 *
 * @param app - The Obsidian App instance
 * @param folderPath - Path to the folder to ensure exists
 * @throws If an intermediate path exists as a file rather than a folder.
 */
export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  const normalizedPath = normalizePath(folderPath);
  const folder = app.vault.getAbstractFileByPath(normalizedPath);

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
    const parentFile = app.vault.getAbstractFileByPath(parentPath);

    if (!parentFile) {
      // Parent doesn't exist - create it
      await app.vault.createFolder(parentPath);
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
 * Get all existing child paths in a folder.
 *
 * @param app - The Obsidian App instance
 * @param folderPath - Path to the folder to list
 * @returns Set of normalized paths for all children
 */
export function getExistingPaths(app: App, folderPath: string): Set<string> {
  const paths = new Set<string>();
  const folder = app.vault.getAbstractFileByPath(folderPath);

  if (folder instanceof TFolder) {
    for (const child of folder.children) {
      paths.add(normalizePath(child.path));
    }
  }

  return paths;
}

/**
 * Focus the file explorer on a folder.
 * Best-effort: logs errors but doesn't throw since this is a UX enhancement.
 *
 * @param app - The Obsidian App instance
 * @param folderPath - Path to the folder to focus on
 *
 * WARNING: Uses undocumented internal Obsidian API (revealInFolder).
 * Tested on Obsidian 1.7.x. May break in future versions.
 */
export async function focusFolder(app: App, folderPath: string): Promise<void> {
  const normalizedPath = normalizePath(folderPath);
  const folder = app.vault.getAbstractFileByPath(normalizedPath);

  if (!folder) {
    return;
  }

  try {
    // Get the file explorer leaf
    const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
    if (!fileExplorer) {
      return;
    }

    // INTERNAL API: revealInFolder is not in Obsidian's public type definitions
    // This is a best-effort feature - operations succeed even if this fails
    const fileExplorerView = fileExplorer.view as {
      revealInFolder?: (file: TAbstractFile) => void;
    };

    if (typeof fileExplorerView.revealInFolder === "function") {
      fileExplorerView.revealInFolder(folder as TAbstractFile);
    }
  } catch {
    // Best-effort UX enhancement - silent failure is acceptable here
    // unlike core operations (archiving) which show Notice to user
  }
}

/**
 * Get the maximum mtime (modification time) among all files in a folder and its subfolders.
 * Used for calculating the "last modified" time of a project folder.
 *
 * @param folder - The folder to scan
 * @returns The maximum mtime in milliseconds, or 0 if folder has no files
 */
export function getFolderLastModifiedTime(folder: TFolder): number {
  let maxMtime = 0;

  const traverse = (f: TFolder): void => {
    for (const child of f.children) {
      if (child instanceof TFolder) {
        traverse(child);
      } else {
        // child must be a TFile (already verified by the if check above)
        const file = child as TFile;
        if (typeof file.stat?.mtime === "number") {
          maxMtime = Math.max(maxMtime, file.stat.mtime);
        }
      }
    }
  };

  traverse(folder);
  return maxMtime;
}

