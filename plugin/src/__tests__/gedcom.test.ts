import { describe, it, expect } from "vitest";
import { formatGedcomDate, sexToGedcom, buildFamilies, buildGedcom } from "../gedcom";
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

function gedcomLines(output: string): string[] {
  return output.trim().split("\n");
}

function findLines(output: string, tag: string): string[] {
  return gedcomLines(output).filter(l => l.includes(tag));
}

// ── formatGedcomDate ──────────────────────────────────────────────────────────

describe("formatGedcomDate", () => {
  it("returns null for falsy values", () => {
    expect(formatGedcomDate(null)).toBeNull();
    expect(formatGedcomDate(undefined)).toBeNull();
    expect(formatGedcomDate("")).toBeNull();
  });

  it("formats a plain year integer", () => {
    expect(formatGedcomDate(1923)).toBe("1923");
  });

  it("formats a plain year string", () => {
    expect(formatGedcomDate("1923")).toBe("1923");
  });

  it("formats an approximate year with ~ prefix", () => {
    expect(formatGedcomDate("~1923")).toBe("ABT 1923");
  });

  it("formats a circa year with c. prefix", () => {
    expect(formatGedcomDate("c.1923")).toBe("ABT 1923");
  });

  it("formats a circa year with c prefix (no dot)", () => {
    expect(formatGedcomDate("c1923")).toBe("ABT 1923");
  });

  it("formats a full ISO date YYYY-MM-DD", () => {
    expect(formatGedcomDate("1923-04-15")).toBe("15 APR 1923");
  });

  it("formats a partial date YYYY-MM", () => {
    expect(formatGedcomDate("1923-04")).toBe("APR 1923");
  });

  it("formats a Dataview date object with year only", () => {
    expect(formatGedcomDate({ year: 1923 })).toBe("1923");
  });

  it("formats a Dataview date object with year and month", () => {
    expect(formatGedcomDate({ year: 1923, month: 4 })).toBe("APR 1923");
  });

  it("formats a Dataview date object with full date", () => {
    expect(formatGedcomDate({ year: 1923, month: 4, day: 15 })).toBe("15 APR 1923");
  });

  it("pads single-digit day to two digits", () => {
    expect(formatGedcomDate({ year: 1923, month: 4, day: 5 })).toBe("05 APR 1923");
  });

  it("returns null for an empty Dataview object", () => {
    expect(formatGedcomDate({ year: 0 })).toBeNull();
  });

  it("formats an approximate full ISO date", () => {
    expect(formatGedcomDate("~1923-04-15")).toBe("ABT 15 APR 1923");
  });
});

// ── sexToGedcom ───────────────────────────────────────────────────────────────

describe("sexToGedcom", () => {
  it("maps male → M", () => {
    expect(sexToGedcom("male")).toBe("M");
    expect(sexToGedcom("Male")).toBe("M");
    expect(sexToGedcom("MALE")).toBe("M");
  });

  it("maps female → F", () => {
    expect(sexToGedcom("female")).toBe("F");
    expect(sexToGedcom("Female")).toBe("F");
  });

  it("maps unknown/empty → U", () => {
    expect(sexToGedcom("")).toBe("U");
    expect(sexToGedcom(null)).toBe("U");
    expect(sexToGedcom(undefined)).toBe("U");
    expect(sexToGedcom("other")).toBe("U");
  });
});

// ── buildFamilies ─────────────────────────────────────────────────────────────

