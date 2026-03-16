#!/usr/bin/env python3
"""
new_person.py
Creates a new Arbor person note with a unique filename suffix.

Usage:
    python3 new_person.py "John Pusceddu"
    python3 new_person.py "John Pusceddu" --vault ~/Obsidian/PersonalDB
    python3 new_person.py "John Pusceddu" --first "John" --family "Pusceddu"

The first and family name are inferred by splitting the full name on the last
space, but can be overridden explicitly for names that don't split cleanly
(e.g. compound surnames, prefixes like "de" or "van").
"""

import argparse
import random
import string
import sys
from pathlib import Path

DEFAULT_VAULT  = "~/Obsidian/PersonalDB"
DEFAULT_FOLDER = "FamilyTree/People"


# ── Helpers ───────────────────────────────────────────────────────────────────

def random_suffix(length: int = 4) -> str:
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=length))


def unique_suffix(existing_stems: set[str], base: str, length: int = 4) -> str:
    for _ in range(1000):
        suffix = random_suffix(length)
        if f"{base}_{suffix}" not in existing_stems:
            return suffix
    raise RuntimeError(f"Could not generate unique suffix for '{base}' after 1000 attempts")


def existing_stems(people_dir: Path) -> set[str]:
    return {md.stem for md in people_dir.glob("*.md")}


def make_template(first: str, family: str) -> str:
    return f"""---
ar_type: person
first_names: {first}
family_name: {family}
sex:
DOB:
DOD:
birthplace:
married: []
father:
mother:
---
"""


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Create a new Arbor person note.")
    parser.add_argument("fullname",          help="Full name, e.g. 'John Pusceddu'")
    parser.add_argument("--vault",  default=DEFAULT_VAULT,  help=f"Vault root (default: {DEFAULT_VAULT})")
    parser.add_argument("--folder", default=DEFAULT_FOLDER, help=f"People folder (default: {DEFAULT_FOLDER})")
    parser.add_argument("--first",  default=None, help="Override first names (default: inferred from fullname)")
    parser.add_argument("--family", default=None, help="Override family name (default: inferred from fullname)")
    args = parser.parse_args()

    # Infer first/family name split if not explicitly provided
    parts = args.fullname.strip().split()
    if len(parts) < 2 and not (args.first and args.family):
        print("Error: provide at least two name parts, or use --first and --family explicitly.")
        sys.exit(1)

    first  = args.first  or " ".join(parts[:-1])
    family = args.family or parts[-1]

    vault      = Path(args.vault).expanduser().resolve()
    people_dir = vault / args.folder

    if not people_dir.exists():
        print(f"Error: folder not found: {people_dir}")
        sys.exit(1)

    stems  = existing_stems(people_dir)
    base   = args.fullname.strip()
    suffix = unique_suffix(stems, base)
    stem   = f"{base}_{suffix}"
    path   = people_dir / f"{stem}.md"

    path.write_text(make_template(first, family), encoding="utf-8")
    print(f"Created: {path}")
    print(f"Filename stem: {stem}")


if __name__ == "__main__":
    main()
