import { CARD_W, CARD_H, SPOUSE_GAP } from "./constants";
import { Edge, GenderIndex, LayoutMode, PersonEntry, PersonPage, Theme, Unit } from "./types";
import { getYear, getNameLines, trunc } from "./tree";

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
  const edgeSeen = new Set<string>();

  for (const e of edges) {
    const fromU = units[e.fromUnit];
    const toU   = units[e.toUnit];
    if (!fromU || !toU || fromU.x === undefined || toU.x === undefined) continue;
    const key = [e.fromUnit, e.toUnit].sort().join("|");
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    const col  = e.sibling ? theme.edgeSib : theme.edge;
    const dash = e.sibling ? " stroke-dasharray='5,3'" : "";
    let d: string;

    if (layoutMode === "horizontal") {
      const x1    = fromU.x + (fromU.width ?? 0) / 2 + ox;
      const y1    = fromU.y! + CARD_H + oy;
      const toIdx = e.toName ? toU.members.indexOf(e.toName) : 0;
      const toOff = toIdx > 0 ? toIdx * (CARD_W + SPOUSE_GAP) : 0;
      const x2    = toU.x + toOff + CARD_W / 2 + ox;
      const y2    = toU.y! + oy;
      const midY  = (y1 + y2) / 2;
      d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
    } else {
      const [ancU, chU] = fromU.gen < toU.gen ? [fromU, toU] : [toU, fromU];
      const toIdx = e.toName ? chU.members.indexOf(e.toName) : 0;
      const toOff = toIdx > 0 ? toIdx * (CARD_H + SPOUSE_GAP) : 0;
      const x1   = ancU.x! + (ancU.width ?? 0) + ox;
      const y1   = ancU.y! + (ancU.height ?? 0) / 2 + oy;
      const x2   = chU.x! + ox;
      const y2   = chU.y! + toOff + CARD_H / 2 + oy;
      const midX = (x1 + x2) / 2;
      d = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
    }

    edgeSVG += `<path d='${d}' fill='none' stroke='${col}' stroke-width='1.5'${dash}/>`;
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
      const dates    = dob && dod ? `${dob} - ${dod}` : dob || dod || "";
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
      const firstTxt  = firstIsUnknown ? "UNKNOWN" : trunc(first);
      const lastTxt   = lastIsUnknown  ? "UNKNOWN" : trunc(last);
      const firstCol  = firstIsUnknown ? theme.dates : textCol;
      const lastCol   = lastIsUnknown  ? theme.dates : textCol;
      const firstSize = firstIsUnknown ? "10" : "14";
      const lastSize  = lastIsUnknown  ? "10" : "14";

      cardSVG += `<g class='person-card' data-name='${name.replace(/'/g, "&#39;")}' style='cursor:pointer'>`;
      cardSVG += `<rect x='${cx}' y='${cy}' width='${CARD_W}' height='${CARD_H}' rx='6' fill='${fill}' stroke='${border}' stroke-width='${sw}'/>`;
      cardSVG += `<text x='${mid}' y='${cy + 16}' text-anchor='middle' font-size='${firstSize}' font-weight='${fw}' fill='${firstCol}' font-family='var(--font-interface)'>${firstTxt}</text>`;
      cardSVG += `<text x='${mid}' y='${cy + 29}' text-anchor='middle' font-size='${lastSize}'  font-weight='${fw}' fill='${lastCol}'  font-family='var(--font-interface)'>${lastTxt}</text>`;
      cardSVG += `<text x='${mid}' y='${cy + 48}' text-anchor='middle' font-size='11' fill='${datesCol}' font-family='var(--font-interface)'>${dates}</text>`;
      cardSVG += `</g>`;
    });
  }

  return { svgW, svgH, edgeSVG, cardSVG };
}
