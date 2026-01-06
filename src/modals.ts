/**
 * Modal dialogs for the PARA Manager plugin.
 */

import { App, Modal } from "obsidian";

/**
 * Confirmation modal for archiving an item.
 * Shows the item name and destination path, with confirm/cancel buttons.
 */
export class ArchiveConfirmModal extends Modal {
  private itemName: string;
  private destPath: string;
  private onConfirm: () => void;
  private onCancel: () => void;
  private confirmed = false;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    app: App,
    itemName: string,
    destPath: string,
    onConfirm: () => void,
    onCancel: () => void
  ) {
    super(app);
    this.itemName = itemName;
    this.destPath = destPath;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Archive Item?" });
    contentEl.createEl("p", { text: `Move "${this.itemName}" to:` });
    contentEl.createEl("p", { text: this.destPath, cls: "archive-dest-path" });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const confirmBtn = buttonContainer.createEl("button", { text: "Archive", cls: "mod-cta" });
    confirmBtn.addEventListener("click", () => {
      this.confirmed = true;
      this.onConfirm();
      this.close();
    });

    // Focus confirm button for keyboard users
    confirmBtn.focus();

    // Handle Enter key to confirm
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        this.confirmed = true;
        this.onConfirm();
        this.close();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    };
    contentEl.addEventListener("keydown", this.keydownHandler);
  }

  onClose() {
    const { contentEl } = this;
    if (this.keydownHandler) {
      contentEl.removeEventListener("keydown", this.keydownHandler);
    }
    contentEl.empty();
    if (!this.confirmed) {
      this.onCancel();
    }
  }
}

/**
 * Modal for entering a name (used for creating Projects, Areas, Resources).
 * Shows a text input with Enter to submit.
 */
export class NameInputModal extends Modal {
  private title: string;
  private placeholder: string;
  private onSubmit: (name: string) => void;

  constructor(
    app: App,
    title: string,
    placeholder: string,
    onSubmit: (name: string) => void
  ) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: this.title });

    const input = contentEl.createEl("input", {
      type: "text",
      placeholder: this.placeholder,
    });
    input.style.width = "100%";
    input.style.marginBottom = "1em";
    input.focus();

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const submitBtn = buttonContainer.createEl("button", { text: "Create", cls: "mod-cta" });
    submitBtn.addEventListener("click", () => {
      const value = input.value.trim();
      if (value) {
        this.onSubmit(value);
        this.close();
      }
    });

    // Handle keyboard
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        const value = input.value.trim();
        if (value) {
          this.onSubmit(value);
          this.close();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
