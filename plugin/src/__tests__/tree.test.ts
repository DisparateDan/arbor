import { describe, it, expect } from "vitest";
import {
  resolveName, resolveList, getYear, trunc, getNameLines, findChildren, buildTree,
} from "../tree";
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

// ── resolveName ───────────────────────────────────────────────────────────────

describe("resolveName", () => {
  it("returns null for falsy values", () => {
    expect(resolveName(null)).toBeNull();
    expect(resolveName(undefined)).toBeNull();
    expect(resolveName("")).toBeNull();
  });

  it("resolves a wikilink string", () => {
    expect(resolveName("[[John Smith_ab12]]")).toBe("John Smith_ab12");
  });

  it("resolves a path object (Dataview style)", () => {
    expect(resolveName({ path: "FamilyTree/People/John Smith_ab12.md" })).toBe("John Smith_ab12");
  });

  it("resolves a path object without .md extension", () => {
    expect(resolveName({ path: "FamilyTree/People/John Smith_ab12" })).toBe("John Smith_ab12");
  });

  it("returns a plain string as-is", () => {
    expect(resolveName("John Smith_ab12")).toBe("John Smith_ab12");
  });
});

// ── resolveList ───────────────────────────────────────────────────────────────

describe("resolveList", () => {
  it("returns [] for falsy values", () => {
    expect(resolveList(null)).toEqual([]);
    expect(resolveList(undefined)).toEqual([]);
    expect(resolveList([])).toEqual([]);
  });

  it("resolves an array of wikilinks", () => {
    expect(resolveList(["[[Alice_aa11]]", "[[Bob_bb22]]"])).toEqual(["Alice_aa11", "Bob_bb22"]);
  });

  it("wraps a single value in an array", () => {
    expect(resolveList("[[Alice_aa11]]")).toEqual(["Alice_aa11"]);
  });

  it("filters out nulls from the array", () => {
    expect(resolveList(["[[Alice_aa11]]", "", null])).toEqual(["Alice_aa11"]);
  });
});

// ── getYear ───────────────────────────────────────────────────────────────────

describe("getYear", () => {
  it("returns empty string for falsy values", () => {
    expect(getYear(null)).toBe("");
    expect(getYear("")).toBe("");
  });

  it("returns a plain year integer as string", () => {
    expect(getYear(1923)).toBe("1923");
    expect(getYear("1923")).toBe("1923");
  });

  it("preserves approximate prefix ~", () => {
    expect(getYear("~1923")).toBe("~1923");
  });

  it("preserves circa prefix c.", () => {
    expect(getYear("c.1923")).toBe("c.1923");
  });

  it("extracts year from ISO date string", () => {
    expect(getYear("1923-04-15")).toBe("1923");
  });

  it("returns year from a Dataview date object", () => {
    expect(getYear({ year: 1923, month: 4, day: 15 })).toBe("1923");
  });
});

// ── trunc ─────────────────────────────────────────────────────────────────────

describe("trunc", () => {
  it("returns empty string for falsy input", () => {
    expect(trunc("")).toBe("");
  });

  it("returns short strings unchanged", () => {
    expect(trunc("Hello")).toBe("Hello");
  });

  it("truncates strings longer than MAX_LEN (18)", () => {
    const long = "abcdefghijklmnopqr"; // 18 chars — exactly at limit
    expect(trunc(long)).toBe(long);
    const tooLong = "abcdefghijklmnopqrs"; // 19 chars
    expect(trunc(tooLong)).toBe("abcdefghijklmnopq...");
  });
});

// ── getNameLines ──────────────────────────────────────────────────────────────

describe("getNameLines", () => {
  it("uses page fields when present", () => {
    expect(getNameLines("stem", person({ first_names: "John", family_name: "Smith" })))
      .toEqual({ first: "John", last: "Smith" });
  });

  it("falls back to splitting the stem when page is null", () => {
    expect(getNameLines("John Smith_ab12", null))
      .toEqual({ first: "John", last: "Smith_ab12" });
  });

  it("handles empty page fields", () => {
    expect(getNameLines("stem", person({ first_names: "", family_name: "" })))
      .toEqual({ first: "", last: "" });
  });
});

// ── findChildren ──────────────────────────────────────────────────────────────

