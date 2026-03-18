import { SHOW_SIBLINGS, MAX_LEN } from "./constants";
import { Edge, PersonPage, TreeResult, Unit } from "./types";

// ── Pure data helpers ─────────────────────────────────────────────────────

export function resolveName(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "object" && val !== null && "path" in val) {
    const parts = (val as { path: string }).path.split("/");
    return parts[parts.length - 1].replace(/\.md$/, "");
  }
  if (typeof val !== "string" && typeof val !== "number") return null;
  const s = String(val);
  const m = s.match(/\[\[(.+?)\]\]/);
  return m ? m[1] : s;
}

export function resolveList(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(resolveName).filter((x): x is string => x !== null);
  const n = resolveName(val);
  return n ? [n] : [];
}

export function getYear(val: unknown): string {
  if (!val) return "";
  if (typeof val === "object" && val !== null && "year" in val) {
    return String((val as { year: number }).year);
  }
  if (typeof val !== "string" && typeof val !== "number") return "";
  const s = String(val).trim();
  const prefix = (s.match(/^[~c.]+/) || [""])[0];
  const digits = s.replace(/^[~c.]+/, "").slice(0, 4);
  return prefix + digits;
}

export function trunc(s: string): string {
  if (!s) return "";
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1) + "..." : s;
}

export function getNameLines(name: string, page: PersonPage | null): { first: string; last: string } {
  if (page && page.first_names !== undefined && page.family_name !== undefined) {
    return { first: String(page.first_names || ""), last: String(page.family_name || "") };
  }
  const parts = name.split(" ");
  const last = parts.pop() ?? "";
  return { first: parts.join(" "), last };
}

// ── Tree building ─────────────────────────────────────────────────────────

/** Return all vault children of `name`, sorted by DOB ascending. */
export function findChildren(name: string, byName: Record<string, PersonPage>): string[] {
  const children: string[] = [];
  for (const [cName, cPage] of Object.entries(byName)) {
    const f = resolveName(cPage?.father);
    const m = resolveName(cPage?.mother);
    if (f === name || m === name) children.push(cName);
  }
  return children.sort((a, b) => {
    const pa = byName[a];
    const pb = byName[b];
    const ya = pa?.DOB && typeof pa.DOB === "object" && "year" in pa.DOB
      ? Number(pa.DOB.year) : (typeof pa?.DOB === "object" ? 9999 : parseInt(String(pa?.DOB ?? 9999)));
    const yb = pb?.DOB && typeof pb.DOB === "object" && "year" in pb.DOB
      ? Number(pb.DOB.year) : (typeof pb?.DOB === "object" ? 9999 : parseInt(String(pb?.DOB ?? 9999)));
    return (isNaN(ya) ? 9999 : ya) - (isNaN(yb) ? 9999 : yb);
  });
}

