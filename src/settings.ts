import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ArchiveProjectPlugin from "./main";

export interface ArchiveProjectSettings {
  projectsPath: string;
  archivePath: string;
  focusAfterArchive: boolean;
  confirmBeforeArchive: boolean;
}

export const DEFAULT_SETTINGS: ArchiveProjectSettings = {
  projectsPath: "Projects",
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
            this.plugin.settings.projectsPath = normalized;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Archive folder")
      .setDesc("Path where archived projects will be moved")
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
            this.plugin.settings.archivePath = normalized;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Focus Projects folder after archive")
      .setDesc("Return focus to the Projects folder in the file explorer after archiving")
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
