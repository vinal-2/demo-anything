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
- The top bar has the narrator voice menu (when a demo has more than one voice), the
  language menu, sound, captions (CC) and full screen. The voice, sound and caption
  settings are remembered in the browser. In menus, ↑ and ↓ move and Escape closes.
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

Each narration step can play a real recording with word-by-word captions. Without
one, the browser reads the script aloud; that works everywhere but sounds robotic
and differs between browsers.

### Choose a voice

| Provider | Sounds like | Cost | Needs | Word timings |
| --- | --- | --- | --- | --- |
| `kokoro` | Natural; 8 British voices (default `bm_george`) | Free, runs on your computer ([Apache-2.0](https://github.com/hexgrad/kokoro)) | `npm install --no-save kokoro-js` (about 210 MB) and ffmpeg; downloads a ~90 MB model once | Estimated, or measured with `--align` |
| `elevenlabs` | Very natural, many voices | Paid; plans from $6 a month, API Multilingual v2 listed at $0.08 per 1,000 characters ([pricing](https://elevenlabs.io/pricing/api)). Check the plan's terms for commercial use | `ELEVENLABS_API_KEY`, a voice ID | From the API |
| `google` | Natural; Chirp 3 HD British voices (default `en-GB-Chirp3-HD-Charon`) | Paid per character after a monthly free allowance ([pricing](https://cloud.google.com/text-to-speech/pricing)) | `GOOGLE_API_KEY` restricted to the Text-to-Speech API | Estimated, or measured with `--align` |
| `recorded` | You | Free | Your own `assets/vNN.mp3`, `.wav` or `.m4a` files | Estimated, or measured with `--align` |
| `browser` | Robotic, varies | Free | Nothing | Estimated by the player |

The demos in this repository use Kokoro's `bm_george`. ElevenLabs and Google follow
their current API documentation but have not yet been run against a live account
here, so try one step first.

To compare voices, run `npm run voice:sample`. It reads one sentence with every
provider you can use, in a few voices each, and writes `voice-samples/index.html`
(git-ignored) so you can listen side by side.

### Make the narration

1. Pick the narrator in `flow.json`:
   ```json
   "narrator": { "provider": "kokoro", "voice": "bm_george", "speed": 1.0 }
   ```
   `--provider`, `--voice` and `--speed` override it for one run; the environment
   (`TTS_PROVIDER`, `KOKORO_VOICE`, `ELEVENLABS_VOICE_ID`, `GOOGLE_TTS_VOICE`,
   `TTS_SPEED`) is used last.
2. Keys go in `.env` (copy `.env.example`). Git ignores `.env`.
3. Run `npm run voice -- flows/<id>`. Add `--only <step>` for one step, `--force` to
   redo every step, and `--align` for measured word timings if
   [faster-whisper](https://github.com/SYSTRAN/faster-whisper) or openai-whisper is
   installed (`pip install faster-whisper`).

Every file is a mono MP3 at 44.1 kHz and about 96 kbps, normalised to -16 LUFS,
with 150 ms of silence at each end, so steps sound even. Each step keeps a hash of
its provider, voice, speed and spoken text, so only changed steps are made again.

### Let viewers switch voice

List several narrators instead of one, and the player shows a **Narrator voice** menu
(the microphone in the top bar). Viewers can switch at any time, even mid-step: the
current line restarts in the new voice, captions stay in sync, and the browser
remembers the choice for that demo.

```json
"narrators": [
  { "id": "george", "label": "George (British, male)", "provider": "kokoro", "voice": "bm_george" },
  { "id": "emma", "label": "Emma (British, female)", "provider": "kokoro", "voice": "bf_emma" },
  { "id": "browser", "label": "Browser voice", "provider": "browser" }
]
```

- The first narrator is the default. Its files are `assets/vNN.mp3`; the others go in
  `assets/<id>/vNN.mp3`.
- `npm run voice -- flows/<id> --align` makes every narrator. Add `--narrator emma`
  to make just one.
- A `browser` narrator needs no files; it uses the viewer's browser voice.
- Each extra voice adds about 1 MB to a typical demo.

### Your own voice

Record each narration step and save it as `flows/<id>/assets/vNN.wav`, `.m4a` or
`.mp3`, where `NN` is the step number (two digits). Then run
`npm run voice -- flows/<id> --provider recorded`. The tool converts and normalises
each file and fills in the timings.

### Pronunciation

`voice-lexicon.json` at the repository root says how to pronounce words:

```json
{ "LAB-WS22-01": "lab W S twenty-two oh one", "MDE": "M D E", "KQL": "K Q L" }
```

Only the text sent to the voice changes; captions keep the original words.

### Scripts that read well aloud

`npm run voice -- flows/<id> --check-scripts` lists scripts over 30 words or with
brackets, slashes, symbols or abbreviations, each with a suggested rewrite. It
changes nothing.

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
