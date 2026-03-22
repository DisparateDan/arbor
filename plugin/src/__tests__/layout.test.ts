import { describe, it, expect } from "vitest";
import { buildTree } from "../tree";
import { layout } from "../layout";
import { CARD_W, CARD_H, H_GAP } from "../constants";
import type { PersonPage } from "../types";

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

// 3-generation linear tree: Grandparent → Parent → Child
const linearByName = {
  "Grandparent_aa11": person({ first_names: "Grand" }),
  "Parent_bb22":      person({ first_names: "Parent", father: "[[Grandparent_aa11]]" }),
  "Child_cc33":       person({ first_names: "Child",  father: "[[Parent_bb22]]"      }),
};

// Couple with 2 children
const coupleByName = {
  "Father_aa11": person({ first_names: "Father", sex: "male",   married: ["[[Mother_bb22]]"] }),
  "Mother_bb22": person({ first_names: "Mother", sex: "female", married: ["[[Father_aa11]]"] }),
  "Child1_cc33": person({ first_names: "Child1", father: "[[Father_aa11]]", mother: "[[Mother_bb22]]", DOB: 1980 }),
  "Child2_dd44": person({ first_names: "Child2", father: "[[Father_aa11]]", mother: "[[Mother_bb22]]", DOB: 1982 }),
};

function unitCoord(
  name: string,
  units: ReturnType<typeof buildTree>["units"],
  people: ReturnType<typeof buildTree>["people"],
): { x: number; y: number } {
  const u = units[people[name].unitId];
  return { x: u.x!, y: u.y! };
}

// ── Horizontal layout ─────────────────────────────────────────────────────────

describe("layout — horizontal mode", () => {
  it("places ancestor above root (lower y)", () => {
    const { units, people, edges } = buildTree("Parent_bb22", linearByName, true);
    layout(units, edges, linearByName, "horizontal");
    const gpY     = unitCoord("Grandparent_aa11", units, people).y;
    const parentY = unitCoord("Parent_bb22",      units, people).y;
    expect(gpY).toBeLessThan(parentY);
  });

  it("places descendant below root (greater y)", () => {
    const { units, people, edges } = buildTree("Parent_bb22", linearByName, true);
    layout(units, edges, linearByName, "horizontal");
    const parentY = unitCoord("Parent_bb22", units, people).y;
    const childY  = unitCoord("Child_cc33",  units, people).y;
    expect(childY).toBeGreaterThan(parentY);
  });

  it("separates each generation by exactly CARD_H + V_GAP", () => {
    const { units, people, edges } = buildTree("Parent_bb22", linearByName, true);
    layout(units, edges, linearByName, "horizontal");
    const gpY     = unitCoord("Grandparent_aa11", units, people).y;
    const parentY = unitCoord("Parent_bb22",      units, people).y;
    const childY  = unitCoord("Child_cc33",        units, people).y;
    expect(parentY - gpY).toBe(CARD_H + 120);   // V_GAP = 120
    expect(childY - parentY).toBe(CARD_H + 120);
  });

  it("places siblings at the same y coordinate", () => {
    const { units, people, edges } = buildTree("Father_aa11", coupleByName, true);
    layout(units, edges, coupleByName, "horizontal");
    const c1Y = unitCoord("Child1_cc33", units, people).y;
    const c2Y = unitCoord("Child2_dd44", units, people).y;
    expect(c1Y).toBe(c2Y);
  });

  it("assigns x positions to all placed units", () => {
    const { units, people, edges } = buildTree("Father_aa11", coupleByName, true);
    layout(units, edges, coupleByName, "horizontal");
    for (const name of ["Father_aa11", "Mother_bb22", "Child1_cc33", "Child2_dd44"]) {
      expect(unitCoord(name, units, people).x).not.toBeNaN();
    }
  });

  it("sibling units do not overlap horizontally", () => {
    const { units, people, edges } = buildTree("Father_aa11", coupleByName, true);
    layout(units, edges, coupleByName, "horizontal");
    const c1 = units[people["Child1_cc33"].unitId];
    const c2 = units[people["Child2_dd44"].unitId];
    const left  = c1.x! < c2.x! ? c1 : c2;
    const right = c1.x! < c2.x! ? c2 : c1;
    // right card must start at or after left card's right edge + gap
    expect(right.x!).toBeGreaterThanOrEqual(left.x! + (left.width ?? CARD_W) + H_GAP);
  });

  it("child is horizontally centred under the parent unit", () => {
    // Single child should be centred under the parent
    const byName = {
      "Father_aa11": person({ first_names: "F", sex: "male",   married: ["[[Mother_bb22]]"] }),
      "Mother_bb22": person({ first_names: "M", sex: "female", married: ["[[Father_aa11]]"] }),
      "Child_cc33":  person({ first_names: "C", father: "[[Father_aa11]]", mother: "[[Mother_bb22]]" }),
    };
    const { units, people, edges } = buildTree("Father_aa11", byName, true);
    layout(units, edges, byName, "horizontal");
    const parentUnit = units[people["Father_aa11"].unitId];
    const childUnit  = units[people["Child_cc33"].unitId];
    const parentCentreX = parentUnit.x! + (parentUnit.width ?? CARD_W) / 2;
    const childCentreX  = childUnit.x!  + (childUnit.width  ?? CARD_W) / 2;
    expect(Math.abs(childCentreX - parentCentreX)).toBeLessThan(1);
  });
});

// ── Vertical layout ───────────────────────────────────────────────────────────

describe("layout — vertical mode", () => {
  it("places ancestor to the left of root (lower x)", () => {
    const { units, people, edges } = buildTree("Parent_bb22", linearByName, true);
    layout(units, edges, linearByName, "vertical");
    const gpX     = unitCoord("Grandparent_aa11", units, people).x;
    const parentX = unitCoord("Parent_bb22",      units, people).x;
    expect(gpX).toBeLessThan(parentX);
  });

  it("places descendant to the right of root (greater x)", () => {
    const { units, people, edges } = buildTree("Parent_bb22", linearByName, true);
    layout(units, edges, linearByName, "vertical");
    const parentX = unitCoord("Parent_bb22", units, people).x;
    const childX  = unitCoord("Child_cc33",  units, people).x;
    expect(childX).toBeGreaterThan(parentX);
  });

  it("places siblings at the same x coordinate", () => {
    const { units, people, edges } = buildTree("Father_aa11", coupleByName, true);
    layout(units, edges, coupleByName, "vertical");
    const c1X = unitCoord("Child1_cc33", units, people).x;
    const c2X = unitCoord("Child2_dd44", units, people).x;
    expect(c1X).toBe(c2X);
  });

  it("sibling units do not overlap vertically", () => {
    const { units, people, edges } = buildTree("Father_aa11", coupleByName, true);
    layout(units, edges, coupleByName, "vertical");
    const c1 = units[people["Child1_cc33"].unitId];
    const c2 = units[people["Child2_dd44"].unitId];
    const top    = c1.y! < c2.y! ? c1 : c2;
    const bottom = c1.y! < c2.y! ? c2 : c1;
    expect(bottom.y!).toBeGreaterThanOrEqual(top.y! + (top.height ?? CARD_H) + H_GAP);
  });
});
