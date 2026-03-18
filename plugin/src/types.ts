// ── Obsidian frontmatter shape for a person note ──────────────────────────
export interface PersonPage {
  file: { name: string; path: string };
  ar_type?: string;
  first_names?: string;
  family_name?: string;
  sex?: string;
  DOB?: string | number | DateObject;
  DOD?: string | number | DateObject;
  birthplace?: string;
  married?: WikiLink | WikiLink[] | string | string[];
  father?: WikiLink | string;
  mother?: WikiLink | string;
  [key: string]: unknown;
}

interface DateObject {
  year: number;
  month?: number;
  day?: number;
}

interface WikiLink {
  path: string;
}

// ── Tree data structures ────────────────────────────────────────────────
export type UnitDir = "root" | "anc" | "desc" | "sibling";

export interface Unit {
  id: string;
  members: string[];
  gen: number;
  dir: UnitDir;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface Edge {
  fromUnit: string;
  toUnit: string;
  toName: string;
  sibling: boolean;
}

export interface PersonEntry {
  name: string;
  page: PersonPage | null;
  unitId: string;
}

export interface TreeResult {
  units: Record<string, Unit>;
  people: Record<string, PersonEntry>;
  edges: Edge[];
  bloodLine: Set<string>;
}

// ── Index types ─────────────────────────────────────────────────────────
export interface NameIndex {
  stemToDisplay: Record<string, string>;
  displayToStem: Record<string, string>;
}

export type GenderIndex = Record<string, "m" | "f" | "u">;

// ── Theme ────────────────────────────────────────────────────────────────
export interface Theme {
  containerBorder: string;
  edge: string;
  edgeSib: string;
  edgePalette: string[];
  spouseLine: string;
  rootBorder: string;
  text: string;
  textRoot: string;
  textSib: string;
  dates: string;
  maleFill: string;
  maleBorder: string;
  femaleFill: string;
  femaleBorder: string;
  unknownFill: string;
  unknownBorder: string;
  sibFill: string;
  sibBorder: string;
  toolbarBg: string;
  toolbarBorder: string;
  btnBg: string;
  btnBorder: string;
  btnColor: string;
  toggleLabel: string;
  bodyBg?: string;
}

export type ThemeKey = "dark" | "light";
export type LayoutMode = "horizontal" | "vertical";

// ── Plugin settings ──────────────────────────────────────────────────────
// rootPerson and vaultFolder are derived from the active file at runtime.
// This interface is reserved for future user preferences (theme, etc.).
export interface ArborSettings {
  arborSchemaVersion: number;
  [key: string]: unknown;
}
