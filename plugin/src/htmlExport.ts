/**
 * htmlExport.ts
 *
 * Entry point for the self-contained HTML export bundle.
 * Compiled by generate-html-bundle.mjs into src/htmlBundle.ts.
 *
 * Expects two globals injected by a preceding <script> block in the HTML:
 *   ARBOR_PEOPLE  — Record<string, PlainPerson> (pre-resolved, plain strings)
 *   ARBOR_ROOT    — string  (file stem of the initial root person)
 *
 * No Obsidian or Node.js dependencies — browser-only.
 */

import { THEMES, CARD_W, CARD_H, SPOUSE_GAP } from "./constants";
import { buildTree } from "./tree";
import { layout } from "./layout";
import { buildSVG } from "./renderer";
import type { GenderIndex, LayoutMode, PersonPage, ThemeKey } from "./types";

// ── Globals injected by the export command ────────────────────────────────────

declare const ARBOR_PEOPLE: Record<string, PersonPage>;
declare const ARBOR_ROOT: string;
declare const ARBOR_FOLDER: string;

// ── Derived indexes ───────────────────────────────────────────────────────────

function buildGenderIndex(byName: Record<string, PersonPage>): GenderIndex {
  const gender: GenderIndex = {};
  for (const [name, page] of Object.entries(byName)) {
    const s = String(page?.sex ?? "").toLowerCase().trim();
    gender[name] = s === "male" ? "m" : s === "female" ? "f" : "u";
  }
  return gender;
}

function displayName(stem: string): string {
  const p = ARBOR_PEOPLE[stem];
  if (!p) return stem;
  return [p.first_names, p.family_name].filter(Boolean).join(" ") || stem;
}

// ── View state ────────────────────────────────────────────────────────────────

let currentTheme: ThemeKey    = "dark";
let currentLayout: LayoutMode = "horizontal";
let siblingsBloodOnly         = true;
let currentRoot               = "";
const navHistory: string[]    = [];

const genderIndex = buildGenderIndex(ARBOR_PEOPLE);

// ── Render ────────────────────────────────────────────────────────────────────

function render(rootName: string): void {
  currentRoot = rootName;
  const t = THEMES[currentTheme];

  document.body.style.background = t.bodyBg ?? "";

  const toolbar = document.getElementById("arbor-toolbar")!;
  toolbar.innerHTML = "";
  toolbar.style.cssText =
    `display:flex; align-items:center; gap:10px; padding:7px 12px;` +
    `background:${t.toolbarBg}; border-bottom:1px solid ${t.toolbarBorder};` +
    `overflow-x:auto;`;

  const btnStyle =
    `background:${t.btnBg}; border:1px solid ${t.btnBorder};` +
    `color:${t.btnColor}; padding:3px 10px; border-radius:4px;` +
    `cursor:pointer; font-size:12px; flex-shrink:0;`;

  const { units, people, edges } = buildTree(rootName, ARBOR_PEOPLE, siblingsBloodOnly);

  const titleEl = document.createElement("span");
  titleEl.style.cssText = `font-size:13px; font-weight:600; color:${t.rootBorder}; margin-right:auto;`;
  titleEl.textContent = `${ARBOR_FOLDER} - ${displayName(rootName)} (${Object.keys(people).length} people)`;
  toolbar.appendChild(titleEl);

  function btn(label: string, disabled = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = btnStyle + (disabled ? " opacity:0.35; cursor:default;" : "");
    toolbar.appendChild(b);
    return b;
  }

  btn("← Back", navHistory.length === 0).addEventListener("click", () => {
    if (navHistory.length > 0) render(navHistory.pop()!);
  });

  btn("⌂ Home").addEventListener("click", () => {
    navHistory.length = 0;
    render(ARBOR_ROOT);
  });

  btn(siblingsBloodOnly ? "Show All Siblings" : "Blood Siblings Only").addEventListener("click", () => {
    siblingsBloodOnly = !siblingsBloodOnly;
    render(currentRoot);
  });

  const sep = document.createElement("span");
  sep.style.cssText = `width:1px; height:18px; background:${t.toolbarBorder}; flex-shrink:0;`;
  toolbar.appendChild(sep);

  btn(currentLayout === "horizontal" ? "⇄ Vertical" : "↕ Horizontal").addEventListener("click", () => {
    currentLayout = currentLayout === "horizontal" ? "vertical" : "horizontal";
    render(currentRoot);
  });

  btn(t.toggleLabel).addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    render(currentRoot);
  });

  // SVG
  layout(units, edges, ARBOR_PEOPLE, currentLayout);
  const { svgW, svgH, edgeSVG, cardSVG } = buildSVG(
    units, edges, people, rootName, ARBOR_PEOPLE, genderIndex, t, currentLayout
  );

  const container = document.getElementById("arbor-tree")!;
  container.innerHTML =
    `<svg width='${svgW}' height='${svgH}' xmlns='http://www.w3.org/2000/svg'>` +
    `<g id='edges'>${edgeSVG}</g><g id='cards'>${cardSVG}</g></svg>`;

  container.querySelectorAll(".person-card").forEach(el => {
    el.addEventListener("click", () => {
      const name = el.getAttribute("data-name");
      if (name && name !== rootName) {
        navHistory.push(rootName);
        render(name);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => render(ARBOR_ROOT));
