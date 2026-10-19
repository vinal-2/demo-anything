# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The published site has a page per demo (`demos/<id>/`) with its own title,
  description and link-preview picture (`og/<id>.png`), a list of demos (`demos/`),
  and `sitemap.xml`. The home page carries share tags and SoftwareApplication data.
- A page can name its flow with `<meta name="demo-flow">`; the player finds `flows/`
  from its own folder, so pages in sub-folders work.
- `"showBadge": true` adds a small "Made with Demo Anything" link to the end card.
- The skill installs as a Claude Code plugin:
  `/plugin install demo-anything --marketplace vinal-2/demo-anything`.
- Community files: a code of conduct (Contributor Covenant 2.0), `CITATION.cff`, a
  switched-off `FUNDING.yml` and a Show and tell discussion form.
- OpenSSF Scorecard runs weekly and on every push to `main`; the score is a README
  badge.
- The README opens with an animated GIF of the example playing
  (`docs/assets/demo.gif`), and `docs/assets/social-preview.png` (1280 × 640) is
  ready for the repository's social preview.

### Fixed

- A flow title or description containing `$&`, `$'` or `` $` `` is now written into
  the published page as text instead of being read as a replacement pattern.

### Security

- `redact` pads every area by 8 px (`pad`), offers `"style": "solid"`, empties the
  clean folder first, re-encodes every image to strip metadata, and writes
  `redaction.json` with SHA-256 hashes.
- `import` refuses a capture folder without `redaction.json`, or with a screenshot
  added or changed after redaction.
- `validate` fails on emails, `*.onmicrosoft.com` names, GUIDs, public IPv4 addresses,
  JWTs and long keys anywhere in `flow.json`, and on terms listed in the git-ignored
  `capture/sensitive-terms.txt`; values are masked in the output. The inside-the-folder
  rule covers logo, background, voice and music files.
- GitHub Pages deploys only after CI passes on `main`, and publishes only the files
  each flow references (`tools/build-site.mjs`).
- Third-party actions are pinned to commit SHAs; Dependabot watches actions and npm.
- The player follows only `https://`, in-page and same-site links.
- Flows can only publish PNG, JPEG, WebP, MP4, WebM, MP3, M4A, OGG and WAV files.
  `validate` checks each file's first bytes match its name, enforces size limits
  (5 MB image, 20 MB video, 3 MB audio, 50 MB per flow), requires `logo` and `bg` to
  be images, refuses web addresses for any flow file, and fails on files the flow
  doesn't use. The site build runs the same checks and refuses to publish on errors.
- `validate --strict` fails on warnings too; `npm run validate:all` uses it.
- The Defender demo's logo is now a PNG (it was an SVG).
- Every page (the player, each demo page and the demos list) carries a
  Content-Security-Policy: scripts, images, audio and video only from the site itself,
  styles and fonts from the site and Google Fonts, no `<base>` changes or form posts.
- CI: checkout keeps no credentials, 20-minute limit, one run per pull request,
  blocks `capture/`, `.claude/`, `.mcp.json`, `.vscode/` and `.devcontainer/`,
  installs with `--ignore-scripts`, validates with `--strict`, and reviews new
  dependencies on pull requests (fails on moderate or worse).
- Pages: no permissions by default; a read-only build job and a deploy-only job.
  The build checks out `main` itself (never a commit named by the triggering event)
  and deploys only if it is the commit CI tested.
- Actions updated (checkout 7.0.1, setup-node 7.1.0, gitleaks 3.0.0, deploy-pages
  5.0.1, upload-pages-artifact 5.0.0). A test checks every action is pinned to a
  full commit SHA.
- Pull requests are labelled by what they touch (agent instructions, workflows,
  dependencies, player/tools, flow). The labeler never checks out pull request code.
- `CODEOWNERS` routes every change, and the sensitive paths by name, to the
  maintainer.
- `CONTRIBUTING.md` says how pull requests are merged and adds a contributor
  declaration, with matching checkboxes in the pull request template.
  `docs/maintainers.md` explains how to review pull requests safely and lists the
  repository settings to keep.

### Changed

- The player is now the fuller demo-player engine: narration with word-by-word
  captions, a guided cursor, video steps, a control bar with progress segments and
  speed, sound, captions and full-screen buttons, `?embed` with progress events,
  and an `?flow=<id>&edit` authoring mode.
- Flows use typed steps (`cover`, `image`, `video`, `end`), store files in
  `assets/`, and place hotspots as fractions of the screenshot.
  See [docs/flow-format.md](docs/flow-format.md).
- `validate` also refuses files outside the flow folder, screenshots of different
  sizes and an `aspectRatio` that does not match, and warns about narration copied
  between flows.

### Added

- Showcase flow `mde-isolate-device`: isolating a device in Microsoft Defender for
  Endpoint, on placeholder screens of a fictional SOC lab.
- `AGENTS.md`: rules for coding agents working in the repository (with a
  `CLAUDE.md` that points to it).
- Natural narration: `npm run voice` with Kokoro (free, local), ElevenLabs, Google
  Chirp 3 HD or your own recordings; per-flow `narrator`; audio normalised to
  -16 LUFS with even padding; word timings from the provider, measured with
  `--align` (Whisper), or estimated from the audio length; `voice-lexicon.json` for
  pronunciation; `--only`, `--list-voices` and `--check-scripts`.
- `npm run voice:sample` renders one sentence in several voices to compare.
- Voice switcher: list several `narrators` in a flow and viewers choose one from the
  player's microphone menu, even mid-step; the choice is remembered. Menus now work
  with the arrow keys. The demos offer George, Emma and the browser voice.
- Both demos are narrated by Kokoro's `bm_george`.
- The example flow has a video step; the local server streams video.
- [docs/player.md](docs/player.md).

- `redact` tool: blurs the areas listed in `redact.json` and refuses to skip any
  screenshot.
- `preview` tool: draws hotspot and redaction boxes on copies of the screenshots
  so you can check them.
- `validate --all` checks every flow in `flows/`.
- Agent skill in `skills/demo-anything/` for building flows with Claude Code and
  Claude in Chrome.
- Guides in `docs/`, GitHub Pages site, CI with a capture guard and secret scan.
- MIT licence, contributing, security and disclaimer notes.

## [0.1.0] - 2026-10-18

### Added

- Walkthrough player: cover card, screenshot steps with hotspots, narration and
  end card.
- `import-steps` and `validate-flow` tools and a local web server.
- Example flow and tests.
