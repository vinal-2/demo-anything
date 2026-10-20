# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The repository is a template: **Use this template** makes a separate copy (which
  can be private). The getting-started guide explains template vs fork and what to
  change after copying.

### Changed

- The maintainers guide lists `dependency-review` as a required check on `main`
  and records the decision to keep admin bypass, with the reason.
- The Claude Code plugin now lives in its own folder, `plugin/`, which holds only
  `plugin.json` and the skill (`plugin/skills/demo-anything/SKILL.md`). Installing
  the plugin no longer copies the rest of the repository. The install command is
  unchanged; to copy the skill by hand, copy `plugin/skills/demo-anything/`.

### Security

- Symbolic links are refused. `validate` and the site build fail on any symbolic
  link inside a flow, or on a flow folder that is itself a link, and the local server
  won't serve a linked file or a file whose real location is outside the allowed
  folders. A link could otherwise publish a file from elsewhere on your computer.
- `validate` fails on end-card buttons and subtitle links the player wouldn't follow
  (for example `javascript:` or `http://`), instead of letting them become dead
  links. Buttons allow `https://`, `#` and same-site paths; links in text allow
  `https://` and `#`. The player and the validator share one rule
  (`player/links.js`).
- CI's first step (`tools/check-files.mjs`) now also fails if git tracks a symbolic
  link (mode 120000), or a Claude Code plugin part that can run code (`hooks/`,
  `.mcp.json`, `.lsp.json`, `bin/`, `monitors/`, `settings.json`, `commands/`,
  `agents/`, `workflows/`, `output-styles/`, `themes/`, `scripts/`) at the root or
  in `plugin/`. Changes to those paths are labelled "touches: agent instructions"
  and owned by the maintainer in CODEOWNERS.

### Fixed

- A copy (template or fork) built on GitHub now uses its own GitHub Pages address
  for canonical links, link previews, the sitemap and structured data, instead of
  the original project's. A `SITE_URL` repository variable sets a custom domain.
- A player test no longer depends on the Defender demo being in the repository.
- A hotspot in the bottom strip of a screenshot (for example a wizard's Next or
  Create button) can be clicked again. The control bar, which appears when the mouse
  moves, used to sit on top of it, so the click went to the bar and could jump to
  another step. The hotspot and its label now sit above the bar.
- Card buttons ("Get Started", "Replay") now use the same text size as card links;
  a general button style was shrinking them, most visibly in a wide player.

## [0.1.0] - 2026-10-19

The first release.

### Added

#### Player

- Walkthrough player in plain HTML, CSS and JavaScript, with no build step: typed
  steps (`cover`, `image`, `video`, `end`), hotspots placed as fractions of the
  screenshot, a guided cursor, and a control bar with progress segments, speed,
  sound, captions and full screen.
- Narration with word-by-word captions. List several `narrators` in a flow and
  viewers choose one from the microphone menu, even mid-step; the choice is
  remembered.
- Keyboard and screen-reader support: arrow keys, Space, menus that work with the
  arrow keys and Escape, accessible names and visible focus.
- `?embed` mode with `demo:step` and `demo:complete` events for the host page, and a
  `?flow=<id>&edit` authoring mode to place hotspots by clicking and export
  `flow.json`.
- `"showBadge": true` adds a small "Made with Demo Anything" link to the end card
  (off by default).

#### Tools

- `import`, `validate`, `redact`, `preview` and `save-shot` tools, and a local server
  that serves only the player and flows (with video range requests).
- `npm run voice`: natural narration from Kokoro (free, local), ElevenLabs, Google
  Chirp 3 HD or your own recordings; audio normalised to -16 LUFS; word timings from
  the provider, measured with `--align` (Whisper) or estimated; a pronunciation
  lexicon; `--only`, `--list-voices` and `--check-scripts`.
- `npm run voice:sample` renders one sentence in several voices to compare.

#### Agents

- Agent skill in `skills/demo-anything/` for building flows with Claude Code and
  Claude in Chrome, read-only, stopping at sign-in and MFA pages. It also installs as
  a Claude Code plugin:
  `/plugin install demo-anything --marketplace vinal-2/demo-anything`.
- `AGENTS.md` (with a `CLAUDE.md` that points to it): the rules coding agents follow
  in this repository.

#### Site and demos

- GitHub Pages site with a page per demo (`demos/<id>/`), its own title, description
  and link-preview picture (`og/<id>.png`), a list of demos (`demos/`), `sitemap.xml`,
  and share tags and SoftwareApplication data on the home page.
- Two demos: an example in a fictional admin app (with a video step), and isolating
  a device in Microsoft Defender for Endpoint on placeholder screens of a fictional
  SOC lab. Both are narrated, with George, Emma and the browser voice to choose from.

#### Project

- Guides in `docs/`, including use cases and a maintainers guide.
- README with an animated GIF, use cases, a comparison and an FAQ;
  `docs/assets/social-preview.png` for the repository's social preview.
- MIT licence, contributing guide with a contributor declaration, code of conduct
  (Contributor Covenant 2.0), security policy, disclaimer, `CITATION.cff`, a
  switched-off `FUNDING.yml`, issue and pull request templates, and a Show and tell
  discussion form.

### Security

- `redact` pads every area by 8 px, offers solid boxes as well as blur, re-encodes
  every image to strip metadata, and writes `redaction.json` with SHA-256 hashes.
  `import` refuses screenshots that weren't redacted or changed afterwards.
- `validate` fails on emails, `*.onmicrosoft.com` names, GUIDs, public IPv4 addresses,
  JWTs, long keys and your own terms in `capture/sensitive-terms.txt` (values are
  masked in the output).
- Flows can only publish PNG, JPEG, WebP, MP4, WebM, MP3, M4A, OGG and WAV files,
  checked by their first bytes, within size limits (5 MB image, 20 MB video, 3 MB
  audio, 50 MB per flow), with no web addresses and no unused files. The site build
  refuses to publish a flow with errors. `validate --strict` fails on warnings too.
- Every page carries a Content-Security-Policy, and the player follows only
  `https://`, in-page and same-site links.
- CI blocks `capture/`, `.claude/`, `.mcp.json`, `.vscode/` and `.devcontainer/`, scans
  for secrets, installs with `--ignore-scripts`, and reviews new dependencies on pull
  requests. Checkouts keep no credentials.
- Pages deploys only after CI passes on `main`, only the commit CI tested, from a
  build job with read-only access and a separate deploy job.
- Every action is pinned to a full commit SHA (a test checks this); Dependabot
  watches actions and npm; OpenSSF Scorecard runs weekly.
- Pull requests are labelled by what they touch (agent instructions, workflows,
  dependencies, player/tools, flow), and `CODEOWNERS` sends every change to the
  maintainer.

[Unreleased]: https://github.com/vinal-2/demo-anything/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vinal-2/demo-anything/releases/tag/v0.1.0
