import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { THEMES } from "./constants";
import { GenderIndex, LayoutMode, NameIndex, PersonPage, ThemeKey } from "./types";
import { buildGenderIndex, buildNameIndex, loadPeople } from "./loader";
import { buildTree } from "./tree";
import { layout } from "./layout";
import { buildSVG } from "./renderer";
import type ArborPlugin from "./main";

export const ARBOR_VIEW_TYPE = "arbor-family-tree";

export class FamilyTreeView extends ItemView {
  private byName: Record<string, PersonPage> = {};
  private nameIndex: NameIndex = { stemToDisplay: {}, displayToStem: {} };
  private genderIndex: GenderIndex = {};

  private currentFolder = "";
  private homeRoot = "";

  private currentTheme: ThemeKey = "dark";
  private currentLayout: LayoutMode = "horizontal";
  private coloredEdges = false;
  private siblingsBloodOnly = true;
  private currentRoot = "";
  private navHistory: string[] = [];

  constructor(leaf: WorkspaceLeaf, private plugin: ArborPlugin) {
    super(leaf);
  }

  getViewType(): string { return ARBOR_VIEW_TYPE; }

  getDisplayText(): string {
    if (this.currentFolder) {
      const parts = this.currentFolder.split("/");
      const folderName = parts.length > 1 ? parts[parts.length - 2] : parts[0];
      return `Arbor: ${folderName}`;
    }
    return "Arbor";
  }

  getIcon(): string { return "trees"; }

