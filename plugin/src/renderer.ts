import { CARD_W, CARD_H, SPOUSE_GAP } from "./constants";
import { Edge, GenderIndex, LayoutMode, PersonEntry, PersonPage, Theme, Unit } from "./types";
import { getYear, getNameLines, trunc } from "./tree";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function cardColors(
  name: string,
  isRoot: boolean,
  isSpouse: boolean,
  isSib: boolean,
  genderIndex: GenderIndex,
  theme: Theme,
): { fill: string; border: string; text: string } {
  const g = genderIndex[name] ?? "u";
  const fill   = g === "m" ? theme.maleFill : g === "f" ? theme.femaleFill : theme.unknownFill;
  const border = isRoot ? theme.rootBorder
               : isSib  ? theme.sibBorder
               : g === "m" ? theme.maleBorder : g === "f" ? theme.femaleBorder : theme.unknownBorder;
  const text   = isRoot ? theme.textRoot : isSib ? theme.textSib : theme.text;
  return { fill, border, text };
}

export interface SVGResult {
  svgW: number;
  svgH: number;
  edgeSVG: string;
  cardSVG: string;
}

/** Build SVG markup for a fully laid-out tree.
 *  Returns { svgW, svgH, edgeSVG, cardSVG } — caller assembles the <svg> tag. */
