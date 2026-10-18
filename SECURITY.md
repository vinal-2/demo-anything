# Security

## Report a problem privately

Use **Security → Report a vulnerability** on the
[GitHub repository](https://github.com/vinal-2/demo-anything/security) to send a
private report. Please do not open a public issue for security problems.

Report anything like:

- a published flow that shows personal or organisation data that should have been
  redacted (names, emails, tenant IDs, IP addresses, keys or tokens)
- a way for the player or the local server to load files outside `index.html`,
  `player/` and `flows/`
- a way for flow data to run script in the player

We aim to reply within 7 days. If a published flow leaked data, we remove it and
rewrite the repository history so the image is no longer reachable.

## How the project protects data

- `capture/` (raw and working screenshots) is git-ignored and the local server
  never serves it.
- `redact.json` must list every screenshot; areas are padded by 8 px and every image
  is re-encoded to strip metadata.
- `redaction.json` records each cleaned file's hash, and import refuses screenshots
  that weren't redacted or changed afterwards.
- `validate` fails on emails, tenant names and IDs, public IPs, token-like strings and
  your own sensitive terms anywhere in `flow.json`, and on any file outside the flow.
- CI blocks anything under `capture/` and scans for secrets. GitHub Pages deploys only
  after CI passes, and only the files each flow references.
- Third-party GitHub Actions are pinned to a commit, with Dependabot proposing updates.
- The player adds flow text as text, never as HTML, and only follows `https://`,
  in-page and same-site links.
