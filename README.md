# Arbor Family Tree

An Obsidian plugin for building, visualising, and exporting a family tree stored as plain Markdown notes in your vault.

Arbor grew out of a personal project to document my own family history. It is not designed to be a canonically correct genealogical model — it is optimised for practical, everyday use by someone who wants to keep family records in Obsidian and share them with non-technical family members. If you have similar motivations, it may suit you well.

---

## Features

- **Interactive tree view** — visualise your family tree as a navigable SVG diagram, rooted on any person
- **Dark and light themes**
- **Horizontal and vertical layout modes**
- **Siblings toggle** — show blood-line siblings only, or all siblings including married-in relatives
- **Create Person Note** — modal command to add a new person note with the correct frontmatter
- **Import People from CSV** — bulk-create person notes from a CSV file, with dry-run preview
- **Export Tree as HTML** — generates a fully self-contained, interactive HTML file for sharing with anyone
- **Export Tree as GEDCOM** — exports to GEDCOM 5.5.1 for use with genealogy applications such as Gramps

---

## Installation

### From the Obsidian community plugin browser (recommended)

1. Open **Settings → Community plugins → Browse**
2. Search for **Arbor Family Tree**
3. Install and enable

### Manual installation

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/DisparateDan/arbor/releases)
2. Copy them to `<your vault>/.obsidian/plugins/arbor-family-tree/`
3. Enable the plugin in **Settings → Community plugins**

---

## Getting started

### 1. Create your first person note

Run **Arbor Family Tree: Create Person Note** from the command palette. You will be prompted for a first name and family name. Arbor will create a note with the correct frontmatter in your people folder.

Alternatively, create a note manually anywhere in your vault using the schema below.

### 2. Open the tree view

Click the tree icon in the ribbon, or run **Arbor Family Tree: Open Tree View** from the command palette. The tree will root on whichever person note is currently active.

### 3. Navigate

- **Click any card** to re-root the tree on that person
- **← Back** returns to the previous root
- **⌂ Home** returns to the person who was active when the tree was loaded
- **Show All Siblings / Blood Siblings Only** toggles sibling display mode

---

## Person note schema

Each person is a single Markdown file. The filename can be anything, but Arbor uses the file stem as the person's identifier — the convention is `First Last_xxxx.md` where `xxxx` is a short random suffix to keep filenames unique.

```yaml
---
ar_type: person          # required — marks this note as a person record
first_names:             # given name(s)
family_name:             # surname
sex:                     # male | female  (blank = unknown)
DOB:                     # year (1923), approximate (~1923, c.1923), or YYYY-MM-DD
DOD:                     # same formats as DOB
birthplace:
married: []              # list of wikilinks to spouse note stems
father:                  # wikilink to father's note stem
mother:                  # wikilink to mother's note stem
---
```

All fields except `ar_type` are optional. Arbor will render whatever is present.

### Wikilink format

Relationships use standard Obsidian wikilinks:

```yaml
father: "[[John Smith_ab12]]"
mother: "[[Mary Jones_cd34]]"
married:
  - "[[Jane Doe_ef56]]"
```

---

## Multiple trees

Arbor supports multiple independent family trees in one vault. Place each tree's person notes under a different top-level folder (e.g. `FamilyTree/People` and `AnotherTree/People`). Arbor uses the top-level folder name as the tree's identity and will prompt you to choose if it detects more than one tree.

---

## Exporting

### HTML export

Run **Arbor Family Tree: Export Tree as HTML** to generate a standalone HTML file saved to your vault root. The file is fully self-contained — no internet connection required — and can be shared with anyone who has a web browser. It includes the full interactive toolbar (navigation, theme toggle, layout toggle).

### GEDCOM export

Run **Arbor Family Tree: Export Tree as GEDCOM** to generate a GEDCOM 5.5.1 `.ged` file, compatible with genealogy applications such as Gramps. The exporter covers individuals, birth/death dates and places, and family units derived from parent and spouse fields.

---

## Known limitations

- The "show all siblings" mode can produce overlapping cards in some multi-generation configurations. Blood-siblings-only mode works correctly in all cases.
- GEDCOM export has been tested with Gramps only.

---

## License

MIT — see [LICENSE](LICENSE).
