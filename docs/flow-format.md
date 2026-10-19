# Flow format

## Folder layout

```
flows/
  <flow-id>/
    flow.json
    assets/       redacted screenshots, video clips, voice files, logo
```

`<flow-id>` uses lower-case letters, numbers and dashes. It is also the value in
`/?flow=<flow-id>`. The player opens the `example` flow when no flow is given.

## `steps.json` (capture)

Written while capturing, one entry per screenshot in `capture/raw/shots/`:

```json
[
  {
    "step": 1,
    "screen": "Home",
    "element": "Open Settings",
    "box": { "x": 16, "y": 250, "width": 228, "height": 44 },
    "why": "Every admin option lives under Settings.",
    "say": "To turn on email alerts, open Settings in the left-hand menu."
  }
]
```

| Field | Meaning |
| --- | --- |
| `step` | 1, 2, 3 … matches the `NN` in `NN-short-name.png` |
| `screen` | The screen's title as shown in the app (used for the image's alt text) |
| `element` | What to click; becomes the hotspot label |
| `box` | The click target in screenshot pixels |
| `why` | One line on why the step matters (used as narration when `say` is empty) |
| `say` | One or two sentences of narration |

`npm run import` turns each entry into a **narration step** (plays `say`, then moves
on) and a **checkpoint** on the same screenshot (waits for the click), and adds a
cover and an end card.

## `flow.json`

```json
{
  "id": "example",
  "name": "Example: turn on email alerts",
  "aspectRatio": 0.5625,
  "theme": { "brand": "#0E676C", "brandText": "#FFFFFF", "hotspot": "#D06A12" },
  "showBackNextButtons": true,
  "keyboardNav": true,
  "backgroundMusic": { "src": null, "volume": 0.1 },
  "steps": [ … ]
}
```

`aspectRatio` is the screenshots' height ÷ width (0.5625 for 16:9). The importer
measures it for you.

`name` is the page title. An optional `description` (one sentence) is used for the
published demo page and its link preview; without it, the cover's subtitle is used.
See [publishing](publishing.md#pages-for-sharing-and-search).

`"showBadge": true` adds a small "Made with Demo Anything" link to the end card. It is
off unless you turn it on.

### Step types

| Type | Fields | What it does |
| --- | --- | --- |
| `cover` | `title`, `subtitle`, `buttonText`, `logo`, `logoText`, `bg`, `align` (`left` or `center`) | Waits for the start button. Must be the first step. |
| `image` | `src`, `alt`, `voice`, `hotspot`, `autoAdvance`, `autoAdvanceAfterMs` | Narration, checkpoint, or both; see below. |
| `video` | `src` (a path, or a list such as WebM then MP4), `start`, `end`, `muted`, `voice`, `autoAdvance`, `hotspot` | Plays from `start` to `end` with any narration, then moves on. With a hotspot it waits on the last frame. |
| `end` | `title`, `subtitle` (`[links](https://…)` allowed), `buttons` | Buttons are `{ "text", "action": "restart" }` or `{ "text", "action": "url", "href" }`. Must be the last step. |

An `image` step is one of:

- **Narration**: `voice.script` and no hotspot. Plays the narration with captions,
  then moves on. With sound off it moves on after `max(2.5 s, words × 0.35 s)`.
- **Checkpoint**: a `hotspot` and `"autoAdvance": false`. Waits for the click.
- **Both**: narration first, then it waits for the click.

The usual pattern is a narration step followed by a checkpoint on the same
screenshot. The player keeps the image between them, so nothing flickers.

### Hotspots

```json
"hotspot": { "x": 0.0813, "y": 0.3022, "size": 40, "style": "pulsating", "label": "Open Settings" }
```

- `x` and `y` are the centre of the hotspot as fractions (0 to 1) of the
  screenshot, so they hold at any size.
- `label` becomes the tooltip and the button's accessible name. Keep it short.
- `size` scales the rings (40 by default). The click target is never smaller than
  44 × 44 px.

### Voice

```json
"voice": { "script": "Open Settings in the left-hand menu.", "audio": null, "timings": [] }
```

With `audio` set, the player plays that file and highlights words from `timings`
(`[{ "t": 0.41, "word": "Open" }, …]`). Without it, the browser reads the script
aloud. `npm run voice` makes the audio and timings for every script with the
flow's narrator:

```json
"narrator": { "provider": "kokoro", "voice": "bm_george", "speed": 1.0 }
```

Or list several `narrators` (each with an `id` and `label`) so viewers can switch
voice. The first narrator's audio is in `voice.audio` and `voice.timings`; each other
narrator's is in `voice.variants.<id>`:

```json
"voice": {
  "script": "Open Settings in the left-hand menu.",
  "audio": "assets/v01.mp3", "timings": [ … ],
  "variants": { "emma": { "audio": "assets/emma/v01.mp3", "timings": [ … ] } }
}
```

See [player.md](player.md#voice) for the providers and the voice menu.

## What `validate` checks

Errors (the flow fails):

- the first step is a cover and the last is an end card
- every `src`, `logo`, `bg`, voice and music file exists **inside the flow folder**;
  web addresses are not allowed
- every file is an allowed type, and its content matches its name (checked by its
  first bytes): images `.png .jpg .jpeg .webp`, video `.mp4 .webm`, audio
  `.mp3 .m4a .ogg .wav`. No SVG, HTML or anything else, because files in a flow are
  published on your Pages site and those could run scripts there
- `logo` and `bg` are images; image steps use images and video steps use videos
- size limits: 5 MB per image, 20 MB per video, 3 MB per audio file, 50 MB per flow
- **every file in the flow folder is used** by `flow.json` (delete leftovers)
- every screenshot is the **same size**, and `aspectRatio` matches it
- hotspot `x` and `y` are between 0 and 1
- every checkpoint has a hotspot (or `autoAdvanceAfterMs`)
- a video step's `end` is later than its `start`

Warnings (fix before you publish):

- a narration script repeated, or nearly repeated, in this flow or another flow
- the cover or first narration shares no words with the flow name, which usually
  means it was copied from another flow
- a cover or end card in the middle of the flow
- no `name`

`npm run validate -- flows/<id>` checks one flow; add `--strict` to fail on warnings
too. `npm run validate:all` checks every flow in `flows/` with `--strict`, as CI does.
The site build runs the same checks and refuses to publish a flow with errors.
