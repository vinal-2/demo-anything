# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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
