# Publishing

## GitHub Pages

The `pages` workflow publishes the player and `flows/` to GitHub Pages every time
`main` changes. Nothing else in the repository is published.

To turn it on in your own copy:

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`, or run the **Pages** workflow from the **Actions** tab.

Your flows are then at `https://<your-user>.github.io/<repo>/?flow=<flow-id>`.

## Before you publish

- Every screenshot is redacted and you have looked at each one.
- `npm run validate:all` prints `PASS` with `0 warnings` for every flow.
- `npm test` passes.
- `git status` shows nothing under `capture/`.

CI runs the same checks on every pull request, fails if anything under `capture/`
is committed, and scans for secrets.

## Other hosts

The site is static files with no build step. Copy `index.html`, `player/` and
`flows/` to any static host (Netlify, Cloudflare Pages, an internal web server) and
it works as it is. Links inside the player are relative, so it can live in a
sub-folder.
