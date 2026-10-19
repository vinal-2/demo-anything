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
