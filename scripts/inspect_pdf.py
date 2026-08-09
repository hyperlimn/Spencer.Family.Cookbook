"""Inspect PDF text positions to understand the cookbook's imposed layout."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".tools"))

from pypdf import PdfReader


def main() -> None:
    reader = PdfReader("cookbook.pdf")
    for page_number in (4, 5, 168):
        page = reader.pages[page_number - 1]
        print(f"\nPDF PAGE {page_number}: {page.mediabox}")

        def visitor(text, _cm, tm, _font, size):
            clean = " ".join(text.split())
            if clean:
                print(f"x={tm[4]:7.1f} y={tm[5]:7.1f} s={size:4.1f} | {clean}")

        page.extract_text(visitor_text=visitor)


if __name__ == "__main__":
    main()
