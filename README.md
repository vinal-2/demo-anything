# Demo Anything

Turn screenshots into click-through walkthroughs that anyone can play in a browser.

Each walkthrough (a **flow**) has a cover card, one screenshot per step with a
glowing **hotspot** to click, a line of narration, and an end card. No build step,
no framework: plain HTML, CSS and JavaScript.

## Try it

You need [Node.js](https://nodejs.org/) 20.11 or later.

```bash
npm install
npx playwright install chromium   # only needed to run the tests
npm start
```

Open <http://127.0.0.1:4173/?flow=example> to play the example, or
<http://127.0.0.1:4173/> to see every flow.

Click the hotspot, or use **Next** / **Back**, or the **→** / **←** keys.

## Make your own flow

### 1. Capture

Make a folder under `capture/raw/` with:

- `shots/NN-short-name.png`: one screenshot per step, numbered `01`, `02`, … All
  screenshots must be the same size (1600 × 900 works well).
- `steps.json`: one entry per screenshot.

```json
[
  {
    "step": 1,
    "screen": "Home",
    "element": "Settings",
    "box": { "x": 16, "y": 250, "width": 228, "height": 44 },
    "why": "Every admin option lives under Settings.",
    "say": "Start on the home page and open Settings in the left-hand menu."
  }
]
```

`box` is the thing to click, in screenshot pixels. `element` becomes the hotspot
label. `say` is the narration and `why` is a short reason the step matters.

### 2. Redact

Screenshots of real systems contain names, email addresses, tenant IDs and IP
addresses. Blur everything identifying and write the cleaned copies to
`capture/clean/` (keep the same file names and copy `steps.json` across).
Look at every cleaned image before you go on.

The whole `capture/` folder is git-ignored and the player never serves it, so raw
screenshots can't be published by accident.

### 3. Import

```bash
node tools/import-steps.mjs capture/clean flows/my-flow --name "My flow"
```

This copies the screenshots into `flows/my-flow/shots/`, writes
`flows/my-flow/flow.json`, and adds the flow to `flows/index.json`. Add `--force`
to replace a flow you imported before.

### 4. Finish `flow.json`

Set `cover.subtitle`, shorten the hotspot labels, and change the `end` text if
you like. The player is at `/?flow=my-flow`.

### 5. Check it

```bash
node tools/validate-flow.mjs flows/my-flow
```

A flow is ready when this prints `PASS` with `0 warnings`. Then add a test like
the one in `tests/player.spec.mjs` and run `npm test`.

## `flow.json` reference

| Field | Meaning |
| --- | --- |
| `id` | Same as the folder name: lower-case letters, numbers and dashes |
| `name` | Shown on the home page |
| `cover.title`, `cover.subtitle` | The first card |
| `imageSize` | Width and height of every screenshot, in pixels |
| `aspectRatio` | Screenshot height ÷ width, for example `0.5625` for 16:9 |
| `steps[].screen` | Name of the screen, shown above the screenshot |
| `steps[].image` | Path to the screenshot, inside the flow folder |
| `steps[].hotspot` | `x`, `y`, `width`, `height` in pixels, plus a short `label` |
| `steps[].say`, `steps[].why` | Narration, and why the step matters |
| `end.title`, `end.text` | The last card |

## Project layout

```
index.html, player/     the player
flows/                  published flows and index.json
tools/                  import, validate and the local web server
tests/                  unit tests (node --test) and browser tests (Playwright)
capture/                your working screenshots (git-ignored, never served)
```

## Tests

```bash
npm test
```

Runs the tool tests, then plays every tested flow in Chromium from cover to end
card and checks each hotspot sits inside its screenshot.
