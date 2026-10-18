# Getting started

## Install

You need [Node.js](https://nodejs.org/) 20.11 or later and Git.

```bash
git clone https://github.com/vinal-2/demo-anything.git
cd demo-anything
npm install
npx playwright install chromium   # for the tests
npm start
```

Open <http://localhost:4173/> to see every flow, or
<http://localhost:4173/?flow=example> to play the example. To make your own copy on
GitHub, use **Use this template** or fork the repository.

## Make a flow by hand

You can build a flow without an agent. The steps are the same ones the
[agent skill](agent-workflow.md) follows.

1. **Capture.** Put one screenshot per step in `capture/raw/shots/`, named
   `01-short-name.png`, `02-…`. All the same size. Write `capture/raw/steps.json`
   with one entry per step; see [flow-format.md](flow-format.md#stepsjson).
   Browser screenshots in another format can be converted with
   `npm run save-shot -- <file> capture/raw/shots/01-home.png`.
2. **Check the boxes.** `npm run preview -- capture/raw` draws each click target on
   a copy in `capture/raw/preview/`. Look at every one.
3. **Redact.** List what to hide in `capture/raw/redact.json`, then
   `npm run redact -- capture/raw capture/clean`. See [redaction.md](redaction.md).
4. **Import.** `npm run import -- capture/clean flows/my-flow --name "My flow"`
5. **Finish.** Set the cover subtitle, hotspot labels and end card in
   `flows/my-flow/flow.json`.
6. **Check.** `npm run validate -- flows/my-flow` must print `PASS` with
   `0 warnings`, and `npm test` must pass.
7. **Publish.** Commit `flows/my-flow/` and `flows/index.json`. See
   [publishing.md](publishing.md).

On Windows PowerShell, if `npm` is blocked by script signing, use `npm.cmd`.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Plays flows at <http://localhost:4173/> |
| `npm run save-shot -- <in> <out.png>` | Copies a screenshot into a capture as PNG |
| `npm run preview -- <captureDir>` | Draws hotspot and redaction boxes on copies |
| `npm run redact -- <rawDir> <cleanDir>` | Hides the areas in `redact.json` |
| `npm run import -- <captureDir> <flowDir> --name "…"` | Builds a flow from a capture |
| `npm run validate -- <flowDir>` | Checks one flow (`npm run validate:all` checks all) |
| `npm test` | Tool tests, then plays every flow in a browser |
