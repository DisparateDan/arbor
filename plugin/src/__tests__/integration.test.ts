/**
 * Integration tests: run the full buildTree → layout → buildSVG pipeline against
 * realistic datasets and assert structural invariants that only emerge at scale.
 *
 * These tests don't check pixel-exact positions; they check that the output is
 * self-consistent regardless of the specific numbers produced.
 */
import { describe, it, expect } from "vitest";
import { buildTree } from "../tree";
import { layout } from "../layout";
import { buildSVG } from "../renderer";
import { THEMES, CARD_W, CARD_H, H_GAP } from "../constants";
import type { GenderIndex, PersonPage, Unit } from "../types";
import { tudorByName } from "./fixtures/tudor";
import { tolkienByName } from "./fixtures/tolkien";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGenderIndex(byName: Record<string, PersonPage>): GenderIndex {
  const idx: GenderIndex = {};
  for (const [name, page] of Object.entries(byName)) {
    const s = String(page?.sex || "").toLowerCase().trim();
    idx[name] = s === "male" ? "m" : s === "female" ? "f" : "u";
  }
  return idx;
}

/** Returns a description of any overlap found, or null if clean. */
function findOverlap(units: Record<string, Unit>, mode: "horizontal" | "vertical"): string | null {
  const byGen: Record<number, Unit[]> = {};
  for (const u of Object.values(units)) {
    if (u.x === undefined || u.y === undefined) continue;
    (byGen[u.gen] = byGen[u.gen] || []).push(u);
  }
  for (const [gen, genUnits] of Object.entries(byGen)) {
    if (mode === "horizontal") {
      const sorted = [...genUnits].sort((a, b) => a.x! - b.x!);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], curr = sorted[i];
        const prevRight = prev.x! + (prev.width ?? CARD_W);
        if (curr.x! < prevRight - 0.5) { // 0.5px tolerance for floating point
          return `gen ${gen}: units overlap — right edge ${prevRight.toFixed(1)} > left edge ${curr.x!.toFixed(1)}`;
        }
      }
    } else {
      const sorted = [...genUnits].sort((a, b) => a.y! - b.y!);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1], curr = sorted[i];
        const prevBottom = prev.y! + (prev.height ?? CARD_H);
        if (curr.y! < prevBottom - 0.5) {
          return `gen ${gen}: units overlap — bottom ${prevBottom.toFixed(1)} > top ${curr.y!.toFixed(1)}`;
        }
      }
    }
  }
  return null;
}

function runPipeline(
  byName: Record<string, PersonPage>,
  rootName: string,
  mode: "horizontal" | "vertical",
  siblingsBloodOnly = true,
) {
  const { units, people, edges, pedigreeCollapse } = buildTree(rootName, byName, siblingsBloodOnly);
  layout(units, edges, byName, mode);
  const svg = buildSVG(units, edges, people, rootName, byName, makeGenderIndex(byName), THEMES.dark, mode, false);
  return { units, people, edges, pedigreeCollapse, svg };
}

// ── Shared invariant checks ───────────────────────────────────────────────────

/**
 * The core invariants that must hold for any well-formed tree.
 * Called for each dataset/root/layout combination below.
 */