export function buildSVG(
  units: Record<string, Unit>,
  edges: Edge[],
  people: Record<string, PersonEntry>,
  rootName: string,
  byName: Record<string, PersonPage>,
  genderIndex: GenderIndex,
  theme: Theme,
  layoutMode: LayoutMode,
  coloredEdges = true,
): SVGResult {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const u of Object.values(units)) {
    if (u.x === undefined) continue;
    minX = Math.min(minX, u.x);
    maxX = Math.max(maxX, u.x + (u.width ?? 0));
    minY = Math.min(minY, u.y!);
    maxY = Math.max(maxY, u.y! + (u.height ?? 0));
  }
  const pad  = 40;
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const ox   = -minX + pad;
  const oy   = -minY + pad;

  let edgeSVG = "";
  let cardSVG = "";

  // Pass 1: canonicalise and deduplicate edges, group by (ancestor, sibling flag)
  type CanonEdge = { ancId: string; chId: string; toName: string; sibling: boolean };
  const edgeSeen = new Set<string>();
  const ancGroups = new Map<string, CanonEdge[]>();

  for (const e of edges) {
    const fromU = units[e.fromUnit];
    const toU   = units[e.toUnit];
    if (!fromU || !toU || fromU.x === undefined || toU.x === undefined) continue;

    const ancId = fromU.gen <= toU.gen ? e.fromUnit : e.toUnit;
    const chId  = ancId === e.fromUnit ? e.toUnit   : e.fromUnit;

    const key = `${ancId}|${chId}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);

    const groupKey = `${ancId}::${e.sibling}`;
    if (!ancGroups.has(groupKey)) ancGroups.set(groupKey, []);
    ancGroups.get(groupKey)!.push({ ancId, chId, toName: e.toName, sibling: e.sibling });
  }

  // Pass 2: emit one Bézier per edge, exit points spread across parent card edge
  for (const group of ancGroups.values()) {
    const { ancId, sibling } = group[0];
    const ancU = units[ancId];
    const col  = sibling ? theme.edgeSib : theme.edge;
    const dash = sibling ? " stroke-dasharray='5,3'" : "";

    if (layoutMode === "horizontal") {
      const px = ancU.x! + (ancU.width ?? CARD_W) / 2 + ox;
      const py = ancU.y! + CARD_H + oy;

      const withPos = group.map(ce => {
        const chU   = units[ce.chId];
        const toIdx = ce.toName ? chU.members.indexOf(ce.toName) : 0;
        const toOff = toIdx > 0 ? toIdx * (CARD_W + SPOUSE_GAP) : 0;
        return { ...ce, cx: chU.x! + toOff + CARD_W / 2 + ox, cy: chU.y! + oy };
      }).sort((a, b) => a.cx - b.cx);

      const n = withPos.length;
      withPos.forEach(({ cx, cy }, i) => {
        const edgeCol = (coloredEdges && n > 1) ? theme.edgePalette[i % theme.edgePalette.length] : col;
        const dy = cy - py;
        const d = `M${px},${py} C${px},${py + dy * 0.5} ${cx},${cy - dy * 0.5} ${cx},${cy}`;
        edgeSVG += `<path d='${d}' fill='none' stroke='${edgeCol}' stroke-width='1.5'${dash}/>`;
      });

    } else {
      const px = ancU.x! + (ancU.width ?? 0) + ox;
      const py = ancU.y! + (ancU.height ?? CARD_H) / 2 + oy;

      const withPos = group.map(ce => {
        const chU   = units[ce.chId];
        const toIdx = ce.toName ? chU.members.indexOf(ce.toName) : 0;
        const toOff = toIdx > 0 ? toIdx * (CARD_H + SPOUSE_GAP) : 0;
        return { ...ce, cx: chU.x! + ox, cy: chU.y! + toOff + CARD_H / 2 + oy };
      }).sort((a, b) => a.cy - b.cy);

      const n = withPos.length;
      withPos.forEach(({ cx, cy }, i) => {
        const edgeCol = (coloredEdges && n > 1) ? theme.edgePalette[i % theme.edgePalette.length] : col;
        const dx = cx - px;
        const d = `M${px},${py} C${px + dx * 0.5},${py} ${cx - dx * 0.5},${cy} ${cx},${cy}`;
        edgeSVG += `<path d='${d}' fill='none' stroke='${edgeCol}' stroke-width='1.5'${dash}/>`;
      });
    }
  }

  for (const u of Object.values(units)) {
    if (u.x === undefined) continue;
    u.members.forEach((name, i) => {
      const p      = byName[name];
      const cx     = layoutMode === "horizontal"
        ? u.x! + i * (CARD_W + SPOUSE_GAP) + ox
        : u.x! + ox;
      const cy     = layoutMode === "horizontal"
        ? u.y! + oy
        : u.y! + i * (CARD_H + SPOUSE_GAP) + oy;
      const isRoot   = name === rootName;
      const isSpouse = i > 0;
      const isSib    = u.dir === "sibling";
      const dob      = getYear(p?.DOB);
      const dod      = getYear(p?.DOD);
      const dates    = escapeHtml(dob && dod ? `${dob} - ${dod}` : dob || dod || "");
      const { first, last } = getNameLines(name, p ?? null);
      const { fill, border, text: textCol } = cardColors(name, isRoot, isSpouse, isSib, genderIndex, theme);
      const datesCol = isRoot ? "rgba(255,255,255,0.75)" : theme.dates;
      const sw       = isRoot ? "4" : "1";
      const fw       = isRoot ? "700" : "500";
      const mid      = cx + CARD_W / 2;

      if (isSpouse) {
        if (layoutMode === "horizontal") {
          const lx1 = u.x! + i * (CARD_W + SPOUSE_GAP) - SPOUSE_GAP + ox;
          const ly  = u.y! + CARD_H / 2 + oy;
          edgeSVG += `<line x1='${lx1}' y1='${ly}' x2='${lx1 + SPOUSE_GAP}' y2='${ly}' stroke='${theme.spouseLine}' stroke-width='2' stroke-dasharray='3,2'/>`;
        } else {
          const lx  = u.x! + CARD_W / 2 + ox;
          const ly1 = u.y! + i * (CARD_H + SPOUSE_GAP) - SPOUSE_GAP + oy;
          edgeSVG += `<line x1='${lx}' y1='${ly1}' x2='${lx}' y2='${ly1 + SPOUSE_GAP}' stroke='${theme.spouseLine}' stroke-width='2' stroke-dasharray='3,2'/>`;
        }
      }

      const firstIsUnknown = !first || first.toLowerCase() === "unknown";
      const lastIsUnknown  = !last  || last.toLowerCase()  === "unknown";
      const firstTxt  = firstIsUnknown ? "UNKNOWN" : escapeHtml(trunc(first));
      const lastTxt   = lastIsUnknown  ? "UNKNOWN" : escapeHtml(trunc(last));
      const firstCol  = firstIsUnknown ? theme.dates : textCol;
      const lastCol   = lastIsUnknown  ? theme.dates : textCol;
      const firstSize = firstIsUnknown ? "10" : "14";
      const lastSize  = lastIsUnknown  ? "10" : "14";

      cardSVG += `<g class='person-card' data-name='${escapeHtml(name)}' style='cursor:pointer'>`;
      cardSVG += `<rect x='${cx}' y='${cy}' width='${CARD_W}' height='${CARD_H}' rx='6' fill='${fill}' stroke='${border}' stroke-width='${sw}'/>`;
      cardSVG += `<text x='${mid}' y='${cy + 16}' text-anchor='middle' font-size='${firstSize}' font-weight='${fw}' fill='${firstCol}' font-family='var(--font-interface)'>${firstTxt}</text>`;
      cardSVG += `<text x='${mid}' y='${cy + 29}' text-anchor='middle' font-size='${lastSize}'  font-weight='${fw}' fill='${lastCol}'  font-family='var(--font-interface)'>${lastTxt}</text>`;
      cardSVG += `<text x='${mid}' y='${cy + 48}' text-anchor='middle' font-size='11' fill='${datesCol}' font-family='var(--font-interface)'>${dates}</text>`;
      cardSVG += `</g>`;
    });
  }

  return { svgW, svgH, edgeSVG, cardSVG };
}
