// ── Pure GEDCOM helpers ───────────────────────────────────────────────────────
// No Obsidian dependencies — safe to import in tests.

import { resolveName, resolveList } from "./tree";
import type { PersonPage } from "./types";

export const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export function formatGedcomDate(val: unknown): string | null {
  if (!val) return null;

  // Dataview date object
  if (typeof val === "object" && val !== null && "year" in val) {
    const d = val as { year?: number; month?: number; day?: number };
    if (!d.year) return null;
    if (d.month && d.day) return `${String(d.day).padStart(2, "0")} ${MONTHS[d.month - 1]} ${d.year}`;
    if (d.month)           return `${MONTHS[d.month - 1]} ${d.year}`;
    return String(d.year);
  }

  let s = String(val).trim();
  let prefix = "";
  const approx = s.match(/^([~c]+\.?)\s*/);
  if (approx) {
    prefix = "ABT ";
    s = s.slice(approx[0].length);
  }

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return prefix + `${d} ${MONTHS[parseInt(mo) - 1]} ${y}`;
  }

  // YYYY-MM
  m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const [, y, mo] = m;
    return prefix + `${MONTHS[parseInt(mo) - 1]} ${y}`;
  }

  // Plain year
  m = s.match(/^(\d{3,4})$/);
  if (m) return prefix + m[1];

  return prefix + s || null;
}

export function sexToGedcom(val: unknown): string {
  const s = String(val ?? "").trim().toLowerCase();
  if (s === "male")   return "M";
  if (s === "female") return "F";
  return "U";
}

export function gedLine(level: number, tag: string, value = ""): string {
  return value ? `${level} ${tag} ${value}` : `${level} ${tag}`;
}

// ── Family building ───────────────────────────────────────────────────────────

export interface Family {
  husband: string | null;
  wife:    string | null;
  children: string[];
}

export function buildFamilies(byName: Record<string, PersonPage>): Family[] {
  const famMap = new Map<string, string[]>();

  const key = (f: string | null, m: string | null) => `${f ?? ""}|||${m ?? ""}`;

  for (const [name, page] of Object.entries(byName)) {
    const f = resolveName(page.father);
    const m = resolveName(page.mother);
    if (f || m) {
      const k = key(f, m);
      if (!famMap.has(k)) famMap.set(k, []);
      famMap.get(k)!.push(name);
    }
  }

  // Also capture marriages that may have no children yet
  for (const [name, page] of Object.entries(byName)) {
    const spouses = resolveList(page.married);
    const sex = sexToGedcom(page.sex);
    for (const sp of spouses) {
      let k: string;
      if (sex === "M")      k = key(name, sp);
      else if (sex === "F") k = key(sp, name);
      else                  k = key(...([name, sp].sort() as [string, string]));
      if (!famMap.has(k)) famMap.set(k, []);
    }
  }

  return Array.from(famMap.entries()).map(([k, children]) => {
    const [husband, wife] = k.split("|||");
    return { husband: husband || null, wife: wife || null, children };
  });
}

// ── GEDCOM builder ────────────────────────────────────────────────────────────

export function buildGedcom(byName: Record<string, PersonPage>, filename: string): string {
  const sortedNames = Object.keys(byName).sort();
  const personIds: Record<string, string> = {};
  sortedNames.forEach((name, i) => { personIds[name] = `I${String(i + 1).padStart(4, "0")}`; });

  const families = buildFamilies(byName);
  const familyIds: string[] = families.map((_, i) => `F${String(i + 1).padStart(4, "0")}`);

  const spouseFams: Record<string, string[]> = {};
  const childFams:  Record<string, string[]> = {};
  families.forEach((fam, i) => {
    const fid = familyIds[i];
    if (fam.husband) (spouseFams[fam.husband] ??= []).push(fid);
    if (fam.wife)    (spouseFams[fam.wife]    ??= []).push(fid);
    for (const child of fam.children) (childFams[child] ??= []).push(fid);
  });

  const now   = new Date();
  const day   = String(now.getDate()).padStart(2, "0");
  const month = MONTHS[now.getMonth()];
  const year  = now.getFullYear();
  const time  = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

  const lines: string[] = [
    gedLine(0, "HEAD"),
    gedLine(1, "SOUR", "ArborPlugin"),
    gedLine(2, "NAME", "Arbor Family Tree Plugin"),
    gedLine(1, "DATE", `${day} ${month} ${year}`),
    gedLine(2, "TIME", time),
    gedLine(1, "FILE", filename),
    gedLine(1, "GEDC"),
    gedLine(2, "VERS", "5.5.1"),
    gedLine(2, "FORM", "LINEAGE-LINKED"),
    gedLine(1, "CHAR", "UTF-8"),
  ];

  // Individual records
  for (const name of sortedNames) {
    const page  = byName[name];
    const xref  = personIds[name];
    const first = String(page.first_names ?? "").trim();
    const last  = String(page.family_name ?? "").trim();
    const fullName = last ? `${first} /${last}/` : first;

    lines.push(gedLine(0, `@${xref}@`, "INDI"));
    lines.push(gedLine(1, "NAME", fullName));
    if (first) lines.push(gedLine(2, "GIVN", first));
    if (last)  lines.push(gedLine(2, "SURN", last));

    lines.push(gedLine(1, "SEX", sexToGedcom(page.sex)));

    const dob        = formatGedcomDate(page.DOB);
    const birthplace = String(page.birthplace ?? "").trim();
    if (dob || birthplace) {
      lines.push(gedLine(1, "BIRT"));
      if (dob)        lines.push(gedLine(2, "DATE", dob));
      if (birthplace) lines.push(gedLine(2, "PLAC", birthplace));
    }

    const dod = formatGedcomDate(page.DOD);
    if (dod) {
      lines.push(gedLine(1, "DEAT"));
      lines.push(gedLine(2, "DATE", dod));
    }

    for (const fid of spouseFams[name] ?? []) lines.push(gedLine(1, "FAMS", `@${fid}@`));
    for (const fid of childFams[name]  ?? []) lines.push(gedLine(1, "FAMC", `@${fid}@`));
  }

  // Family records
  families.forEach((fam, i) => {
    const fid = familyIds[i];
    lines.push(gedLine(0, `@${fid}@`, "FAM"));
    if (fam.husband && personIds[fam.husband]) lines.push(gedLine(1, "HUSB", `@${personIds[fam.husband]}@`));
    if (fam.wife    && personIds[fam.wife])    lines.push(gedLine(1, "WIFE", `@${personIds[fam.wife]}@`));
    for (const child of fam.children) {
      if (personIds[child]) lines.push(gedLine(1, "CHIL", `@${personIds[child]}@`));
    }
  });

  lines.push(gedLine(0, "TRLR"));
  return lines.join("\n") + "\n";
}
