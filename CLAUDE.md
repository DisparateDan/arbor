# Arbor — Project Brief for Claude Code

## Purpose

Arbor is a personal family tree project built on top of an Obsidian vault. The goal is to maintain a family tree as a collection of Markdown notes, visualise it interactively inside Obsidian, and export it for sharing with non-technical family members as a standalone web page or standard GEDCOM file.

---

## Repository Layout

```
arbor/
├── CLAUDE.md
├── scripts/
│   └── export_gedcom.py               ← exports vault to GEDCOM 5.5.1
└── plugin/                            ← Obsidian community plugin (source of truth)
    ├── manifest.json
    ├── package.json
    ├── esbuild.config.mjs
    ├── generate-html-bundle.mjs       ← compiles htmlExport.ts → htmlBundle.ts
    └── src/
        ├── main.ts                    ← plugin entry point, command registration
        ├── view.ts                    ← FamilyTreeView (ItemView)
        ├── loader.ts                  ← vault data loading
        ├── tree.ts                    ← buildTree() + pure data helpers
        ├── layout.ts                  ← layout engine
        ├── renderer.ts                ← SVG renderer
        ├── constants.ts               ← THEMES, card dimensions, defaults
        ├── types.ts                   ← shared TypeScript interfaces
        ├── htmlExport.ts              ← standalone browser entry point for HTML export
        ├── htmlBundle.ts              ← AUTO-GENERATED — do not edit
        └── commands/
            ├── newPerson.ts           ← "Create Person Note" command
            ├── bulkImport.ts          ← "Import People from CSV" command
            └── exportHtml.ts          ← "Export Tree as HTML" command
```

**Schema reference:**
- `obsidian/arbor_family_member_template.md` — blank person note template (reference only)

---

## Vault Structure

- **Vault root:** `~/Obsidian/PersonalDB`
- **People folder:** `FamilyTree/People`
- Each person is a single `.md` file whose filename stem is the person's full name plus a 4-character random suffix, e.g. `Daniel Pusceddu_alek.md`
- The root/home person is **Daniel Pusceddu** (`Daniel Pusceddu_alek.md`)

---

## Person Note Frontmatter Schema

```yaml
ar_type: person          # filter field — must be exactly this value
first_names:             # given names
family_name:             # surname
sex:                     # male | female  (lowercase, blank = unknown)
DOB:                     # year int, ~1923, c.1923, or YYYY-MM-DD
DOD:                     # same format as DOB
birthplace:
married: []              # list of wikilinks to spouse note stems
father:                  # wikilink to father's note stem
mother:                  # wikilink to mother's note stem
```

Key rules:
- Filter field is `ar_type: person` — **not** `type: familymember` (old schema, now obsolete)
- Sex values are lowercase; blank/missing renders as unknown (neutral card colour)
- Dates may be plain year ints, approximate strings (`~1923`, `c.1923`), full ISO dates, or Dataview date objects `{year, month, day}`
- Wikilinks are resolved to bare filename stems by the plugin and all scripts

---

## Plugin Architecture

### Core modules (`src/`)

The plugin is structured as pure functional modules with a thin Obsidian adapter layer:

- **`loader.ts`** — `loadPeople()` reads vault via `app.metadataCache`; `buildNameIndex()` / `buildGenderIndex()` are pure helpers
- **`tree.ts`** — `buildTree()` produces `{ units, people, edges, bloodLine }`; also exports `resolveName()`, `resolveList()`, `getYear()`, `getNameLines()`, `trunc()`
- **`layout.ts`** — `layout()` mutates unit x/y/width/height in place; pure, no Obsidian deps
- **`renderer.ts`** — `buildSVG()` returns `{ svgW, svgH, edgeSVG, cardSVG }`; pure, no Obsidian deps
- **`constants.ts`** — `THEMES`, card dimensions, `DEFAULT_SETTINGS`, `CURRENT_ARBOR_SCHEMA_VERSION`
- **`view.ts`** — `FamilyTreeView` (ItemView); detects active file, loads data, renders tree, handles toolbar interactions

### Commands (`src/commands/`)

- **`newPerson.ts`** — "Create Person Note": auto-detects people folder, two-field modal, exports `createPersonNote()` and `uniqueSuffix()` for reuse
- **`bulkImport.ts`** — "Import People from CSV": vault CSV picker, dry-run preview, confirm step, stub creation for relation-only names
- **`exportHtml.ts`** — "Export Tree as HTML": serialises vault data, assembles standalone HTML embedding the compiled bundle

### HTML export pipeline

The HTML export embeds the plugin's own compiled logic — no separately maintained JS copy:

1. `src/htmlExport.ts` imports `tree.ts`, `layout.ts`, `renderer.ts`, `constants.ts` (no Obsidian deps)
2. `generate-html-bundle.mjs` compiles it to a minified IIFE via esbuild → writes `src/htmlBundle.ts`
3. `src/commands/exportHtml.ts` imports `HTML_BUNDLE` from `htmlBundle.ts` and embeds it in the output HTML

**`src/htmlBundle.ts` is auto-generated.** Run `npm run build:html` to regenerate after changing tree/layout/renderer logic. The full `npm run build` does this automatically.

### Schema versioning

`arborSchemaVersion` is stored in plugin settings (`data.json`). `runSchemaMigrations()` runs on every `onload()`. Add migration steps to that method when breaking schema changes are needed. Current version: `0`.

---

## Colour Theme System

`THEMES` in `constants.ts` is the single source of truth for all colours. The HTML export uses the same object via the compiled bundle — no separate copy to maintain.

Theme keys: `containerBorder`, `edge`, `edgeSib`, `spouseLine`, `rootBorder`, `text`, `textRoot`, `textSib`, `dates`, `maleFill`, `maleBorder`, `femaleFill`, `femaleBorder`, `unknownFill`, `unknownBorder`, `sibFill`, `sibBorder`, `toolbarBg`, `toolbarBorder`, `btnBg`, `btnBorder`, `btnColor`, `bodyBg`, `toggleLabel`.

---

## `scripts/export_gedcom.py`

Exports all person notes to a GEDCOM 5.5.1 file for use with genealogy applications (tested with Gramps). Not yet ported to a plugin command.

**Usage:**
```bash
python3 scripts/export_gedcom.py --vault ~/Obsidian/PersonalDB --output family.ged
```

---

## Known Issues / Deferred Work

- **Intermingled siblings at gen 2+ ("show all siblings" mode):** When `siblingsBloodOnly = false`, siblings of married-in spouses can intermingle with blood-line children in some cases. Root cause is in `buildTree`/`addDescendants`. Deferred — the blood-siblings-only mode works correctly.
- **GEDCOM exporter** has not been tested with applications other than Gramps.

## Planned Features

_(none at this time)_

---

## Working Conventions

- The plugin `src/` modules are the source of truth — `obsidian/FamilyTreeView.md` and the Python scripts are deprecated/removed
- Layout bugs and data/tree-building bugs are distinct failure modes; don't conflate them
- `resolveOverlaps` / `resolveOverlapsV` must sort by parent-centre first — this is a hard-won fix, do not revert it
- Prefer systematic logging to diagnose bugs before attempting fixes
- One bug at a time; clean revert if a fix causes regression rather than patching forward
- The `ar_type: person` filter is the sole loading criterion — do not add or change filter fields without updating all plugin modules and `export_gedcom.py`
- Obsidian command `name` fields should NOT include the plugin name prefix — Obsidian prepends "Arbor Family Tree:" automatically in the command palette
