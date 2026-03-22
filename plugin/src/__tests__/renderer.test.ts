import { describe, it, expect } from "vitest";
import { buildTree } from "../tree";
import { layout } from "../layout";
import { buildSVG, cardColors } from "../renderer";
import { THEMES } from "../constants";
import type { GenderIndex, PersonPage } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function person(overrides: Partial<PersonPage> = {}): PersonPage {
  return {
    file: { name: "test", path: "FamilyTree/People/test.md" },
    ar_type: "person",
    first_names: "",
    family_name: "",
    ...overrides,
  };
}

function genderIndex(byName: Record<string, PersonPage>): GenderIndex {
  const idx: GenderIndex = {};
  for (const [name, page] of Object.entries(byName)) {
    const s = String(page?.sex || "").toLowerCase().trim();
    idx[name] = s === "male" ? "m" : s === "female" ? "f" : "u";
  }
  return idx;
}

const theme = THEMES.dark;

// Standard 2-parent, 2-child fixture
const byName = {
  "Father_aa11": person({ first_names: "John",  family_name: "Smith", sex: "male",   married: ["[[Mother_bb22]]"] }),
  "Mother_bb22": person({ first_names: "Jane",  family_name: "Smith", sex: "female", married: ["[[Father_aa11]]"] }),
  "Child1_cc33": person({ first_names: "Alice", family_name: "Smith", father: "[[Father_aa11]]", mother: "[[Mother_bb22]]", DOB: 1980 }),
  "Child2_dd44": person({ first_names: "Bob",   family_name: "Smith", father: "[[Father_aa11]]", mother: "[[Mother_bb22]]", DOB: 1982 }),
};

function buildLaidOutSVG(root: string, layoutMode: "horizontal" | "vertical" = "horizontal", coloredEdges = false) {
  const { units, people, edges } = buildTree(root, byName, true);
  layout(units, edges, byName, layoutMode);
  return buildSVG(units, edges, people, root, byName, genderIndex(byName), theme, layoutMode, coloredEdges);
}

// ── cardColors ────────────────────────────────────────────────────────────────

describe("cardColors", () => {
  const gi: GenderIndex = { "male_x": "m", "female_x": "f", "unknown_x": "u" };

  it("uses maleFill for male persons", () => {
    const { fill } = cardColors("male_x", false, false, false, gi, theme);
    expect(fill).toBe(theme.maleFill);
  });

  it("uses femaleFill for female persons", () => {
    const { fill } = cardColors("female_x", false, false, false, gi, theme);
    expect(fill).toBe(theme.femaleFill);
  });

  it("uses rootBorder for the root person", () => {
    const { border } = cardColors("male_x", true, false, false, gi, theme);
    expect(border).toBe(theme.rootBorder);
  });

  it("uses sibBorder for sibling persons", () => {
    const { border } = cardColors("unknown_x", false, false, true, gi, theme);
    expect(border).toBe(theme.sibBorder);
  });
});

// ── buildSVG — dimensions ─────────────────────────────────────────────────────

describe("buildSVG — dimensions", () => {
  it("returns positive svgW and svgH", () => {
    const { svgW, svgH } = buildLaidOutSVG("Father_aa11");
    expect(svgW).toBeGreaterThan(0);
    expect(svgH).toBeGreaterThan(0);
  });

  it("horizontal and vertical modes produce different dimensions", () => {
    const { svgW: hW, svgH: hH } = buildLaidOutSVG("Father_aa11", "horizontal");
    const { svgW: vW, svgH: vH } = buildLaidOutSVG("Father_aa11", "vertical");
    // The two layout modes orient the tree differently so dimensions must differ.
    expect(hW === vW && hH === vH).toBe(false);
  });
});

// ── buildSVG — card elements ──────────────────────────────────────────────────

describe("buildSVG — card elements", () => {
  it("emits one person-card per person in the tree", () => {
    const { cardSVG } = buildLaidOutSVG("Father_aa11");
    const matches = cardSVG.match(/class='person-card'/g);
    expect(matches).toHaveLength(4); // Father, Mother, Child1, Child2
  });

  it("root card has correct data-name attribute", () => {
    const { cardSVG } = buildLaidOutSVG("Father_aa11");
    expect(cardSVG).toContain("data-name='Father_aa11'");
  });

  it("all people have cards with data-name attributes", () => {
    const { cardSVG } = buildLaidOutSVG("Father_aa11");
    for (const name of Object.keys(byName)) {
      expect(cardSVG).toContain(`data-name='${name}'`);
    }
  });

  it("renders first and last name text", () => {
    const { cardSVG } = buildLaidOutSVG("Father_aa11");
    expect(cardSVG).toContain("John");
    expect(cardSVG).toContain("Smith");
  });

  it("renders dates when present", () => {
    const { cardSVG } = buildLaidOutSVG("Father_aa11");
    expect(cardSVG).toContain("1980");
    expect(cardSVG).toContain("1982");
  });
});

// ── buildSVG — edges ──────────────────────────────────────────────────────────

describe("buildSVG — edges", () => {
  it("emits path elements for parent-child relationships", () => {
    const { edgeSVG } = buildLaidOutSVG("Father_aa11");
    const pathCount = (edgeSVG.match(/<path /g) ?? []).length;
    // At least 2 paths: one edge to each child
    expect(pathCount).toBeGreaterThanOrEqual(2);
  });

  it("emits spouse connector lines", () => {
    const { edgeSVG } = buildLaidOutSVG("Father_aa11");
    expect(edgeSVG).toContain("<line ");
  });

  it("uses palette colours when coloredEdges is true", () => {
    const { edgeSVG } = buildLaidOutSVG("Father_aa11", "horizontal", true);
    // edgePalette[0] is the first colour
    expect(edgeSVG).toContain(theme.edgePalette[0]);
  });

  it("uses theme.edge colour when coloredEdges is false", () => {
    const { edgeSVG } = buildLaidOutSVG("Father_aa11", "horizontal", false);
    expect(edgeSVG).toContain(theme.edge);
  });
});

// ── buildSVG — vertical layout ────────────────────────────────────────────────

describe("buildSVG — vertical layout", () => {
  it("emits path elements in vertical mode", () => {
    const { edgeSVG } = buildLaidOutSVG("Father_aa11", "vertical");
    expect((edgeSVG.match(/<path /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("returns positive dimensions in vertical mode", () => {
    const { svgW, svgH } = buildLaidOutSVG("Father_aa11", "vertical");
    expect(svgW).toBeGreaterThan(0);
    expect(svgH).toBeGreaterThan(0);
  });
});
