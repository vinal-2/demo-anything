# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
