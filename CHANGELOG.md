# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

- `AGENTS.md`: rules for coding agents working in the repository (with a
  `CLAUDE.md` that points to it).
- `voice` tool: records narration with Azure or ElevenLabs.
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
