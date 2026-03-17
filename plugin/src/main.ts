import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CURRENT_ARBOR_SCHEMA_VERSION, DEFAULT_SETTINGS } from "./constants";
import { ArborSettings } from "./types";
import { ARBOR_VIEW_TYPE, FamilyTreeView } from "./view";
import { registerNewPersonCommand } from "./commands/newPerson";

export default class ArborPlugin extends Plugin {
  settings: ArborSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.runSchemaMigrations();

    this.registerView(
      ARBOR_VIEW_TYPE,
      (leaf) => new FamilyTreeView(leaf, this),
    );

    this.addRibbonIcon("trees", "Open Tree View", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-family-tree",
      name: "Open Tree View",
      callback: () => this.activateView(),
    });

    registerNewPersonCommand(this);
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

  private async runSchemaMigrations(): Promise<void> {
    const stored = this.settings.arborSchemaVersion ?? 0;

    if (stored === CURRENT_ARBOR_SCHEMA_VERSION) return;

    if (stored > CURRENT_ARBOR_SCHEMA_VERSION) {
      new Notice(
        "Arbor: this vault was created with a newer version of the plugin. " +
        "Some features may not work correctly. Please update Arbor.",
      );
      return;
    }

    // Add migration steps here as the schema evolves, e.g.:
    // if (stored < 1) await migrateV0toV1(this.app);
    // if (stored < 2) await migrateV1toV2(this.app);

    this.settings.arborSchemaVersion = CURRENT_ARBOR_SCHEMA_VERSION;
    await this.saveSettings();
  }
}
