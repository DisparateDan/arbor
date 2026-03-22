import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile } from "obsidian";
import type ArborPlugin from "../main";

// ── Suffix helpers ────────────────────────────────────────────────────────────

function randomSuffix(length = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function uniqueSuffix(existingStems: Set<string>, base: string, length = 4): string {
  for (let i = 0; i < 1000; i++) {
    const suffix = randomSuffix(length);
    if (!existingStems.has(`${base}_${suffix}`)) return suffix;
  }
  throw new Error(`Could not generate a unique suffix for '${base}' after 1000 attempts`);
}

// ── Note template ─────────────────────────────────────────────────────────────

function makePersonNote(first: string, family: string): string {
  return [
    "---",
    "ar_type: person",
    `first_names: ${first}`,
    `family_name: ${family}`,
    "sex:",
    "DOB:",
    "DOD:",
    "birthplace:",
    "married: []",
    "father:",
    "mother:",
    "---",
    "",
  ].join("\n");
}

// ── Core creation logic (reusable by bulk import) ─────────────────────────────

export async function createPersonNote(
  app: App,
  folder: string,
  first: string,
  family: string,
): Promise<TFile> {
  const fullName = [first, family].filter(Boolean).join(" ");
  const existingStems = new Set(
    app.vault.getMarkdownFiles()
      .filter(f => (f.parent?.path ?? "") === folder)
      .map(f => f.basename),
  );
  const suffix = uniqueSuffix(existingStems, fullName);
  const stem = `${fullName}_${suffix}`;
  const path = folder ? `${folder}/${stem}.md` : `${stem}.md`;
  return await app.vault.create(path, makePersonNote(first, family));
}

// ── Folder detection ──────────────────────────────────────────────────────────

function findPersonFolders(app: App): string[] {
  const folders = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.ar_type === "person") {
      folders.add(file.parent?.path ?? "");
    }
  }
  return [...folders].sort();
}

export async function resolveTargetFolder(app: App): Promise<string | null> {
  // Prefer the folder of the currently active person note.
  const active = app.workspace.getActiveFile();
  if (active) {
    const cache = app.metadataCache.getFileCache(active);
    if (cache?.frontmatter?.ar_type === "person") {
      return active.parent?.path ?? "";
    }
  }

  const folders = findPersonFolders(app);

  if (folders.length === 0) {
    new Notice("Arbor: no person notes found in vault. Create a person note manually first.");
    return null;
  }

  if (folders.length === 1) return folders[0];

  // Multiple trees — ask the user to pick.
  return new Promise(resolve => new FolderPickerModal(app, folders, resolve).open());
}

// ── Folder picker (multi-tree vaults) ────────────────────────────────────────

class FolderPickerModal extends FuzzySuggestModal<string> {
  private selected: string | null = null;

  constructor(
    app: App,
    private folders: string[],
    private onPick: (folder: string | null) => void,
  ) {
    super(app);
    this.setPlaceholder("Choose a family tree folder…");
  }

  getItems(): string[] { return this.folders; }
  getItemText(item: string): string { return item; }

  onChooseItem(item: string): void {
    this.selected = item;
  }

  onClose(): void {
    // Obsidian calls close() before onChooseItem; defer so the selection is set first.
    setTimeout(() => this.onPick(this.selected), 0);
  }
}

// ── New Person modal ──────────────────────────────────────────────────────────

class NewPersonModal extends Modal {
  private first = "";
  private family = "";

  constructor(
    app: App,
    private folder: string,
    private onSubmit: (first: string, family: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Create person note" });
    contentEl.createEl("p", {
      text: `Folder: ${this.folder || "(vault root)"}`,
      attr: { style: "color: var(--text-muted); font-size: 12px; margin: 0 0 12px;" },
    });

    let firstInput: HTMLInputElement;
    let familyInput: HTMLInputElement;

    new Setting(contentEl)
      .setName("First name(s)")
      .addText(text => {
        firstInput = text.inputEl;
        text.setPlaceholder("John William")
          .onChange(value => { this.first = value.trim(); });
      });

    new Setting(contentEl)
      .setName("Family name")
      .addText(text => {
        familyInput = text.inputEl;
        text.setPlaceholder("Smith")
          .onChange(value => { this.family = value.trim(); });
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Create")
        .setCta()
        .onClick(() => this.submit()),
      );

    // Keyboard shortcuts: Enter advances field, Enter on last field submits.
    firstInput!.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); familyInput.focus(); }
    });
    familyInput!.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); this.submit(); }
    });

    firstInput!.focus();
  }

  private submit(): void {
    if (!this.first && !this.family) {
      new Notice("Arbor: please enter at least a first name or family name.");
      return;
    }
    this.onSubmit(this.first, this.family);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── Command registration ──────────────────────────────────────────────────────

export function registerNewPersonCommand(plugin: ArborPlugin): void {
  plugin.addCommand({
    id: "create-person-note",
    name: "Create person note",
    callback: async () => {
      const folder = await resolveTargetFolder(plugin.app);
      if (folder === null) return;

      new NewPersonModal(plugin.app, folder, (first, family) => {
        void (async () => {
          try {
            const file = await createPersonNote(plugin.app, folder, first, family);
            new Notice(`Arbor: created ${file.basename}`);
            await plugin.app.workspace.getLeaf(false).openFile(file);
          } catch (err) {
            new Notice(`Arbor: failed to create note — ${err}`);
          }
        })();
      }).open();
    },
  });
}
