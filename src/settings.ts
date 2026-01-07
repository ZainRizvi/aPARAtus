import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TextComponent, TFile, TFolder } from "obsidian";
import type ParaManagerPlugin from "./main";
import { validateParaFolderPath, type ParaFolderField } from "./utils";
import { ensureFolderExists } from "./folder-ops";
import type { FileExplorerView } from "./obsidian-internals";

/** Default folder for storing templates */
const DEFAULT_TEMPLATES_FOLDER = "Templates";

/**
 * Generate a default template for a PARA item type.
 * Creates a basic starter template with the item type and description.
 */
function generateDefaultTemplate(itemType: "Project" | "Area" | "Resource"): string {
  const descriptions: Record<string, string> = {
    Project: `# {{name}}

A project is a series of tasks linked to a goal, with a deadline.

## Status
- [ ] In Progress

## Goals
-

## Tasks
-

## Notes
- `,
    Area: `# {{name}}

An area is a sphere of activity with a standard to maintain over time.

## Responsibilities
-

## Standards
-

## Notes
- `,
    Resource: `# {{name}}

A resource is a topic or tool you want to reference in the future.

## Overview
-

## Key Points
-

## Related Resources
- `,
  };

  return descriptions[itemType] || `# {{name}}\n`;
}

/**
 * Handle the "Generate Default" button click for template settings.
 * Creates a default template file, updates the corresponding setting, and refreshes the UI.
 *
 * @param plugin - The ParaManagerPlugin instance
 * @param itemType - The PARA item type (Project, Area, or Resource)
 * @param settingsKey - The settings key to update (projectTemplatePath, areaTemplatePath, or resourceTemplatePath)
 * @param refreshDisplay - Function to refresh the settings display UI
 */
