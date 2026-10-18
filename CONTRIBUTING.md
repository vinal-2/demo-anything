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
   - `npm run validate -- flows/<id>` prints `PASS` with `0 warnings`
   - `npm test` passes
   - nothing under `capture/` is in your commit
3. Only capture systems you are allowed to use, ideally a sandbox. See
   [DISCLAIMER.md](DISCLAIMER.md).

## Change the code

Coding agents and people follow the same rules: see [AGENTS.md](AGENTS.md).

- Keep changes small and focused, with a test that fails without the change.
- The player is plain HTML, CSS and JavaScript with no build step. Keep it that way.
- Never insert flow text as HTML.
- Use plain British English in the player, docs and narration.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`.

## Report a problem

Open an issue using a template. For security problems or leaked data, follow
[SECURITY.md](SECURITY.md) instead.
