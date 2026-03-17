import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile } from "obsidian";
import type ArborPlugin from "../main";
import { resolveTargetFolder, uniqueSuffix } from "./newPerson";

// ── CSV template ──────────────────────────────────────────────────────────────

const TEMPLATE_FILENAME = "arbor-import-template.csv";

const TEMPLATE_CONTENT = [
  "first_names,family_name,sex,DOB,DOD,birthplace,married,father,mother",
  "John William,Smith,male,1923,,London,,Thomas Smith,Mary Jones",
  "Mary,Jones,female,~1925,2001-03-15,Manchester,Thomas Smith,,",
  "Thomas,Smith,male,c.1900,1965,,,,,",
].join("\n") + "\n";

async function saveTemplate(app: App): Promise<void> {
  const existing = app.vault.getAbstractFileByPath(TEMPLATE_FILENAME);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, TEMPLATE_CONTENT);
  } else {
    await app.vault.create(TEMPLATE_FILENAME, TEMPLATE_CONTENT);
  }
  new Notice(`Arbor: template saved to ${TEMPLATE_FILENAME} in your vault`);
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  });
}

function splitList(value: string): string[] {
  if (!value) return [];
  return value.split(/[;|]/).map(v => v.trim()).filter(Boolean);
}

// ── Note rendering ────────────────────────────────────────────────────────────

function renderNote(
  first: string, family: string,
  sex: string, dob: string, dod: string, birthplace: string,
  marriedStems: string[], fatherStem: string, motherStem: string,
): string {
  const lines = [
    "---",
    "ar_type: person",
    `first_names: ${first}`,
    `family_name: ${family}`,
    `sex: ${sex}`,
    `DOB: ${dob}`,
    `DOD: ${dod}`,
    `birthplace: ${birthplace}`,
  ];
  if (marriedStems.length > 0) {
    lines.push("married:");
    marriedStems.forEach(s => lines.push(`  - "[[${s}]]"`));
  } else {
    lines.push("married: []");
  }
  lines.push(`father: ${fatherStem ? `"[[${fatherStem}]]"` : ""}`);
  lines.push(`mother: ${motherStem ? `"[[${motherStem}]]"` : ""}`);
  lines.push("---", "");
  return lines.join("\n");
}

function renderStub(first: string, family: string): string {
  return renderNote(first, family, "", "", "", "", [], "", "");
}

// ── Name helpers ──────────────────────────────────────────────────────────────

function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ""];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

// ── Import logic ──────────────────────────────────────────────────────────────

interface ImportResult {
  created: number;
  stubs: number;
  skipped: number;
}

async function runImport(
  app: App,
  csvFile: TFile,
  folder: string,
  dryRun = false,
): Promise<ImportResult> {
  // Read and parse CSV
  const raw = await app.vault.read(csvFile);
  const rows = parseCSV(raw);

  if (rows.length === 0) throw new Error("CSV is empty or has no data rows.");

  const missing = ["first_names", "family_name"].filter(col => !(col in rows[0]));
  if (missing.length > 0) throw new Error(`CSV is missing required column(s): ${missing.join(", ")}`);

  // Build name→stem map from existing vault notes
  const nameToStem: Record<string, string> = {};
  const stemsSet = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    if ((file.parent?.path ?? "") !== folder) continue;
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (fm?.ar_type !== "person") continue;
    const name = [fm.first_names, fm.family_name].filter(Boolean).join(" ").trim();
    if (name) nameToStem[name] = file.basename;
    stemsSet.add(file.basename);
  }

  // Collect every name mentioned (direct rows + relationship columns)
  const allNames = new Set<string>();
  for (const row of rows) {
    const name = [row.first_names, row.family_name].filter(Boolean).join(" ").trim();
    if (name) allNames.add(name);
    for (const col of ["father", "mother"]) {
      const v = row[col]?.trim();
      if (v) allNames.add(v);
    }
    for (const spouse of splitList(row.married ?? "")) allNames.add(spouse);
  }

  // Assign stems for any name not already in the vault
  for (const name of [...allNames].sort()) {
    if (nameToStem[name]) continue;
    const suffix = uniqueSuffix(stemsSet, name);
    const stem = `${name}_${suffix}`;
    nameToStem[name] = stem;
    stemsSet.add(stem);
  }

  const csvNames = new Set(
    rows.map(r => [r.first_names, r.family_name].filter(Boolean).join(" ").trim()).filter(Boolean)
  );
  const relationOnlyNames = [...allNames].filter(n => !csvNames.has(n));

  let created = 0, stubs = 0, skipped = 0;

  // Write stubs for relation-only names
  for (const name of relationOnlyNames) {
    const stem = nameToStem[name];
    const path = folder ? `${folder}/${stem}.md` : `${stem}.md`;
    if (app.vault.getAbstractFileByPath(path)) { skipped++; continue; }
    if (!dryRun) {
      const [first, family] = splitName(name);
      await app.vault.create(path, renderStub(first, family));
    }
    stubs++;
  }

  // Write full notes for CSV rows
  for (const row of rows) {
    const name = [row.first_names, row.family_name].filter(Boolean).join(" ").trim();
    if (!name) continue;
    const stem = nameToStem[name];
    const path = folder ? `${folder}/${stem}.md` : `${stem}.md`;
    if (app.vault.getAbstractFileByPath(path)) { skipped++; continue; }

    if (!dryRun) {
      const marriedStems = splitList(row.married ?? "")
        .map(n => nameToStem[n]).filter(Boolean);
      const fatherStem = nameToStem[row.father?.trim() ?? ""] ?? "";
      const motherStem = nameToStem[row.mother?.trim() ?? ""] ?? "";
      await app.vault.create(path, renderNote(
        row.first_names, row.family_name,
        row.sex ?? "", row.DOB ?? "", row.DOD ?? "", row.birthplace ?? "",
        marriedStems, fatherStem, motherStem,
      ));
    }
    created++;
  }

  return { created, stubs, skipped };
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

