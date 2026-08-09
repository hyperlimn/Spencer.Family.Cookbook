"""Turn reconstructed PDF text into editable Markdown recipe records."""

from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw-pages.json"
RECIPES = ROOT / "content" / "recipes"

SECTIONS = [
    (1, 39, "Appetizers"),
    (40, 44, "Beverages"),
    (45, 51, "Breakfast"),
    (52, 154, "Desserts"),
    (155, 249, "Main Courses"),
    (250, 258, "Miscellaneous"),
    (259, 317, "Side Dishes"),
    (318, 332, "Slow Cooker"),
    (333, 339, "Soups"),
]


def category(page: int) -> str:
    return next((name for start, end, name in SECTIONS if start <= page <= end), "Uncategorized")


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "untitled"


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def group_lines(items: list[dict]) -> list[dict]:
    rows: dict[float, list[dict]] = defaultdict(list)
    for item in items:
        rows[round(item["y"], 1)].append(item)
    result = []
    for y in sorted(rows, reverse=True):
        row = sorted(rows[y], key=lambda item: item["x"])
        result.append({
            "text": " ".join(i["text"] for i in row).replace(" - ", "-").replace(" ®", "®"),
            "x": min(i["x"] for i in row),
            "y": y,
            "size": max(i["size"] for i in row),
        })
    return result


def title_clusters(lines: list[dict]) -> list[list[dict]]:
    titles = [line for line in lines if line["size"] >= 30 and line["text"] != "Index"]
    clusters: list[list[dict]] = []
    for line in titles:
        if not clusters or clusters[-1][-1]["y"] - line["y"] > 62:
            clusters.append([line])
        else:
            clusters[-1].append(line)
    return clusters


def clean_title(cluster: list[dict]) -> str:
    title = " ".join(line["text"] for line in cluster)
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(r"\s+-\s+", "-", title)
    return title


def likely_contributor(line: dict, side: str) -> bool:
    center_start = 95 if side == "left" else 491
    text = line["text"]
    blocked = ("mix ", "add ", "bake ", "cook ", "preheat ", "brown ", "combine ", "serve ", "spread ", "place ")
    return (
        17 <= line["size"] <= 20
        and line["x"] >= center_start
        and len(text) <= 38
        and not any(ch.isdigit() for ch in text)
        and not text.lower().startswith(blocked)
        and len(text.split()) <= 5
    )


def paragraphs(lines: list[dict]) -> list[str]:
    if not lines:
        return []
    result, current = [], [lines[0]["text"]]
    for previous, line in zip(lines, lines[1:]):
        if previous["y"] - line["y"] > 29:
            result.append(" ".join(current))
            current = [line["text"]]
        else:
            current.append(line["text"])
    result.append(" ".join(current))
    return result


def split_content(body: list[dict]) -> tuple[list[dict], list[dict]]:
    """Separate ingredient and method text, including recipes set in one font."""
    ingredients = [line for line in body if line["size"] <= 16.5]
    directions = [line for line in body if line["size"] > 16.5]
    if ingredients:
        return ingredients, directions
    method_words = (
        "add ", "arrange ", "bake ", "beat ", "blend ", "boil ", "brown ", "chill ",
        "combine ", "cook ", "cover ", "cut ", "drain ", "fold ", "heat ", "in a ",
        "layer ", "line ", "melt ", "mix ", "place ", "pour ", "preheat ", "roll ",
        "serve ", "shape ", "simmer ", "spread ", "stir ", "top ", "using ", "whisk ",
    )
    method_index = next((i for i, line in enumerate(body) if line["text"].lower().startswith(method_words)), None)
    if method_index is not None and method_index > 0:
        return body[:method_index], body[method_index:]
    return [], body


def main() -> None:
    pages = json.loads(RAW.read_text(encoding="utf-8"))
    pages = sorted((p for p in pages if p["printed_page"]), key=lambda p: p["printed_page"])
    records = []
    pending_continuation: list[dict] = []

    for page in pages:
        number = page["printed_page"]
        lines = [line for line in group_lines(page["items"]) if not (line["y"] < 42 and line["text"] == str(number))]
        clusters = title_clusters(lines)
        if not clusters:
            pending_continuation.extend(line for line in lines if line["text"] != "Index")
            continue

        for index, cluster in enumerate(clusters):
            title = clean_title(cluster)
            top = cluster[-1]["y"]
            bottom = clusters[index + 1][0]["y"] if index + 1 < len(clusters) else -1
            body = [line for line in lines if bottom < line["y"] < top and line["size"] < 30]
            if pending_continuation and records:
                records[-1]["extra_lines"].extend(pending_continuation)
                records[-1]["source_pages"].append(number - 1)
                pending_continuation = []

            is_continuation = bool(re.search(r"continued", title, re.I))
            if is_continuation and records:
                records[-1]["extra_lines"].extend(body)
                records[-1]["source_pages"].append(number)
                records[-1]["needs_review"] = True
                continue

            contributor = None
            if body and likely_contributor(body[0], page["side"]):
                contributor = body.pop(0)["text"]

            ingredient_lines, direction_lines = split_content(body)
            records.append({
                "title": title,
                "category": category(number),
                "contributor": contributor,
                "ingredients": [line["text"] for line in ingredient_lines],
                "directions": paragraphs(direction_lines),
                "extra_lines": [],
                "printed_page": number,
                "source_pages": [number],
                "pdf_page": page["pdf_page"],
                "source_side": page["side"],
                "needs_review": not ingredient_lines or not direction_lines,
            })

    RECIPES.mkdir(parents=True, exist_ok=True)
    used: dict[str, int] = defaultdict(int)
    for record in records:
        if record["extra_lines"]:
            record["directions"].extend(paragraphs(record["extra_lines"]))
            record["needs_review"] = True
        base = slugify(record["title"])
        used[base] += 1
        slug = base if used[base] == 1 else f"{base}-{record['printed_page']}"
        record["slug"] = slug
        ingredients = "\n".join(f"  - {yaml_string(item)}" for item in record["ingredients"])
        ingredient_field = f"ingredients:\n{ingredients}" if ingredients else "ingredients: []"
        directions = "\n\n".join(record["directions"]) or "Directions were not separated in the source layout. See the original page."
        contributor = "null" if not record["contributor"] else yaml_string(record["contributor"])
        source_pages = ", ".join(str(page) for page in sorted(set(record["source_pages"])))
        text = f'''---
title: {yaml_string(record["title"])}
slug: {yaml_string(slug)}
category: {yaml_string(record["category"])}
contributor: {contributor}
source_pages: [{source_pages}]
pdf_page: {record["pdf_page"]}
source_side: {yaml_string(record["source_side"])}
needs_review: {str(record["needs_review"]).lower()}
{ingredient_field}
---

{directions}
'''
        (RECIPES / f"{slug}.md").write_text(text, encoding="utf-8")

    print(f"Imported {len(records)} recipes ({sum(r['needs_review'] for r in records)} flagged for review).")


if __name__ == "__main__":
    main()
