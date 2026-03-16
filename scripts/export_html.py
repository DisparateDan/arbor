#!/usr/bin/env python3
"""
export_html.py
Exports Obsidian family tree notes to a standalone interactive HTML file.

Usage:
    python3 export_html.py
    python3 export_html.py --vault ~/Obsidian/PersonalDB --output family.html
    python3 export_html.py --root "Daniel Pusceddu"
"""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML is required: sudo apt install python3-yaml")
    sys.exit(1)

DEFAULT_VAULT  = "~/Obsidian/PersonalDB"
DEFAULT_FOLDER = "FamilyTree/People"
DEFAULT_ROOT   = "Daniel Pusceddu"
DEFAULT_OUTPUT = "family.html"


# ── Data loading (mirrors GEDCOM exporter) ────────────────────────────────────

def parse_frontmatter(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return None
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None


def resolve_link(val) -> str | None:
    if not val:
        return None
    if isinstance(val, dict) and "path" in val:
        return Path(val["path"]).stem
    s = str(val).strip()
    m = re.match(r"\[\[(.+?)(?:\|.+?)?\]\]", s)
    return m.group(1) if m else (s or None)


def resolve_list(val) -> list[str]:
    if not val:
        return []
    if isinstance(val, list):
        return [r for v in val if (r := resolve_link(v))]
    r = resolve_link(val)
    return [r] if r else []


def format_year(val) -> str:
    """Extract a display year/date string from a DOB/DOD value."""
    if not val:
        return ""
    if isinstance(val, dict):
        y = val.get("year")
        return str(int(y)) if y else ""
    if isinstance(val, date):
        return str(val.year)
    s = str(val).strip()
    prefix = ""
    m = re.match(r"^([~c]+\.?)\s*", s)
    if m:
        prefix = "~"
        s = s[m.end():]
    m = re.match(r"^(\d{4})", s)
    return (prefix + m.group(1)) if m else ""


def load_people(people_dir: Path) -> dict[str, dict]:
    people = {}
    for md in people_dir.glob("*.md"):
        fm = parse_frontmatter(md)
        if not fm or fm.get("ar_type") != "person":
            continue
        name = md.stem
        people[name] = {
            "name":        name,
            "first_names": str(fm.get("first_names") or "").strip(),
            "family_name": str(fm.get("family_name") or "").strip(),
            "sex":         str(fm.get("sex") or "").strip().lower(),
            "DOB":         format_year(fm.get("DOB")),
            "DOD":         format_year(fm.get("DOD")),
            "father":      resolve_link(fm.get("father")),
            "mother":      resolve_link(fm.get("mother")),
            "married":     resolve_list(fm.get("married")),
        }
    return people


# ── HTML template ─────────────────────────────────────────────────────────────

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Family Tree</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  #toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    flex-shrink: 0;
  }
  #tree-container {
    flex: 1;
    overflow: auto;
    padding: 20px;
  }
  svg .person-card { cursor: pointer; }
  svg .person-card rect { transition: filter 0.15s; }
  svg .person-card:hover rect { filter: brightness(1.15); }
</style>
</head>
<body>
<div id="toolbar"></div>
<div id="tree-container"></div>

<script>
// ── Embedded data ─────────────────────────────────────────────
const PEOPLE    = __PEOPLE_JSON__;
const ROOT_NAME = __ROOT_NAME_JSON__;

// ── Themes ────────────────────────────────────────────────────
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
    bodyBg:          "#0f1320",
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
    bodyBg:          "#f0ebe0",
    toggleLabel:     "🌙 Dark",
  },
};

let currentTheme = "dark";
function T() { return THEMES[currentTheme]; }

// ── Configuration ─────────────────────────────────────────────
const SHOW_SIBLINGS = true;

const CARD_W     = 120;
const CARD_H     = 58;
const H_GAP      = 20;
const SPOUSE_GAP = 12;
const V_GAP      = 120;
const MAX_LEN    = 14;