function assertTreeInvariants(
  byName: Record<string, PersonPage>,
  rootName: string,
  mode: "horizontal" | "vertical",
  opts: { expectPedigreeCollapse?: boolean } = {},
) {
  const { units, people, edges, pedigreeCollapse, svg } = runPipeline(byName, rootName, mode);

  // 1. Every placed person has a valid back-reference into units.
  //    (Not every person in byName will be reachable from every root.)
  it(`all placed people have valid unit references (${rootName}, ${mode})`, () => {
    for (const [name, entry] of Object.entries(people)) {
      expect(units[entry.unitId], `person "${name}" references missing unit "${entry.unitId}"`).toBeDefined();
    }
  });

  // 2. Every placed unit has finite, non-NaN coordinates.
  it(`no NaN/undefined coordinates (${rootName}, ${mode})`, () => {
    for (const u of Object.values(units)) {
      if (u.x === undefined) continue; // unplaced units are acceptable
      expect(isFinite(u.x),  `unit ${u.id} x=${u.x} is not finite`).toBe(true);
      expect(isFinite(u.y!), `unit ${u.id} y=${u.y} is not finite`).toBe(true);
    }
  });

  // 3. Every edge references units that actually exist.
  it(`all edge references are valid (${rootName}, ${mode})`, () => {
    for (const e of edges) {
      expect(units[e.fromUnit], `edge.fromUnit "${e.fromUnit}" not found`).toBeDefined();
      expect(units[e.toUnit],   `edge.toUnit "${e.toUnit}" not found`).toBeDefined();
    }
  });

  // 4. No units in the same generation overlap (blood-siblings-only mode, which guarantees no overlaps).
  it(`no unit overlaps in same generation (${rootName}, ${mode})`, () => {
    const violation = findOverlap(units, mode);
    expect(violation).toBeNull();
  });

  // 5. Root unit is at generation 0.
  it(`root unit is at gen 0 (${rootName}, ${mode})`, () => {
    const rootEntry = people[rootName];
    expect(rootEntry).toBeDefined();
    expect(units[rootEntry.unitId].gen).toBe(0);
    expect(units[rootEntry.unitId].dir).toBe("root");
  });

  // 6. SVG output is non-empty and has positive dimensions.
  it(`SVG has positive dimensions (${rootName}, ${mode})`, () => {
    expect(svg.svgW).toBeGreaterThan(0);
    expect(svg.svgH).toBeGreaterThan(0);
    expect(svg.cardSVG.length).toBeGreaterThan(0);
  });

  // 7. SVG contains a card for the root person.
  it(`SVG contains root card (${rootName}, ${mode})`, () => {
    expect(svg.cardSVG).toContain(`data-name='${rootName}'`);
  });

  // 8. Pedigree collapse flag matches expectation when specified.
  if (opts.expectPedigreeCollapse !== undefined) {
    it(`pedigreeCollapse is ${opts.expectPedigreeCollapse} (${rootName}, ${mode})`, () => {
      expect(pedigreeCollapse).toBe(opts.expectPedigreeCollapse);
    });
  }
}

// ── Tudor — Henry VIII as root ────────────────────────────────────────────────
// Henry VIII has 6 wives in a single unit — the widest unit Arbor is likely to see.
// His three children have different mothers, exercising per-spouse fromName anchoring.

describe("Tudor — rooted on Henry VIII", () => {
  assertTreeInvariants(tudorByName, "Henry VIII_h8tu", "horizontal", { expectPedigreeCollapse: false });
  assertTreeInvariants(tudorByName, "Henry VIII_h8tu", "vertical",   { expectPedigreeCollapse: false });
});

// ── Tudor — Henry VII as root ─────────────────────────────────────────────────
// Henry VII gives a 3-generation view (grandparents → Henry VIII + Margaret → grandchildren).

describe("Tudor — rooted on Henry VII", () => {
  assertTreeInvariants(tudorByName, "Henry VII_h7tu", "horizontal");
  assertTreeInvariants(tudorByName, "Henry VII_h7tu", "vertical");
});

// ── Tolkien — Elrond as root ──────────────────────────────────────────────────
// Elrond has deep ancestry (back through Finwe) and descendants including Arwen.
// Rooting on Elrond with blood-siblings-only should produce a clean tree.

describe("Tolkien — rooted on Elrond", () => {
  assertTreeInvariants(tolkienByName, "Elrond HalfElven_37gt", "horizontal");
  assertTreeInvariants(tolkienByName, "Elrond HalfElven_37gt", "vertical");
});

