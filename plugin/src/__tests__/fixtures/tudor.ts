import type { PersonPage } from "../../types";

function p(stem: string, overrides: Partial<PersonPage>): PersonPage {
  return {
    file: { name: stem, path: `TudorFamilyTree/${stem}.md` },
    ar_type: "person",
    first_names: "",
    family_name: "",
    ...overrides,
  };
}

/** 13-person Tudor family tree, transcribed from obsidianVault/TudorFamilyTree/. */
export const tudorByName: Record<string, PersonPage> = {
  "Henry VII_h7tu": p("Henry VII_h7tu", {
    first_names: "Henry VII", family_name: "Tudor", sex: "male",
    DOB: 1457, DOD: 1509,
    married: ["[[Elizabeth of York_eyok]]"],
  }),
  "Elizabeth of York_eyok": p("Elizabeth of York_eyok", {
    first_names: "Elizabeth", family_name: "of York", sex: "female",
    DOB: 1466, DOD: 1503,
    married: ["[[Henry VII_h7tu]]"],
  }),
  "Henry VIII_h8tu": p("Henry VIII_h8tu", {
    first_names: "Henry VIII", family_name: "Tudor", sex: "male",
    DOB: 1491, DOD: 1547,
    father: "[[Henry VII_h7tu]]", mother: "[[Elizabeth of York_eyok]]",
    married: [
      "[[Catherine of Aragon_cofa]]",
      "[[Anne Boleyn_anbo]]",
      "[[Jane Seymour_jase]]",
      "[[Anne of Cleves_aocl]]",
      "[[Catherine Howard_caho]]",
      "[[Catherine Parr_capa]]",
    ],
  }),
  "Margaret Tudor_matu": p("Margaret Tudor_matu", {
    first_names: "Margaret", family_name: "Tudor", sex: "female",
    DOB: 1489, DOD: 1541,
    father: "[[Henry VII_h7tu]]", mother: "[[Elizabeth of York_eyok]]",
  }),
  "Catherine of Aragon_cofa": p("Catherine of Aragon_cofa", {
    first_names: "Catherine", family_name: "of Aragon", sex: "female",
    DOB: 1485, DOD: 1536,
    married: ["[[Henry VIII_h8tu]]"],
  }),
  "Anne Boleyn_anbo": p("Anne Boleyn_anbo", {
    first_names: "Anne", family_name: "Boleyn", sex: "female",
    DOB: "~1501", DOD: 1536,
    married: ["[[Henry VIII_h8tu]]"],
  }),
  "Jane Seymour_jase": p("Jane Seymour_jase", {
    first_names: "Jane", family_name: "Seymour", sex: "female",
    DOB: "~1508", DOD: 1537,
    married: ["[[Henry VIII_h8tu]]"],
  }),
  "Anne of Cleves_aocl": p("Anne of Cleves_aocl", {
    first_names: "Anne", family_name: "of Cleves", sex: "female",
    DOB: 1515, DOD: 1557,
    married: ["[[Henry VIII_h8tu]]"],
  }),
  "Catherine Howard_caho": p("Catherine Howard_caho", {
    first_names: "Catherine", family_name: "Howard", sex: "female",
    DOB: "~1523", DOD: 1542,
    married: ["[[Henry VIII_h8tu]]"],
  }),
  "Catherine Parr_capa": p("Catherine Parr_capa", {
    first_names: "Catherine", family_name: "Parr", sex: "female",
    DOB: 1512, DOD: 1548,
    married: ["[[Henry VIII_h8tu]]"],
  }),
  "Mary I_mary": p("Mary I_mary", {
    first_names: "Mary I", family_name: "Tudor", sex: "female",
    DOB: 1516, DOD: 1558,
    father: "[[Henry VIII_h8tu]]", mother: "[[Catherine of Aragon_cofa]]",
  }),
  "Elizabeth I_eliz": p("Elizabeth I_eliz", {
    first_names: "Elizabeth I", family_name: "Tudor", sex: "female",
    DOB: 1533, DOD: 1603,
    father: "[[Henry VIII_h8tu]]", mother: "[[Anne Boleyn_anbo]]",
  }),
  "Edward VI_edvi": p("Edward VI_edvi", {
    first_names: "Edward VI", family_name: "Tudor", sex: "male",
    DOB: 1537, DOD: 1553,
    father: "[[Henry VIII_h8tu]]", mother: "[[Jane Seymour_jase]]",
  }),
};
