# Recipe submission Worker

This Cloudflare Worker accepts the cookbook form's JSON fields, creates a
Markdown recipe on a new branch, and opens a GitHub pull request for review.

## Cloudflare configuration

The non-secret settings are in `wrangler.toml`. Add one encrypted Worker secret:

- `GITHUB_TOKEN`: a fine-grained GitHub token limited to the
  `hyperlimn/Spencer.Family.Cookbook` repository, with **Contents: Read and
  write** and **Pull requests: Read and write** permissions.

Never put the token in `wrangler.toml`, source code, or the browser application.

After deployment, replace the Formspree endpoint in `docs/app.js` with the
Worker URL and send the existing form values as JSON.