// ── Tolkien — Finwe as root ───────────────────────────────────────────────────
// Finwe is the common ancestor of all Noldor lines in the dataset.
// Elrond appears in two descendant paths from Finwe: via Fingolfin → Turgon → Idril → Earendil,
// and via Finarfin → Galadriel → Celebrian (Elrond's wife).
// Whether pedigreeCollapse fires depends on which branch is traversed first (determined by DOB
// sort order — all unknown here, so insertion order in byName wins). We don't assert the flag
// value, but the pipeline must not crash and invariants must still hold.

describe("Tolkien — rooted on Finwe (potential pedigree collapse)", () => {
  assertTreeInvariants(tolkienByName, "Finwe Noldor_hkaf", "horizontal");
  assertTreeInvariants(tolkienByName, "Finwe Noldor_hkaf", "vertical");
});

// ── Tolkien — people count checks ────────────────────────────────────────────

describe("Tolkien — people counts", () => {
  it("all 41 people are present in the fixture", () => {
    expect(Object.keys(tolkienByName)).toHaveLength(41);
  });

  it("Elrond tree includes all direct blood-line members", () => {
    const { people } = runPipeline(tolkienByName, "Elrond HalfElven_37gt", "horizontal");
    // Elrond's parents, grandparents, children, and spouse should all be present
    for (const name of [
      "Earendil HalfElven_dxu7", "Elwing HalfElven_oejp",   // parents
      "Celebrian of Lothlorien_0mk4",                         // spouse
      "Arwen Undomiel_jwb6", "Elladan HalfElven_9d9g", "Elrohir HalfElven_sd4h", // children
      "Idril Celebrindal_xrtv", "Tuor Eladar_ovzz",          // grandparents (maternal)
    ]) {
      expect(people[name], `${name} missing from Elrond tree`).toBeDefined();
    }
  });

  it("Tudor tree rooted on Henry VIII includes all 13 people", () => {
    const { people } = runPipeline(tudorByName, "Henry VIII_h8tu", "horizontal");
    expect(Object.keys(people)).toHaveLength(13);
  });
});

// ── Tudor — Henry VIII structural specifics ───────────────────────────────────

describe("Tudor — Henry VIII structural specifics", () => {
  it("Henry VIII unit contains all 7 members (self + 6 wives)", () => {
    const { units, people } = runPipeline(tudorByName, "Henry VIII_h8tu", "horizontal");
    const rootUnit = units[people["Henry VIII_h8tu"].unitId];
    expect(rootUnit.members).toHaveLength(7);
    expect(rootUnit.members).toContain("Catherine of Aragon_cofa");
    expect(rootUnit.members).toContain("Anne Boleyn_anbo");
    expect(rootUnit.members).toContain("Jane Seymour_jase");
  });

  it("each child has a distinct mother identified by fromName on their edge", () => {
    const { units, people, edges } = runPipeline(tudorByName, "Henry VIII_h8tu", "horizontal");
    const parentUid = people["Henry VIII_h8tu"].unitId;

    const childEdges = edges.filter(e => e.fromUnit === parentUid);
    // All three children should have edges with fromName set (7-member unit)
    childEdges.forEach(e => {
      expect(e.fromName, `edge to ${e.toName} should have fromName set`).toBeDefined();
    });

    // Each child's fromName should be their actual mother
    const maryEdge  = childEdges.find(e => e.toName === "Mary I_mary");
    const elizEdge  = childEdges.find(e => e.toName === "Elizabeth I_eliz");
    const edwardEdge = childEdges.find(e => e.toName === "Edward VI_edvi");

    expect(maryEdge?.fromName).toBe("Catherine of Aragon_cofa");
    expect(elizEdge?.fromName).toBe("Anne Boleyn_anbo");
    expect(edwardEdge?.fromName).toBe("Jane Seymour_jase");
  });

  it("three children are at generation 1", () => {
    const { units, people } = runPipeline(tudorByName, "Henry VIII_h8tu", "horizontal");
    for (const child of ["Mary I_mary", "Elizabeth I_eliz", "Edward VI_edvi"]) {
      expect(units[people[child].unitId].gen).toBe(1);
    }
  });
});
