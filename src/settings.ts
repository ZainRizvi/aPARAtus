import { AbstractInputSuggest, App, PluginSettingTab, Setting, TextComponent, TFolder } from "obsidian";
import type ParaManagerPlugin from "./main";
import { isNestedPath } from "./utils";

/**
 * Provides folder autocomplete suggestions for text inputs.
 * Uses Obsidian's AbstractInputSuggest to show a dropdown of matching folders.
 */
class FolderInputSuggest extends AbstractInputSuggest<TFolder> {
  private textInputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.textInputEl = inputEl;
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
    this.textInputEl.value = folder.path;
    this.textInputEl.dispatchEvent(new Event("input", { bubbles: true }));
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
}

export const DEFAULT_SETTINGS: ParaManagerSettings = {
  projectsPath: "Projects",
  areasPath: "Areas",
  resourcesPath: "Resources",
  archivePath: "Archive",
  focusAfterArchive: true,
  confirmBeforeArchive: false,
  projectFolderFormat: "YYYY-MM-DD {{name}}",
};

/** PARA folder field names for validation */
type ParaFolderField = "projectsPath" | "areasPath" | "resourcesPath" | "archivePath";

/** Human-readable names for PARA folders */
const FOLDER_NAMES: Record<ParaFolderField, string> = {
  projectsPath: "Projects",
  areasPath: "Areas",
  resourcesPath: "Resources",
  archivePath: "Archive",
};

/** Default values for each folder field */
const FOLDER_DEFAULTS: Record<ParaFolderField, string> = {
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
function validateParaFolderPath(
  newPath: string,
  field: ParaFolderField,
  settings: ParaManagerSettings
): string | null {
  const allFields: ParaFolderField[] = ["projectsPath", "areasPath", "resourcesPath", "archivePath"];
  const otherFields = allFields.filter((f) => f !== field);

  for (const otherField of otherFields) {
    const otherPath = settings[otherField];
    const otherName = FOLDER_NAMES[otherField];
    const thisName = FOLDER_NAMES[field];

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

/** CSS class for invalid input styling */
const INVALID_INPUT_CLASS = "para-manager-invalid-input";
/** CSS class for warning input styling */
const WARNING_INPUT_CLASS = "para-manager-warning-input";

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
  warningEl.style.marginTop = "-8px";
  warningEl.style.marginBottom = "16px";
  warningEl.style.fontSize = "var(--font-ui-smaller)";
  warningEl.style.color = "var(--color-yellow)";
  warningEl.style.display = "none";
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
      inputEl.style.borderColor = "var(--color-yellow)";
      inputEl.style.backgroundColor = "rgba(var(--color-yellow-rgb), 0.1)";
      warningEl.textContent = `Folder "${path}" does not exist (will be created automatically)`;
      warningEl.style.display = "block";
    } else {
      // Clear warning state
      inputEl.classList.remove(WARNING_INPUT_CLASS);
      inputEl.style.borderColor = "";
      inputEl.style.backgroundColor = "";
      warningEl.style.display = "none";
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
      inputEl.style.borderColor = "var(--text-error)";
      inputEl.style.backgroundColor = "rgba(var(--color-red-rgb), 0.1)";
      warningEl.textContent = error;
      warningEl.style.color = "var(--text-error)";
      warningEl.style.display = "block";
      // Revert to last valid value
      text.setValue(plugin.settings[field]);
      // Clear error styling after reverting and check warning state
      setTimeout(() => {
        inputEl.classList.remove(INVALID_INPUT_CLASS);
        inputEl.style.borderColor = "";
        inputEl.style.backgroundColor = "";
        warningEl.style.color = "var(--color-yellow)";
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
    previewEl.style.marginTop = "-8px";
    previewEl.style.marginBottom = "16px";
    previewEl.style.fontSize = "var(--font-ui-smaller)";
    previewEl.style.color = "var(--text-muted)";

    formatSetting.addText((text) => {
      const inputEl = text.inputEl;

      // Update preview with current format
      const updatePreview = (format: string): boolean => {
        const isValid = format.includes("{{name}}");

        if (isValid) {
          // Format sample name using Moment.js
          const sampleName = "My Project";
          const now = (window as any).moment();
          const escaped = format.replace(/\{\{name\}\}/g, `[${sampleName}]`);
          const result = now.format(escaped);
          previewEl.textContent = `Preview: ${result}`;
          previewEl.style.color = "var(--text-muted)";
          inputEl.style.borderColor = "";
        } else {
          previewEl.textContent = "Format must contain {{name}}";
          previewEl.style.color = "var(--text-error)";
          inputEl.style.borderColor = "var(--text-error)";
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
  }
}
