# Build flows with an agent

The `demo-anything` skill teaches a coding agent to walk a web app in your browser,
capture each step, redact it and build the flow, while staying read-only.

## What you need

- [Claude Code](https://code.claude.com/docs/en/overview) with the
  [Claude in Chrome](https://code.claude.com/docs/en/chrome) extension connected.
  In VS Code, type `/chrome` in the Claude prompt box and turn on
  **Enabled by default**, then restart Chrome.
- A Chrome profile with nothing else signed in, signed in to the app you want to
  demo. Use a sandbox or test tenant if you can.
- A clone of this repository, open in Claude Code.

## Install the skill

Copy `skills/demo-anything/` into your agent's skills folder. For Claude Code that
is `~/.claude/skills/demo-anything/` (all projects) or
`.claude/skills/demo-anything/` (this project only).

## Ask your agent

```text
Use the demo-anything skill. Build flow "settings-tour" named
"Find your notification settings" from https://app.example.com:
Home → Settings → Notifications → the Email alerts switch.
```

The agent will:

1. size the browser window and check the page size
2. capture one screenshot per click and measure the click target
3. preview the boxes and fix any that are off
4. list everything identifying in `redact.json`, redact, and check every image
5. import, finish `flow.json`, validate and run the tests
6. commit in small steps and report what it captured and what differed

It stops and asks you at any sign-in or MFA page, and never clicks Save, Submit,
Delete, toggles or anything that changes data. It still screenshots those controls
so the walkthrough can point at them.

## Check its work

Always look at the cleaned screenshots yourself before you publish. Automated
redaction relies on finding every sensitive area; a second pair of eyes catches
what it misses.
