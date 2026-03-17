#!/usr/bin/env python3
"""
bulk_import.py
Bulk-imports family members from a CSV file into the Charted Roots vault.

Usage:
    python3 bulk_import.py people.csv
    python3 bulk_import.py people.csv --vault ~/Obsidian/PersonalDB
    python3 bulk_import.py people.csv --dry-run
    python3 bulk_import.py --template            # write a blank people.csv template and exit

CSV format
----------
Header row is required. Columns match the arbor_family_member_template frontmatter:

    first_names   Given name(s)                       [required]
    family_name   Surname                             [required]
    sex           male | female | unknown             [optional]
    DOB           1923, ~1923, c.1923, 1923-04-15     [optional]
    DOD           same formats as DOB                 [optional]
    birthplace    Free text                           [optional]
    married       Full name(s) of spouse(s), semicolon-separated if multiple [optional]
    father        Full name of father                 [optional]
    mother        Full name of mother                 [optional]

There is no 'name' column. The full name used for filenames and relationship
resolution is derived as  first_names + " " + family_name.

Relationship columns (married, father, mother) contain plain full names — NOT
wikilinks. The script resolves each name to an existing vault file or creates
a minimal stub for any name not already present.

Existing files are never overwritten. Re-running the script on the same CSV
is safe: already-created people are skipped and their stems are reused when
resolving relationships.

Requires: pip install pyyaml --break-system-packages
"""

import argparse
import csv
import random
import re
import string
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML is required: pip install pyyaml --break-system-packages")
    sys.exit(1)

DEFAULT_VAULT  = "~/Obsidian/PersonalDB"
DEFAULT_FOLDER = "FamilyTree/People"

CSV_FIELDS = ["first_names", "family_name", "sex", "DOB", "DOD",
              "birthplace", "married", "father", "mother"]


# ── Name helpers ──────────────────────────────────────────────────────────────

def full_name(first: str, family: str) -> str:
    parts = [p for p in (first.strip(), family.strip()) if p]
    return " ".join(parts)


# ── Suffix helpers (mirrors new_person.py) ────────────────────────────────────

def random_suffix(length: int = 4) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


def unique_suffix(existing_stems: set, base: str, length: int = 4) -> str:
    for _ in range(10_000):
        suffix = random_suffix(length)
        candidate = f"{base}_{suffix}"
        if candidate not in existing_stems:
            return suffix
    raise RuntimeError(f"Could not find a unique suffix for '{base}' after 10 000 attempts")


# ── Vault helpers ─────────────────────────────────────────────────────────────

def load_existing(people_dir: Path) -> dict:
    """Return full_name -> file_stem for every person note in the vault."""
    result = {}
    for md in people_dir.glob("*.md"):
        fm = _parse_frontmatter(md)
        if fm is None:
            continue
        is_person = (
            fm.get("ar_type") == "person"
            or fm.get("cr_type") == "person"
            or fm.get("type") == "familymember"
        )
        if not is_person:
            continue
        name = full_name(
            str(fm.get("first_names") or ""),
            str(fm.get("family_name") or ""),
        )
        if not name:
            name = _stem_to_name(md.stem)
        if name:
            result.setdefault(name, md.stem)
    return result


def _parse_frontmatter(path: Path):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return None
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return None


def _stem_to_name(stem: str) -> str:
    m = re.match(r"^(.+)_[a-z0-9]{4}$", stem)
    return m.group(1) if m else stem


def _split_name(name: str):
    parts = name.strip().split()
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


# ── Note rendering ────────────────────────────────────────────────────────────

def render_note(*, first_names, family_name, sex, dob, dod, birthplace,
                married_stems, father_stem, mother_stem) -> str:
    lines = ["---"]
    lines.append("ar_type: person")
    lines.append("type: familymember")
    lines.append(f"first_names: {first_names}")
    lines.append(f"family_name: {family_name}")
    lines.append(f"sex: {sex}")
    lines.append(f"DOB: {dob}")
    lines.append(f"DOD: {dod}")
    lines.append(f"birthplace: {birthplace}")

    if married_stems:
        lines.append("married:")
        for stem in married_stems:
            lines.append(f'  - "[[{stem}]]"')
    else:
        lines.append("married: []")

    father_val = f'"[[{father_stem}]]"' if father_stem else ""
    mother_val = f'"[[{mother_stem}]]"' if mother_stem else ""
    lines.append(f"father: {father_val}")
    lines.append(f"mother: {mother_val}")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def render_stub(first_names: str, family_name: str) -> str:
    lines = ["---"]
    lines.append("ar_type: person")
    lines.append("type: familymember")
    lines.append(f"first_names: {first_names}")
    lines.append(f"family_name: {family_name}")
    lines.append("sex:")
    lines.append("DOB:")
    lines.append("DOD:")
    lines.append("birthplace:")
    lines.append("married: []")
    lines.append("father:")
    lines.append("mother:")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)


# ── CSV template ──────────────────────────────────────────────────────────────

TEMPLATE_ROWS = [
    {
        "first_names": "Angela",
        "family_name": "Iacobono",
        "sex":         "female",
        "DOB":         "1923",
        "DOD":         "2001-03-15",
        "birthplace":  "Naples, Italy",
        "married":     "Giuseppe Rossi",
        "father":      "Mario Iacobono",
        "mother":      "Lucia Ferrara",
    },
    {
        "first_names": "Giuseppe",
        "family_name": "Rossi",
        "sex":         "male",
        "DOB":         "~1920",
        "DOD":         "",
        "birthplace":  "",
        "married":     "Angela Iacobono",
        "father":      "",
        "mother":      "",
    },
]


