```dataviewjs
// CONFIGURATION
const ROOT_PERSON   = "Daniel Pusceddu";
const VAULT_FOLDER  = "FamilyTree/People";
const SHOW_SIBLINGS = true;
// ============================================================

const CARD_W     = 130;
const CARD_H     = 58;
const H_GAP      = 20;
const SPOUSE_GAP = 12;
const V_GAP      = 120;
const MAX_LEN    = 18;

// ── Themes ───────────────────────────────────────────────────
const THEMES = {
  dark: {
    containerBorder: "#2a3a4a",
    edge:            "#6a8aaa",
    edgeSib:         "#3a5a6a",
    spouseLine:      "#88aacc",
    rootBorder:      "#7080ff",
    text:            "#ffffff",
    textRoot:        "#ffffff",
    textSib:         "#aabbcc",
    dates:           "#88aacc",
    maleFill:        "#0a2a4a",
    maleBorder:      "#2a8acc",
    femaleFill:      "#3a0a2a",
    femaleBorder:    "#cc2a7a",
    unknownFill:     "#1a2030",
    unknownBorder:   "#6a8a9a",
    sibFill:         "#0a1018",
    sibBorder:       "#3a5a6a",
    toolbarBg:       "#0a0e18",
    toolbarBorder:   "#2a3a4a",
    btnBg:           "#1e2a3a",
    btnBorder:       "#6a9abb",
    btnColor:        "#ffffff",
    toggleLabel:     "☀ Light",
  },
  light: {
    containerBorder: "#8a7a6a",
    edge:            "#5a4a3a",
    edgeSib:         "#8a7a6a",
    spouseLine:      "#4a6a8a",
    rootBorder:      "#2030aa",
    text:            "#0a0a0a",
    textRoot:        "#ffffff",
    textSib:         "#3a2a1a",
    dates:           "#3a2a1a",
    maleFill:        "#a0cce8",
    maleBorder:      "#0a4a7a",
    femaleFill:      "#e8a0c0",
    femaleBorder:    "#7a0a3a",
    unknownFill:     "#d8d0c0",
    unknownBorder:   "#5a4a3a",
    sibFill:         "#c8c0b0",
    sibBorder:       "#7a6a5a",
    toolbarBg:       "#e0d8c8",
    toolbarBorder:   "#8a7a6a",
    btnBg:           "#c8c0b0",
    btnBorder:       "#6a5a4a",
    btnColor:        "#0a0a0a",
    toggleLabel:     "🌙 Dark",
  },
};

let currentTheme = "dark";
function T() { return THEMES[currentTheme]; }

// ── 1. Load all person notes ─────────────────────────────────
const allPages = dv.pages(`"${VAULT_FOLDER}"`).where(p => p.ar_type === "person");
const byName = {};
for (const p of allPages) { byName[p.file.name] = p; }

// ── Display name maps ─────────────────────────────────────────
// stem → "First Last" for UI display
// "First Last" → stem for config lookup (ROOT_PERSON)
const stemToDisplay = {};
const displayToStem = {};
for (const [stem, page] of Object.entries(byName)) {
  const display = ((page.first_names || "") + " " + (page.family_name || "")).trim() || stem;
  stemToDisplay[stem] = display;
  // If two people have identical display names, last one wins — acceptable edge case
  displayToStem[display] = stem;
}
function displayName(stem) { return stemToDisplay[stem] || stem; }
function stemFor(display) {
  if (displayToStem[display]) return displayToStem[display];
  // Fallback: find a stem whose display name starts with the given string,
  // or whose stem starts with it (handles "Daniel Pusceddu" → "Daniel Pusceddu_alek").
  const lower = display.toLowerCase();
  for (const [disp, stem] of Object.entries(displayToStem)) {
    if (disp.toLowerCase().startsWith(lower)) return stem;
  }
  for (const stem of Object.keys(byName)) {
    if (stem.toLowerCase().startsWith(lower)) return stem;
  }
  return display; // last resort — will fail gracefully
}

// ── 2. Read gender directly from sex field ───────────────────
const gender = {};
for (const [name, page] of Object.entries(byName)) {
  const s = String((page && page.sex) || "").toLowerCase().trim();
  gender[name] = s === "male" ? "m" : s === "female" ? "f" : "u";
}
function inferGender(name) { return gender[name] || "u"; }

// ── 3. Helpers ───────────────────────────────────────────────
function resolveName(val) {
  if (!val) return null;
  if (typeof val === "object" && val.path) {
    const parts = val.path.split("/");
    return parts[parts.length - 1].replace(/\.md$/, "");
  }
  const s = String(val);
  const m = s.match(/\[\[(.+?)\]\]/);
  return m ? m[1] : s;
}

function resolveList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(resolveName).filter(Boolean);
  const n = resolveName(val);
  return n ? [n] : [];
}

function getYear(val) {
  if (!val) return "";
  if (typeof val === "object" && val.year) return String(val.year);
  const s = String(val).trim();
  const prefix = (s.match(/^[~c.]+/) || [""])[0];
  const digits = s.replace(/^[~c.]+/, "").slice(0, 4);
  return prefix + digits;
}

function trunc(s) {
  if (!s) return "";
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1) + "..." : s;
}

function getNameLines(name, page) {
  if (page && page.first_names !== undefined && page.family_name !== undefined) {
    return { first: String(page.first_names || ""), last: String(page.family_name || "") };
  }
  const parts = name.split(" ");
  const last  = parts.pop();
  return { first: parts.join(" "), last };
}

function findChildren(name) {
  const children = [];
  for (const [cName, cPage] of Object.entries(byName)) {
    const f = resolveName((cPage && cPage.father));
    const m = resolveName((cPage && cPage.mother));
    if (f === name || m === name) children.push(cName);
  }
  return children.sort((a, b) => {
    const ya = (byName[a] && byName[a].DOB && byName[a].DOB.year) || (byName[a] && byName[a].DOB) || 9999;
    const yb = (byName[b] && byName[b].DOB && byName[b].DOB.year) || (byName[b] && byName[b].DOB) || 9999;
    return parseInt(ya) - parseInt(yb);
  });
}

// ── 4. Build tree ────────────────────────────────────────────
function buildTree(rootName) {
  const units = {}, people = {}, edges = [];
  const visited = new Set();
  const bloodLine = new Set();
  let uc = 0;

  function newUnit(members, gen, dir) {
    const id = "u" + (uc++);
    units[id] = { id, members, gen, dir };
    for (const name of members) {
      if (!people[name]) people[name] = { name, page: byName[name] || null, unitId: id };
    }
    return id;
  }

  // Return the DOB year for a person stem, or Infinity as fallback.
  function dobYear(name) {
    const p = byName[name];
    if (!p) return Infinity;
    const v = p.DOB;
    if (!v) return Infinity;
    if (typeof v === "object" && v.year) return parseInt(v.year);
    const m = String(v).replace(/^[~c. ]+/, "").match(/(\d{4})/);
    return m ? parseInt(m[1]) : Infinity;
  }

  function addAncestors(name, gen, isBlood) {
    if (visited.has("anc-" + name)) return;
    visited.add("anc-" + name);
    if (isBlood) bloodLine.add(name);
    const p = byName[name];
    if (!p) return;
    const fName = resolveName((p && p.father));
    const mName = resolveName((p && p.mother));

    if (fName || mName) {
      const parentUid = newUnit([fName, mName].filter(Boolean), gen - 1, "anc");

      if (SHOW_SIBLINGS && (!siblingsBloodOnly || isBlood)) {
        // Gather all children of this parent pair, including the blood-line person.
        // Use a Set to deduplicate across father/mother lookups.
        const sibSet = new Set();
        for (const parentName of [fName, mName].filter(Boolean)) {
          for (const cName of findChildren(parentName)) sibSet.add(cName);
        }
        // Sort by DOB, falling back to vault order (Infinity sorts last).
        const allSibs = [...sibSet].sort((a, b) => dobYear(a) - dobYear(b));

        for (const sibName of allSibs) {
          const isBloodLine = sibName === name;
          const dir = isBloodLine ? ((people[sibName] && people[sibName].unitId) ? null : "anc") : "sibling";

          if (people[sibName]) {
            // Unit already exists (e.g. root person or previously visited desc).
            // Just wire the edge from parent to this existing unit.
            const existingUid = people[sibName].unitId;
            if (!edges.some(e => e.fromUnit === parentUid && e.toUnit === existingUid)) {
              edges.push({ fromUnit: parentUid, toUnit: existingUid, toName: sibName, sibling: !isBloodLine });
            }
          } else {
            // Create unit for this sibling (or the blood-line person if not yet placed).
            const sibPage    = byName[sibName];
            const sibSpouses = sibPage ? resolveList((sibPage && sibPage.married)) : [];
            const unitDir    = isBloodLine ? "anc" : "sibling";
            const uid        = newUnit([sibName, ...sibSpouses.filter(s => s !== sibName)], gen, unitDir);
            edges.push({ fromUnit: parentUid, toUnit: uid, toName: sibName, sibling: !isBloodLine });
          }
        }
      } else {
        // Siblings disabled — just wire edge from parent to blood-line person.
        const childUid = (people[name] && people[name].unitId);
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

  function addDescendants(name, gen, isBlood) {
    if (visited.has("desc-" + name)) return;
    visited.add("desc-" + name);
    if (isBlood) bloodLine.add(name);
    if (!people[name]) {
      const p = byName[name];
      const spouses = p ? resolveList((p && p.married)) : [];
      newUnit([name, ...spouses.filter(s => s !== name)], gen, "desc");
      if (!siblingsBloodOnly) {
        for (const spouse of spouses) addAncestors(spouse, gen, false);
      }
    }
    for (const cName of findChildren(name)) {
      if (!visited.has("desc-" + cName)) addDescendants(cName, gen + 1, true);
      const parentUid = (people[name] && people[name].unitId);
      const childUid  = (people[cName] && people[cName].unitId);
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
  const rootPage0   = byName[rootName];
  const rootSpouses0 = rootPage0 ? resolveList((rootPage0 && rootPage0.married)) : [];
  newUnit([rootName, ...rootSpouses0.filter(s => s !== rootName)], 0, "root");

  addAncestors(rootName, 0, true);
  addDescendants(rootName, 0, true);

  if (!siblingsBloodOnly) {
    const rootPage    = byName[rootName];
    const rootSpouses = rootPage ? resolveList((rootPage && rootPage.married)) : [];
    for (const member of rootSpouses.filter(s => s !== rootName)) {
      addAncestors(member, 0, false);
    }
  }

  return { units, people, edges, bloodLine };
}


// ── 5. Layout ────────────────────────────────────────────────
let currentLayout       = "horizontal"; // "horizontal" | "vertical"
let siblingsBloodOnly   = true;

function layout(units, edges) {
  if (currentLayout === "vertical") {
    // Vertical hierarchical layout — mirrors horizontal but rotated 90°.
    // Generations become columns (x axis). Children spread vertically
    // under their parent's y centre. Ancestors placed to the left,
    // descendants to the right.

    function unitH(u) {
      return u.members.length * CARD_H + (u.members.length - 1) * SPOUSE_GAP;
    }
    function unitDobV(u) {
      const name = u.members[0];
      const p = byName[name];
      if (!p) return Infinity;
      const v = p.DOB;
      if (!v) return Infinity;
      if (typeof v === "object" && v.year) return parseInt(v.year);
      const m = String(v).replace(/^[~c. ]+/, "").match(/(\d{4})/);
      return m ? parseInt(m[1]) : Infinity;
    }

    // Unified parent→children map (includes siblings).
    const childrenOf = {};
    const parentOf   = {};
    for (const e of edges) {
      const pu = units[e.fromUnit], cu = units[e.toUnit];
      if (!pu || !cu) continue;
      const [ancId, descId] = pu.gen < cu.gen ? [e.fromUnit, e.toUnit] : [e.toUnit, e.fromUnit];
      if (!childrenOf[ancId]) childrenOf[ancId] = [];
      if (!childrenOf[ancId].includes(descId)) childrenOf[ancId].push(descId);
      const existing = parentOf[descId];
      const ancDir = units[ancId].dir;
      if (!existing) {
        parentOf[descId] = ancId;
      } else if (units[existing].dir === "sibling" && ancDir !== "sibling") {
        parentOf[descId] = ancId;
      }
    }

    function isLeafV(uid) {
      const u = units[uid];
      if (!u || u.dir === "sibling") return false;
      const ch = (childrenOf[uid] || []).filter(cid => units[cid] && units[cid].dir !== "anc");
      return ch.length === 0;
    }
    const subtreeHeightCache = {};
    function subtreeHeight(uid) {
      if (subtreeHeightCache[uid] !== undefined) return subtreeHeightCache[uid];
      const u = units[uid];
      if (!u) return 0;
      if (u.dir === "sibling") return subtreeHeightCache[uid] = unitH(u);
      if (isLeafV(uid))        return subtreeHeightCache[uid] = 0;
      const ch = (childrenOf[uid] || []).filter(cid => !isLeafV(cid))
                  .sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
      if (ch.length === 0) return subtreeHeightCache[uid] = unitH(u);
      let h = ch.reduce((sum, cid) => sum + subtreeHeight(cid), 0) + (ch.length - 1) * H_GAP;
      h = Math.max(h, unitH(u));
      return subtreeHeightCache[uid] = h;
    }

    const allUnitIds = Object.keys(units);
    const descUnits  = allUnitIds.filter(id => units[id].gen >= 0 && units[id].dir !== "anc");
    const ancUnits   = allUnitIds.filter(id => units[id].gen < 0 || units[id].dir === "anc");
    const descRoots  = descUnits.filter(id => {
      const u = units[id];
      if (u.dir === "anc") return false;
      if (u.dir === "root") return true;  // root always anchors the descent tree
      const p = parentOf[id];
      if (p && units[p].dir === "anc") return false;
      return !p || units[p].gen < 0;
    });

    function assignY(uid, centerY) {
      const u = units[uid];
      if (!u) return;
      u.y = centerY - unitH(u) / 2;
      u.width  = CARD_W;
      u.height = unitH(u);
      // Place all children in DOB order (oldest first/top). Each child's effective span is
      // its card height if it is a leaf, or subtreeHeight if it has descendants. This
      // preserves age ordering across all children regardless of whether they have subtrees.
      const eligible = (childrenOf[uid] || [])
        .filter(cid => {
          const cu = units[cid];
          if (!cu) return false;
          if (cu.dir === "sibling") {
            const pid = parentOf[cid];
            return pid && units[pid] && units[pid].gen >= 0 && units[pid].dir !== "anc";
          }
          return cu.dir !== "anc";
        })
        .sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
      if (eligible.length === 0) return;

      const totalSpan = eligible.reduce((sum, cid) =>
          sum + (isLeafV(cid) ? unitH(units[cid]) : subtreeHeight(cid)), 0)
        + (eligible.length - 1) * H_GAP;
      let y = centerY - totalSpan / 2;
      for (const cid of eligible) {
        if (isLeafV(cid)) {
          units[cid].y      = y;
          units[cid].width  = CARD_W;
          units[cid].height = unitH(units[cid]);
          y += unitH(units[cid]) + H_GAP;
        } else {
          const span = subtreeHeight(cid);
          assignY(cid, y + span / 2);
          y += span + H_GAP;
        }
      }
    }

    {
      const totalSpan = descRoots.reduce((sum, id) => sum + subtreeHeight(id), 0) + (descRoots.length - 1) * H_GAP;
      let y = -totalSpan / 2;
      for (const id of descRoots) {
        assignY(id, y + subtreeHeight(id) / 2);
        y += subtreeHeight(id) + H_GAP;
      }
    }

    // x coordinates: each generation is a column.
    const byGen = {};
    for (const id of allUnitIds) {
      const g = units[id].gen;
      (byGen[g] = byGen[g] || []).push(id);
    }
    for (const [gen, ids] of Object.entries(byGen)) {
      const x = parseInt(gen) * (CARD_W + V_GAP);
      for (const id of ids) {
        if (units[id].y !== undefined) { units[id].x = x; units[id].width = CARD_W; units[id].height = unitH(units[id]); }
      }
    }

    // Return the y-centre of a unit's parent, used to keep siblings contiguous
    // during overlap resolution. Falls back to the unit's own y-centre so that
    // parentless units sort stably among themselves.
    function parentCentreY(id) {
      const pid = parentOf[id];
      if (pid && units[pid] && units[pid].y !== undefined) {
        return units[pid].y + unitH(units[pid]) / 2;
      }
      const u = units[id];
      return u.y + unitH(u) / 2;
    }

    function resolveOverlapsV(genIds) {
      // Sort by (parent y-centre, own y) so siblings from the same parent stay
      // contiguous — the push-apart pass then separates family groups without
      // interleaving children of different parents.
      const placed = genIds.filter(id => units[id].y !== undefined)
        .sort((a, b) => {
          const pa = parentCentreY(a), pb = parentCentreY(b);
          if (pa !== pb) return pa - pb;
          return units[a].y - units[b].y;
        });
      if (placed.length < 2) return;
      for (let i = 1; i < placed.length; i++) {
        const prev = units[placed[i - 1]], curr = units[placed[i]];
        if (curr.y < prev.y + unitH(prev) + H_GAP) curr.y = prev.y + unitH(prev) + H_GAP;
      }
      for (let i = placed.length - 2; i >= 0; i--) {
        const next = units[placed[i + 1]], curr = units[placed[i]];
        if (curr.y > next.y - unitH(curr) - H_GAP) curr.y = next.y - unitH(curr) - H_GAP;
      }
      const top    = units[placed[0]].y;
      const bottom = units[placed[placed.length - 1]].y + unitH(units[placed[placed.length - 1]]);
      const shift  = (top + bottom) / 2;
      for (const id of placed) units[id].y -= shift;
    }

    for (const [gen, ids] of Object.entries(byGen)) {
      if (parseInt(gen) >= 0) resolveOverlapsV(ids);
    }

    const ancGens = [...new Set(ancUnits.map(id => units[id].gen))].sort((a, b) => b - a);
    for (const gen of ancGens) {
      const ids = byGen[gen] || [];
      for (const id of ids) {
        const u = units[id];
        u.width = CARD_W; u.height = unitH(u);
        u.x = gen * (CARD_W + V_GAP);
        // Centre over already-placed children (desc-side).
        const placedCh = (childrenOf[id] || []).filter(cid => (units[cid] && units[cid].y) !== undefined);
        if (placedCh.length > 0) {
          const minY = Math.min(...placedCh.map(cid => units[cid].y));
          const maxY = Math.max(...placedCh.map(cid => units[cid].y + unitH(units[cid])));
          u.y = (minY + maxY) / 2 - unitH(u) / 2;
        } else {
          u.y = -unitH(u) / 2;
        }
        // Now place sibling children that were deferred from assignY.
        const sibCh = (childrenOf[id] || [])
          .filter(cid => units[cid] && units[cid].dir === "sibling" && units[cid].y === undefined)
          .sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
        if (sibCh.length > 0) {
          // Also include the blood-line child(ren) of this ancestor for ordering.
          const bloodCh = (childrenOf[id] || [])
            .filter(cid => units[cid] && units[cid].dir !== "sibling" && units[cid].y !== undefined)
            .sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
          const allCh = [...bloodCh, ...sibCh]
            .sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
          const totalH = allCh.reduce((s, cid) => s + unitH(units[cid]), 0) + (allCh.length - 1) * H_GAP;
          const ancCentreY = u.y + unitH(u) / 2;
          let y = ancCentreY - totalH / 2;
          for (const cid of allCh) {
            const childGen = units[cid].gen;
            units[cid].y      = y;
            units[cid].x      = childGen * (CARD_W + V_GAP);  // column for child's own gen
            units[cid].width  = CARD_W;
            units[cid].height = unitH(units[cid]);
            y += unitH(units[cid]) + H_GAP;
          }
        }
      }
      resolveOverlapsV(ids);
    }
    // Final pass: resolve every gen now that all units are placed.
    for (const [gen, ids] of Object.entries(byGen)) {
      resolveOverlapsV(ids.filter(id => units[id].y !== undefined));
    }
    return;
  }

  // ── Horizontal hierarchical layout ───────────────────────────
  // Siblings are treated as ordinary children of their parent unit
  // for layout purposes — folded into subtreeWidth from the start so
  // the bottom-up width calculation already accounts for them.

  function unitW(u) {
    return u.members.length * CARD_W + (u.members.length - 1) * SPOUSE_GAP;
  }

  function unitDob(u) {
    const name = u.members[0];
    const p = byName[name];
    if (!p) return Infinity;
    const v = p.DOB;
    if (!v) return Infinity;
    if (typeof v === "object" && v.year) return parseInt(v.year);
    const m = String(v).replace(/^[~c. ]+/, "").match(/(\d{4})/);
    return m ? parseInt(m[1]) : Infinity;
  }

  // Build a unified childrenOf map that includes sibling edges.
  // Both blood children and sibling units are "children" of their
  // parent unit for layout purposes; they just render differently.
  const childrenOf = {}; // unitId -> [unitId]
  const parentOf   = {}; // unitId -> unitId  (prefer desc/root parents over sibling parents)
  for (const e of edges) {
    const pu = units[e.fromUnit], cu = units[e.toUnit];
    if (!pu || !cu) continue;
    const [ancId, descId] = pu.gen < cu.gen ? [e.fromUnit, e.toUnit] : [e.toUnit, e.fromUnit];
    if (!childrenOf[ancId]) childrenOf[ancId] = [];
    if (!childrenOf[ancId].includes(descId)) childrenOf[ancId].push(descId);
    // Prefer a desc/root/anc parent over a sibling parent so that blood
    // children don't get orphaned when a sibling unit edge is seen first.
    const existing = parentOf[descId];
    const ancDir = units[ancId].dir;
    if (!existing) {
      parentOf[descId] = ancId;
    } else if (units[existing].dir === "sibling" && ancDir !== "sibling") {
      parentOf[descId] = ancId;
    }
  }

  // ── Step 1: Bottom-up subtree width ──────────────────────────
  // Sibling units are included in their parent's subtree span so that
  // assignX places them in one pass rather than deferring to Step 6.
  // A unit is a leaf only when it has no non-ancestor, non-sibling children;
  // a parent that has only sibling children still gets a real span.
  function isLeaf(uid) {
    const u = units[uid];
    if (!u || u.dir === "sibling") return false;
    const ch = (childrenOf[uid] || []).filter(
      cid => units[cid] && units[cid].dir !== "anc" && units[cid].dir !== "sibling"
    );
    return ch.length === 0;
  }
  const subtreeWidthCache = {};
  function subtreeWidth(uid) {
    if (subtreeWidthCache[uid] !== undefined) return subtreeWidthCache[uid];
    const u = units[uid];
    if (!u) return 0;
    if (u.dir === "sibling") return subtreeWidthCache[uid] = unitW(u);
    // All eligible children for span: blood children + sibling units (exclude anc).
    const allCh = (childrenOf[uid] || []).filter(
      cid => units[cid] && units[cid].dir !== "anc"
    );
    if (allCh.length === 0) return subtreeWidthCache[uid] = unitW(u);
    // Only non-leaf children drive the recursive span.
    const nonLeafCh = allCh.filter(cid => !isLeaf(cid));
    if (nonLeafCh.length === 0) return subtreeWidthCache[uid] = unitW(u);
    let w = nonLeafCh.reduce((sum, cid) => sum + subtreeWidth(cid), 0)
            + (nonLeafCh.length - 1) * H_GAP;
    w = Math.max(w, unitW(u));
    return subtreeWidthCache[uid] = w;
  }

  // ── Step 2: Partition units ───────────────────────────────────
  const allUnitIds = Object.keys(units);
  const descUnits  = allUnitIds.filter(id => units[id].gen >= 0 && units[id].dir !== "anc");
  const ancUnits   = allUnitIds.filter(id => units[id].gen < 0 || units[id].dir === "anc");

  // Descendant roots: gen>=0 units whose parent (if any) is an ancestor,
  // AND which are not themselves ancestor-type units.
  // Ancestor units at gen=0 (grandparents with no recorded parents) must
  // not be treated as descent roots — they'd trigger assignX on their
  // sibling children, creating a second independent tree centred at x=0.
  const descRoots = descUnits.filter(id => {
    const u = units[id];
    if (u.dir === "anc") return false;
    if (u.dir === "root") return true;  // root always anchors the descent tree
    const pid = parentOf[id];
    if (pid && units[pid].dir === "anc") return false;
    return !pid || units[pid].gen < 0;
  });

  // ── Step 3: Top-down x assignment ────────────────────────────
  function assignX(uid, centerX) {
    const u = units[uid];
    if (!u) return;
    u.x = centerX - unitW(u) / 2;
    u.width  = unitW(u);
    u.height = CARD_H;
    // Place all children in DOB order (oldest left). Each child's effective span is its
    // card width if it is a leaf, or subtreeWidth if it has descendants. This preserves
    // age ordering across all children regardless of whether they have their own subtrees.
    // Sibling units are always eligible — no ancestor-parent exclusion.
    const eligible = (childrenOf[uid] || [])
      .filter(cid => {
        const cu = units[cid];
        if (!cu || cu.dir === "anc") return false;
        return true;
      })
      .sort((a, b) => unitDob(units[a]) - unitDob(units[b]));
    if (eligible.length === 0) return;

    const totalSpan = eligible.reduce((sum, cid) =>
        sum + (isLeaf(cid) ? unitW(units[cid]) : subtreeWidth(cid)), 0)
      + (eligible.length - 1) * H_GAP;
    let x = centerX - totalSpan / 2;
    for (const cid of eligible) {
      if (isLeaf(cid)) {
        units[cid].x      = x;
        units[cid].width  = unitW(units[cid]);
        units[cid].height = CARD_H;
        x += unitW(units[cid]) + H_GAP;
      } else {
        const span = subtreeWidth(cid);
        assignX(cid, x + span / 2);
        x += span + H_GAP;
      }
    }
  }

  {
    const totalSpan = descRoots.reduce((sum, id) => sum + subtreeWidth(id), 0)
                      + (descRoots.length - 1) * H_GAP;
    let x = -totalSpan / 2;
    for (const id of descRoots) {
      assignX(id, x + subtreeWidth(id) / 2);
      x += subtreeWidth(id) + H_GAP;
    }
  }

  // ── Step 4: y coordinates ─────────────────────────────────────
  const byGen = {};
  for (const id of allUnitIds) {
    const g = units[id].gen;
    (byGen[g] = byGen[g] || []).push(id);
  }
  for (const [gen, ids] of Object.entries(byGen)) {
    const y = parseInt(gen) * (CARD_H + V_GAP);
    for (const id of ids) {
      if (units[id].x !== undefined) units[id].y = y;
    }
  }

  // ── Step 5: Overlap resolution (bidirectional) ────────────────
  // Resolve descendant generations first, then place ancestors over
  // the final resolved positions.

  // Return the x-centre of a unit's parent, used to keep siblings contiguous
  // during overlap resolution. Falls back to the unit's own x-centre so that
  // parentless units sort stably among themselves.
  function parentCentreX(id) {
    const pid = parentOf[id];
    if (pid && units[pid] && units[pid].x !== undefined) {
      return units[pid].x + unitW(units[pid]) / 2;
    }
    const u = units[id];
    return u.x + unitW(u) / 2;
  }

  function resolveOverlaps(genIds) {
    // Sort by (parent x-centre, own x) so siblings from the same parent stay
    // contiguous — the push-apart pass then separates family groups without
    // interleaving children of different parents.
    const placed = genIds
      .filter(id => units[id].x !== undefined)
      .sort((a, b) => {
        const pa = parentCentreX(a), pb = parentCentreX(b);
        if (pa !== pb) return pa - pb;
        return units[a].x - units[b].x;
      });
    if (placed.length < 2) return;
    // Forward: push right.
    for (let i = 1; i < placed.length; i++) {
      const prev = units[placed[i - 1]], curr = units[placed[i]];
      const minX = prev.x + unitW(prev) + H_GAP;
      if (curr.x < minX) curr.x = minX;
    }
    // Backward: push left.
    for (let i = placed.length - 2; i >= 0; i--) {
      const next = units[placed[i + 1]], curr = units[placed[i]];
      const maxX = next.x - unitW(curr) - H_GAP;
      if (curr.x > maxX) curr.x = maxX;
    }
    // Re-centre.
    const left  = units[placed[0]].x;
    const right = units[placed[placed.length - 1]].x + unitW(units[placed[placed.length - 1]]);
    const shift = (left + right) / 2;
    for (const id of placed) units[id].x -= shift;
  }

  // First pass: resolve descendant gens (before ancestor placement).
  for (const [gen, ids] of Object.entries(byGen)) {
    if (parseInt(gen) >= 0) resolveOverlaps(ids);
  }

  // ── Step 6: Ancestors over resolved descendant positions ─────
  const ancGens = [...new Set(ancUnits.map(id => units[id].gen))].sort((a, b) => b - a);
  for (const gen of ancGens) {
    const ids = byGen[gen] || [];
    for (const id of ids) {
      const u = units[id];
      u.width  = unitW(u);
      u.height = CARD_H;
      u.y      = gen * (CARD_H + V_GAP);
      // Centre over already-placed children.
      const placedCh = (childrenOf[id] || []).filter(cid => (units[cid] && units[cid].x) !== undefined);
      if (placedCh.length > 0) {
        const minX = Math.min(...placedCh.map(cid => units[cid].x));
        const maxX = Math.max(...placedCh.map(cid => units[cid].x + unitW(units[cid])));
        u.x = (minX + maxX) / 2 - unitW(u) / 2;
      } else {
        u.x = -unitW(u) / 2;
      }
      // Place any sibling children that were not reached by assignX
      // (e.g. siblings of the root person at gen 0).
      const unplacedSibs = (childrenOf[id] || [])
        .filter(cid => units[cid] && units[cid].dir === "sibling" && units[cid].x === undefined)
        .sort((a, b) => unitDob(units[a]) - unitDob(units[b]));
      if (unplacedSibs.length > 0) {
        // Collect all children of this ancestor (placed blood + unplaced sibs)
        // and lay them out together in DOB order centred on the ancestor.
        const allCh = (childrenOf[id] || [])
          .sort((a, b) => unitDob(units[a]) - unitDob(units[b]));
        const totalW = allCh.reduce((s, cid) => s + unitW(units[cid]), 0) + (allCh.length - 1) * H_GAP;
        const ancCentreX = u.x + unitW(u) / 2;
        let cx = ancCentreX - totalW / 2;
        const childY = (parseInt(gen) + 1) * (CARD_H + V_GAP);
        for (const cid of allCh) {
          units[cid].x      = cx;
          units[cid].y      = childY;
          units[cid].width  = unitW(units[cid]);
          units[cid].height = CARD_H;
          cx += unitW(units[cid]) + H_GAP;
        }
      }
    }
    resolveOverlaps(ids);
  }

  // Final pass: resolve every gen now that all units are placed.
  for (const [gen, ids] of Object.entries(byGen)) {
    resolveOverlaps(ids.filter(id => units[id].x !== undefined));
  }
}

// ── 6. Card colours ──────────────────────────────────────────
function cardColors(name, isRoot, isSpouse, isSib) {
  const t = T();
  const g = inferGender(name);
  const fill   = g === "m" ? t.maleFill : g === "f" ? t.femaleFill : t.unknownFill;
  const border = isRoot ? t.rootBorder
               : isSib  ? t.sibBorder
               : g === "m" ? t.maleBorder : g === "f" ? t.femaleBorder : t.unknownBorder;
  const text   = isRoot ? t.textRoot : isSib ? t.textSib : t.text;
  return { fill, border, text };
}

// ── 7. Render ────────────────────────────────────────────────
let currentRoot = stemFor(ROOT_PERSON);
let outerContainer = null;
const navHistory = [];

function render(rootName) {
  currentRoot = rootName;
  const t = T();

  if (outerContainer) {
    outerContainer.remove();
  }

  outerContainer = dv.el("div", "", {
    attr: { style: "border:1px solid " + t.containerBorder + "; border-radius:8px; overflow:hidden;" }
  });

  // Toolbar
  const toolbar = outerContainer.createEl("div", {
    attr: {
      style: "display:flex; align-items:center; gap:10px; padding:7px 12px;" +
             "background:" + t.toolbarBg + "; border-bottom:1px solid " + t.toolbarBorder + ";"
    }
  });

  const btnStyle = "background:" + t.btnBg + "; border:1px solid " + t.btnBorder + ";" +
                   "color:" + t.btnColor + "; padding:3px 10px; border-radius:4px;" +
                   "cursor:pointer; font-size:12px;";

  toolbar.createEl("span", {
    text: displayName(rootName),
    attr: { style: "font-size:13px; font-weight:600; color:" + t.rootBorder + "; margin-right:auto;" }
  });

  const backBtn = toolbar.createEl("button", {
    text: "← Back",
    attr: { style: btnStyle + (navHistory.length === 0 ? " opacity:0.35; cursor:default;" : "") }
  });
  backBtn.addEventListener("click", () => {
    if (navHistory.length > 0) render(navHistory.pop());
  });

  const homeBtn = toolbar.createEl("button", {
    text: "⌂ Home",
    attr: { style: btnStyle }
  });
  homeBtn.addEventListener("click", () => {
    navHistory.length = 0;
    render(stemFor(ROOT_PERSON));
  });

  const layoutBtn = toolbar.createEl("button", {
    text: currentLayout === "horizontal" ? "⇄ Vertical" : "↕ Horizontal",
    attr: { style: btnStyle }
  });
  layoutBtn.addEventListener("click", () => {
    currentLayout = currentLayout === "horizontal" ? "vertical" : "horizontal";
    render(currentRoot);
  });

  const sibBtn = toolbar.createEl("button", {
    text: siblingsBloodOnly ? "Show All Siblings" : "Blood Siblings Only",
    attr: { style: btnStyle }
  });
  sibBtn.addEventListener("click", () => {
    siblingsBloodOnly = !siblingsBloodOnly;
    render(currentRoot);
  });

  const themeBtn = toolbar.createEl("button", {
    text: t.toggleLabel,
    attr: { style: btnStyle }
  });
  themeBtn.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    render(currentRoot);
  });

  // SVG
  const { units, people, edges, bloodLine } = buildTree(rootName);

  layout(units, edges);


  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const u of Object.values(units)) {
    if (u.x === undefined) continue;
    minX = Math.min(minX, u.x);
    maxX = Math.max(maxX, u.x + u.width);
    minY = Math.min(minY, u.y);
    maxY = Math.max(maxY, u.y + u.height);
  }
  const pad  = 40;
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const ox   = -minX + pad;
  const oy   = -minY + pad;

  let edgeSVG = "";
  let cardSVG = "";
  const edgeSeen = new Set();

  for (const e of edges) {
    const fromU = units[e.fromUnit];
    const toU   = units[e.toUnit];
    if (!fromU || !toU || fromU.x === undefined || toU.x === undefined) continue;
    const key = [e.fromUnit, e.toUnit].sort().join("|");
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    const col  = e.sibling ? t.edgeSib : t.edge;
    const dash = e.sibling ? " stroke-dasharray='5,3'" : "";
    let d;

    if (currentLayout === "horizontal") {
      const x1    = fromU.x + fromU.width / 2 + ox;
      const y1    = fromU.y + CARD_H + oy;
      const toIdx = e.toName ? toU.members.indexOf(e.toName) : 0;
      const toOff = toIdx > 0 ? toIdx * (CARD_W + SPOUSE_GAP) : 0;
      const x2    = toU.x + toOff + CARD_W / 2 + ox;
      const y2    = toU.y + oy;
      const midY  = (y1 + y2) / 2;
      d = "M" + x1 + "," + y1 + " C" + x1 + "," + midY + " " + x2 + "," + midY + " " + x2 + "," + y2;
    } else {
      // Ancestors are to the left (lower gen = more negative x), descendants to the right.
      // Connect from the right edge of the ancestor unit to the left edge of the descendant unit.
      const [ancU, chU] = fromU.gen < toU.gen ? [fromU, toU] : [toU, fromU];
      const toIdx = e.toName ? chU.members.indexOf(e.toName) : 0;
      const toOff = toIdx > 0 ? toIdx * (CARD_H + SPOUSE_GAP) : 0;
      const x1   = ancU.x + ancU.width + ox;
      const y1   = ancU.y + ancU.height / 2 + oy;
      const x2   = chU.x + ox;
      const y2   = chU.y + toOff + CARD_H / 2 + oy;
      const midX = (x1 + x2) / 2;
      d = "M" + x1 + "," + y1 + " C" + midX + "," + y1 + " " + midX + "," + y2 + " " + x2 + "," + y2;
    }

    edgeSVG += "<path d='" + d + "' fill='none' stroke='" + col + "' stroke-width='1.5'" + dash + "/>";
  }

  for (const u of Object.values(units)) {
    if (u.x === undefined) continue;
    u.members.forEach((name, i) => {
      const p      = byName[name];
      const cx     = currentLayout === "horizontal"
        ? u.x + i * (CARD_W + SPOUSE_GAP) + ox
        : u.x + ox;
      const cy     = currentLayout === "horizontal"
        ? u.y + oy
        : u.y + i * (CARD_H + SPOUSE_GAP) + oy;
      const isRoot   = name === rootName;
      const isSpouse = i > 0;
      const isSib    = u.dir === "sibling";
      const dob      = getYear((p && p.DOB));
      const dod      = getYear((p && p.DOD));
      const dates    = dob && dod ? dob + " - " + dod : dob || dod || "";
      const { first, last } = getNameLines(name, p);
      const { fill, border, text: textCol } = cardColors(name, isRoot, isSpouse, isSib);
      const datesCol = isRoot ? "rgba(255,255,255,0.75)" : t.dates;
      const sw       = isRoot ? "4" : "1";
      const fw       = isRoot ? "700" : "500";
      const mid      = cx + CARD_W / 2;

      if (isSpouse) {
        if (currentLayout === "horizontal") {
          const lx1 = u.x + i * (CARD_W + SPOUSE_GAP) - SPOUSE_GAP + ox;
          const ly  = u.y + CARD_H / 2 + oy;
          edgeSVG += "<line x1='" + lx1 + "' y1='" + ly + "' x2='" + (lx1 + SPOUSE_GAP) + "' y2='" + ly + "' stroke='" + t.spouseLine + "' stroke-width='2' stroke-dasharray='3,2'/>";
        } else {
          const lx  = u.x + CARD_W / 2 + ox;
          const ly1 = u.y + i * (CARD_H + SPOUSE_GAP) - SPOUSE_GAP + oy;
          edgeSVG += "<line x1='" + lx + "' y1='" + ly1 + "' x2='" + lx + "' y2='" + (ly1 + SPOUSE_GAP) + "' stroke='" + t.spouseLine + "' stroke-width='2' stroke-dasharray='3,2'/>";
        }
      }

      cardSVG += "<g class='person-card' data-name='" + name.replace(/'/g, "&#39;") + "' style='cursor:pointer'>";
      cardSVG += "<rect x='" + cx + "' y='" + cy + "' width='" + CARD_W + "' height='" + CARD_H + "' rx='6' fill='" + fill + "' stroke='" + border + "' stroke-width='" + sw + "'/>";

      const firstIsUnknown = !first || first.toLowerCase() === "unknown";
      const lastIsUnknown  = !last  || last.toLowerCase()  === "unknown";
      const firstTxt  = firstIsUnknown ? "UNKNOWN" : trunc(first);
      const lastTxt   = lastIsUnknown  ? "UNKNOWN" : trunc(last);
      const firstCol  = firstIsUnknown ? t.dates : textCol;
      const lastCol   = lastIsUnknown  ? t.dates : textCol;
      const firstSize = firstIsUnknown ? "10" : "14";
      const lastSize  = lastIsUnknown  ? "10" : "14";

      cardSVG += "<text x='" + mid + "' y='" + (cy + 16) + "' text-anchor='middle' font-size='" + firstSize + "' font-weight='" + fw + "' fill='" + firstCol + "' font-family='var(--font-interface)'>" + firstTxt + "</text>";
      cardSVG += "<text x='" + mid + "' y='" + (cy + 29) + "' text-anchor='middle' font-size='" + lastSize  + "' font-weight='" + fw + "' fill='" + lastCol  + "' font-family='var(--font-interface)'>" + lastTxt  + "</text>";
      cardSVG += "<text x='" + mid + "' y='" + (cy + 48) + "' text-anchor='middle' font-size='11' fill='" + datesCol + "' font-family='var(--font-interface)'>" + dates + "</text>";
      cardSVG += "</g>";
    });
  }

  const svgContainer = outerContainer.createEl("div", {
    attr: { style: "overflow:auto; max-height:80vh;" }
  });

  svgContainer.innerHTML = "<svg width='" + svgW + "' height='" + svgH + "' xmlns='http://www.w3.org/2000/svg'><g id='edges'>" + edgeSVG + "</g><g id='cards'>" + cardSVG + "</g></svg>";

  svgContainer.querySelectorAll(".person-card").forEach(el => {
    el.addEventListener("click", () => {
      const name = el.getAttribute("data-name");
      if (name !== rootName) {
        navHistory.push(rootName);
        render(name);
      }
    });
    el.addEventListener("dblclick", (evt) => {
      evt.stopPropagation();
      const name = el.getAttribute("data-name");
      const file = app.vault.getAbstractFileByPath(VAULT_FOLDER + "/" + name + ".md");
      if (file) app.workspace.getLeaf(false).openFile(file);
    });
  });
}

render(stemFor(ROOT_PERSON));
```