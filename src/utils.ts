/**
 * Pure utility functions for the aPARAtus plugin.
 * These functions have no Obsidian dependencies and are fully testable.
 */

/** PARA folder field names for validation */
export type ParaFolderField = "projectsPath" | "areasPath" | "resourcesPath" | "archivePath";

/** PARA manager settings structure (minimal interface for validation) */
export interface ParaSettings {
  projectsPath: string;
  areasPath: string;
  resourcesPath: string;
  archivePath: string;
}

/** Maximum collision attempts before throwing an error */
const MAX_COLLISION_ATTEMPTS = 1000;

/**
 * Check if one path is nested within another (parent-child relationship).
 * Returns true if path1 is a parent of path2 OR path2 is a parent of path1.
 *
 * Examples:
 * - "Work" and "Work/Projects" → true (Work is parent of Work/Projects)
 * - "Projects/Archive" and "Projects" → true (Projects is parent of Projects/Archive)
 * - "Projects" and "Archive" → false (neither is parent of other)
 * - "Projects" and "Projects" → true (same path is considered nested)
 *
 * @param path1 - First path to compare
 * @param path2 - Second path to compare
 * @returns true if the paths have a parent-child relationship
 */
export function isNestedPath(path1: string, path2: string): boolean {
  const normalized1 = normalizePathPure(path1);
  const normalized2 = normalizePathPure(path2);

  // Same path is considered nested
  if (normalized1 === normalized2) {
    return true;
  }

  // Check if path1 is parent of path2
  if (normalized2.startsWith(normalized1 + "/")) {
    return true;
  }

  // Check if path2 is parent of path1
  if (normalized1.startsWith(normalized2 + "/")) {
    return true;
  }

  return false;
}

/**
 * Validate that all paths in the array are non-nested with each other.
 * Returns an error message if any paths are nested, null if all paths are valid.
 *
 * @param paths - Array of paths to validate
 * @returns Error message string if paths are nested, null if all paths are non-nested
 */
export function arePathsNested(paths: string[]): string | null {
  // Check every combination of paths
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (isNestedPath(paths[i], paths[j])) {
        const path1 = normalizePathPure(paths[i]);
        const path2 = normalizePathPure(paths[j]);
        return `PARA folders cannot be nested: "${path1}" and "${path2}"`;
      }
    }
  }
  return null;
}

/**
 * Normalize a path by trimming leading/trailing slashes and collapsing multiple slashes.
 *
 * IMPORTANT: This must behave identically to Obsidian's normalizePath() for common cases.
 * The plugin uses both: Obsidian's for API calls, this for pure/testable logic.
 * If these diverge (e.g., unicode handling, special chars), path comparisons may fail.
 *
 * Current alignment verified: trim slashes, collapse multiples, backslash conversion.
 */
export function normalizePathPure(path: string): string {
  return path
    .replace(/\\/g, "/") // Convert backslashes to forward slashes
    .replace(/\/+/g, "/") // Collapse multiple slashes
    .replace(/^\/+/, "") // Trim leading slashes
    .replace(/\/+$/, ""); // Trim trailing slashes
}

/**
 * Get the parent folder path from a full path.
 * Returns empty string if there's no parent (root level).
 */
export function getParentPath(folderPath: string): string {
  const normalized = normalizePathPure(folderPath);
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) {
    return "";
  }
  return normalized.substring(0, lastSlash);
}

/**
 * Check if a folder is a direct child of the projects path.
 *
 * Note: Applies normalizePathPure internally. Callers using Obsidian's normalizePath
 * should still work correctly as both normalizers align for standard path formats.
 */
export function isTopLevelProjectFolder(
  folderPath: string,
  projectsPath: string
): boolean {
  const normalizedFolder = normalizePathPure(folderPath);
  const normalizedProjects = normalizePathPure(projectsPath);

  // The folder's parent must exactly match the projects path
  const parent = getParentPath(normalizedFolder);
  return parent === normalizedProjects;
}

/**
 * Get the item name (file or folder) from a path.
 */