// ── Display names ─────────────────────────────────────────────
function displayName(stem) {
  const p = PEOPLE[stem];
  if (!p) return stem;
  return ((p.first_names || "") + " " + (p.family_name || "")).trim() || stem;
}

// ── Helpers ───────────────────────────────────────────────────
function inferGender(name) {
  const p = PEOPLE[name];
  if (!p) return "u";
  const s = (p.sex || "").toLowerCase();
  return s === "male" ? "m" : s === "female" ? "f" : "u";
}

function getYear(val) {
  if (!val) return "";
  const s = String(val).trim();
  const prefix = (s.match(/^[~c.]+/) || [""])[0];
  const digits = s.replace(/^[~c.]+/, "").slice(0, 4);
  return prefix + digits;
}

function trunc(s) {
  if (!s) return "";
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1) + "..." : s;
}

function getNameLines(name) {
  const p = PEOPLE[name];
  if (p) return { first: String(p.first_names || ""), last: String(p.family_name || "") };
  const parts = name.split(" ");
  const last  = parts.pop();
  return { first: parts.join(" "), last };
}

function findChildren(name) {
  return Object.values(PEOPLE)
    .filter(p => p.father === name || p.mother === name)
    .sort((a, b) => parseInt(a.DOB) - parseInt(b.DOB))
    .map(p => p.name);
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
      if (!people[name]) people[name] = { name, unitId: id };
    }
    return id;
  }

  function dobYear(name) {
    const p = PEOPLE[name];
    if (!p || !p.DOB) return Infinity;
    const m = String(p.DOB).replace(/^[~c. ]+/, "").match(/(\d{4})/);
    return m ? parseInt(m[1]) : Infinity;
  }

  function addAncestors(name, gen, isBlood) {
    if (visited.has("anc-" + name)) return;
    visited.add("anc-" + name);
    if (isBlood) bloodLine.add(name);
    const p = PEOPLE[name];
    if (!p) return;
    const fName = p.father || null;
    const mName = p.mother || null;

    if (fName || mName) {
      const parentUid = newUnit([fName, mName].filter(Boolean), gen - 1, "anc");

      if (SHOW_SIBLINGS && (!siblingsBloodOnly || isBlood)) {
        const sibSet = new Set();
        for (const parentName of [fName, mName].filter(Boolean)) {
          for (const cName of findChildren(parentName)) sibSet.add(cName);
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
            const sibData    = PEOPLE[sibName];
            const sibSpouses = sibData ? (sibData.married || []) : [];
            const unitDir    = isBloodLine ? "anc" : "sibling";
            const uid        = newUnit([sibName, ...sibSpouses.filter(s => s !== sibName)], gen, unitDir);
            edges.push({ fromUnit: parentUid, toUnit: uid, toName: sibName, sibling: !isBloodLine });
          }
        }
      } else {
        const childUid = people[name] && people[name].unitId;
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
      const p = PEOPLE[name];
      const spouses = p ? (p.married || []) : [];
      newUnit([name, ...spouses.filter(s => s !== name)], gen, "desc");
      if (!siblingsBloodOnly) {
        for (const spouse of spouses) addAncestors(spouse, gen, false);
      }
    }
    for (const cName of findChildren(name)) {
      if (!visited.has("desc-" + cName)) addDescendants(cName, gen + 1, true);
      const parentUid = people[name] && people[name].unitId;
      const childUid  = people[cName] && people[cName].unitId;
      if (parentUid && childUid && parentUid !== childUid) {
        if (!edges.some(e => e.fromUnit === parentUid && e.toUnit === childUid)) {
          edges.push({ fromUnit: parentUid, toUnit: childUid, toName: cName, sibling: false });
        }
      }
    }
  }

  bloodLine.add(rootName);
  const rootData    = PEOPLE[rootName] || {};
  const rootSpouses = (rootData.married || []).filter(s => s !== rootName);
  newUnit([rootName, ...rootSpouses], 0, "root");

  addAncestors(rootName, 0, true);
  addDescendants(rootName, 0, true);

  if (!siblingsBloodOnly) {
    for (const sp of rootSpouses) addAncestors(sp, 0, false);
  }

  return { units, people, edges, bloodLine };
}

