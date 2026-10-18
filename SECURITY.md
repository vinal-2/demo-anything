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
- `redact.json` must list every screenshot, so none is skipped by accident.
- CI fails if anything under `capture/` is committed and scans for secrets.
- The player only adds flow text as text, never as HTML.
