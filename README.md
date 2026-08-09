# Spencer Family Cookbook

A searchable, editable web edition of Kathy Spencer's family cookbook. The site is static and deploys to GitHub Pages; recipes live as Markdown files with YAML front matter.

## Edit a recipe

Open a file in `content/recipes`, make the correction, and run:

```powershell
python scripts/build_site.py
```

Commit both the Markdown change and the regenerated `docs/data/recipes.json`. Each recipe links to its corresponding source scan and GitHub edit page. A red dot marks imported records that need comparison with the original PDF.

## Recipe format

```yaml
---
title: "Aloha Dip"
slug: "aloha-dip"
category: "Appetizers"
contributor: "Mary Jo"
source_pages: [2]
pdf_page: 3
source_side: "left"
needs_review: false
ingredients:
  - "12 macaroons, crushed in small pieces"
---

Mix together macaroons, sugar, and sour cream.
```

`source_pages` are printed cookbook page numbers. `pdf_page` points to the sheet in `cookbook.pdf`, whose printer-spread layout is not in reading order.

## Re-import from the PDF

Install `requirements-dev.txt`, then run `scripts/extract_catalog.py` followed by `scripts/import_recipes.py`. Re-importing replaces generated recipe files, so use it only when deliberately rebuilding the transcription.

## Deploy

The included GitHub Actions workflow builds the catalog and publishes `docs`. In the repository's **Settings → Pages**, select **GitHub Actions** as the source once; future pushes to `main` deploy automatically.
