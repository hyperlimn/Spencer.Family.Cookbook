"""Build the browser-friendly JSON catalog from Markdown recipe files."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECIPE_DIRS = (ROOT / "content" / "recipes", ROOT / "content" / "new-recipes")


def parse_scalar(value: str):
    value = value.strip()
    if value == "null":
        return None
    if value in ("true", "false"):
        return value == "true"
    if re.fullmatch(r"\d+", value):
        return int(value)
    if value.startswith("["):
        return json.loads(value)
    return json.loads(value) if value.startswith('"') else value


def parse_recipe(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    _, front, body = raw.split("---", 2)
    data, active_list = {}, None
    for line in front.strip().splitlines():
        if line.startswith("  - ") and active_list:
            data[active_list].append(parse_scalar(line[4:]))
        elif ":" in line:
            key, value = line.split(":", 1)
            if value.strip():
                data[key] = parse_scalar(value)
                active_list = None
            else:
                data[key] = []
                active_list = key
    data["directions"] = [p.replace("\n", " ").strip() for p in re.split(r"\n\s*\n", body.strip()) if p.strip()]
    data["file"] = path.relative_to(ROOT).as_posix()
    return data


def main() -> None:
    paths = sorted(path for directory in RECIPE_DIRS for path in directory.glob("*.md"))
    recipes = [parse_recipe(path) for path in paths]
    slug_files: dict[str, list[str]] = {}
    for recipe in recipes:
        slug_files.setdefault(recipe["slug"], []).append(recipe["file"])
    duplicates = {slug: files for slug, files in slug_files.items() if len(files) > 1}
    if duplicates:
        details = "; ".join(f"{slug}: {', '.join(files)}" for slug, files in duplicates.items())
        raise ValueError(f"Duplicate recipe slugs found: {details}")
    recipes.sort(key=lambda item: (item["title"].casefold(), (item.get("source_pages") or [0])[0]))
    contributors = sorted({r["contributor"] for r in recipes if r["contributor"]})
    payload = {"recipes": recipes, "contributors": contributors}
    output = ROOT / "docs" / "data" / "recipes.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {len(recipes)} recipes and {len(contributors)} contributors.")


if __name__ == "__main__":
    main()
