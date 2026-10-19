# Publishing

## GitHub Pages

The `pages` workflow publishes to GitHub Pages **after CI passes** on a push to
`main`, so a flow that fails validation or tests never goes live. It runs
`node tools/build-site.mjs`, which publishes `index.html`, `player/` and, for each
flow, only `flow.json` and the files it references. Nothing else in the repository is
published, not even stray files inside a flow folder.

To turn it on in your own copy:

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main`, or run the **Pages** workflow from the **Actions** tab.

Your flows are then at `https://<your-user>.github.io/<repo>/demos/<flow-id>/`
(the older `?flow=<flow-id>` address still works).

## Pages for sharing and search

The build also writes:

| File | What it is for |
| --- | --- |
| `demos/<flow-id>/index.html` | A page per demo with its own title, description and link preview. Share this address. |
| `og/<flow-id>.png` | The link-preview picture (1200 × 630), cut from the flow's first screenshot. |
| `demos/index.html` | A list of every demo. |
| `sitemap.xml` | Every page, for search engines. Submit it in Google Search Console. |

The title comes from `name` in flow.json and the description from `description`
(or the cover's subtitle). Links in previews and the sitemap need the site's full
address. The build reads it from `homepage` in `package.json`; set `SITE_URL` to
override it. Without either, those tags and the sitemap are left out.

To verify the site in Google Search Console, add a **URL prefix** property for the
site address, pick the **HTML tag** method, and copy just the `content="…"` code into
a repository variable named `GOOGLE_SITE_VERIFICATION` (**Settings → Secrets and
variables → Actions → Variables**). The next deploy puts the tag on the home page.
Then press **Verify** and submit `sitemap.xml` under **Sitemaps**.

Every published page carries a Content-Security-Policy: it only loads scripts and
files from your own site, plus the Inter font from Google Fonts. A flow that points
at an image on another site shows a broken image instead of loading it. If you
change the policy, change it in both `index.html` and `CSP` in
`tools/lib/site-meta.mjs` (a test checks they match).

There is no `robots.txt`: on a `<user>.github.io/<repo>/` site it isn't at the
domain root, so search engines never read it.

## Before you publish

- Every screenshot is redacted and you have looked at each one.
- `npm run validate:all` prints `PASS` with `0 warnings` for every flow.
- `npm test` passes.
- `git status` shows nothing under `capture/`.

CI runs the same checks on every pull request, fails if anything under `capture/`
is committed, and scans for secrets.

## Other hosts

The site is static files. Run `node tools/build-site.mjs` and copy `_site/` to any
static host (Netlify, Cloudflare Pages, an internal web server), or copy
`index.html`, `player/` and `flows/` as they are. Links inside the player are
relative, so it can live in a sub-folder.
