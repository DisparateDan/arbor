import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile } from "obsidian";
import { HTML_BUNDLE } from "../htmlBundle";
import { loadPeople, buildNameIndex } from "../loader";
import { resolveName, resolveList, getYear } from "../tree";
import type ArborPlugin from "../main";
import { resolveTargetFolder } from "./newPerson";
import type { PersonPage } from "../types";

// ── Data serialisation ────────────────────────────────────────────────────────
// Converts vault PersonPage objects (may contain Dataview objects, wikilinks)
// into plain JSON-serialisable objects for embedding in the HTML export.

interface PlainPerson {
  first_names: string;
  family_name: string;
  sex: string;
  DOB: string;
  DOD: string;
  father: string | null;
  mother: string | null;
  married: string[];
}

function serialisePeople(byName: Record<string, PersonPage>): Record<string, PlainPerson> {
  const result: Record<string, PlainPerson> = {};
  for (const [stem, page] of Object.entries(byName)) {
    result[stem] = {
      first_names: String(page.first_names ?? ""),
      family_name: String(page.family_name ?? ""),
      sex:         String(page.sex ?? "").toLowerCase().trim(),
      DOB:         getYear(page.DOB),
      DOD:         getYear(page.DOD),
      father:      resolveName(page.father),
      mother:      resolveName(page.mother),
      married:     resolveList(page.married),
    };
  }
  return result;
}

// ── HTML assembly ─────────────────────────────────────────────────────────────

function buildHtml(people: Record<string, PlainPerson>, rootStem: string, title: string): string {
  const peopleJson = JSON.stringify(people, null, 2);
  const rootJson   = JSON.stringify(rootStem);
  const titleEsc   = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleEsc}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --font-interface: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  body { font-family: var(--font-interface); height: 100vh; display: flex; flex-direction: column; }
  #arbor-toolbar { flex-shrink: 0; }
  #arbor-tree { flex: 1; overflow: auto; padding: 20px; }
  svg .person-card { cursor: pointer; }
  svg .person-card rect { transition: filter 0.15s; }
  svg .person-card:hover rect { filter: brightness(1.15); }
</style>
</head>
<body>
<div id="arbor-toolbar"></div>
<div id="arbor-tree"></div>
<script>
const ARBOR_PEOPLE = ${peopleJson};
const ARBOR_ROOT   = ${rootJson};
</script>
<script>${HTML_BUNDLE}</script>
</body>
</html>`;
}

// ── Root person resolution ────────────────────────────────────────────────────

async function resolveRootPerson(app: App, byName: Record<string, PersonPage>): Promise<string | null> {
  const active = app.workspace.getActiveFile();
  if (active && byName[active.basename]) return active.basename;

  const { stemToDisplay } = buildNameIndex(byName);
  const stems = Object.keys(byName).sort((a, b) =>
    (stemToDisplay[a] || a).localeCompare(stemToDisplay[b] || b)
  );
  if (stems.length === 0) return null;

  return new Promise(resolve => new RootPersonModal(app, stems, stemToDisplay, resolve).open());
}

class RootPersonModal extends FuzzySuggestModal<string> {
  private chosen = false;

  constructor(
    app: App,
    private stems: string[],
    private stemToDisplay: Record<string, string>,
    private onPick: (stem: string | null) => void,
  ) {
    super(app);
    this.setPlaceholder("Choose the root person for the export…");
  }

  getItems(): string[] { return this.stems; }
  getItemText(stem: string): string { return this.stemToDisplay[stem] || stem; }

  onChooseItem(stem: string): void {
    this.chosen = true;
    this.onPick(stem);
  }

  onClose(): void {
    if (!this.chosen) this.onPick(null);
  }
}

// ── Export modal ──────────────────────────────────────────────────────────────

class ExportModal extends Modal {
  private filename = "family-tree.html";

  constructor(
    app: App,
    private rootDisplayName: string,
    private onExport: (filename: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Export Tree as HTML" });
    contentEl.createEl("p", {
      text: `Root: ${this.rootDisplayName}`,
      attr: { style: "color: var(--text-muted); font-size: 12px; margin: 0 0 12px;" },
    });

    new Setting(contentEl)
      .setName("Output filename")
      .setDesc("Saved to your vault root. The .html extension will be added if missing.")
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

export function registerExportHtmlCommand(plugin: ArborPlugin): void {
  plugin.addCommand({
    id: "export-tree-html",
    name: "Export Tree as HTML",
    callback: async () => {
      const folder = await resolveTargetFolder(plugin.app);
      if (folder === null) return;

      const byName = loadPeople(plugin.app, folder);
      if (Object.keys(byName).length === 0) {
        new Notice("Arbor: no person notes found.");
        return;
      }

      const rootStem = await resolveRootPerson(plugin.app, byName);
      if (!rootStem) return;

      const { stemToDisplay } = buildNameIndex(byName);
      const rootDisplayName = stemToDisplay[rootStem] || rootStem;

      new ExportModal(plugin.app, rootDisplayName, async (filename) => {
        try {
          const path = filename.endsWith(".html") ? filename : filename + ".html";
          const people = serialisePeople(byName);
          const html   = buildHtml(people, rootStem, rootDisplayName);

          const existing = plugin.app.vault.getAbstractFileByPath(path);
          if (existing instanceof TFile) {
            await plugin.app.vault.modify(existing, html);
          } else {
            await plugin.app.vault.create(path, html);
          }
          new Notice(`Arbor: exported to ${path}`);
        } catch (err) {
          new Notice(`Arbor: export failed — ${err}`);
        }
      }).open();
    },
  });
}