// ── 5. Layout ────────────────────────────────────────────────
let currentLayout     = "horizontal";
let siblingsBloodOnly = true;

function layout(units, edges) {
  if (currentLayout === "vertical") {
    function unitH(u) {
      return u.members.length * CARD_H + (u.members.length - 1) * SPOUSE_GAP;
    }
    function unitDobV(u) {
      const p = PEOPLE[u.members[0]];
      if (!p || !p.DOB) return Infinity;
      const m = String(p.DOB).replace(/^[~c. ]+/, "").match(/(\d{4})/);
      return m ? parseInt(m[1]) : Infinity;
    }

    const childrenOf = {}, parentOf = {};
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
      if (u.dir === "root") return true;
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

    function parentCentreY(id) {
      const pid = parentOf[id];
      if (pid && units[pid] && units[pid].y !== undefined) {
        return units[pid].y + unitH(units[pid]) / 2;
      }
      const u = units[id];
      return u.y + unitH(u) / 2;
    }

    function resolveOverlapsV(genIds) {
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
        const placedCh = (childrenOf[id] || []).filter(cid => units[cid] && units[cid].y !== undefined);
        if (placedCh.length > 0) {
          const minY = Math.min(...placedCh.map(cid => units[cid].y));
          const maxY = Math.max(...placedCh.map(cid => units[cid].y + unitH(units[cid])));
          u.y = (minY + maxY) / 2 - unitH(u) / 2;
        } else {
          u.y = -unitH(u) / 2;
        }
        const sibCh = (childrenOf[id] || [])
          .filter(cid => units[cid] && units[cid].dir === "sibling" && units[cid].y === undefined)
          .sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
        if (sibCh.length > 0) {
          const bloodCh = (childrenOf[id] || [])
            .filter(cid => units[cid] && units[cid].dir !== "sibling" && units[cid].y !== undefined)
            .sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
          const allCh = [...bloodCh, ...sibCh].sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
          const totalH = allCh.reduce((s, cid) => s + unitH(units[cid]), 0) + (allCh.length - 1) * H_GAP;
          const ancCentreY = u.y + unitH(u) / 2;
          let y = ancCentreY - totalH / 2;
          for (const cid of allCh) {
            const childGen = units[cid].gen;
            units[cid].y      = y;
            units[cid].x      = childGen * (CARD_W + V_GAP);
            units[cid].width  = CARD_W;
            units[cid].height = unitH(units[cid]);
            y += unitH(units[cid]) + H_GAP;
          }
        }
      }
      resolveOverlapsV(ids);
    }
    for (const [gen, ids] of Object.entries(byGen)) {
      resolveOverlapsV(ids.filter(id => units[id].y !== undefined));
    }
    return;
  }

  // ── Horizontal layout ─────────────────────────────────────────
  function unitW(u) {
    return u.members.length * CARD_W + (u.members.length - 1) * SPOUSE_GAP;
  }
  function unitDob(u) {
    const p = PEOPLE[u.members[0]];
    if (!p || !p.DOB) return Infinity;
    const m = String(p.DOB).replace(/^[~c. ]+/, "").match(/(\d{4})/);
    return m ? parseInt(m[1]) : Infinity;
  }

  const childrenOf = {}, parentOf = {};
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
    const allCh = (childrenOf[uid] || []).filter(cid => units[cid] && units[cid].dir !== "anc");
    if (allCh.length === 0) return subtreeWidthCache[uid] = unitW(u);
    const nonLeafCh = allCh.filter(cid => !isLeaf(cid));
    if (nonLeafCh.length === 0) return subtreeWidthCache[uid] = unitW(u);
    let w = nonLeafCh.reduce((sum, cid) => sum + subtreeWidth(cid), 0) + (nonLeafCh.length - 1) * H_GAP;
    w = Math.max(w, unitW(u));
    return subtreeWidthCache[uid] = w;
  }

  const allUnitIds = Object.keys(units);
  const descUnits  = allUnitIds.filter(id => units[id].gen >= 0 && units[id].dir !== "anc");
  const ancUnits   = allUnitIds.filter(id => units[id].gen < 0 || units[id].dir === "anc");
  const descRoots  = descUnits.filter(id => {
    const u = units[id];
    if (u.dir === "anc") return false;
    if (u.dir === "root") return true;
    const pid = parentOf[id];
    if (pid && units[pid].dir === "anc") return false;
    return !pid || units[pid].gen < 0;
  });

  function assignX(uid, centerX) {
    const u = units[uid];
    if (!u) return;
    u.x = centerX - unitW(u) / 2;
    u.width  = unitW(u);
    u.height = CARD_H;
    const eligible = (childrenOf[uid] || [])
      .filter(cid => { const cu = units[cid]; return cu && cu.dir !== "anc"; })
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
    const totalSpan = descRoots.reduce((sum, id) => sum + subtreeWidth(id), 0) + (descRoots.length - 1) * H_GAP;
    let x = -totalSpan / 2;
    for (const id of descRoots) {
      assignX(id, x + subtreeWidth(id) / 2);
      x += subtreeWidth(id) + H_GAP;
    }
  }

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

  function parentCentreX(id) {
    const pid = parentOf[id];
    if (pid && units[pid] && units[pid].x !== undefined) {
      return units[pid].x + unitW(units[pid]) / 2;
    }
    const u = units[id];
    return u.x + unitW(u) / 2;
  }

  function resolveOverlaps(genIds) {
    const placed = genIds
      .filter(id => units[id].x !== undefined)
      .sort((a, b) => {
        const pa = parentCentreX(a), pb = parentCentreX(b);
        if (pa !== pb) return pa - pb;
        return units[a].x - units[b].x;
      });
    if (placed.length < 2) return;
    for (let i = 1; i < placed.length; i++) {
      const prev = units[placed[i - 1]], curr = units[placed[i]];
      const minX = prev.x + unitW(prev) + H_GAP;
      if (curr.x < minX) curr.x = minX;
    }
    for (let i = placed.length - 2; i >= 0; i--) {
      const next = units[placed[i + 1]], curr = units[placed[i]];
      const maxX = next.x - unitW(curr) - H_GAP;
      if (curr.x > maxX) curr.x = maxX;
    }
    const left  = units[placed[0]].x;
    const right = units[placed[placed.length - 1]].x + unitW(units[placed[placed.length - 1]]);
    const shift = (left + right) / 2;
    for (const id of placed) units[id].x -= shift;
  }

  for (const [gen, ids] of Object.entries(byGen)) {
    if (parseInt(gen) >= 0) resolveOverlaps(ids);
  }

  const ancGens = [...new Set(ancUnits.map(id => units[id].gen))].sort((a, b) => b - a);
  for (const gen of ancGens) {
    const ids = byGen[gen] || [];
    for (const id of ids) {
      const u = units[id];
      u.width  = unitW(u);
      u.height = CARD_H;
      u.y      = gen * (CARD_H + V_GAP);
      const placedCh = (childrenOf[id] || []).filter(cid => units[cid] && units[cid].x !== undefined);
      if (placedCh.length > 0) {
        const minX = Math.min(...placedCh.map(cid => units[cid].x));
        const maxX = Math.max(...placedCh.map(cid => units[cid].x + unitW(units[cid])));
        u.x = (minX + maxX) / 2 - unitW(u) / 2;
      } else {
        u.x = -unitW(u) / 2;
      }
      const unplacedSibs = (childrenOf[id] || [])
        .filter(cid => units[cid] && units[cid].dir === "sibling" && units[cid].x === undefined)
        .sort((a, b) => unitDob(units[a]) - unitDob(units[b]));
      if (unplacedSibs.length > 0) {
        const allCh = (childrenOf[id] || []).sort((a, b) => unitDob(units[a]) - unitDob(units[b]));
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

  for (const [gen, ids] of Object.entries(byGen)) {
    resolveOverlaps(ids.filter(id => units[id].x !== undefined));
  }
}

// ── 6. Card colours ───────────────────────────────────────────
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

// ── 7. Render ─────────────────────────────────────────────────
let currentRoot = ROOT_NAME;
const navHistory = [];

function render(rootName) {
  currentRoot = rootName;
  const t = T();

  // Rebuild toolbar
  const toolbar = document.getElementById("toolbar");
  toolbar.innerHTML = "";
  toolbar.style.cssText = "display:flex; align-items:center; gap:10px; padding:7px 12px;" +
                          "background:" + t.toolbarBg + "; border-bottom:1px solid " + t.toolbarBorder + ";";
  document.body.style.background = t.bodyBg;

  const btnStyle = "background:" + t.btnBg + "; border:1px solid " + t.btnBorder + ";" +
                   "color:" + t.btnColor + "; padding:3px 10px; border-radius:4px;" +
                   "cursor:pointer; font-size:12px;";

  const rootLabel = document.createElement("span");
  rootLabel.textContent = displayName(rootName);
  rootLabel.style.cssText = "font-size:13px; font-weight:600; color:" + t.rootBorder + "; margin-right:auto;";
  toolbar.appendChild(rootLabel);

  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.style.cssText = btnStyle + (navHistory.length === 0 ? " opacity:0.35; cursor:default;" : "");
  backBtn.addEventListener("click", () => { if (navHistory.length > 0) render(navHistory.pop()); });
  toolbar.appendChild(backBtn);

  const homeBtn = document.createElement("button");
  homeBtn.textContent = "⌂ Home";
  homeBtn.style.cssText = btnStyle;
  homeBtn.addEventListener("click", () => { navHistory.length = 0; render(ROOT_NAME); });
  toolbar.appendChild(homeBtn);

  const layoutBtn = document.createElement("button");
  layoutBtn.textContent = currentLayout === "horizontal" ? "⇄ Vertical" : "↕ Horizontal";
  layoutBtn.style.cssText = btnStyle;
  layoutBtn.addEventListener("click", () => {
    currentLayout = currentLayout === "horizontal" ? "vertical" : "horizontal";
    render(currentRoot);
  });
  toolbar.appendChild(layoutBtn);

  const sibBtn = document.createElement("button");
  sibBtn.textContent = siblingsBloodOnly ? "Show All Siblings" : "Blood Siblings Only";
  sibBtn.style.cssText = btnStyle;
  sibBtn.addEventListener("click", () => { siblingsBloodOnly = !siblingsBloodOnly; render(currentRoot); });
  toolbar.appendChild(sibBtn);

  const themeBtn = document.createElement("button");
  themeBtn.textContent = t.toggleLabel;
  themeBtn.style.cssText = btnStyle;
  themeBtn.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    render(currentRoot);
  });
  toolbar.appendChild(themeBtn);

  // SVG
  const { units, people, edges } = buildTree(rootName);
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

  let edgeSVG = "", cardSVG = "";
  const edgeSeen = new Set();

  for (const e of edges) {
    const fromU = units[e.fromUnit], toU = units[e.toUnit];
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
      const cx     = currentLayout === "horizontal"
        ? u.x + i * (CARD_W + SPOUSE_GAP) + ox
        : u.x + ox;
      const cy     = currentLayout === "horizontal"
        ? u.y + oy
        : u.y + i * (CARD_H + SPOUSE_GAP) + oy;
      const isRoot   = name === rootName;
      const isSpouse = i > 0;
      const isSib    = u.dir === "sibling";
      const p        = PEOPLE[name] || {};
      const dob      = getYear(p.DOB);
      const dod      = getYear(p.DOD);
      const dates    = dob && dod ? dob + " - " + dod : dob || dod || "";
      const { first, last } = getNameLines(name);
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

      const firstIsUnknown = !first || first.toLowerCase() === "unknown";
      const lastIsUnknown  = !last  || last.toLowerCase()  === "unknown";
      const firstTxt  = firstIsUnknown ? "UNKNOWN" : trunc(first);
      const lastTxt   = lastIsUnknown  ? "UNKNOWN" : trunc(last);
      const firstCol  = firstIsUnknown ? t.dates : textCol;
      const lastCol   = lastIsUnknown  ? t.dates : textCol;
      const firstSize = firstIsUnknown ? "10" : "14";
      const lastSize  = lastIsUnknown  ? "10" : "14";

      cardSVG += "<g class='person-card' data-name='" + name.replace(/'/g, "&#39;") + "' style='cursor:pointer'>";
      cardSVG += "<rect x='" + cx + "' y='" + cy + "' width='" + CARD_W + "' height='" + CARD_H + "' rx='6' fill='" + fill + "' stroke='" + border + "' stroke-width='" + sw + "'/>";
      cardSVG += "<text x='" + mid + "' y='" + (cy + 16) + "' text-anchor='middle' font-size='" + firstSize + "' font-weight='" + fw + "' fill='" + firstCol + "'>" + firstTxt + "</text>";
      cardSVG += "<text x='" + mid + "' y='" + (cy + 29) + "' text-anchor='middle' font-size='" + lastSize  + "' font-weight='" + fw + "' fill='" + lastCol  + "'>" + lastTxt  + "</text>";
      cardSVG += "<text x='" + mid + "' y='" + (cy + 48) + "' text-anchor='middle' font-size='11' fill='" + datesCol + "'>" + dates + "</text>";
      cardSVG += "</g>";
    });
  }

  const container = document.getElementById("tree-container");
  container.innerHTML = "<svg width='" + svgW + "' height='" + svgH + "' xmlns='http://www.w3.org/2000/svg'><g id='edges'>" + edgeSVG + "</g><g id='cards'>" + cardSVG + "</g></svg>";

  container.querySelectorAll(".person-card").forEach(el => {
    el.addEventListener("click", () => {
      const name = el.getAttribute("data-name");
      if (name !== rootName) {
        navHistory.push(rootName);
        render(name);
      }
    });
  });
}