describe("findChildren", () => {
  it("finds children by father wikilink", () => {
    const byName = {
      "Father_aa11": person({ first_names: "Father", sex: "male" }),
      "Child_bb22":  person({ first_names: "Child",  father: "[[Father_aa11]]", DOB: 1990 }),
    };
    expect(findChildren("Father_aa11", byName)).toEqual(["Child_bb22"]);
  });

  it("finds children by mother wikilink", () => {
    const byName = {
      "Mother_aa11": person({ first_names: "Mother", sex: "female" }),
      "Child_bb22":  person({ first_names: "Child",  mother: "[[Mother_aa11]]", DOB: 1990 }),
    };
    expect(findChildren("Mother_aa11", byName)).toEqual(["Child_bb22"]);
  });

  it("sorts children by DOB ascending", () => {
    const byName = {
      "Parent_aa11": person({ first_names: "Parent" }),
      "Child2_cc33": person({ first_names: "Child2", father: "[[Parent_aa11]]", DOB: 1992 }),
      "Child1_bb22": person({ first_names: "Child1", father: "[[Parent_aa11]]", DOB: 1990 }),
    };
    expect(findChildren("Parent_aa11", byName)).toEqual(["Child1_bb22", "Child2_cc33"]);
  });

  it("returns empty array when no children", () => {
    const byName = { "Person_aa11": person() };
    expect(findChildren("Person_aa11", byName)).toEqual([]);
  });
});

// ── buildTree ─────────────────────────────────────────────────────────────────

describe("buildTree", () => {
  it("builds a root-only tree", () => {
    const byName = { "Root_aa11": person({ first_names: "Root" }) };
    const { units, people } = buildTree("Root_aa11", byName, true);
    expect(Object.keys(people)).toContain("Root_aa11");
    const rootUnit = Object.values(units).find(u => u.dir === "root");
    expect(rootUnit).toBeDefined();
    expect(rootUnit!.members).toContain("Root_aa11");
  });

  it("includes parents as ancestor unit", () => {
    const byName = {
      "Root_aa11":   person({ first_names: "Root", father: "[[Father_bb22]]", mother: "[[Mother_cc33]]" }),
      "Father_bb22": person({ first_names: "Father", sex: "male" }),
      "Mother_cc33": person({ first_names: "Mother", sex: "female" }),
    };
    const { units } = buildTree("Root_aa11", byName, true);
    const ancUnit = Object.values(units).find(u => u.dir === "anc");
    expect(ancUnit).toBeDefined();
    expect(ancUnit!.members).toContain("Father_bb22");
    expect(ancUnit!.members).toContain("Mother_cc33");
  });

  it("includes children as descendant units", () => {
    const byName = {
      "Root_aa11":  person({ first_names: "Root" }),
      "Child_bb22": person({ first_names: "Child", father: "[[Root_aa11]]" }),
    };
    const { people } = buildTree("Root_aa11", byName, true);
    expect(Object.keys(people)).toContain("Child_bb22");
  });

  it("marks root and blood-line members in bloodLine set", () => {
    const byName = {
      "Root_aa11":  person({ first_names: "Root" }),
      "Child_bb22": person({ first_names: "Child", father: "[[Root_aa11]]" }),
    };
    const { bloodLine } = buildTree("Root_aa11", byName, true);
    expect(bloodLine.has("Root_aa11")).toBe(true);
    expect(bloodLine.has("Child_bb22")).toBe(true);
  });

  it("creates edges between parent and child units", () => {
    const byName = {
      "Root_aa11":  person({ first_names: "Root" }),
      "Child_bb22": person({ first_names: "Child", father: "[[Root_aa11]]" }),
    };
    const { edges } = buildTree("Root_aa11", byName, true);
    expect(edges.length).toBeGreaterThan(0);
  });

  it("places spouse in same unit as root", () => {
    const byName = {
      "Root_aa11":   person({ first_names: "Root",   married: ["[[Spouse_bb22]]"] }),
      "Spouse_bb22": person({ first_names: "Spouse", married: ["[[Root_aa11]]"] }),
    };
    const { units } = buildTree("Root_aa11", byName, true);
    const rootUnit = Object.values(units).find(u => u.dir === "root");
    expect(rootUnit!.members).toContain("Spouse_bb22");
  });
});
