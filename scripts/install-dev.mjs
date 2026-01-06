#!/usr/bin/env node
/**
 * Development installation script for the Archive Project plugin.
 *
 * Usage:
 *   npm run install:dev
 *   npm run install:dev -- --vault "/path/to/vault"
 *
 * Copies built artifacts to the specified Obsidian vault's plugin directory.
 */

import { copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Default vault path - override with OBSIDIAN_TEST_VAULT env var
const DEFAULT_VAULT = process.env.OBSIDIAN_TEST_VAULT || "/Users/zain/test/PluginDev/TEST_Vault";
const PLUGIN_ID = "para-manager";

// Files to copy
const FILES_TO_COPY = ["manifest.json", "main.js"];
const OPTIONAL_FILES = ["styles.css"];

function parseArgs() {
  const args = process.argv.slice(2);
  let vaultPath = DEFAULT_VAULT;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--vault" && args[i + 1]) {
      vaultPath = args[i + 1];
      i++;
    }
  }

  return { vaultPath };
}

async function main() {
  const { vaultPath } = parseArgs();
  const pluginDir = join(vaultPath, ".obsidian", "plugins", PLUGIN_ID);

  console.log(`Installing plugin to: ${pluginDir}`);

  // Ensure plugin directory exists
  if (!existsSync(pluginDir)) {
    await mkdir(pluginDir, { recursive: true });
    console.log("Created plugin directory");
  }

  // Copy required files
  for (const file of FILES_TO_COPY) {
    const src = join(projectRoot, file);
    const dest = join(pluginDir, file);

    if (!existsSync(src)) {
      console.error(`Error: Required file not found: ${src}`);
      console.error("Did you run 'npm run build' first?");
      process.exit(1);
    }

    await copyFile(src, dest);
    console.log(`Copied: ${file}`);
  }

  // Copy optional files if they exist
  for (const file of OPTIONAL_FILES) {
    const src = join(projectRoot, file);
    const dest = join(pluginDir, file);

    if (existsSync(src)) {
      await copyFile(src, dest);
      console.log(`Copied: ${file}`);
    }
  }

  console.log("\nInstallation complete!");
  console.log(`Plugin installed to: ${pluginDir}`);
  console.log("\nNext steps in Obsidian:");
  console.log("1. Open Settings > Community plugins");
  console.log("2. Enable 'Archive Project' plugin");
  console.log("3. Reload Obsidian (Cmd+R / Ctrl+R) if needed");
}

main().catch((err) => {
  console.error("Installation failed:", err.message);
  process.exit(1);
});
