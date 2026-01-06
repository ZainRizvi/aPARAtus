/**
 * Pure utility functions for the Archive Project plugin.
 * These functions have no Obsidian dependencies and are fully testable.
 */

/** Maximum collision attempts before throwing an error */
const MAX_COLLISION_ATTEMPTS = 1000;

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
