#!/usr/bin/env python3
"""Copy listed upstream skills into this repo.

Each JSON file in .github/vendor-skills/ names one skill to vendor:

    {"source": "owner/repo", "skill": "skill-name", "dest": "skills/skill-name"}

Optional "ref" pins a branch or tag. Default is the source repo's default
branch. dest must stay under skills/ or machine/.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VENDOR_DIR = ROOT / ".github" / "vendor-skills"
SOURCE_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
NAME_RE = re.compile(r"^name:\s*[\"']?([a-z0-9]+(?:-[a-z0-9]+)*)[\"']?\s*$")
ALLOWED_DEST_PREFIXES = ("skills/", "machine/")


def main() -> int:
    entries = load_entries()
    if not entries:
        print("No vendored skills listed under .github/vendor-skills/")
        return 0

    for entry in entries:
        refresh(entry)
    return 0


def load_entries() -> list[dict[str, str]]:
    if not VENDOR_DIR.is_dir():
        return []

    entries: list[dict[str, str]] = []
    for path in sorted(VENDOR_DIR.glob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{path}: invalid JSON: {exc}") from exc
        entries.append(parse_entry(path, raw))
    return entries


def parse_entry(path: Path, raw: object) -> dict[str, str]:
    if not isinstance(raw, dict):
        raise SystemExit(f"{path}: expected a JSON object")

    source = require_str(path, raw, "source")
    skill = require_str(path, raw, "skill")
    dest = require_str(path, raw, "dest").rstrip("/")
    ref = raw.get("ref")

    if not SOURCE_RE.fullmatch(source):
        raise SystemExit(f"{path}: source must be owner/repo, got {source!r}")
    if not dest_is_allowed(dest):
        raise SystemExit(f"{path}: dest must be under skills/ or machine/, got {dest!r}")
    if ref is not None and (not isinstance(ref, str) or not ref or ref.startswith("-")):
        raise SystemExit(f"{path}: ref must be a non-empty branch or tag")

    entry = {"source": source, "skill": skill, "dest": dest}
    if isinstance(ref, str):
        entry["ref"] = ref
    return entry


def dest_is_allowed(dest: str) -> bool:
    if not dest.startswith(ALLOWED_DEST_PREFIXES) or Path(dest).is_absolute():
        return False
    resolved = (ROOT / dest).resolve()
    try:
        resolved.relative_to(ROOT)
    except ValueError:
        return False
    return any(
        resolved != base and resolved.is_relative_to(base)
        for base in ((ROOT / "skills").resolve(), (ROOT / "machine").resolve())
    )


def require_str(path: Path, raw: dict[object, object], key: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        raise SystemExit(f"{path}: {key} must be a non-empty string")
    return value.strip()


def refresh(entry: dict[str, str]) -> None:
    dest = ROOT / entry["dest"]
    url = f"https://github.com/{entry['source']}.git"
    clone_cmd = ["git", "clone", "--depth", "1"]
    if "ref" in entry:
        clone_cmd.extend(["--branch", entry["ref"]])
    clone_cmd.append(url)

    with tempfile.TemporaryDirectory() as tmp:
        clone = Path(tmp) / "src"
        clone_cmd.append(str(clone))
        subprocess.run(clone_cmd, check=True)
        src = find_skill_dir(clone, entry["skill"])
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(src, dest, ignore=shutil.ignore_patterns(".git"))

    print(f"vendored {entry['skill']} from {entry['source']} -> {entry['dest']}")


def find_skill_dir(clone: Path, skill_name: str) -> Path:
    for skill_md in clone.rglob("SKILL.md"):
        if ".git" in skill_md.parts:
            continue
        name = skill_name_from(skill_md)
        if name == skill_name:
            return skill_md.parent
    raise SystemExit(f"skill {skill_name!r} not found in clone")


def skill_name_from(skill_md: Path) -> str | None:
    text = skill_md.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end < 0:
        return None
    for line in text[3:end].splitlines():
        match = NAME_RE.match(line.strip())
        if match:
            return match.group(1)
    return None


if __name__ == "__main__":
    sys.exit(main())
