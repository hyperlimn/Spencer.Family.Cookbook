"""Reconstruct cookbook pages and print a title map for import development."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tools"))

from pypdf import PdfReader


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def collect_half(page, side: str) -> list[dict]:
    items: list[dict] = []

    def visitor(text, _cm, tm, _font, size):
        value = clean(text)
        x, y = float(tm[4]), float(tm[5])
        if not value or (side == "left" and x >= 396) or (side == "right" and x < 396):
            return
        items.append({"text": value, "x": round(x, 2), "y": round(y, 2), "size": round(float(size), 2)})

    page.extract_text(visitor_text=visitor)
    return sorted(items, key=lambda item: (-item["y"], item["x"]))


def printed_number(items: list[dict]) -> int | None:
    candidates = [int(i["text"]) for i in items if i["y"] < 42 and re.fullmatch(r"\d{1,3}", i["text"])]
    return candidates[-1] if candidates else None


def title_lines(items: list[dict]) -> list[str]:
    lines: dict[float, list[dict]] = defaultdict(list)
    for item in items:
        if item["size"] >= 30 and item["text"] != "Index":
            lines[item["y"]].append(item)
    return [" ".join(x["text"] for x in sorted(lines[y], key=lambda i: i["x"])) for y in sorted(lines, reverse=True)]


def main() -> None:
    reader = PdfReader(ROOT / "cookbook.pdf")
    reconstructed = []
    for pdf_page, page in enumerate(reader.pages, 1):
        for side in ("left", "right"):
            items = collect_half(page, side)
            reconstructed.append({
                "pdf_page": pdf_page,
                "side": side,
                "printed_page": printed_number(items),
                "titles": title_lines(items),
                "items": items,
            })
    out = ROOT / "data" / "raw-pages.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(reconstructed, ensure_ascii=False, indent=2), encoding="utf-8")
    for page in sorted((p for p in reconstructed if p["printed_page"]), key=lambda p: p["printed_page"]):
        if page["titles"]:
            print(f'{page["printed_page"]:>3}: {" | ".join(page["titles"])}')


if __name__ == "__main__":
    main()
