# Maintainers

How to review and merge pull requests safely, and which repository settings to keep.

## Reviewing a pull request

Everything in `flows/` is published on the project's website, and some files change
what an agent or GitHub Actions does. So review in this order, **on GitHub first**.

1. **Read the labels.** The labeler marks what the pull request touches:
   - `touches: agent instructions`: `AGENTS.md`, `CLAUDE.md`, `plugin/`, `.claude/`,
     `.claude-plugin/`, and plugin parts that can run code (`hooks/`, `.mcp.json`,
     `.lsp.json`, `bin/`, `monitors/`, `settings.json`, `commands/`, `agents/`,
     `workflows/`, `output-styles/`, `themes/`, `scripts/`). Read every line. Look for
     instructions that tell an agent to run commands, fetch URLs, read secrets, or skip
     checks. CI already refuses those plugin parts and any symbolic link.
   - `touches: workflows`: anything in `.github/`. Look for new triggers (especially
     `pull_request_target`), wider `permissions`, actions not pinned to a full commit
     SHA, `actions/checkout` of pull request code, or new secrets.
   - `touches: dependencies`: `package.json` or `package-lock.json`. Check each new
     package is needed, well known, and that the dependency review passed. Watch for
     look-alike names.
   - `touches: player/tools`: code that runs in viewers' browsers or on your computer.
   - `flow`: a new or changed demo.
2. **Check CI.** `test` and `dependency-review` must pass. A first-time contributor's
   run waits for your approval: read the diff before you approve it.
3. **Look at every image** in the pull request's **Files changed** tab, at full size.
   Check for real names, emails, tenant or company names, IP addresses, tokens, faces,
   and anything the contributor might not be allowed to share. Redaction boxes must
   fully cover what they hide.
4. **Read `flow.json`** for text that names a real person or organisation, and links
   you wouldn't want on the site.
5. **Check the contributor declaration** boxes are ticked.
6. **Merge with "Squash and merge"** only when all of the above is fine.

### Don't run untrusted pull requests locally

Don't check out a pull request from someone you don't know and run `npm install`,
`npm test`, `npm start` or an agent in it. Install scripts, tests and agent
instructions can all run code on your computer. CI already runs the tests in a
throwaway machine. If you must try it locally, use a disposable environment (a
virtual machine or a GitHub Codespace) with no access to your files or accounts.

### If something private was published

Follow [SECURITY.md](../SECURITY.md): remove the file in a new commit, redeploy, and
remember that it stays in git history and may have been copied.

## Repository settings checklist

Re-check these from time to time. Values as set on 2026-10-20.

### Branch protection (Settings → Branches)

- [x] `main` is protected
- [x] Required status check: `test` (from GitHub Actions)
- [ ] Required status check: `dependency-review` (from GitHub Actions): **add it**.
  It runs only on pull requests, so pushes to `main` don't wait for it.
- [x] Force pushes blocked
- [x] Deletion blocked
- [x] Admins can bypass: "Do not allow bypassing the above settings" is **off**

**Bypass decision (2026-10-20): keep admin bypass.** The maintainer may push to
`main` directly and merge without waiting for checks. Why: there is one maintainer,
CI still runs on every push to `main`, and Pages deploys automatically only after
CI passes on that commit (the site build also refuses flows that fail validation). Everyone else has no write access, so their changes come through pull requests
that must pass the required checks. Revisit this when a second maintainer joins.

### Release tags (Settings → Rules → Rulesets)

- [x] Ruleset "Protect release tags" on `refs/tags/v*`: tags can't be deleted, moved
  or force-pushed, by anyone. A wrong release gets a new version (for example
  `v0.1.1`); the old tag stays.

### Actions (Settings → Actions → General)

- [x] Workflow permissions: **Read repository contents** (read-only token)
- [x] "Allow GitHub Actions to create and approve pull requests": **off**
- [x] Fork pull request workflows: approval required for **first-time contributors**
  (stricter option: all outside contributors)
- [ ] Optional: require actions to be pinned to a full-length commit SHA (every
  workflow already does this; `tests/workflows.test.mjs` checks it)

### Environments (Settings → Environments → github-pages)

- [x] Deployment branches: `main` only

### Pages (Settings → Pages)

- [x] Source: **GitHub Actions**
- [x] Repository variable `GOOGLE_SITE_VERIFICATION` (Settings → Secrets and
  variables → Actions → Variables) holds the Search Console code. Don't delete it.

### Code security (Settings → Advanced Security)

- [x] Secret scanning: on
- [x] Push protection: on
- [x] Dependabot version updates: on (`.github/dependabot.yml`)
- [ ] Dependabot security updates: **turn on**
- [x] Private vulnerability reporting: on
- [x] Code scanning: CodeQL **default setup** (JavaScript-TypeScript and GitHub
  Actions, default queries, on pushes and pull requests to `main` and weekly).
  Alerts appear under **Security → Code scanning**, next to Scorecard's notes.

### General (Settings → General → Pull Requests)

- [ ] Allow squash merging only (optional, matches the merge rule in
  [CONTRIBUTING.md](../CONTRIBUTING.md#how-pull-requests-are-merged))

### Labels

The labeler needs these labels to exist: `touches: agent instructions`,
`touches: workflows`, `touches: dependencies`, `touches: player/tools`, `flow`.
