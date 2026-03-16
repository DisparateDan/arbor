import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants";
import { ArborSettings } from "./types";
import { ARBOR_VIEW_TYPE, FamilyTreeView } from "./view";

export default class ArborPlugin extends Plugin {
  settings: ArborSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      ARBOR_VIEW_TYPE,
      (leaf) => new FamilyTreeView(leaf, this),
    );

    this.addRibbonIcon("git-fork", "Open Family Tree", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-family-tree",
      name: "Open Family Tree",
      callback: () => this.activateView(),
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(ARBOR_VIEW_TYPE);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(ARBOR_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab") as WorkspaceLeaf;
      await leaf.setViewState({ type: ARBOR_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as ArborSettings;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