  async onOpen(): Promise<void> {
    // Restore persisted toggle states.
    const s = this.plugin.settings;
    if (s.lastTheme)                    this.currentTheme      = s.lastTheme;
    if (s.lastLayout)                   this.currentLayout     = s.lastLayout;
    if (s.coloredEdges      !== undefined) this.coloredEdges      = s.coloredEdges;
    if (s.siblingsBloodOnly !== undefined) this.siblingsBloodOnly = s.siblingsBloodOnly;

    // Respond to file-open events while the view is open.
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => this.onFileOpen(file))
    );
    this.loadFromActiveFile();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  // ── File context ──────────────────────────────────────────────────────────

  private isPersonFile(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.ar_type === "person";
  }

  private onFileOpen(file: TFile | null): void {
    if (!file || !this.isPersonFile(file)) return;
    const newFolder = file.parent?.path ?? "";
    if (newFolder === this.currentFolder && this.currentFolder !== "") {
      // Same dataset — navigate to this person if not already there.
      if (file.basename !== this.currentRoot) {
        this.navHistory.push(this.currentRoot);
        this.render(file.basename);
      }
    } else {
      // Different dataset (or first load) — reload the whole tree.
      this.loadFromFile(file);
    }
  }

  private loadFromActiveFile(): void {
    const file = this.app.workspace.getActiveFile();
    if (file && this.isPersonFile(file)) {
      this.loadFromFile(file);
    } else if (this.plugin.settings.lastRoot && this.plugin.settings.lastFolder) {
      this.currentFolder = this.plugin.settings.lastFolder;
      this.homeRoot      = this.plugin.settings.lastRoot;
      this.loadData();
      this.render(this.plugin.settings.lastRoot);
    } else {
      this.showNoPersonMessage();
    }
  }

  private loadFromFile(file: TFile): void {
    this.currentFolder = file.parent?.path ?? "";
    this.homeRoot      = file.basename;
    this.loadData();
    this.navHistory = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.leaf as any).updateHeader();
    this.render(file.basename);
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  private loadData(): void {
    this.byName      = loadPeople(this.app, this.currentFolder);
    this.nameIndex   = buildNameIndex(this.byName);
    this.genderIndex = buildGenderIndex(this.byName);
  }

  private displayName(stem: string): string {
    return this.nameIndex.stemToDisplay[stem] || stem;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private showNoPersonMessage(): void {
    this.contentEl.empty();
    const wrapper = this.contentEl.createEl("div", {
      attr: {
        style: "display:flex; align-items:center; justify-content:center;" +
               "height:100%; color:var(--text-muted); font-size:14px; text-align:center; padding:2em;"
      }
    });
    wrapper.createEl("span", { text: "Open a person note to view their family tree." });
  }

  private render(rootName: string): void {
    this.currentRoot = rootName;

    const s = this.plugin.settings;
    s.lastRoot          = this.currentRoot;
    s.lastFolder        = this.currentFolder;
    s.lastTheme         = this.currentTheme;
    s.lastLayout        = this.currentLayout;
    s.coloredEdges      = this.coloredEdges;
    s.siblingsBloodOnly = this.siblingsBloodOnly;
    this.plugin.saveSettings();

    const t = THEMES[this.currentTheme];

    this.contentEl.empty();

    const outerContainer = this.contentEl.createEl("div", {
      attr: { style: `border:1px solid ${t.containerBorder}; border-radius:8px; overflow:hidden;` }
    });

    const { units, people, edges } = buildTree(rootName, this.byName, this.siblingsBloodOnly);

    // ── Toolbar ──────────────────────────────────────────────────────────────
    const btnStyle =
      `background:${t.btnBg}; border:1px solid ${t.btnBorder};` +
      `color:${t.btnColor}; padding:3px 10px; border-radius:4px;` +
      `cursor:pointer; font-size:12px; flex-shrink:0;`;

    const toolbar = outerContainer.createEl("div", {
      attr: {
        style:
          `display:flex; align-items:center; gap:10px; padding:7px 12px;` +
          `background:${t.toolbarBg}; border-bottom:1px solid ${t.toolbarBorder};` +
          `overflow-x:auto;`
      }
    });

    const parts = this.currentFolder.split("/");
    const folderName = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    const titleEl = toolbar.createEl("span", {
      attr: { style: `font-size:13px; color:${t.text}; flex-shrink:0;` }
    });
    titleEl.createEl("strong", { text: "Arbor" });
    titleEl.createEl("span", { text: `: ${folderName}` });

    toolbar.createEl("span", {
      text: ` - ${this.displayName(rootName)} (${Object.keys(people).length} people)`,
      attr: { style: `font-size:13px; font-weight:600; color:${t.rootBorder}; margin-right:auto;` }
    });

    const backBtn = toolbar.createEl("button", {
      text: "← Back",
      attr: { style: btnStyle + (this.navHistory.length === 0 ? " opacity:0.35; cursor:default;" : "") }
    });
    backBtn.addEventListener("click", () => {
      if (this.navHistory.length > 0) this.render(this.navHistory.pop()!);
    });

    const homeBtn = toolbar.createEl("button", { text: "⌂ Home", attr: { style: btnStyle } });
    homeBtn.addEventListener("click", () => {
      this.navHistory.length = 0;
      this.render(this.homeRoot);
    });

    const sibBtn = toolbar.createEl("button", {
      text: this.siblingsBloodOnly ? "Show All Siblings" : "Blood Siblings Only",
      attr: { style: btnStyle }
    });
    sibBtn.addEventListener("click", () => {
      this.siblingsBloodOnly = !this.siblingsBloodOnly;
      this.render(this.currentRoot);
    });

    toolbar.createEl("span", {
      attr: { style: `width:1px; height:18px; background:${t.toolbarBorder}; flex-shrink:0;` }
    });

    const layoutBtn = toolbar.createEl("button", {
      text: this.currentLayout === "horizontal" ? "⇄ Vertical" : "↕ Horizontal",
      attr: { style: btnStyle }
    });
    layoutBtn.addEventListener("click", () => {
      this.currentLayout = this.currentLayout === "horizontal" ? "vertical" : "horizontal";
      this.render(this.currentRoot);
    });

    const edgeColBtn = toolbar.createEl("button", {
      text: this.coloredEdges ? "Mono Lines" : "Colour Lines",
      attr: { style: btnStyle }
    });
    edgeColBtn.addEventListener("click", () => {
      this.coloredEdges = !this.coloredEdges;
      this.render(this.currentRoot);
    });

    const themeBtn = toolbar.createEl("button", { text: t.toggleLabel, attr: { style: btnStyle } });
    themeBtn.addEventListener("click", () => {
      this.currentTheme = this.currentTheme === "dark" ? "light" : "dark";
      this.render(this.currentRoot);
    });

    // ── SVG ──────────────────────────────────────────────────────────────────
    layout(units, edges, this.byName, this.currentLayout);
    const { svgW, svgH, edgeSVG, cardSVG } = buildSVG(
      units, edges, people, rootName, this.byName, this.genderIndex, t, this.currentLayout, this.coloredEdges
    );

    const svgContainer = outerContainer.createEl("div", {
      attr: { style: `overflow:auto; max-height:80vh; background:${t.bodyBg};` }
    });

    svgContainer.innerHTML =
      `<svg width='${svgW}' height='${svgH}' xmlns='http://www.w3.org/2000/svg'>` +
      `<g id='edges'>${edgeSVG}</g><g id='cards'>${cardSVG}</g></svg>`;

    svgContainer.querySelectorAll(".person-card").forEach(el => {
      el.addEventListener("click", () => {
        const name = el.getAttribute("data-name");
        if (name && name !== rootName) {
          this.navHistory.push(rootName);
          this.render(name);
        }
      });
      el.addEventListener("dblclick", (evt) => {
        evt.stopPropagation();
        const name = el.getAttribute("data-name");
        if (!name) return;
        const file = this.app.vault.getAbstractFileByPath(
          `${this.currentFolder}/${name}.md`
        );
        if (file instanceof TFile) this.app.workspace.getLeaf(false).openFile(file);
      });
    });
  }
}
