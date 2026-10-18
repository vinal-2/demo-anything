# Flow format

## Folder layout

```
flows/
  index.json             list of flows shown on the home page
  <flow-id>/
    flow.json
    shots/01-home.png    redacted screenshots
```

`<flow-id>` uses lower-case letters, numbers and dashes, and is also the value in
`/?flow=<flow-id>`.

## `steps.json`

Written during capture, one entry per screenshot:

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

| Field | Meaning |
| --- | --- |
| `step` | 1, 2, 3 … matches the `NN` in the screenshot name |
| `screen` | The screen's title as shown in the app |
| `element` | Label of what to click; becomes the hotspot label |
| `box` | The click target in screenshot pixels |
| `why` | One line on why the step matters |
| `say` | One or two sentences of narration |

## `flow.json`

Written by `npm run import`, then finished by hand.

| Field | Meaning |
| --- | --- |
| `id` | Same as the folder name |
| `name` | Shown on the home page |
| `cover.title`, `cover.subtitle` | The first card |
| `imageSize` | Width and height of every screenshot, in pixels |
| `aspectRatio` | Height ÷ width, for example `0.5625` for 16:9 |
| `steps[].step` | 1, 2, 3 … in order |
| `steps[].screen` | Shown above the screenshot |
| `steps[].image` | Path inside the flow folder, for example `shots/01-home.png` |
| `steps[].hotspot` | `x`, `y`, `width`, `height` in pixels, plus a short `label` |
| `steps[].say`, `steps[].why` | Narration, and why the step matters |
| `end.title`, `end.text` | The last card |

## What `validate` checks

Errors (the flow fails):

- `id` matches the folder; `name` and `cover.title` are set
- every screenshot exists, is a PNG inside the flow folder and matches `imageSize`
- `aspectRatio` matches the screenshots
- every hotspot has a size and sits inside its screenshot

Warnings (fix before you publish):

- empty cover subtitle, end title, screen name, narration or hotspot label
- a hotspot label longer than 40 characters
- steps not numbered 1, 2, 3 in order
- the flow is missing from `flows/index.json`
