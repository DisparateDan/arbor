import { App, Modal, Notice, Setting } from "obsidian";
import type ArborPlugin from "../main";
import { loadPeople, buildNameIndex } from "../loader";
import { resolveTargetFolder } from "./newPerson";
import { serializeCSV } from "../csvUtils";
import type { PersonPage } from "../types";

// ── Wikilink / DateObject helpers ─────────────────────────────────────────────

function extractStem(val: unknown): string {
  if (!val) return "";
  if (typeof val === "object" && "path" in (val as object))
    return String((val as { path: string }).path);
  return String(val).replace(/^\[\[|\]\]$/g, "");
}

function fmtDateField(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return val;
  if (typeof val === "object" && "year" in (val as object)) {
    const d = val as { year: number; month?: number; day?: number };
    if (d.month && d.day)
      return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    return String(d.year);
  }
  return String(val);
}

// ── Serialise one person to a CSV row ─────────────────────────────────────────

const HEADERS = [
  "first_names", "family_name", "sex",
  "DOB", "DOD", "birthplace",
  "married", "father", "mother",
];

function personToRow(
  p: PersonPage,
  stemToDisplay: Record<string, string>,
): (string | string[])[] {
  const resolve = (v: unknown) => {
    const stem = extractStem(v);
    return stem ? (stemToDisplay[stem] ?? stem) : "";
  };

  const marriedRaw = Array.isArray(p.married)
    ? p.married
    : p.married ? [p.married] : [];
  const marriedNames = marriedRaw.map(resolve).filter(Boolean);

  return [
    String(p.first_names ?? ""),
    String(p.family_name ?? ""),
    String(p.sex ?? ""),
    fmtDateField(p.DOB),
    fmtDateField(p.DOD),
    String(p.birthplace ?? ""),
    marriedNames,           // string[] → pipe-joined by serializeCSV
    resolve(p.father),
    resolve(p.mother),
  ];
}

// ── Modal ─────────────────────────────────────────────────────────────────────

class ExportCsvModal extends Modal {
  private filename = "arbor-export.csv";

  constructor(app: App, private plugin: ArborPlugin) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Export people to CSV" });

    new Setting(contentEl)
      .setName("Filename")
      .setDesc("Saved to vault root")
      .addText(t => t
        .setValue(this.filename)
        .onChange(v => { this.filename = v.trim(); }),
      );

    new Setting(contentEl)
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton(b => b.setButtonText("Export").setCta().onClick(() => void this.run()));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async run(): Promise<void> {
    const folder = await resolveTargetFolder(this.plugin.app);
    if (folder === null) return;

    const people = loadPeople(this.plugin.app, folder);
    const { stemToDisplay } = buildNameIndex(people);

    const rows = Object.values(people).map(p => personToRow(p, stemToDisplay));
    const csv = serializeCSV(HEADERS, rows);

    const filename = this.filename.endsWith(".csv") ? this.filename : this.filename + ".csv";
    const existing = this.app.vault.getFileByPath(filename);
    if (existing) {
      await this.app.vault.modify(existing, csv);
    } else {
      await this.app.vault.create(filename, csv);
    }

    new Notice(`Arbor: exported ${rows.length} people to ${filename}`);
    this.close();
  }
}

// ── Command registration ──────────────────────────────────────────────────────

export function registerExportCsvCommand(plugin: ArborPlugin): void {
  plugin.addCommand({
    id: "export-people-to-csv",
    name: "Export people to CSV",
    callback: () => new ExportCsvModal(plugin.app, plugin).open(),
  });
}
