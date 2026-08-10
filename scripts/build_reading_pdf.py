"""Create a single-page, reading-order edition from the imposed printer PDF."""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tools"))

from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import RectangleObject


def main() -> None:
    source = PdfReader(ROOT / "cookbook.pdf")
    mapping = json.loads((ROOT / "data" / "raw-pages.json").read_text(encoding="utf-8"))
    def has_page_footer(entry: dict) -> bool:
        if not entry["printed_page"]:
            return False
        low, high = ((150, 250) if entry["side"] == "left" else (545, 650))
        return any(
            item["text"] == str(entry["printed_page"])
            and item["y"] < 35
            and item["size"] >= 17
            and low <= item["x"] <= high
            for item in entry["items"]
        )

    numbered = {entry["printed_page"]: entry for entry in mapping if has_page_footer(entry)}
    missing = sorted(set(range(1, 340)) - numbered.keys())
    if missing:
        raise ValueError(f"Missing printed page footers: {missing}")
    writer = PdfWriter()

    # The unnumbered foreword occupies the left half of the first printer sheet.
    foreword = copy.copy(source.pages[0])
    half_width, page_height = float(foreword.mediabox.width) / 2, float(foreword.mediabox.height)
    foreword_box = RectangleObject((0, 0, half_width, page_height))
    foreword.mediabox = foreword_box
    foreword.cropbox = foreword_box
    foreword.trimbox = foreword_box
    writer.add_page(foreword)

    for printed_page in range(1, 340):
        entry = numbered[printed_page]
        page = copy.copy(source.pages[entry["pdf_page"] - 1])
        width, height = float(page.mediabox.width) / 2, float(page.mediabox.height)
        if entry["side"] == "right":
            page.add_transformation(Transformation().translate(tx=-width, ty=0))
        box = RectangleObject((0, 0, width, height))
        page.mediabox = box
        page.cropbox = box
        page.trimbox = box
        writer.add_page(page)

    writer.add_metadata({"/Title": "Spencer Family Cookbook — Reading Edition", "/Author": "Kathy Spencer"})
    output = ROOT / "docs" / "cookbook-reading-order.pdf"
    with output.open("wb") as stream:
        writer.write(stream)
    print(f"Built {len(writer.pages)} ordered pages including foreword: {output.name}")


if __name__ == "__main__":
    main()