export function buildTree(
  rootName: string,
  byName: Record<string, PersonPage>,
  siblingsBloodOnly: boolean,
): TreeResult {
  const units: Record<string, Unit> = {};
  const people: Record<string, { name: string; page: PersonPage | null; unitId: string }> = {};
  const edges: Edge[] = [];
  const visited = new Set<string>();
  const bloodLine = new Set<string>();
  let uc = 0;

  function newUnit(members: string[], gen: number, dir: Unit["dir"]): string {
    const id = "u" + uc++;
    units[id] = { id, members, gen, dir };
    for (const name of members) {
      if (!people[name]) people[name] = { name, page: byName[name] ?? null, unitId: id };
    }
    return id;
  }

  function dobYear(name: string): number {
    const p = byName[name];
    if (!p) return Infinity;
    const v = p.DOB;
    if (!v) return Infinity;
    if (typeof v === "object" && "year" in v) return parseInt(String(v.year));
    const m = String(v).replace(/^[~c. ]+/, "").match(/(\d{4})/);
    return m ? parseInt(m[1]) : Infinity;
  }

  function addAncestors(name: string, gen: number, isBlood: boolean): void {
    if (visited.has("anc-" + name)) return;
    visited.add("anc-" + name);
    if (isBlood) bloodLine.add(name);
    const p = byName[name];
    if (!p) return;
    const fName = resolveName(p.father);
    const mName = resolveName(p.mother);

    if (fName || mName) {
      const parentUid = newUnit([fName, mName].filter((x): x is string => x !== null), gen - 1, "anc");

      if (SHOW_SIBLINGS && (!siblingsBloodOnly || isBlood)) {
        const sibSet = new Set<string>();
        for (const parentName of [fName, mName].filter((x): x is string => x !== null)) {
          for (const cName of findChildren(parentName, byName)) sibSet.add(cName);
        }
        const allSibs = [...sibSet].sort((a, b) => dobYear(a) - dobYear(b));

        for (const sibName of allSibs) {
          const isBloodLine = sibName === name;
          if (people[sibName]) {
            const existingUid = people[sibName].unitId;
            if (!edges.some(e => e.fromUnit === parentUid && e.toUnit === existingUid)) {
              edges.push({ fromUnit: parentUid, toUnit: existingUid, toName: sibName, sibling: !isBloodLine });
            }
          } else {
            const sibPage    = byName[sibName];
            const sibSpouses = sibPage ? resolveList(sibPage.married) : [];
            const unitDir    = isBloodLine ? "anc" : "sibling";
            const uid        = newUnit([sibName, ...sibSpouses.filter(s => s !== sibName)], gen, unitDir);
            edges.push({ fromUnit: parentUid, toUnit: uid, toName: sibName, sibling: !isBloodLine });
          }
        }
      } else {
        const childUid = people[name]?.unitId;
        if (childUid) {
          if (!edges.some(e => e.fromUnit === parentUid && e.toUnit === childUid)) {
            edges.push({ fromUnit: parentUid, toUnit: childUid, toName: name, sibling: false });
          }
        }
      }

      if (fName) addAncestors(fName, gen - 1, true);
      if (mName) addAncestors(mName, gen - 1, true);
    }
  }

  function addDescendants(name: string, gen: number, isBlood: boolean): void {
    if (visited.has("desc-" + name)) return;
    visited.add("desc-" + name);
    if (isBlood) bloodLine.add(name);
    if (!people[name]) {
      const p = byName[name];
      const spouses = p ? resolveList(p.married) : [];
      newUnit([name, ...spouses.filter(s => s !== name)], gen, "desc");
      if (!siblingsBloodOnly) {
        for (const spouse of spouses) addAncestors(spouse, gen, false);
      }
    }
    for (const cName of findChildren(name, byName)) {
      if (!visited.has("desc-" + cName)) addDescendants(cName, gen + 1, true);
      const parentUid = people[name]?.unitId;
      const childUid  = people[cName]?.unitId;
      if (parentUid && childUid && parentUid !== childUid) {
        if (!edges.some(e => e.fromUnit === parentUid && e.toUnit === childUid)) {
          edges.push({ fromUnit: parentUid, toUnit: childUid, toName: cName, sibling: false });
        }
      }
    }
  }

  // Create root unit FIRST so that when addAncestors iterates siblings,
  // it finds rootName already in people[] and wires an edge rather than
  // creating a spurious dir="anc" unit for the root person.
  bloodLine.add(rootName);
  const rootPage0    = byName[rootName];
  const rootSpouses0 = rootPage0 ? resolveList(rootPage0.married) : [];
  newUnit([rootName, ...rootSpouses0.filter(s => s !== rootName)], 0, "root");

  addAncestors(rootName, 0, true);
  addDescendants(rootName, 0, true);

  if (!siblingsBloodOnly) {
    const rootPage    = byName[rootName];
    const rootSpouses = rootPage ? resolveList(rootPage.married) : [];
    for (const member of rootSpouses.filter(s => s !== rootName)) {
      addAncestors(member, 0, false);
    }
  }

  return { units, people, edges, bloodLine };
}