def write_template(output_path: Path):
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(TEMPLATE_ROWS)
    print(f"Template written to {output_path}")


# ── Core import logic ─────────────────────────────────────────────────────────

def import_csv(csv_path: Path, people_dir: Path, dry_run: bool, verbose: bool) -> None:
    # 1. Load existing vault notes
    name_to_stem = load_existing(people_dir)
    stems_set = set(name_to_stem.values())

    if verbose:
        print(f"Found {len(name_to_stem)} existing person note(s) in vault.")

    # 2. Parse CSV
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("CSV is empty — nothing to do.")
        return

    for col in ("first_names", "family_name"):
        if col not in (reader.fieldnames or []):
            print(f"Error: CSV is missing required column: '{col}'")
            sys.exit(1)

    rows = [{k.strip(): (v or "").strip() for k, v in row.items()} for row in rows]

    # 3. Collect every name mentioned (direct + relational)
    all_names = set()
    for row in rows:
        name = full_name(row.get("first_names", ""), row.get("family_name", ""))
        if name:
            all_names.add(name)
        for rel_col in ("father", "mother"):
            rel = row.get(rel_col, "").strip()
            if rel:
                all_names.add(rel)
        for spouse in _split_list(row.get("married", "")):
            all_names.add(spouse)

    # 4. Assign stems for every name
    for name in sorted(all_names):
        if name in name_to_stem:
            continue
        suffix = unique_suffix(stems_set, name)
        stem = f"{name}_{suffix}"
        name_to_stem[name] = stem
        stems_set.add(stem)

    # 5. Determine which names need stub files
    csv_names = {
        full_name(r.get("first_names", ""), r.get("family_name", ""))
        for r in rows
        if full_name(r.get("first_names", ""), r.get("family_name", ""))
    }
    relation_only_names = all_names - csv_names

    # 6. Write files
    created = []
    skipped = []
    stub_created = []

    # 6a. Stubs for relation-only names
    for name in sorted(relation_only_names):
        stem = name_to_stem[name]
        path = people_dir / f"{stem}.md"
        if path.exists():
            if verbose:
                print(f"  [skip-stub]  {stem}.md  (already exists)")
            skipped.append(stem)
            continue
        first, family = _split_name(name)
        content = render_stub(first, family)
        if not dry_run:
            path.write_text(content, encoding="utf-8")
        stub_created.append(stem)
        print(f"  [stub]    {stem}.md")

    # 6b. Full notes for CSV rows
    for row in rows:
        first_names = row.get("first_names", "").strip()
        family_name = row.get("family_name", "").strip()
        name = full_name(first_names, family_name)

        if not name:
            print(f"  [warn]  Skipping row with no name: {row}")
            continue

        stem = name_to_stem[name]
        path = people_dir / f"{stem}.md"

        if path.exists():
            print(f"  [skip]    {stem}.md  (already exists)")
            skipped.append(stem)
            continue

        father_stem = name_to_stem.get(row.get("father", "").strip()) if row.get("father") else None
        mother_stem = name_to_stem.get(row.get("mother", "").strip()) if row.get("mother") else None
        married_stems = [
            name_to_stem[sp]
            for sp in _split_list(row.get("married", ""))
            if sp in name_to_stem
        ]

        content = render_note(
            first_names   = first_names,
            family_name   = family_name,
            sex           = row.get("sex", ""),
            dob           = row.get("DOB", ""),
            dod           = row.get("DOD", ""),
            birthplace    = row.get("birthplace", ""),
            married_stems = married_stems,
            father_stem   = father_stem,
            mother_stem   = mother_stem,
        )

        if not dry_run:
            path.write_text(content, encoding="utf-8")
        created.append(stem)
        print(f"  [create]  {stem}.md")

    # 7. Summary
    mode = " (DRY RUN — no files written)" if dry_run else ""
    print()
    print(f"Done{mode}.")
    print(f"  Full notes created : {len(created)}")
    print(f"  Stub notes created : {len(stub_created)}")
    print(f"  Already existed    : {len(skipped)}")


def _split_list(value: str) -> list:
    if not value:
        return []
    return [v.strip() for v in re.split(r"[;|]", value) if v.strip()]


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Bulk-import family members from CSV into the Charted Roots vault."
    )
    parser.add_argument("csv", nargs="?", metavar="CSV_FILE",
                        help="Path to the input CSV file")
    parser.add_argument("--vault",  default=DEFAULT_VAULT,
                        help=f"Vault root (default: {DEFAULT_VAULT})")
    parser.add_argument("--folder", default=DEFAULT_FOLDER,
                        help=f"People folder relative to vault (default: {DEFAULT_FOLDER})")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and validate only — no files written")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Print extra detail")
    parser.add_argument("--template", action="store_true",
                        help="Write a blank people.csv template and exit")
    args = parser.parse_args()

    if args.template:
        write_template(Path("people.csv"))
        return

    if not args.csv:
        parser.error("CSV_FILE is required (or use --template to generate one)")

    csv_path = Path(args.csv).expanduser().resolve()
    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)

    vault      = Path(args.vault).expanduser().resolve()
    people_dir = (vault / args.folder).resolve()

    if not args.dry_run and not people_dir.exists():
        print(f"Error: people folder not found: {people_dir}")
        print("       Pass --dry-run to validate without needing the vault.")
        sys.exit(1)

    if args.dry_run and not people_dir.exists():
        print("[dry-run] Vault folder not found; treating as empty vault.")
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            import_csv(csv_path, Path(tmp), dry_run=True, verbose=args.verbose)
        return

    import_csv(csv_path, people_dir, dry_run=args.dry_run, verbose=args.verbose)


if __name__ == "__main__":
    main()