export function getItemName(folderPath: string): string {
  const normalized = normalizePathPure(folderPath);
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) {
    return normalized;
  }
  return normalized.substring(lastSlash + 1);
}

/**
 * Generate a destination path for archiving.
 * If the base destination exists, generates alternatives with date suffix and counters.
 *
 * @param archivePath - The archive folder path (e.g., "Archive")
 * @param folderName - The name of the folder being archived
 * @param existingPaths - Set of existing paths to check for collisions
 * @returns The first available destination path
 */
export function generateArchiveDestination(
  archivePath: string,
  folderName: string,
  existingPaths: Set<string>
): string {
  const normalizedArchive = normalizePathPure(archivePath);
  const baseDest = `${normalizedArchive}/${folderName}`;

  // First try: just the folder name
  if (!existingPaths.has(baseDest)) {
    return baseDest;
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];

  // Second try: folder name with date
  const dateDest = `${normalizedArchive}/${folderName} (Archived ${dateStr})`;
  if (!existingPaths.has(dateDest)) {
    return dateDest;
  }

  // Subsequent tries: add counter
  let counter = 2;
  while (true) {
    const counterDest = `${normalizedArchive}/${folderName} (Archived ${dateStr}) (${counter})`;
    if (!existingPaths.has(counterDest)) {
      return counterDest;
    }
    counter++;
    // Safety valve to prevent infinite loops
    if (counter > MAX_COLLISION_ATTEMPTS) {
      throw new Error("Too many archive collisions - please clean up your archive folder");
    }
  }
}

/** Human-readable display names for PARA folders (used in error messages) */
const FOLDER_DISPLAY_NAMES: Record<ParaFolderField, string> = {
  projectsPath: "Projects",
  areasPath: "Areas",
  resourcesPath: "Resources",
  archivePath: "Archive",
};

/**
 * Validate a PARA folder path against all other PARA paths.
 * Checks for equality and nesting conflicts.
 *
 * @param newPath - The normalized new path value
 * @param field - Which field is being changed
 * @param settings - Current settings to validate against
 * @returns Error message if invalid, null if valid
 */
export function validateParaFolderPath(
  newPath: string,
  field: ParaFolderField,
  settings: ParaSettings
): string | null {
  const allFields: ParaFolderField[] = ["projectsPath", "areasPath", "resourcesPath", "archivePath"];
  const otherFields = allFields.filter((f) => f !== field);

  for (const otherField of otherFields) {
    const otherPath = settings[otherField];
    const otherName = FOLDER_DISPLAY_NAMES[otherField];
    const thisName = FOLDER_DISPLAY_NAMES[field];

    // Check equality
    if (newPath === otherPath) {
      return `${thisName} folder cannot be the same as ${otherName} folder`;
    }

    // Check nesting
    if (isNestedPath(newPath, otherPath)) {
      return `${thisName} folder cannot be nested with ${otherName} folder`;
    }
  }

  return null;
}

/**
 * Extract the date format portion from projectFolderFormat setting.
 * Removes the {{name}} placeholder and returns just the date format part.
 *
 * @param projectFolderFormat - The full format string (e.g., "YYMMDD - {{name}}")
 * @returns The date format portion (e.g., "YYMMDD - ")
 */
export function extractDateFormatFromProjectFormat(projectFolderFormat: string): string {
  // Remove {{name}} and everything after it to get the date prefix format
  const nameIndex = projectFolderFormat.indexOf("{{name}}");
  if (nameIndex === -1) {
    return projectFolderFormat;
  }
  return projectFolderFormat.substring(0, nameIndex);
}

/**
 * Comparator for sorting project folders by last modified time (newest first).
 * Returns negative if a's mtime is newer, positive if b's mtime is newer, 0 if equal.
 *
 * @param a - First folder data with mtime
 * @param b - Second folder data with mtime
 * @returns Comparison result for sort
 */
export function compareByLastModified(a: { mtime: number }, b: { mtime: number }): number {
  return b.mtime - a.mtime; // Descending order (newest first)
}

