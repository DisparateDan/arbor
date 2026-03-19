import { App } from "obsidian";
import { GenderIndex, NameIndex, PersonPage } from "./types";

// ── Data loading ──────────────────────────────────────────────────────────
// Plugin replacement for the DataviewJS loadPeople() call.
// Uses app.vault + app.metadataCache instead of dv.pages().

/** Load all person notes from `folder`. Returns a plain dict keyed by file stem. */
export function loadPeople(app: App, folder: string): Record<string, PersonPage> {
  const byName: Record<string, PersonPage> = {};
  const prefix = folder.endsWith("/") ? folder : folder + "/";
  for (const file of app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(prefix)) continue;
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.ar_type === "person") {
      byName[file.basename] = {
        file: { name: file.basename, path: file.path },
        ...cache.frontmatter,
      } as PersonPage;
    }
  }
  return byName;
}

/** Build forward + reverse display-name lookup tables from a byName dict. */
export function buildNameIndex(byName: Record<string, PersonPage>): NameIndex {
  const stemToDisplay: Record<string, string> = {};
  const displayToStem: Record<string, string> = {};
  for (const [stem, page] of Object.entries(byName)) {
    const display = ((page.first_names || "") + " " + (page.family_name || "")).trim() || stem;
    stemToDisplay[stem] = display;
    displayToStem[display] = stem; // last writer wins on collision — acceptable edge case
  }
  return { stemToDisplay, displayToStem };
}

/** Build a stem → "m"|"f"|"u" gender map from a byName dict. */
export function buildGenderIndex(byName: Record<string, PersonPage>): GenderIndex {
  const gender: GenderIndex = {};
  for (const [name, page] of Object.entries(byName)) {
    const s = String(page?.sex || "").toLowerCase().trim();
    gender[name] = s === "male" ? "m" : s === "female" ? "f" : "u";
  }
  return gender;
}

