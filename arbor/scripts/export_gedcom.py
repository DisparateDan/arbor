#!/usr/bin/env python3
"""
export_gedcom.py
Exports Obsidian family tree notes to a GEDCOM 5.5.1 file.

Usage:
    python3 export_gedcom.py --vault /path/to/vault --output family.ged

The script expects notes in <vault>/Charted Roots/People/*.md with frontmatter:
    cr_type, cr_id, type, name, first_names, family_name, birthplace,
    sex, DOB, DOD, married, father, mother
"""

import argparse
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML is required: pip install pyyaml --break-system-packages")
    sys.exit(1)


# ── Helpers ──────────────────────────────────────────────────────────────────

def parse_frontmatter(path: Path) -> dict | None:
    """Extract YAML frontmatter from a markdown file."""
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return None
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None


def resolve_link(val) -> str | None:
    """Turn a wikilink, path object, or plain string into a bare filename stem."""
    if not val:
        return None
    if isinstance(val, dict) and "path" in val:
        return Path(val["path"]).stem
    s = str(val).strip()
    m = re.match(r"\[\[(.+?)(?:\|.+?)?\]\]", s)
    return m.group(1) if m else (s or None)


def resolve_list(val) -> list[str]:
    if not val:
        return []
    if isinstance(val, list):
        return [r for v in val if (r := resolve_link(v))]
    r = resolve_link(val)
    return [r] if r else []


def format_gedcom_date(val) -> str | None:
    """
    Convert a DOB/DOD value to a GEDCOM date string.
    Handles:
      - plain year int/str: 1923  → "1923"
      - approximate:        ~1923 → "ABT 1923"
      - circa:              c1923 / c.1923 → "ABT 1923"
      - full ISO date:      1923-04-15 → "15 APR 1923"
      - YYYY-MM:            1923-04 → "APR 1923"
      - Dataview date dict: {year: 1923, month: 4, day: 15}
    """
    MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN",
              "JUL","AUG","SEP","OCT","NOV","DEC"]

    if not val:
        return None

    # Dataview date dict
    if isinstance(val, dict):
        y = val.get("year")
        mo = val.get("month")
        d = val.get("day")
        if y:
            if mo and d:
                return f"{int(d):02d} {MONTHS[int(mo)-1]} {int(y)}"
            if mo:
                return f"{MONTHS[int(mo)-1]} {int(y)}"
            return str(int(y))
        return None

    # Python date object (yaml may parse YYYY-MM-DD as date)
    if hasattr(val, "year") and hasattr(val, "month") and hasattr(val, "day"):
        return f"{val.day:02d} {MONTHS[val.month-1]} {val.year}"

    s = str(val).strip()

    # Approximate prefix
    prefix = ""
    m = re.match(r"^([~c]+\.?)\s*", s)
    if m:
        prefix = "ABT "
        s = s[m.end():]

    # YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return prefix + f"{d:02d} {MONTHS[mo-1]} {y}"

    # YYYY-MM
    m = re.match(r"^(\d{4})-(\d{2})$", s)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
        return prefix + f"{MONTHS[mo-1]} {y}"

    # Plain year
    m = re.match(r"^(\d{3,4})$", s)
    if m:
        return prefix + m.group(1)

    return prefix + s if s else None


def sex_to_gedcom(val) -> str:
    if not val:
        return "U"
    s = str(val).strip().lower()
    if s == "male":   return "M"
    if s == "female": return "F"
    return "U"


def ged_line(level: int, tag: str, value: str = "") -> str:
    if value:
        return f"{level} {tag} {value}"
    return f"{level} {tag}"


# ── Main export ───────────────────────────────────────────────────────────────

def load_people(people_dir: Path) -> dict[str, dict]:
    """Load all family member notes, keyed by file stem (= person name)."""
    people = {}
    for md in people_dir.glob("*.md"):
        fm = parse_frontmatter(md)
        if not fm or fm.get("type") != "familymember":
            continue
        people[md.stem] = fm
    return people


def build_families(people: dict[str, dict]) -> list[dict]:
    """
    Derive family units from parent fields.
    Returns a list of dicts: {husband, wife, children}
    Each is a unique (father, mother) pair found across all child records,
    plus any marriages that produced no children.
    """
    fam_map: dict[tuple, list] = {}  # (father|None, mother|None) -> [child_names]

    for name, fm in people.items():
        f = resolve_link(fm.get("father"))
        m = resolve_link(fm.get("mother"))
        if f or m:
            key = (f, m)
            fam_map.setdefault(key, []).append(name)

    # Also capture marriages that may not yet have children recorded
    for name, fm in people.items():
        spouses = resolve_list(fm.get("married"))
        sex = sex_to_gedcom(fm.get("sex"))
        for sp in spouses:
            if sex == "M":
                key = (name, sp)
            elif sex == "F":
                key = (sp, name)
            else:
                # Arbitrary ordering to avoid duplicates
                key = tuple(sorted([name, sp]))
            fam_map.setdefault(key, [])

    families = []
    for (father, mother), children in fam_map.items():
        families.append({
            "husband":  father,
            "wife":     mother,
            "children": children,
        })
    return families


