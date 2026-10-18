#!/usr/bin/env node
// Renders one sentence with every narration provider you can use, in a few voices each,
// so you can listen side by side and choose. Writes voice-samples/*.mp3 and
// voice-samples/index.html (the folder is git-ignored).
//
// Usage: node tools/voice-sampler.mjs        then open voice-samples/index.html

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFfmpeg, finishAudio } from './lib/audio.mjs';
import { loadDotEnv } from './lib/env.mjs';
import * as elevenlabs from './voice/elevenlabs.mjs';
import * as google from './voice/google.mjs';
import * as kokoro from './voice/kokoro.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'voice-samples');
export const SENTENCE = 'Response actions such as isolation are in the menu at the top right of the device page.';
const VOICES_EACH = 3;

const PROVIDERS = [
  {
    id: 'kokoro', module: kokoro, cost: 'Free, runs on your computer',
    ready: async () => { try { await import('kokoro-js'); return true; } catch { return false; } },
    why: 'npm install kokoro-js',
    voices: async () => ['bm_george', 'bf_emma', 'bm_daniel'],
  },
  {
    id: 'elevenlabs', module: elevenlabs, cost: 'Paid per character, free monthly allowance',
    ready: async () => Boolean(process.env.ELEVENLABS_API_KEY),
    why: 'set ELEVENLABS_API_KEY in .env',
    voices: async () => (await elevenlabs.listVoices()).slice(0, VOICES_EACH).map((v) => v.id),
  },
  {
    id: 'google', module: google, cost: 'Paid per character, free monthly allowance',
    ready: async () => Boolean(process.env.GOOGLE_API_KEY),
    why: 'set GOOGLE_API_KEY in .env',
    voices: async () => {
      const listed = (await google.listVoices()).map((v) => v.id);
      const preferred = ['en-GB-Chirp3-HD-Charon', 'en-GB-Chirp3-HD-Aoede', 'en-GB-Chirp3-HD-Puck'].filter((v) => listed.includes(v));
      return (preferred.length ? preferred : listed).slice(0, VOICES_EACH);
    },
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeName = (s) => s.replace(/[^a-z0-9_-]+/gi, '-');

async function main() {
  loadDotEnv(ROOT);
  await checkFfmpeg();
  fs.mkdirSync(OUT, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-sampler-'));
  const samples = [];
  const skipped = [];
  try {
    for (const p of PROVIDERS) {
      if (!(await p.ready())) { skipped.push(`${p.id}: ${p.why}`); continue; }
      let voices;
      try { voices = await p.voices(); } catch (err) { skipped.push(`${p.id}: ${err.message}`); continue; }
      for (const voice of voices) {
        const file = `${p.id}-${safeName(voice)}.mp3`;
        process.stdout.write(`  ${p.id} ${voice} … `);
        try {
          const raw = path.join(work, `${file}.${p.id === 'kokoro' ? 'wav' : 'mp3'}`);
          await p.module.synth(SENTENCE, { voice, speed: 1 }, raw);
          const seconds = await finishAudio(raw, path.join(OUT, file));
          samples.push({ provider: p.id, voice, file, seconds, cost: p.cost });
          console.log(`${file} (${seconds.toFixed(1)} s)`);
        } catch (err) {
          console.log(`failed: ${err.message}`);
          skipped.push(`${p.id} ${voice}: ${err.message}`);
        }
      }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(OUT, 'index.html'), page(samples, skipped));
  console.log(`\n${samples.length} samples in voice-samples/. Open voice-samples/index.html to compare them.`);
  skipped.forEach((s) => console.log(`  not sampled: ${s}`));
}

function page(samples, skipped) {
  const cards = samples.map((s) => `
    <article>
      <h2>${esc(s.voice)}</h2>
      <p class="meta">${esc(s.provider)} · ${s.seconds.toFixed(1)} s · ${esc(s.cost)}</p>
      <audio controls preload="none" src="${esc(s.file)}"></audio>
      <code>"narrator": { "provider": "${esc(s.provider)}", "voice": "${esc(s.voice)}", "speed": 1.0 }</code>
    </article>`).join('');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voice samples</title>
<style>
  body { font: 17px/1.5 system-ui, "Segoe UI", sans-serif; margin: 0 auto; max-width: 980px; padding: 24px 16px; background: #f6f4ef; color: #1b1f24; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  article { background: #fff; border-radius: 10px; padding: 16px; box-shadow: 0 1px 6px rgb(0 0 0 / .08); }
  h2 { margin: 0; font-size: 1.1rem; } .meta { margin: 4px 0 10px; color: #4a5560; }
  audio { width: 100%; } code { display: block; margin-top: 10px; font-size: .78rem; word-break: break-all; color: #4a5560; }
  button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 2px solid #1b1f24; background: #fff; cursor: pointer; }
</style>
</head>
<body>
<h1>Voice samples</h1>
<p>Each sample reads: <q>${esc(SENTENCE)}</q></p>
<p>Copy the <code style="display:inline">narrator</code> line of the voice you like into a flow's <code style="display:inline">flow.json</code>, then run <code style="display:inline">npm run voice -- flows/&lt;id&gt;</code>.</p>
<div class="grid">${cards}
  <article>
    <h2>Browser voice</h2>
    <p class="meta">browser · free · differs by browser and computer</p>
    <button type="button" id="speak">Play</button>
    <code>"narrator": { "provider": "browser" }</code>
  </article>
</div>
${skipped.length ? `<h2>Not sampled</h2><ul>${skipped.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
<script>
  document.getElementById('speak').addEventListener('click', () => {
    const u = new SpeechSynthesisUtterance(${JSON.stringify(SENTENCE)});
    u.lang = 'en-GB';
    const gb = speechSynthesis.getVoices().find((v) => v.lang === 'en-GB');
    if (gb) u.voice = gb;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
</script>
</body>
</html>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
