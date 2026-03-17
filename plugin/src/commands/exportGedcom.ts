import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { loadPeople } from "../loader";
import { buildGedcom } from "../gedcom";
import type ArborPlugin from "../main";
import { resolveTargetFolder } from "./newPerson";

// ── Export modal ──────────────────────────────────────────────────────────────

class ExportGedcomModal extends Modal {
  private filename = "family.ged";

  constructor(
    app: App,
    private personCount: number,
    private onExport: (filename: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Export Tree as GEDCOM" });
    contentEl.createEl("p", {
      text: `${this.personCount} people found`,
      attr: { style: "color: var(--text-muted); font-size: 12px; margin: 0 0 12px;" },
    });

    new Setting(contentEl)
      .setName("Output filename")
      .setDesc("Saved to your vault root. The .ged extension will be added if missing.")
      .addText(text => {
        text.setValue(this.filename)
          .onChange(value => { this.filename = value.trim(); });
        text.inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter") { e.preventDefault(); this.submit(); }
        });
        setTimeout(() => text.inputEl.focus(), 50);
      });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Export")
        .setCta()
        .onClick(() => this.submit()),
      );
  }

  private submit(): void {
    if (!this.filename) {
      new Notice("Arbor: please enter a filename.");
      return;
    }
    this.onExport(this.filename);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── Command registration ──────────────────────────────────────────────────────

export function registerExportGedcomCommand(plugin: ArborPlugin): void {
  plugin.addCommand({
    id: "export-gedcom",
    name: "Export Tree as GEDCOM",
    callback: async () => {
      const folder = await resolveTargetFolder(plugin.app);
      if (folder === null) return;

      const byName = loadPeople(plugin.app, folder);
      const count  = Object.keys(byName).length;
      if (count === 0) {
        new Notice("Arbor: no person notes found.");
        return;
      }

      new ExportGedcomModal(plugin.app, count, async (filename) => {
        try {
          const path   = filename.endsWith(".ged") ? filename : filename + ".ged";
          const gedcom = buildGedcom(byName, path);

          const existing = plugin.app.vault.getAbstractFileByPath(path);
          if (existing instanceof TFile) {
            await plugin.app.vault.modify(existing, gedcom);
          } else {
            await plugin.app.vault.create(path, gedcom);
          }
          new Notice(`Arbor: exported ${count} people to ${path}`);
        } catch (err) {
          new Notice(`Arbor: GEDCOM export failed — ${err}`);
        }
      }).open();
    },
  });
}