describe("buildFamilies", () => {
  it("creates a family from a child's parent fields", () => {
    const byName = {
      "Father_aa11": person({ sex: "male" }),
      "Mother_bb22": person({ sex: "female" }),
      "Child_cc33":  person({ father: "[[Father_aa11]]", mother: "[[Mother_bb22]]" }),
    };
    const fams = buildFamilies(byName);
    expect(fams).toHaveLength(1);
    expect(fams[0].husband).toBe("Father_aa11");
    expect(fams[0].wife).toBe("Mother_bb22");
    expect(fams[0].children).toContain("Child_cc33");
  });

  it("creates a family from a marriage with no children", () => {
    const byName = {
      "Husband_aa11": person({ sex: "male",   married: ["[[Wife_bb22]]"] }),
      "Wife_bb22":    person({ sex: "female", married: ["[[Husband_aa11]]"] }),
    };
    const fams = buildFamilies(byName);
    expect(fams).toHaveLength(1);
    expect(fams[0].children).toHaveLength(0);
  });

  it("does not duplicate a family that appears in both parent fields and married fields", () => {
    const byName = {
      "Father_aa11": person({ sex: "male",   married: ["[[Mother_bb22]]"] }),
      "Mother_bb22": person({ sex: "female", married: ["[[Father_aa11]]"] }),
      "Child_cc33":  person({ father: "[[Father_aa11]]", mother: "[[Mother_bb22]]" }),
    };
    const fams = buildFamilies(byName);
    // One family: Father + Mother, with Child
    expect(fams).toHaveLength(1);
    expect(fams[0].children).toContain("Child_cc33");
  });

  it("handles father-only family", () => {
    const byName = {
      "Father_aa11": person({ sex: "male" }),
      "Child_bb22":  person({ father: "[[Father_aa11]]" }),
    };
    const fams = buildFamilies(byName);
    expect(fams).toHaveLength(1);
    expect(fams[0].husband).toBe("Father_aa11");
    expect(fams[0].wife).toBeNull();
  });
});

// ── buildGedcom ───────────────────────────────────────────────────────────────

describe("buildGedcom", () => {
  const byName = {
    "Father_aa11": person({ first_names: "John",  family_name: "Smith", sex: "male",   DOB: 1950, married: ["[[Mother_bb22]]"] }),
    "Mother_bb22": person({ first_names: "Jane",  family_name: "Smith", sex: "female", DOB: 1952, married: ["[[Father_aa11]]"] }),
    "Child_cc33":  person({ first_names: "Alice", family_name: "Smith", sex: "female", DOB: "1980-06-15",
                            father: "[[Father_aa11]]", mother: "[[Mother_bb22]]" }),
  };

  it("starts with HEAD and ends with TRLR", () => {
    const lines = gedcomLines(buildGedcom(byName, "test.ged"));
    expect(lines[0]).toBe("0 HEAD");
    expect(lines[lines.length - 1]).toBe("0 TRLR");
  });

  it("contains the correct number of INDI records", () => {
    expect(findLines(buildGedcom(byName, "test.ged"), "INDI")).toHaveLength(3);
  });

  it("contains a FAM record", () => {
    // Match only the FAM record lines (e.g. "0 @F0001@ FAM"), not FAMS/FAMC
    const famRecords = gedcomLines(buildGedcom(byName, "test.ged")).filter(l => l.endsWith(" FAM"));
    expect(famRecords).toHaveLength(1);
  });

  it("includes NAME with surname in slashes", () => {
    const names = findLines(buildGedcom(byName, "test.ged"), "NAME");
    expect(names.some(l => l.includes("/Smith/"))).toBe(true);
  });

  it("includes formatted birth date", () => {
    const dates = findLines(buildGedcom(byName, "test.ged"), "DATE");
    expect(dates.some(l => l.includes("15 JUN 1980"))).toBe(true);
  });

  it("includes SEX records", () => {
    const output = buildGedcom(byName, "test.ged");
    expect(findLines(output, "SEX M")).toHaveLength(1);
    expect(findLines(output, "SEX F")).toHaveLength(2);
  });

  it("links child to family via FAMC", () => {
    expect(findLines(buildGedcom(byName, "test.ged"), "FAMC")).toHaveLength(1);
  });

  it("links parents to family via FAMS", () => {
    expect(findLines(buildGedcom(byName, "test.ged"), "FAMS")).toHaveLength(2);
  });

  it("embeds the filename in the FILE tag", () => {
    expect(findLines(buildGedcom(byName, "my-tree.ged"), "FILE")).toContain("1 FILE my-tree.ged");
  });
});
