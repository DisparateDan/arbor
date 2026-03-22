import type { PersonPage } from "../../types";

function p(stem: string, overrides: Partial<PersonPage>): PersonPage {
  return {
    file: { name: stem, path: `TolkienTree/${stem}.md` },
    ar_type: "person",
    first_names: "",
    family_name: "",
    ...overrides,
  };
}

/** 41-person Tolkien family tree, transcribed from obsidianVault/TolkienTree/. */
export const tolkienByName: Record<string, PersonPage> = {
  "Finwe Noldor_hkaf": p("Finwe Noldor_hkaf", {
    first_names: "Finwe", family_name: "Noldor", sex: "male",
    married: ["[[Miriel Noldor_dpa1]]", "[[Indis Vanyar_un5a]]"],
  }),
  "Miriel Noldor_dpa1": p("Miriel Noldor_dpa1", {
    first_names: "Miriel", family_name: "Noldor", sex: "female",
    married: ["[[Finwe Noldor_hkaf]]"],
  }),
  "Indis Vanyar_un5a": p("Indis Vanyar_un5a", {
    first_names: "Indis", family_name: "Vanyar", sex: "female",
    married: ["[[Finwe Noldor_hkaf]]"],
  }),
  "Feanor Noldor_f3kv": p("Feanor Noldor_f3kv", {
    first_names: "Feanor", family_name: "Noldor", sex: "male",
    father: "[[Finwe Noldor_hkaf]]", mother: "[[Miriel Noldor_dpa1]]",
    married: ["[[Nerdanel Noldor_bgbg]]"],
  }),
  "Nerdanel Noldor_bgbg": p("Nerdanel Noldor_bgbg", {
    first_names: "Nerdanel", family_name: "Noldor", sex: "female",
  }),
  "Fingolfin Noldor_ss80": p("Fingolfin Noldor_ss80", {
    first_names: "Fingolfin", family_name: "Noldor", sex: "male",
    father: "[[Finwe Noldor_hkaf]]", mother: "[[Indis Vanyar_un5a]]",
  }),
  "Finarfin Noldor_kbdm": p("Finarfin Noldor_kbdm", {
    first_names: "Finarfin", family_name: "Noldor", sex: "male",
    father: "[[Finwe Noldor_hkaf]]", mother: "[[Indis Vanyar_un5a]]",
    married: [],
  }),
  // Feanor's seven sons
  "Maethros Noldor_tose": p("Maethros Noldor_tose", {
    first_names: "Maethros", family_name: "Noldor", sex: "male",
    father: "[[Feanor Noldor_f3kv]]", mother: "[[Nerdanel Noldor_bgbg]]",
  }),
  "Maglor Noldor_kvm8": p("Maglor Noldor_kvm8", {
    first_names: "Maglor", family_name: "Noldor", sex: "male",
    father: "[[Feanor Noldor_f3kv]]", mother: "[[Nerdanel Noldor_bgbg]]",
  }),
  "Celegorm Noldor_bo41": p("Celegorm Noldor_bo41", {
    first_names: "Celegorm", family_name: "Noldor", sex: "male",
    father: "[[Feanor Noldor_f3kv]]", mother: "[[Nerdanel Noldor_bgbg]]",
  }),
  "Caranthir Noldor_cn04": p("Caranthir Noldor_cn04", {
    first_names: "Caranthir", family_name: "Noldor", sex: "male",
    father: "[[Feanor Noldor_f3kv]]", mother: "[[Nerdanel Noldor_bgbg]]",
  }),
  "Curufin Noldor_1dlb": p("Curufin Noldor_1dlb", {
    first_names: "Curufin", family_name: "Noldor", sex: "male",
    father: "[[Feanor Noldor_f3kv]]", mother: "[[Nerdanel Noldor_bgbg]]",
  }),
  "Amrod Noldor_09zi": p("Amrod Noldor_09zi", {
    first_names: "Amrod", family_name: "Noldor", sex: "male",
    father: "[[Feanor Noldor_f3kv]]", mother: "[[Nerdanel Noldor_bgbg]]",
  }),
  "Amras Noldor_7fpo": p("Amras Noldor_7fpo", {
    first_names: "Amras", family_name: "Noldor", sex: "male",
    father: "[[Feanor Noldor_f3kv]]", mother: "[[Nerdanel Noldor_bgbg]]",
  }),
  // Curufin's son
  "Celebrimbor Noldor_jcmb": p("Celebrimbor Noldor_jcmb", {
    first_names: "Celebrimbor", family_name: "Noldor", sex: "male",
    father: "[[Curufin Noldor_1dlb]]",
  }),
  // Fingolfin's children
  "Fingon Noldor_tq7i": p("Fingon Noldor_tq7i", {
    first_names: "Fingon", family_name: "Noldor", sex: "male",
    father: "[[Fingolfin Noldor_ss80]]",
  }),
  "Turgon Noldor_s3t9": p("Turgon Noldor_s3t9", {
    first_names: "Turgon", family_name: "Noldor", sex: "male",
    father: "[[Fingolfin Noldor_ss80]]",
    married: ["[[Elenwe Vanyar_3kca]]"],
  }),
  "Aredhel Noldor_l2bb": p("Aredhel Noldor_l2bb", {
    first_names: "Aredhel", family_name: "Noldor", sex: "female",
    father: "[[Fingolfin Noldor_ss80]]",
    married: ["[[Eol Moriquendi_cyvb]]"],
  }),
  // Fingon's son
  "Gil-galad Noldor_4khq": p("Gil-galad Noldor_4khq", {
    first_names: "Gil-galad", family_name: "Noldor", sex: "male",
    father: "[[Fingon Noldor_tq7i]]",
  }),
  // Turgon's family
  "Elenwe Vanyar_3kca": p("Elenwe Vanyar_3kca", {
    first_names: "Elenwe", family_name: "Vanyar", sex: "female",
    married: ["[[Turgon Noldor_s3t9]]"],
  }),
  "Idril Celebrindal_xrtv": p("Idril Celebrindal_xrtv", {
    first_names: "Idril", family_name: "Celebrindal", sex: "female",
    father: "[[Turgon Noldor_s3t9]]", mother: "[[Elenwe Vanyar_3kca]]",
  }),
  // Aredhel's family
  "Eol Moriquendi_cyvb": p("Eol Moriquendi_cyvb", {
    first_names: "Eol", family_name: "Moriquendi", sex: "male",
    married: ["[[Aredhel Noldor_l2bb]]"],
  }),
  "Maeglin Noldor_392d": p("Maeglin Noldor_392d", {
    first_names: "Maeglin", family_name: "Noldor", sex: "male",
    DOB: 320,
    father: "[[Eol Moriquendi_cyvb]]", mother: "[[Aredhel Noldor_l2bb]]",
  }),
  // Finarfin's children
  "Galadriel Noldor_ptji": p("Galadriel Noldor_ptji", {
    first_names: "Galadriel", family_name: "Noldor", sex: "female",
    father: "[[Finarfin Noldor_kbdm]]", mother: "[[Earwen Sindarin_sxks]]",
    married: ["[[Celeborn Sindarin_aeoj]]"],
  }),
  "Angrod Noldor_u5c8": p("Angrod Noldor_u5c8", {
    first_names: "Angrod", family_name: "Noldor", sex: "male",
    father: "[[Finarfin Noldor_kbdm]]", mother: "[[Earwen Sindarin_sxks]]",
  }),
  "Aegnor Noldor_2dlc": p("Aegnor Noldor_2dlc", {
    first_names: "Aegnor", family_name: "Noldor", sex: "male",
    father: "[[Finarfin Noldor_kbdm]]", mother: "[[Earwen Sindarin_sxks]]",
  }),
  "Finrod Felagund_1n8l": p("Finrod Felagund_1n8l", {
    first_names: "Finrod", family_name: "Felagund", sex: "male",
    father: "[[Finarfin Noldor_kbdm]]", mother: "[[Earwen Sindarin_sxks]]",
  }),
  "Orodreth Noldor_533g": p("Orodreth Noldor_533g", {
    first_names: "Orodreth", family_name: "Noldor", sex: "male",
    father: "[[Finarfin Noldor_kbdm]]", mother: "[[Earwen Sindarin_sxks]]",
  }),
  // Orodreth's daughter
  "Finduilas Noldor_v0fo": p("Finduilas Noldor_v0fo", {
    first_names: "Finduilas", family_name: "Noldor", sex: "female",
    father: "[[Orodreth Noldor_533g]]",
  }),
  // Earwen (Finarfin's wife, from Sindarin line)
  "Earwen Sindarin_sxks": p("Earwen Sindarin_sxks", {
    first_names: "Earwen", family_name: "Sindarin", sex: "female",
    father: "[[Olwe Sindarin_semf]]",
    married: ["[[Finarfin Noldor_kbdm]]"],
  }),
  "Olwe Sindarin_semf": p("Olwe Sindarin_semf", {
    first_names: "Olwe", family_name: "Sindarin", sex: "male",
  }),
  // Galadriel's family
  "Celeborn Sindarin_aeoj": p("Celeborn Sindarin_aeoj", {
    first_names: "Celeborn", family_name: "Sindarin", sex: "male",
    married: ["[[Galadriel Noldor_ptji]]"],
  }),
  "Celebrian of Lothlorien_0mk4": p("Celebrian of Lothlorien_0mk4", {
    first_names: "Celebrian", family_name: "of Lothlorien", sex: "female",
    father: "[[Celeborn Sindarin_aeoj]]", mother: "[[Galadriel Noldor_ptji]]",
    married: ["[[Elrond HalfElven_37gt]]"],
  }),
  // Earendil's line
  "Tuor Eladar_ovzz": p("Tuor Eladar_ovzz", {
    first_names: "Tuor", family_name: "Eladar", sex: "male",
    married: ["[[Idril Celebrindal_xrtv]]"],
  }),
  "Elwing HalfElven_oejp": p("Elwing HalfElven_oejp", {
    first_names: "Elwing", family_name: "HalfElven", sex: "female",
    married: ["[[Earendil HalfElven_dxu7]]"],
  }),
  "Earendil HalfElven_dxu7": p("Earendil HalfElven_dxu7", {
    first_names: "Earendil", family_name: "HalfElven", sex: "male",
    father: "[[Tuor Eladar_ovzz]]", mother: "[[Idril Celebrindal_xrtv]]",
    married: ["[[Elwing HalfElven_oejp]]"],
  }),
  "Elrond HalfElven_37gt": p("Elrond HalfElven_37gt", {
    first_names: "Elrond", family_name: "HalfElven", sex: "male",
    father: "[[Earendil HalfElven_dxu7]]", mother: "[[Elwing HalfElven_oejp]]",
    married: ["[[Celebrian of Lothlorien_0mk4]]"],
  }),
  "Elros HalfElven_w8dr": p("Elros HalfElven_w8dr", {
    first_names: "Elros", family_name: "HalfElven", sex: "male",
    father: "[[Earendil HalfElven_dxu7]]", mother: "[[Elwing HalfElven_oejp]]",
  }),
  "Elladan HalfElven_9d9g": p("Elladan HalfElven_9d9g", {
    first_names: "Elladan", family_name: "HalfElven", sex: "male",
    father: "[[Elrond HalfElven_37gt]]", mother: "[[Celebrian of Lothlorien_0mk4]]",
  }),
  "Elrohir HalfElven_sd4h": p("Elrohir HalfElven_sd4h", {
    first_names: "Elrohir", family_name: "HalfElven", sex: "male",
    father: "[[Elrond HalfElven_37gt]]", mother: "[[Celebrian of Lothlorien_0mk4]]",
  }),
  "Arwen Undomiel_jwb6": p("Arwen Undomiel_jwb6", {
    first_names: "Arwen", family_name: "Undomiel", sex: "female",
    father: "[[Elrond HalfElven_37gt]]", mother: "[[Celebrian of Lothlorien_0mk4]]",
  }),
};
