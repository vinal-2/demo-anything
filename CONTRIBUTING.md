# Contributing

Thanks for helping. Demos and fixes are both welcome.

## Set up

```bash
npm install
npx playwright install chromium
npm test
```

You need Node.js 20.11 or later (`.nvmrc` pins the version CI uses).

## Add a demo

1. Follow [docs/getting-started.md](docs/getting-started.md) to capture, redact,
   import and check your flow.
2. Before you open a pull request, check that:
   - every screenshot in `flows/<id>/assets/` is redacted, and you have looked at
     each one
   - `npm run validate -- --strict flows/<id>` prints `PASS` with `0 warnings`
   - `npm test` passes
   - nothing under `capture/` is in your commit
3. Only capture systems you are allowed to use, ideally a sandbox. See
   [DISCLAIMER.md](DISCLAIMER.md).
4. A flow folder may only hold `flow.json` and the images, videos and audio it uses
   (PNG, JPEG, WebP, MP4, WebM, MP3, M4A, OGG, WAV). SVG, HTML and web addresses are
   refused, because everything in `flows/` is published on the project's website.

## Change the code

Coding agents and people follow the same rules: see [AGENTS.md](AGENTS.md).

- Keep changes small and focused, with a test that fails without the change.
- The player is plain HTML, CSS and JavaScript with no build step. Keep it that way.
- Never insert flow text as HTML.
- Use plain British English in the player, docs and narration.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`.

## How pull requests are merged

- Only the maintainer merges, after reading the change on GitHub.
- Pull requests are squash-merged into one commit on `main`.
- CI must pass first: tests, the strict flow check, the secret scan and the
  dependency review.
- Pull requests that change agent instructions (`AGENTS.md`, `CLAUDE.md`,
  `skills/`, `.claude-plugin/`), workflows (`.github/`) or dependencies are labelled
  automatically and get a closer review. Please explain why such a change is needed.

## Contributor declaration

By opening a pull request you confirm that:

- you have the right to submit this work
- every screenshot comes from a system you are authorised to use, a sandbox or test
  tenant, or is made up
- it contains no real personal data and no real organisation's data
- you agree that your contribution is published under the [MIT licence](LICENSE)

The pull request template has a checkbox for each point.

## Report a problem

Open an issue using a template. For security problems or leaked data, follow
[SECURITY.md](SECURITY.md) instead.
