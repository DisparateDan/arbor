# Arbor — Project Brief for Claude Code

## Purpose

Arbor is a personal family tree project built on top of an Obsidian vault. The goal is to maintain a family tree as a collection of Markdown notes, visualise it interactively inside Obsidian, and export it for sharing with non-technical family members as a standalone web page or standard GEDCOM file.

---

## Repository Layout

```
arbor/
├── CLAUDE.md                          ← this file
├── scripts/
│   ├── export_html.py                 ← exports vault to standalone HTML viewer
│   ├── export_gedcom.py               ← exports vault to GEDCOM 5.5.1
│   └── new_person.py                  ← creates a new person note with unique suffix
└── obsidian/
    ├── FamilyTreeView.md              ← DataviewJS tree renderer (deployed to vault)
    └── arbor_family_member_template.md ← blank person note template
```

**Deployment paths (files are edited here, then copied to the vault):**
- `obsidian/FamilyTreeView.md` → `~/Obsidian/PersonalDB/FamilyTree/FamilyTreeView.md`
- `obsidian/arbor_family_member_template.md` → reference only, not auto-deployed

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
- Wikilinks are resolved to bare filename stems by all scripts and the viewer

---

## Codebase

### `obsidian/FamilyTreeView.md`

Interactive SVG tree rendered inside Obsidian via a `dataviewjs` fenced block. No external dependencies beyond the Dataview plugin.

**Features:**
- Horizontal layout (generations as rows, ancestors above, descendants below) and vertical layout (generations as columns, ancestors left, descendants right)
- Toggle between layouts via toolbar button
- Siblings shown as muted side nodes connected by dashed edges; toggle between blood-line siblings only and all siblings via toolbar button
- Cards colour-coded by sex: male = blue tones, female = pink/rose, unknown = neutral
- Root person card has thicker border and accent colour
- Spouse pairs share a unit, connected by a short dashed line
- Click a card to re-centre the tree on that person; Back and Home buttons in toolbar
- Double-click a card to open that person's note in Obsidian
- Dark/light theme toggle in toolbar

**Key implementation notes:**
- `byName` dict keyed by file stem, populated from `dv.pages()`
- `stemFor()` / `displayName()` handle the stem ↔ display-name mapping
- `buildTree()` produces `units` (co-located person groups), `people` (individual index), and `edges`
- `layout()` branches on `currentLayout`; both branches share the same overlap-resolution approach
- `resolveOverlaps` / `resolveOverlapsV` sort by **parent centre first, then own position** to keep siblings from different parents from interleaving — do not regress this
- Module-level state: `currentTheme`, `currentLayout`, `siblingsBloodOnly`, `currentRoot`, `navHistory`, `outerContainer`
- The entire `outerContainer` (toolbar + SVG) is replaced on each `render()` call

### `scripts/export_html.py`

Exports the vault to a single self-contained `.html` file. The HTML template's JavaScript is kept **exactly in sync** with `FamilyTreeView.md` — same layout logic, same constants, same toolbar buttons, same rendering code. The only intentional differences are:
- No double-click to open note (not applicable outside Obsidian)
- Data is embedded as `PEOPLE` JSON dict rather than read via Dataview
- DOM manipulation uses `document.createElement` instead of `dv.el` / `createEl`

**Usage:**
```bash
python3 scripts/export_html.py
python3 scripts/export_html.py --vault ~/Obsidian/PersonalDB --root "Daniel Pusceddu" --output family.html
```

Requires: `python3-yaml` (`sudo apt install python3-yaml`)

### `scripts/export_gedcom.py`

Exports all person notes to a GEDCOM 5.5.1 file for use with genealogy applications (tested with Gramps).

**Usage:**
```bash
python3 scripts/export_gedcom.py --vault ~/Obsidian/PersonalDB --output family.ged
```

### `scripts/new_person.py`

Creates a new blank person note with a unique 4-character random suffix in the filename.

**Usage:**
```bash
python3 scripts/new_person.py "John Pusceddu"
python3 scripts/new_person.py "John Pusceddu" --first "John" --family "Pusceddu"
```

---

## Colour Theme System

Both `FamilyTreeView.md` and the HTML template in `export_html.py` share identical `THEMES` objects with flat key-value colour palettes. When updating colours, **both files must be updated together**.

Theme keys: `containerBorder`, `edge`, `edgeSib`, `spouseLine`, `rootBorder`, `text`, `textRoot`, `textSib`, `dates`, `maleFill`, `maleBorder`, `femaleFill`, `femaleBorder`, `unknownFill`, `unknownBorder`, `sibFill`, `sibBorder`, `toolbarBg`, `toolbarBorder`, `btnBg`, `btnBorder`, `btnColor`, `bodyBg` (HTML only), `toggleLabel`.

---

## Known Issues / Deferred Work

- **Intermingled siblings at gen 2+ ("show all siblings" mode):** When `siblingsBloodOnly = false`, siblings of married-in spouses can intermingle with blood-line children in some cases. Root cause is in `buildTree`/`addDescendants`. Deferred — the blood-siblings-only mode works correctly.
- **GEDCOM exporter** has not been tested with applications other than Gramps.

## Planned Features

- CSV import utility for bulk-adding people from an external spreadsheet

---

## Working Conventions

- Fixes are made to `obsidian/FamilyTreeView.md` first, then ported to `scripts/export_html.py`
- The HTML template JS and the Obsidian DataviewJS must stay in sync — drift between them is a bug
- Layout bugs and data/tree-building bugs are distinct failure modes; don't conflate them
- `resolveOverlaps` must sort by parent-centre first — this is a hard-won fix, do not revert it
- Prefer systematic logging to diagnose bugs before attempting fixes
- One bug at a time; clean revert if a fix causes regression rather than patching forward
- The `ar_type: person` filter is the sole loading criterion — do not add or change filter fields without updating all three scripts and the viewer
