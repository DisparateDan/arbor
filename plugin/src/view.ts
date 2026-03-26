import { ItemView, sanitizeHTMLToDom, TFile, WorkspaceLeaf } from "obsidian";
import { GenderIndex, LayoutMode, NameIndex, PersonPage, Theme } from "./types";
import { buildGenderIndex, buildNameIndex, loadPeople } from "./loader";
import { buildTree } from "./tree";
import { layout } from "./layout";
import { buildSVG } from "./renderer";
import type ArborPlugin from "./main";

export const ARBOR_VIEW_TYPE = "arbor-family-tree";

/** Read computed CSS custom properties from document.body to build a Theme
 *  for the SVG renderer. Obsidian/theme CSS vars cover chrome colours;
 *  --arbor-* vars (defined in styles.css) cover genealogy-specific colours. */
function resolveTheme(): Theme {
  const cs = getComputedStyle(document.body);
  const g = (v: string) => cs.getPropertyValue(v).trim();
  return {
    containerBorder: g("--background-modifier-border"),
    edge:            g("--arbor-edge"),
    edgeSib:         g("--arbor-edge-sib"),
    edgePalette:     [g("--arbor-edge-0"), g("--arbor-edge-1"), g("--arbor-edge-2"), g("--arbor-edge-3"), g("--arbor-edge-4")],
    spouseLine:      g("--arbor-spouse-line"),
    rootBorder:      g("--interactive-accent"),
    text:            g("--text-normal"),
    textRoot:        g("--arbor-text-root"),
    textSib:         g("--text-muted"),
    dates:           g("--text-muted"),
    maleFill:        g("--arbor-male-fill"),
    maleBorder:      g("--arbor-male-border"),
    femaleFill:      g("--arbor-female-fill"),
    femaleBorder:    g("--arbor-female-border"),
    unknownFill:     g("--arbor-unknown-fill"),
    unknownBorder:   g("--arbor-unknown-border"),
    sibFill:         g("--arbor-sib-fill"),
    sibBorder:       g("--arbor-sib-border"),
    toolbarBg:       g("--background-secondary"),
    toolbarBorder:   g("--background-modifier-border"),
    btnBg:           g("--interactive-normal"),
    btnBorder:       g("--background-modifier-border"),
    btnColor:        g("--text-normal"),
    bodyBg:          g("--background-primary"),
  };
}

export class FamilyTreeView extends ItemView {
  private byName: Record<string, PersonPage> = {};
  private nameIndex: NameIndex = { stemToDisplay: {}, displayToStem: {} };
  private genderIndex: GenderIndex = {};

  private currentFolder = "";
  private homeRoot = "";

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

  onOpen(): Promise<void> {
    // Restore persisted toggle states.
    const s = this.plugin.settings;
    if (s.lastLayout)                   this.currentLayout     = s.lastLayout;
    if (s.coloredEdges      !== undefined) this.coloredEdges      = s.coloredEdges;
    if (s.siblingsBloodOnly !== undefined) this.siblingsBloodOnly = s.siblingsBloodOnly;

    // Re-render when Obsidian's theme changes so SVG picks up new CSS var values.
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        if (this.currentRoot) this.render(this.currentRoot);
      })
    );

    // Respond to file-open events while the view is open.
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => { if (file) this.onFileOpen(file); })
    );
    this.loadFromActiveFile();
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.contentEl.empty();
    return Promise.resolve();
  }

  // ── File context ──────────────────────────────────────────────────────────

  private isPersonFile(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.ar_type === "person";
  }

  private onFileOpen(file: TFile): void {
    if (!this.isPersonFile(file)) return;
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
    (this.leaf as unknown as { updateHeader(): void }).updateHeader();
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
    s.lastLayout        = this.currentLayout;
    s.coloredEdges      = this.coloredEdges;
    s.siblingsBloodOnly = this.siblingsBloodOnly;
    void this.plugin.saveSettings();

    this.contentEl.empty();

    const outerContainer = this.contentEl.createEl("div", { cls: "arbor-outer" });

    const { units, people, edges, pedigreeCollapse } = buildTree(rootName, this.byName, this.siblingsBloodOnly);
    const effectiveSiblingsBloodOnly = pedigreeCollapse ? true : this.siblingsBloodOnly;

    // ── Toolbar ──────────────────────────────────────────────────────────────

    const toolbar = outerContainer.createEl("div", { cls: "arbor-toolbar" });

    const parts = this.currentFolder.split("/");
    const folderName = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    const titleEl = toolbar.createEl("span", { cls: "arbor-title" });
    titleEl.createEl("strong", { text: "Arbor" });
    titleEl.createEl("span", { text: `: ${folderName}` });

    toolbar.createEl("span", {
      text: ` - ${this.displayName(rootName)} (${Object.keys(people).length} people)`,
      cls: "arbor-root-label",
    });

    const backBtn = toolbar.createEl("button", {
      text: "← back",
      cls: "arbor-btn" + (this.navHistory.length === 0 ? " is-disabled" : ""),
    });
    backBtn.addEventListener("click", () => {
      if (this.navHistory.length > 0) this.render(this.navHistory.pop()!);
    });

    const homeBtn = toolbar.createEl("button", { text: "⌂ home", cls: "arbor-btn" });
    homeBtn.addEventListener("click", () => {
      this.navHistory.length = 0;
      this.render(this.homeRoot);
    });

    const sibBtn = toolbar.createEl("button", {
      text: effectiveSiblingsBloodOnly ? "Show All Siblings" : "Blood Siblings Only",
      cls: "arbor-btn" + (pedigreeCollapse ? " is-disabled" : ""),
      attr: pedigreeCollapse
        ? { title: "Show all siblings is unavailable — this tree contains pedigree collapse" }
        : {},
    });
    if (!pedigreeCollapse) {
      sibBtn.addEventListener("click", () => {
        this.siblingsBloodOnly = !this.siblingsBloodOnly;
        this.render(this.currentRoot);
      });
    }

    toolbar.createEl("span", { cls: "arbor-divider" });

    const layoutBtn = toolbar.createEl("button", {
      text: this.currentLayout === "horizontal" ? "⇄ Vertical" : "↕ Horizontal",
      cls: "arbor-btn",
    });
    layoutBtn.addEventListener("click", () => {
      this.currentLayout = this.currentLayout === "horizontal" ? "vertical" : "horizontal";
      this.render(this.currentRoot);
    });

    const edgeColBtn = toolbar.createEl("button", {
      text: this.coloredEdges ? "Mono Lines" : "Colour Lines",
      cls: "arbor-btn",
    });
    edgeColBtn.addEventListener("click", () => {
      this.coloredEdges = !this.coloredEdges;
      this.render(this.currentRoot);
    });

    toolbar.createEl("span", {
      text: `v${this.plugin.manifest.version}`,
      cls: "arbor-version",
    });

    // ── SVG ──────────────────────────────────────────────────────────────────
    const t = resolveTheme();

    layout(units, edges, this.byName, this.currentLayout);
    const { svgW, svgH, edgeSVG, cardSVG } = buildSVG(
      units, edges, people, rootName, this.byName, this.genderIndex, t, this.currentLayout, this.coloredEdges
    );

    const svgContainer = outerContainer.createEl("div", { cls: "arbor-body" });

    svgContainer.appendChild(sanitizeHTMLToDom(
      `<svg width='${svgW}' height='${svgH}' xmlns='http://www.w3.org/2000/svg'>` +
      `<g id='edges'>${edgeSVG}</g><g id='cards'>${cardSVG}</g></svg>`
    ));

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