render(ROOT_NAME);
</script>
</body>
</html>
"""


# ── Export ────────────────────────────────────────────────────────────────────

def export_html(people: dict, root_name: str, output_path: Path):
    html = HTML_TEMPLATE
    html = html.replace("__PEOPLE_JSON__", json.dumps(people, ensure_ascii=False, indent=2))
    html = html.replace("__ROOT_NAME_JSON__", json.dumps(root_name))
    output_path.write_text(html, encoding="utf-8")
    print(f"Exported {len(people)} people → {output_path}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Export Obsidian family tree to standalone HTML.")
    parser.add_argument("--vault",  default=DEFAULT_VAULT,  help=f"Vault root (default: {DEFAULT_VAULT})")
    parser.add_argument("--folder", default=DEFAULT_FOLDER, help=f"People folder (default: {DEFAULT_FOLDER})")
    parser.add_argument("--root",   default=DEFAULT_ROOT,   help=f"Root person (default: {DEFAULT_ROOT})")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help=f"Output file (default: {DEFAULT_OUTPUT})")
    args = parser.parse_args()

    vault      = Path(args.vault).expanduser().resolve()
    people_dir = vault / args.folder
    if not people_dir.exists():
        print(f"Error: folder not found: {people_dir}")
        sys.exit(1)

    people = load_people(people_dir)
    if not people:
        print(f"No family member notes found in {people_dir}")
        sys.exit(1)

    # Resolve root: accept either an exact file stem or a display name
    # ("First Last") matched against first_names + family_name.
    root_stem = args.root
    if root_stem not in people:
        display_lower = root_stem.lower()
        match = next(
            (stem for stem, p in people.items()
             if (p["first_names"] + " " + p["family_name"]).strip().lower() == display_lower
             or stem.lower().startswith(display_lower)),
            None,
        )
        if match:
            root_stem = match
        else:
            print(f"Warning: root person '{args.root}' not found in notes, proceeding anyway.")

    output_path = Path(args.output).expanduser().resolve()
    export_html(people, root_stem, output_path)


if __name__ == "__main__":
    main()
