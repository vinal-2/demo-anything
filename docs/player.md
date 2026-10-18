# The player

A flow looks like a short video but pauses at each checkpoint until the viewer
clicks a pulsing hotspot, with narration, captions and an animated cursor. It is
plain HTML, CSS and JavaScript with no build step.

## Addresses

| Address | What it does |
| --- | --- |
| `/` | Plays the default flow (`example`) |
| `/?flow=<id>` | Plays `flows/<id>/flow.json` |
| `/?flow=<id>&edit` | Opens the flow in authoring mode |
| `/?embed` | Hides the page margin, for use inside an iframe |

## Controls

- **Get Started** starts the flow. That click also lets the browser play sound.
- **Pulsing dot**: click it to continue. Clicking elsewhere makes it bounce.
- **← / →** move one step, **Space** pauses and resumes.
- The top bar has the language menu, sound, captions (CC) and full screen. Sound and
  caption settings are remembered in the browser.
- Hover or tap the screen for the control bar: play/pause, elapsed and total time,
  one progress segment per step (click one to jump there) and speed (1× to 2×).
- Links on the end card that go to other sites open in a new tab.

## Authoring mode (`&edit`)

- The step list is on the left, with a warning on any checkpoint without a hotspot.
- Click the screenshot to place the selected step's hotspot, or type its `x` and `y`.
- Edit the type, source, narration, hotspot label, auto-advance and video times.
- **Duplicate as checkpoint** turns a narration step into narration plus a checkpoint.
- Drag an image onto a step to preview it; then copy the file into `assets/`.
- **Export flow.json** downloads the file. **Copy to clipboard** is the fallback
  where downloads are blocked. Save it over `flows/<id>/flow.json` and run
  `npm run validate`.

## Voice

Without recorded audio, the browser reads each script aloud. Voices differ between
browsers and operating systems. To record narration instead:

1. Copy `.env.example` to `.env` (git ignores `.env`, so keys are never committed).
2. Set `TTS_PROVIDER` and the keys for your provider.
3. Run `npm run voice -- flows/<id>`.

| Provider | Needs | Result |
| --- | --- | --- |
| `browser` (default) | nothing | No files; the player uses the browser's voice |
| `azure` | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, and `npm install microsoft-cognitiveservices-speech-sdk` | `assets/vNN.mp3` with word timings |
| `elevenlabs` | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | `assets/vNN.mp3` with word timings |

Each step keeps a hash of its script and voice, so only changed scripts are
recorded again. Add `--force` to record them all. The Azure and ElevenLabs paths
follow each provider's documented API but have not yet been run against a live
account: try one step first.

## Embedding

```html
<iframe src="https://vinal-2.github.io/demo-anything/?flow=example&embed"
        title="Turn on email alerts" allow="fullscreen"
        style="width:100%;aspect-ratio:16/10;border:0"></iframe>
```

The player posts its progress to the host page, so a learning platform can track it:

```js
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://vinal-2.github.io') return;
  if (e.data?.type === 'demo:step') console.log(`step ${e.data.index + 1} of ${e.data.total}`);
  if (e.data?.type === 'demo:complete') console.log(`${e.data.flow} finished`);
});
```

Always check `e.origin` before trusting these messages.

## Known limits

- Browser speech differs between browsers; some have no English voice, and the
  player then times the narration silently.
- The language menu offers English only for now.
- On a phone, a desktop screenshot is shown at phone width, so small text is hard
  to read. The hotspot and its tap target stay full size.
