# Spencer Family Cookbook

A searchable, editable web edition of Kathy Spencer's family cookbook. The site is static and deploys to GitHub Pages; recipes live as Markdown files with YAML front matter.

## Edit a recipe

Open its file in `content/recipes` or `content/new-recipes`, make the correction, and run:

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
date_added: "2026-08-09"
ingredients:
  - "12 macaroons, crushed in small pieces"
---

Mix together macaroons, sugar, and sour cream.
```

`source_pages` are printed cookbook page numbers. `pdf_page` points to the sheet in `cookbook.pdf`, whose printer-spread layout is not in reading order.

`date_added` is optional. New contributed recipes with this field appear automatically in the site's **Recent additions** section; original imported recipes omit it.

The website's **Add recipe** form sends structured recipe fields to the Cloudflare Worker in `worker/`. The Worker creates a ready-to-file Markdown record on a new branch and opens a GitHub pull request for family review. Merge the pull request to add the recipe to the archive; the existing GitHub workflow validates and deploys the updated site automatically.

To add one through GitHub, open `content/new-recipes`, choose **Add file → Upload files**, drop in the `.md` file, and commit it. New submissions retain their `date_added` value and appear under **Recent additions** automatically. A duplicate recipe slug stops the deployment instead of silently replacing an existing archive entry.

## Re-import from the PDF

Install `requirements-dev.txt`, then run `scripts/extract_catalog.py` followed by `scripts/import_recipes.py`. Re-importing replaces generated recipe files, so use it only when deliberately rebuilding the transcription.

## Deploy

The included GitHub Actions workflow builds the catalog and publishes `docs`. In the repository's **Settings → Pages**, select **GitHub Actions** as the source once; future pushes to `main` deploy automatically.
