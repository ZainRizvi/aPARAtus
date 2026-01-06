import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ArchiveProjectPlugin from "./main";
import { isNestedPath } from "./utils";

export interface ArchiveProjectSettings {
  projectsPath: string;
  areasPath: string;
  resourcesPath: string;
  archivePath: string;
  focusAfterArchive: boolean;
  confirmBeforeArchive: boolean;
}

export const DEFAULT_SETTINGS: ArchiveProjectSettings = {
  projectsPath: "Projects",
  areasPath: "Areas",
  resourcesPath: "Resources",
  archivePath: "Archive",
  focusAfterArchive: true,
  confirmBeforeArchive: false,
};

export class ArchiveProjectSettingTab extends PluginSettingTab {
  plugin: ArchiveProjectPlugin;

  constructor(app: App, plugin: ArchiveProjectPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Projects folder")
      .setDesc("Path to your Projects folder (top-level project folders live here)")
      .addText((text) =>
        text
          .setPlaceholder("Projects")
          .setValue(this.plugin.settings.projectsPath)
          .onChange(async (value) => {
            const normalized = value.trim().replace(/\/+$/, "") || "Projects";
            if (normalized === this.plugin.settings.archivePath) {
              new Notice("Projects folder cannot be the same as Archive folder");
              text.setValue(this.plugin.settings.projectsPath);
              return;
            }
            if (normalized === this.plugin.settings.areasPath) {
              new Notice("Projects folder cannot be the same as Areas folder");
              text.setValue(this.plugin.settings.projectsPath);
              return;
            }
            if (normalized === this.plugin.settings.resourcesPath) {
              new Notice("Projects folder cannot be the same as Resources folder");
              text.setValue(this.plugin.settings.projectsPath);
              return;
            }
            // Check for nested paths
            if (isNestedPath(normalized, this.plugin.settings.archivePath)) {
              new Notice("Projects folder cannot be nested with Archive folder");
              text.setValue(this.plugin.settings.projectsPath);
              return;
            }
            if (isNestedPath(normalized, this.plugin.settings.areasPath)) {
              new Notice("Projects folder cannot be nested with Areas folder");
              text.setValue(this.plugin.settings.projectsPath);
              return;
            }
            if (isNestedPath(normalized, this.plugin.settings.resourcesPath)) {
              new Notice("Projects folder cannot be nested with Resources folder");
              text.setValue(this.plugin.settings.projectsPath);
              return;
            }
            this.plugin.settings.projectsPath = normalized;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Areas folder")
      .setDesc("Path to your Areas folder (top-level area folders live here)")
      .addText((text) =>
        text
          .setPlaceholder("Areas")
          .setValue(this.plugin.settings.areasPath)
          .onChange(async (value) => {
            const normalized = value.trim().replace(/\/+$/, "") || "Areas";
            if (normalized === this.plugin.settings.archivePath) {
              new Notice("Areas folder cannot be the same as Archive folder");
              text.setValue(this.plugin.settings.areasPath);
              return;
            }
            if (normalized === this.plugin.settings.projectsPath) {
              new Notice("Areas folder cannot be the same as Projects folder");
              text.setValue(this.plugin.settings.areasPath);
              return;
            }
            if (normalized === this.plugin.settings.resourcesPath) {
              new Notice("Areas folder cannot be the same as Resources folder");
              text.setValue(this.plugin.settings.areasPath);
              return;
            }
            // Check for nested paths
            if (isNestedPath(normalized, this.plugin.settings.archivePath)) {
              new Notice("Areas folder cannot be nested with Archive folder");
              text.setValue(this.plugin.settings.areasPath);
              return;
            }
            if (isNestedPath(normalized, this.plugin.settings.projectsPath)) {
              new Notice("Areas folder cannot be nested with Projects folder");
              text.setValue(this.plugin.settings.areasPath);
              return;
            }
            if (isNestedPath(normalized, this.plugin.settings.resourcesPath)) {
              new Notice("Areas folder cannot be nested with Resources folder");
              text.setValue(this.plugin.settings.areasPath);
              return;
            }
            this.plugin.settings.areasPath = normalized;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Resources folder")
      .setDesc("Path to your Resources folder (top-level resource folders live here)")
      .addText((text) =>
        text
          .setPlaceholder("Resources")
          .setValue(this.plugin.settings.resourcesPath)
          .onChange(async (value) => {
            const normalized = value.trim().replace(/\/+$/, "") || "Resources";
            if (normalized === this.plugin.settings.archivePath) {
              new Notice("Resources folder cannot be the same as Archive folder");
              text.setValue(this.plugin.settings.resourcesPath);
              return;
            }
            if (normalized === this.plugin.settings.projectsPath) {
              new Notice("Resources folder cannot be the same as Projects folder");
              text.setValue(this.plugin.settings.resourcesPath);
              return;
            }
            if (normalized === this.plugin.settings.areasPath) {
              new Notice("Resources folder cannot be the same as Areas folder");
              text.setValue(this.plugin.settings.resourcesPath);
              return;
            }
            // Check for nested paths
            if (isNestedPath(normalized, this.plugin.settings.archivePath)) {
              new Notice("Resources folder cannot be nested with Archive folder");
              text.setValue(this.plugin.settings.resourcesPath);
              return;
            }
            if (isNestedPath(normalized, this.plugin.settings.projectsPath)) {
              new Notice("Resources folder cannot be nested with Projects folder");
              text.setValue(this.plugin.settings.resourcesPath);
              return;
            }
            if (isNestedPath(normalized, this.plugin.settings.areasPath)) {
              new Notice("Resources folder cannot be nested with Areas folder");
              text.setValue(this.plugin.settings.resourcesPath);
              return;
            }
            this.plugin.settings.resourcesPath = normalized;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Archive folder")
      .setDesc("Path where archived items will be moved")
      .addText((text) =>
        text
          .setPlaceholder("Archive")
          .setValue(this.plugin.settings.archivePath)
          .onChange(async (value) => {
            const normalized = value.trim().replace(/\/+$/, "") || "Archive";
            if (normalized === this.plugin.settings.projectsPath) {
              new Notice("Archive folder cannot be the same as Projects folder");
              text.setValue(this.plugin.settings.archivePath);
              return;
            }
            if (normalized === this.plugin.settings.areasPath) {
              new Notice("Archive folder cannot be the same as Areas folder");
              text.setValue(this.plugin.settings.archivePath);
              return;
            }
            if (normalized === this.plugin.settings.resourcesPath) {
              new Notice("Archive folder cannot be the same as Resources folder");
              text.setValue(this.plugin.settings.archivePath);
              return;
            }
            // Check for nested paths
            if (isNestedPath(normalized, this.plugin.settings.projectsPath)) {
              new Notice("Archive folder cannot be nested with Projects folder");
              text.setValue(this.plugin.settings.archivePath);
              return;
            }
            if (isNestedPath(normalized, this.plugin.settings.areasPath)) {
              new Notice("Archive folder cannot be nested with Areas folder");
              text.setValue(this.plugin.settings.archivePath);
              return;
            }
            if (isNestedPath(normalized, this.plugin.settings.resourcesPath)) {
              new Notice("Archive folder cannot be nested with Resources folder");
              text.setValue(this.plugin.settings.archivePath);
              return;
            }
            this.plugin.settings.archivePath = normalized;
            await this.plugin.saveSettings();
          })
      );

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
