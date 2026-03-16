import { CARD_W, CARD_H, H_GAP, SPOUSE_GAP, V_GAP } from "./constants";
import { Edge, LayoutMode, PersonPage, Unit } from "./types";

export function layout(
  units: Record<string, Unit>,
  edges: Edge[],
  byName: Record<string, PersonPage>,
  layoutMode: LayoutMode,
): void {
  if (layoutMode === "vertical") {
    // Vertical hierarchical layout — mirrors horizontal but rotated 90°.
    // Generations become columns (x axis). Children spread vertically
    // under their parent's y centre. Ancestors placed to the left,
    // descendants to the right.

    function unitH(u: Unit): number {
      return u.members.length * CARD_H + (u.members.length - 1) * SPOUSE_GAP;
    }
    function unitDobV(u: Unit): number {
      const name = u.members[0];
      const p = byName[name];
      if (!p) return Infinity;
      const v = p.DOB;
      if (!v) return Infinity;
      if (typeof v === "object" && "year" in v) return parseInt(String(v.year));
      const m = String(v).replace(/^[~c. ]+/, "").match(/(\d{4})/);
      return m ? parseInt(m[1]) : Infinity;
    }

    const childrenOf: Record<string, string[]> = {};
    const parentOf: Record<string, string> = {};
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

    function isLeafV(uid: string): boolean {
      const u = units[uid];
      if (!u || u.dir === "sibling") return false;
      const ch = (childrenOf[uid] || []).filter(cid => units[cid] && units[cid].dir !== "anc");
      return ch.length === 0;
    }
    const subtreeHeightCache: Record<string, number> = {};
    function subtreeHeight(uid: string): number {
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

    function assignY(uid: string, centerY: number): void {
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

    const byGen: Record<string, string[]> = {};
    for (const id of allUnitIds) {
      const g = String(units[id].gen);
      (byGen[g] = byGen[g] || []).push(id);
    }
    for (const [gen, ids] of Object.entries(byGen)) {
      const x = parseInt(gen) * (CARD_W + V_GAP);
      for (const id of ids) {
        if (units[id].y !== undefined) {
          units[id].x = x;
          units[id].width = CARD_W;
          units[id].height = unitH(units[id]);
        }
      }
    }

    function parentCentreY(id: string): number {
      const pid = parentOf[id];
      if (pid && units[pid] && units[pid].y !== undefined) {
        return units[pid].y! + unitH(units[pid]) / 2;
      }
      const u = units[id];
      return u.y! + unitH(u) / 2;
    }

    function resolveOverlapsV(genIds: string[]): void {
      const placed = genIds.filter(id => units[id].y !== undefined)
        .sort((a, b) => {
          const pa = parentCentreY(a), pb = parentCentreY(b);
          if (pa !== pb) return pa - pb;
          return units[a].y! - units[b].y!;
        });
      if (placed.length < 2) return;
      for (let i = 1; i < placed.length; i++) {
        const prev = units[placed[i - 1]], curr = units[placed[i]];
        if (curr.y! < prev.y! + unitH(prev) + H_GAP) curr.y = prev.y! + unitH(prev) + H_GAP;
      }
      for (let i = placed.length - 2; i >= 0; i--) {
        const next = units[placed[i + 1]], curr = units[placed[i]];
        if (curr.y! > next.y! - unitH(curr) - H_GAP) curr.y = next.y! - unitH(curr) - H_GAP;
      }
      const top    = units[placed[0]].y!;
      const bottom = units[placed[placed.length - 1]].y! + unitH(units[placed[placed.length - 1]]);
      const shift  = (top + bottom) / 2;
      for (const id of placed) units[id].y! -= shift;
    }

    for (const [gen, ids] of Object.entries(byGen)) {
      if (parseInt(gen) >= 0) resolveOverlapsV(ids);
    }

    const ancGens = [...new Set(ancUnits.map(id => units[id].gen))].sort((a, b) => b - a);
    for (const gen of ancGens) {
      const ids = byGen[String(gen)] || [];
      for (const id of ids) {
        const u = units[id];
        u.width = CARD_W; u.height = unitH(u);
        u.x = gen * (CARD_W + V_GAP);
        const placedCh = (childrenOf[id] || []).filter(cid => units[cid] && units[cid].y !== undefined);
        if (placedCh.length > 0) {
          const minY = Math.min(...placedCh.map(cid => units[cid].y!));
          const maxY = Math.max(...placedCh.map(cid => units[cid].y! + unitH(units[cid])));
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
          const allCh = [...bloodCh, ...sibCh]
            .sort((a, b) => unitDobV(units[a]) - unitDobV(units[b]));
          const totalH = allCh.reduce((s, cid) => s + unitH(units[cid]), 0) + (allCh.length - 1) * H_GAP;
          const ancCentreY = u.y! + unitH(u) / 2;
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
    for (const [, ids] of Object.entries(byGen)) {
      resolveOverlapsV(ids.filter(id => units[id].y !== undefined));
    }
    return;
  }

  // ── Horizontal hierarchical layout ──────────────────────────────────────

  function unitW(u: Unit): number {
    return u.members.length * CARD_W + (u.members.length - 1) * SPOUSE_GAP;
  }

  function unitDob(u: Unit): number {
    const name = u.members[0];
    const p = byName[name];
    if (!p) return Infinity;
    const v = p.DOB;
    if (!v) return Infinity;
    if (typeof v === "object" && "year" in v) return parseInt(String(v.year));
    const m = String(v).replace(/^[~c. ]+/, "").match(/(\d{4})/);
    return m ? parseInt(m[1]) : Infinity;
  }

  const childrenOf: Record<string, string[]> = {};
  const parentOf: Record<string, string> = {};
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

  function isLeaf(uid: string): boolean {
    const u = units[uid];
    if (!u || u.dir === "sibling") return false;
    const ch = (childrenOf[uid] || []).filter(
      cid => units[cid] && units[cid].dir !== "anc" && units[cid].dir !== "sibling"
    );
    return ch.length === 0;
  }
  const subtreeWidthCache: Record<string, number> = {};
  function subtreeWidth(uid: string): number {
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

  const descRoots = descUnits.filter(id => {
    const u = units[id];
    if (u.dir === "anc") return false;
    if (u.dir === "root") return true;
    const pid = parentOf[id];
    if (pid && units[pid].dir === "anc") return false;
    return !pid || units[pid].gen < 0;
  });

  function assignX(uid: string, centerX: number): void {
    const u = units[uid];
    if (!u) return;
    u.x = centerX - unitW(u) / 2;
    u.width  = unitW(u);
    u.height = CARD_H;
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

  const byGen: Record<string, string[]> = {};
  for (const id of allUnitIds) {
    const g = String(units[id].gen);
    (byGen[g] = byGen[g] || []).push(id);
  }
  for (const [gen, ids] of Object.entries(byGen)) {
    const y = parseInt(gen) * (CARD_H + V_GAP);
    for (const id of ids) {
      if (units[id].x !== undefined) units[id].y = y;
    }
  }

  function parentCentreX(id: string): number {
    const pid = parentOf[id];
    if (pid && units[pid] && units[pid].x !== undefined) {
      return units[pid].x! + unitW(units[pid]) / 2;
    }
    const u = units[id];
    return u.x! + unitW(u) / 2;
  }

  function resolveOverlaps(genIds: string[]): void {
    const placed = genIds
      .filter(id => units[id].x !== undefined)
      .sort((a, b) => {
        const pa = parentCentreX(a), pb = parentCentreX(b);
        if (pa !== pb) return pa - pb;
        return units[a].x! - units[b].x!;
      });
    if (placed.length < 2) return;
    for (let i = 1; i < placed.length; i++) {
      const prev = units[placed[i - 1]], curr = units[placed[i]];
      const minX = prev.x! + unitW(prev) + H_GAP;
      if (curr.x! < minX) curr.x = minX;
    }
    for (let i = placed.length - 2; i >= 0; i--) {
      const next = units[placed[i + 1]], curr = units[placed[i]];
      const maxX = next.x! - unitW(curr) - H_GAP;
      if (curr.x! > maxX) curr.x = maxX;
    }
    const left  = units[placed[0]].x!;
    const right = units[placed[placed.length - 1]].x! + unitW(units[placed[placed.length - 1]]);
    const shift = (left + right) / 2;
    for (const id of placed) units[id].x! -= shift;
  }

  for (const [gen, ids] of Object.entries(byGen)) {
    if (parseInt(gen) >= 0) resolveOverlaps(ids);
  }

  const ancGens = [...new Set(ancUnits.map(id => units[id].gen))].sort((a, b) => b - a);
  for (const gen of ancGens) {
    const ids = byGen[String(gen)] || [];
    for (const id of ids) {
      const u = units[id];
      u.width  = unitW(u);
      u.height = CARD_H;
      u.y      = gen * (CARD_H + V_GAP);
      const placedCh = (childrenOf[id] || []).filter(cid => units[cid] && units[cid].x !== undefined);
      if (placedCh.length > 0) {
        const minX = Math.min(...placedCh.map(cid => units[cid].x!));
        const maxX = Math.max(...placedCh.map(cid => units[cid].x! + unitW(units[cid])));
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
        const ancCentreX = u.x! + unitW(u) / 2;
        let cx = ancCentreX - totalW / 2;
        const childY = (parseInt(String(gen)) + 1) * (CARD_H + V_GAP);
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

  for (const [, ids] of Object.entries(byGen)) {
    resolveOverlaps(ids.filter(id => units[id].x !== undefined));
  }
}