async function generateDefaultTemplateHandler(
  plugin: ParaManagerPlugin,
  itemType: "Project" | "Area" | "Resource",
  settingsKey: "projectTemplatePath" | "areaTemplatePath" | "resourceTemplatePath",
  refreshDisplay: () => void
): Promise<void> {
  const defaultContent = generateDefaultTemplate(itemType);
  await ensureFolderExists(plugin.app, DEFAULT_TEMPLATES_FOLDER);
  const templatePath = `${DEFAULT_TEMPLATES_FOLDER}/${itemType}.md`;

  // Check if template already exists
  const existing = plugin.app.vault.getAbstractFileByPath(templatePath);
  if (existing) {
    new Notice("Template already exists at " + templatePath);
    return;
  }

  try {
    await plugin.app.vault.create(templatePath, defaultContent);
    plugin.settings[settingsKey] = templatePath;
    await plugin.saveSettings();
    refreshDisplay(); // Refresh UI
    new Notice(`Created ${itemType.toLowerCase()} template at ${templatePath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    new Notice("Failed to create template: " + message);
  }
}

/**
 * Provides folder autocomplete suggestions for text inputs.
 * Uses Obsidian's AbstractInputSuggest to show a dropdown of matching folders.
 */
class FolderInputSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  getSuggestions(inputStr: string): TFolder[] {
    const folders = this.app.vault.getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder);

    if (!inputStr) return folders;

    const lowerInput = inputStr.toLowerCase();
    return folders.filter(folder =>
      folder.path.toLowerCase().includes(lowerInput)
    );
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.close();
  }
}

export interface ParaManagerSettings {
  projectsPath: string;
  areasPath: string;
  resourcesPath: string;
  archivePath: string;
  focusAfterArchive: boolean;
  confirmBeforeArchive: boolean;
  projectFolderFormat: string;
  projectTemplatePath: string;
  areaTemplatePath: string;
  resourceTemplatePath: string;
  projectSortOrder: "disabled" | "lastModified" | "datePrefix";
}

export const DEFAULT_SETTINGS: ParaManagerSettings = {
  projectsPath: "Projects",
  areasPath: "Areas",
  resourcesPath: "Resources",
  archivePath: "Archive",
  focusAfterArchive: true,
  confirmBeforeArchive: false,
  projectFolderFormat: "YYYY-MM-DD {{name}}",
  projectTemplatePath: "",
  areaTemplatePath: "",
  resourceTemplatePath: "",
  projectSortOrder: "disabled",
};

/** Default values for each folder field */
const FOLDER_DEFAULTS: Record<ParaFolderField, string> = {
  projectsPath: "Projects",
  areasPath: "Areas",
  resourcesPath: "Resources",
  archivePath: "Archive",
};

/** CSS class for invalid input styling */
const INVALID_INPUT_CLASS = "aparatus-invalid-input";
/** CSS class for warning input styling */
const WARNING_INPUT_CLASS = "aparatus-warning-input";

/**
 * Set up a template file path input with autocomplete for markdown files.
 * Shows warning if file doesn't exist (it will be created).
 */
function setupTemplatePathInput(
  setting: Setting,
  text: TextComponent,
  plugin: ParaManagerPlugin,
  onSave: (path: string) => Promise<void>
): void {
  const inputEl = text.inputEl;

  // Create a custom suggest for markdown files
  class FileInputSuggest extends AbstractInputSuggest<TFile> {
    constructor(app: App, inputEl: HTMLInputElement) {
      super(app, inputEl);
    }

    getSuggestions(inputStr: string): TFile[] {
      const files = plugin.app.vault.getAllLoadedFiles()
        .filter((f): f is TFile => {
          return f instanceof TFile && f.name.endsWith(".md");
        });

      if (!inputStr) return files.slice(0, 50); // Limit suggestions

      const lowerInput = inputStr.toLowerCase();
      return files.filter(file =>
        file.path.toLowerCase().includes(lowerInput)
      ).slice(0, 20);
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
      el.setText(file.path);
    }

    selectSuggestion(file: TFile): void {
      this.setValue(file.path);
      this.close();
    }
  }

  new FileInputSuggest(plugin.app, inputEl);

  // Create warning element (hidden by default)
  const warningEl = document.createElement("div");
  warningEl.classList.add("aparatus-inline-message", "aparatus-hidden", "aparatus-text-muted");
  setting.settingEl.insertAdjacentElement("afterend", warningEl);

  /**
   * Update warning state based on file existence.
   * Shows warning if file doesn't exist (will be created).
   */
  const updateWarningState = (path: string): void => {
    if (!path.trim()) {
      warningEl.classList.add("aparatus-hidden");
      return;
    }

    const file = plugin.app.vault.getAbstractFileByPath(path);
    if (!file) {
      warningEl.textContent = `Template file "${path}" does not exist (will use default template)`;
      warningEl.classList.remove("aparatus-hidden");
    } else {
      warningEl.classList.add("aparatus-hidden");
    }
  };

  // Validate and save on blur
  inputEl.addEventListener("blur", async () => {
    const value = text.getValue().trim();
    updateWarningState(value);
    await onSave(value);
  });

  // Initial warning state
  setTimeout(() => updateWarningState(text.getValue()), 0);
}

/**
 * Set up a folder path text input with blur-based validation.
 * Validates on blur (not on every keystroke) and shows visual feedback for errors.
 * Shows inline warning below the setting if folder doesn't exist.
 */
function setupFolderPathInput(
  setting: Setting,
  text: TextComponent,
  field: ParaFolderField,
  plugin: ParaManagerPlugin
): void {
  const inputEl = text.inputEl;

  // Attach folder autocomplete suggestions
  new FolderInputSuggest(plugin.app, inputEl);

  // Create warning element (hidden by default)
  const warningEl = document.createElement("div");
  warningEl.classList.add("aparatus-inline-message", "aparatus-hidden", "aparatus-text-warning");
  setting.settingEl.insertAdjacentElement("afterend", warningEl);

  /**
   * Update warning state based on folder existence.
   * Shows yellow styling and warning text if folder doesn't exist.
   */
  const updateWarningState = (path: string): void => {
    const folder = plugin.app.vault.getAbstractFileByPath(path);
    if (!folder) {
      // Show warning state
      inputEl.classList.add(WARNING_INPUT_CLASS);
      warningEl.textContent = `Folder "${path}" does not exist (will be created automatically)`;
      warningEl.classList.remove("aparatus-hidden");
    } else {
      // Clear warning state
      inputEl.classList.remove(WARNING_INPUT_CLASS);
      warningEl.classList.add("aparatus-hidden");
    }
  };

  text
    .setPlaceholder(FOLDER_DEFAULTS[field])
    .setValue(plugin.settings[field]);

  // Check initial state (deferred to avoid blocking settings render)
  setTimeout(() => updateWarningState(plugin.settings[field]), 0);

  // Validate and save on blur (when user leaves the field)
  inputEl.addEventListener("blur", async () => {
    const value = text.getValue();
    const normalized = value.trim().replace(/\/+$/, "") || FOLDER_DEFAULTS[field];

    const error = validateParaFolderPath(normalized, field, plugin.settings);

    if (error) {
      // Show error state (red - more severe than warning)
      inputEl.classList.add(INVALID_INPUT_CLASS);
      inputEl.classList.remove(WARNING_INPUT_CLASS);
      warningEl.textContent = error;
      warningEl.classList.remove("aparatus-text-warning");
      warningEl.classList.add("aparatus-text-error");
      warningEl.classList.remove("aparatus-hidden");
      // Revert to last valid value
      text.setValue(plugin.settings[field]);
      // Clear error styling after reverting and check warning state
      setTimeout(() => {
        inputEl.classList.remove(INVALID_INPUT_CLASS);
        warningEl.classList.remove("aparatus-text-error");
        warningEl.classList.add("aparatus-text-warning");
        updateWarningState(plugin.settings[field]);
      }, 100);
    } else {
      // Clear error state
      inputEl.classList.remove(INVALID_INPUT_CLASS);
      // Check folder existence (updates warning state)
      updateWarningState(normalized);
      // Save
      plugin.settings[field] = normalized;
      await plugin.saveSettings();
    }
  });
}

export class ParaManagerSettingTab extends PluginSettingTab {
  plugin: ParaManagerPlugin;

  constructor(app: App, plugin: ParaManagerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Create settings first, then add text inputs
    // (can't reference setting variable inside its own initialization chain)
    const projectsSetting = new Setting(containerEl)
      .setName("Projects folder")
      .setDesc("Path to your Projects folder (top-level project folders live here)");
    projectsSetting.addText((text) => setupFolderPathInput(projectsSetting, text, "projectsPath", this.plugin));

    const areasSetting = new Setting(containerEl)
      .setName("Areas folder")
      .setDesc("Path to your Areas folder (top-level area folders live here)");
    areasSetting.addText((text) => setupFolderPathInput(areasSetting, text, "areasPath", this.plugin));

    const resourcesSetting = new Setting(containerEl)
      .setName("Resources folder")
      .setDesc("Path to your Resources folder (top-level resource folders live here)");
    resourcesSetting.addText((text) => setupFolderPathInput(resourcesSetting, text, "resourcesPath", this.plugin));

    const archiveSetting = new Setting(containerEl)
      .setName("Archive folder")
      .setDesc("Path where archived items will be moved");
    archiveSetting.addText((text) => setupFolderPathInput(archiveSetting, text, "archivePath", this.plugin));

    // Project folder format with live preview
    const formatSetting = new Setting(containerEl)
      .setName("Project folder format");

    // Add description with link to Moment.js docs
    const descEl = document.createDocumentFragment();
    descEl.appendText("Use {{name}} for project name. Supports ");
    const link = document.createElement("a");
    link.href = "https://momentjs.com/docs/#/displaying/format/";
    link.textContent = "Moment.js tokens";
    link.setAttr("target", "_blank");
    descEl.appendChild(link);
    descEl.appendText(": YYYY, MM, DD, etc.");
    formatSetting.setDesc(descEl);

    // Create preview element (will be added below the setting)
    const previewEl = document.createElement("div");
    previewEl.classList.add("aparatus-inline-message", "aparatus-text-muted");

    formatSetting.addText((text) => {
      const inputEl = text.inputEl;

      // Update preview with current format
      const updatePreview = (format: string): boolean => {
        const isValid = format.includes("{{name}}");

        if (isValid) {
          // Format sample name using Moment.js
          const sampleName = "My Project";
          const now = window.moment();
          const escaped = format.replace(/\{\{name\}\}/g, `[${sampleName}]`);
          const result = now.format(escaped);
          previewEl.textContent = `Preview: ${result}`;
          previewEl.classList.remove("aparatus-text-error");
          previewEl.classList.add("aparatus-text-muted");
          inputEl.classList.remove(INVALID_INPUT_CLASS);
        } else {
          previewEl.textContent = "Format must contain {{name}}";
          previewEl.classList.remove("aparatus-text-muted");
          previewEl.classList.add("aparatus-text-error");
          inputEl.classList.add(INVALID_INPUT_CLASS);
        }

        return isValid;
      };

      text
        .setPlaceholder("YYYY-MM-DD {{name}}")
        .setValue(this.plugin.settings.projectFolderFormat);

      // Initial preview
      updatePreview(this.plugin.settings.projectFolderFormat);

      // Live update on input
      inputEl.addEventListener("input", () => {
        const value = text.getValue().trim() || DEFAULT_SETTINGS.projectFolderFormat;
        updatePreview(value);
      });

      // Save on blur if valid
      inputEl.addEventListener("blur", async () => {
        const value = text.getValue().trim() || DEFAULT_SETTINGS.projectFolderFormat;
        if (updatePreview(value)) {
          this.plugin.settings.projectFolderFormat = value;
          await this.plugin.saveSettings();
        } else {
          // Revert to last valid value
          text.setValue(this.plugin.settings.projectFolderFormat);
          updatePreview(this.plugin.settings.projectFolderFormat);
        }
      });
    });

    // Insert preview below the setting
    formatSetting.settingEl.insertAdjacentElement("afterend", previewEl);

    new Setting(containerEl)
      .setName("Focus source folder after archive")
      .setDesc("Return focus to the source folder (Projects, Areas, or Resources) after archiving")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.focusAfterArchive)
          .onChange(async (value) => {
            this.plugin.settings.focusAfterArchive = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Confirm before archiving")
      .setDesc("Show a confirmation dialog before archiving a project")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.confirmBeforeArchive)
          .onChange(async (value) => {
            this.plugin.settings.confirmBeforeArchive = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Project folder sort order")
      .setDesc("How to sort projects in the Projects folder")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("disabled", "Alphabetical (Obsidian default)")
          .addOption("lastModified", "Last modified (newest first)")
          .addOption("datePrefix", "Date prefix (newer first)")
          .setValue(this.plugin.settings.projectSortOrder)
          .onChange(async (value) => {
            this.plugin.settings.projectSortOrder = value as "disabled" | "lastModified" | "datePrefix";
            await this.plugin.saveSettings();

            // Re-install patch (needed when switching from disabled to enabled)
            // and trigger re-sort
            this.plugin.installSortingPatch();
            const fileExplorer = this.plugin.app.workspace.getLeavesOfType("file-explorer")[0];
            if (fileExplorer) {
              (fileExplorer.view as FileExplorerView).requestSort?.();
            }
          })
      );

    // Template settings header
    new Setting(containerEl).setHeading().setName("Templates");

    // Project template
    const projectTemplateSetting = new Setting(containerEl)
      .setName("Project template")
      .setDesc("Template file to apply when creating new projects (optional)");

    projectTemplateSetting.addText((text) => {
      setupTemplatePathInput(
        projectTemplateSetting,
        text,
        this.plugin,
        async (value) => {
          this.plugin.settings.projectTemplatePath = value;
          await this.plugin.saveSettings();
        }
      );
      text.setValue(this.plugin.settings.projectTemplatePath);
    });

    projectTemplateSetting.addButton((button) =>
      button
        .setButtonText("Generate Default")
        .onClick(async () => {
          await generateDefaultTemplateHandler(
            this.plugin,
            "Project",
            "projectTemplatePath",
            () => this.display()
          );
        })
    );

    // Area template
    const areaTemplateSetting = new Setting(containerEl)
      .setName("Area template")
      .setDesc("Template file to apply when creating new areas (optional)");

    areaTemplateSetting.addText((text) => {
      setupTemplatePathInput(
        areaTemplateSetting,
        text,
        this.plugin,
        async (value) => {
          this.plugin.settings.areaTemplatePath = value;
          await this.plugin.saveSettings();
        }
      );
      text.setValue(this.plugin.settings.areaTemplatePath);
    });

    areaTemplateSetting.addButton((button) =>
      button
        .setButtonText("Generate Default")
        .onClick(async () => {
          await generateDefaultTemplateHandler(
            this.plugin,
            "Area",
            "areaTemplatePath",
            () => this.display()
          );
        })
    );

    // Resource template
    const resourceTemplateSetting = new Setting(containerEl)
      .setName("Resource template")
      .setDesc("Template file to apply when creating new resources (optional)");

    resourceTemplateSetting.addText((text) => {
      setupTemplatePathInput(
        resourceTemplateSetting,
        text,
        this.plugin,
        async (value) => {
          this.plugin.settings.resourceTemplatePath = value;
          await this.plugin.saveSettings();
        }
      );
      text.setValue(this.plugin.settings.resourceTemplatePath);
    });

    resourceTemplateSetting.addButton((button) =>
      button
        .setButtonText("Generate Default")
        .onClick(async () => {
          await generateDefaultTemplateHandler(
            this.plugin,
            "Resource",
            "resourceTemplatePath",
            () => this.display()
          );
        })
    );
  }
}