def export_gedcom(people: dict[str, dict], output_path: Path):
    # Assign stable XREF IDs
    person_ids: dict[str, str] = {}
    for i, name in enumerate(sorted(people.keys()), start=1):
        person_ids[name] = f"I{i:04d}"

    families = build_families(people)
    family_ids: dict[int, str] = {}
    for i, _ in enumerate(families, start=1):
        family_ids[i] = f"F{i:04d}"

    # Build a lookup: person -> list of family IDs they appear in as spouse
    spouse_fams: dict[str, list[str]] = {}
    child_fams:  dict[str, list[str]] = {}
    for i, fam in enumerate(families, start=1):
        fid = family_ids[i]
        for role in ("husband", "wife"):
            p = fam.get(role)
            if p:
                spouse_fams.setdefault(p, []).append(fid)
        for child in fam["children"]:
            child_fams.setdefault(child, []).append(fid)

    lines = []

    # Header
    now = datetime.now()
    lines += [
        ged_line(0, "HEAD"),
        ged_line(1, "SOUR", "ObsidianExport"),
        ged_line(2, "NAME", "Obsidian Family Tree Exporter"),
        ged_line(1, "DATE", now.strftime("%d %b %Y").upper()),
        ged_line(2, "TIME", now.strftime("%H:%M:%S")),
        ged_line(1, "FILE", output_path.name),
        ged_line(1, "GEDC"),
        ged_line(2, "VERS", "5.5.1"),
        ged_line(2, "FORM", "LINEAGE-LINKED"),
        ged_line(1, "CHAR", "UTF-8"),
    ]

    # Individual records
    for name, fm in sorted(people.items()):
        xref = person_ids[name]
        first  = str(fm.get("first_names") or "").strip()
        last   = str(fm.get("family_name") or "").strip()
        full_name = f"{first} /{last}/" if last else first

        lines += [
            ged_line(0, f"@{xref}@", "INDI"),
            ged_line(1, "NAME", full_name),
        ]
        if first:
            lines.append(ged_line(2, "GIVN", first))
        if last:
            lines.append(ged_line(2, "SURN", last))

        lines.append(ged_line(1, "SEX", sex_to_gedcom(fm.get("sex"))))

        dob = format_gedcom_date(fm.get("DOB"))
        birthplace = str(fm.get("birthplace") or "").strip()
        if dob or birthplace:
            lines.append(ged_line(1, "BIRT"))
            if dob:
                lines.append(ged_line(2, "DATE", dob))
            if birthplace:
                lines.append(ged_line(2, "PLAC", birthplace))

        dod = format_gedcom_date(fm.get("DOD"))
        if dod:
            lines += [
                ged_line(1, "DEAT"),
                ged_line(2, "DATE", dod),
            ]

        for fid in spouse_fams.get(name, []):
            lines.append(ged_line(1, "FAMS", f"@{fid}@"))
        for fid in child_fams.get(name, []):
            lines.append(ged_line(1, "FAMC", f"@{fid}@"))

    # Family records
    for i, fam in enumerate(families, start=1):
        fid = family_ids[i]
        lines.append(ged_line(0, f"@{fid}@", "FAM"))
        if fam["husband"] and fam["husband"] in person_ids:
            lines.append(ged_line(1, "HUSB", f"@{person_ids[fam['husband']]}@"))
        if fam["wife"] and fam["wife"] in person_ids:
            lines.append(ged_line(1, "WIFE", f"@{person_ids[fam['wife']]}@"))
        for child in fam["children"]:
            if child in person_ids:
                lines.append(ged_line(1, "CHIL", f"@{person_ids[child]}@"))

    lines.append(ged_line(0, "TRLR"))

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Exported {len(people)} individuals and {len(families)} families to {output_path}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Export Obsidian family tree notes to GEDCOM.")
    parser.add_argument("--vault",  required=True, help="Path to your Obsidian vault root")
    parser.add_argument("--output", default="family.ged", help="Output .ged file path (default: family.ged)")
    parser.add_argument("--folder", default="Charted Roots/People",
                        help="Vault-relative folder containing person notes")
    args = parser.parse_args()

    vault = Path(args.vault).expanduser().resolve()
    people_dir = vault / args.folder
    if not people_dir.exists():
        print(f"Error: folder not found: {people_dir}")
        sys.exit(1)

    people = load_people(people_dir)
    if not people:
        print(f"No family member notes found in {people_dir}")
        sys.exit(1)

    output_path = Path(args.output).expanduser().resolve()
    export_gedcom(people, output_path)


if __name__ == "__main__":
    main()
    