class ConfirmImportModal extends Modal {
  constructor(
    app: App,
    private preview: ImportResult,
    private onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Confirm Import" });

    const { created, stubs, skipped } = this.preview;
    const rows = [
      ["Notes to create", String(created)],
      ["Stub notes to create", String(stubs)],
      ["Already exist (will skip)", String(skipped)],
    ];
    const table = contentEl.createEl("table", {
      attr: { style: "width:100%; border-collapse:collapse; margin-bottom:16px;" }
    });
    for (const [label, value] of rows) {
      const tr = table.createEl("tr");
      tr.createEl("td", { text: label, attr: { style: "padding:4px 8px; color:var(--text-muted);" } });
      tr.createEl("td", { text: value, attr: { style: "padding:4px 8px; font-weight:600; text-align:right;" } });
    }

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Cancel")
        .onClick(() => this.close()),
      )
      .addButton(btn => btn
        .setButtonText("Import")
        .setCta()
        .onClick(() => { this.onConfirm(); this.close(); }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── CSV picker ────────────────────────────────────────────────────────────────

class CsvPickerModal extends FuzzySuggestModal<TFile> {
  private chosen = false;

  constructor(
    app: App,
    private onPick: (file: TFile | null) => void,
  ) {
    super(app);
    this.setPlaceholder("Choose a CSV file from your vault…");
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter(f => f.extension === "csv");
  }

  getItemText(file: TFile): string { return file.path; }

  onChooseItem(file: TFile): void {
    this.chosen = true;
    this.onPick(file);
  }

  onClose(): void {
    if (!this.chosen) this.onPick(null);
  }
}

// ── Intro modal ───────────────────────────────────────────────────────────────

class BulkImportModal extends Modal {
  constructor(
    app: App,
    private folder: string,
    private onChooseFile: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Import People from CSV" });
    contentEl.createEl("p", {
      text: `Folder: ${this.folder || "(vault root)"}`,
      attr: { style: "color: var(--text-muted); font-size: 12px; margin: 0 0 12px;" },
    });
    contentEl.createEl("p", {
      text: "The CSV must be saved inside your vault. Download the template, fill it in, then choose the file.",
      attr: { style: "font-size: 13px; margin-bottom: 16px;" },
    });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText("Download CSV Template")
        .onClick(async () => { await saveTemplate(this.app); }),
      )
      .addButton(btn => btn
        .setButtonText("Choose CSV File")
        .setCta()
        .onClick(() => { this.close(); this.onChooseFile(); }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── Command registration ──────────────────────────────────────────────────────

export function registerBulkImportCommand(plugin: ArborPlugin): void {
  plugin.addCommand({
    id: "import-people-from-csv",
    name: "Import People from CSV",
    callback: async () => {
      const folder = await resolveTargetFolder(plugin.app);
      if (folder === null) return;

      const openPicker = () => new CsvPickerModal(plugin.app, async (csvFile) => {
        if (!csvFile) return;
        try {
          const preview = await runImport(plugin.app, csvFile, folder, true);
          new ConfirmImportModal(plugin.app, preview, async () => {
            try {
              const { created, stubs, skipped } = await runImport(plugin.app, csvFile, folder);
              new Notice(
                `Arbor: import complete — ${created} created, ${stubs} stub(s), ${skipped} skipped`
              );
            } catch (err) {
              new Notice(`Arbor: import failed — ${err}`);
            }
          }).open();
        } catch (err) {
          new Notice(`Arbor: import failed — ${err}`);
        }
      }).open();

      new BulkImportModal(plugin.app, folder, openPicker).open();
    },
  });
}
