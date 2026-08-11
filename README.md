# Spencer Family Cookbook

A searchable, editable web edition of Kathy Spencer's family cookbook. The site is static and deploys to GitHub Pages; recipes live as Markdown files with YAML front matter.

The web edition supports full-text search, category and contributor filters, recent additions, links back to the scanned cookbook, multiple visual themes, dark mode, and family recipe submissions through a Cloudflare Worker.

## Project structure

- `content/recipes/` contains recipes transcribed from the original cookbook.
- `content/new-recipes/` contains recipes contributed after the initial import.
- `docs/` is the GitHub Pages site. `docs/data/recipes.json` and `docs/cookbook-reading-order.pdf` are generated files.
- `scripts/` contains the catalog build, PDF import, and reading-order PDF tools.
- `worker/` contains the Cloudflare Worker that turns form submissions into pull requests.
- `cookbook.pdf` is the source scan in printer-spread order.

## Run locally

Requires Python 3.12 or newer. Install the build dependency and generate the site data:

```powershell
python -m pip install -r requirements-dev.txt
python scripts/build_site.py
python scripts/build_reading_pdf.py
python -m http.server 8000 --directory docs
```

Then open `http://localhost:8000`. Serve `docs/` through HTTP rather than opening `index.html` directly, because the app fetches its recipe catalog as JSON.

## Edit a recipe

Open its file in `content/recipes` or `content/new-recipes`, make the correction, and run:

```powershell
python scripts/build_site.py
```

Commit both the Markdown change and the regenerated `docs/data/recipes.json`. Each recipe links to its corresponding source scan and GitHub edit page. A red dot marks imported records that need comparison with the original PDF.

`scripts/build_site.py` also validates the recipe front matter and fails on invalid records or duplicate slugs, so run it before committing.

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

The website's **Add recipe** form sends structured recipe fields to the Cloudflare Worker in `worker/`. The Worker creates a ready-to-file Markdown record on a new branch and opens a GitHub pull request for family review. Its deployment and secret setup are documented in `worker/README.md`. Merge the pull request to add the recipe to the archive; the existing GitHub workflow validates and deploys the updated site automatically.

Contributed variations of an existing recipe are allowed. The Worker preserves the submitted title and assigns the next available numbered slug, such as `chili-2`, so the new version remains a separate recipe.

To add one through GitHub, open `content/new-recipes`, choose **Add file → Upload files**, drop in the `.md` file, and commit it. New submissions retain their `date_added` value and appear under **Recent additions** automatically. A duplicate recipe slug stops the deployment instead of silently replacing an existing archive entry.

## Re-import from the PDF

Install `requirements-dev.txt`, then run `python scripts/extract_catalog.py` followed by `python scripts/import_recipes.py`. Re-importing replaces generated recipe files, so use it only when deliberately rebuilding the transcription.

## Deploy

The included GitHub Actions workflow rebuilds the recipe catalog and reading-order PDF, copies the source scan into `docs/`, and publishes the directory. In the repository's **Settings → Pages**, select **GitHub Actions** as the source once; future pushes to `main` deploy automatically.
