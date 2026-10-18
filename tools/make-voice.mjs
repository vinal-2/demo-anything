#!/usr/bin/env node
// Turns each step's voice.script into narration.
//
//   TTS_PROVIDER=browser     (default) No files. The player speaks with the browser's own voice and
//                            estimates word timings, so the flow runs with no API keys.
//   TTS_PROVIDER=azure       Azure AI Speech. Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION, plus
//                            `npm install microsoft-cognitiveservices-speech-sdk`.
//                            Voice: AZURE_SPEECH_VOICE (default en-GB-RyanNeural).
//   TTS_PROVIDER=elevenlabs  ElevenLabs "with timestamps" endpoint. Needs ELEVENLABS_API_KEY and
//                            ELEVENLABS_VOICE_ID. Model: ELEVENLABS_MODEL (default eleven_multilingual_v2).
//
// Settings come from the environment or a .env file in the project root (never commit .env).
// Each step stores a hash of its script and provider, so unchanged steps are skipped.
//
// Usage: node tools/make-voice.mjs [flows/<flow-id>] [--force]

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} isn't set. Add it to .env or the environment.`);
  return v;
}

// Group character timings into word timings: [{ t, word }].
export function wordsFromCharacters(chars, starts) {
  const out = [];
  let word = '';
  let t = 0;
  chars.forEach((ch, k) => {
    if (/\s/.test(ch)) {
      if (word) out.push({ t: Math.round(t * 1000) / 1000, word });
      word = '';
      return;
    }
    if (!word) t = starts[k];
    word += ch;
  });
  if (word) out.push({ t: Math.round(t * 1000) / 1000, word });
  return out;
}

async function azure(script, outFile) {
  let sdk;
  try {
    sdk = await import('microsoft-cognitiveservices-speech-sdk');
    sdk = sdk.default || sdk;
  } catch {
    throw new Error('Azure needs the Speech SDK: npm install microsoft-cognitiveservices-speech-sdk');
  }
  const config = sdk.SpeechConfig.fromSubscription(need('AZURE_SPEECH_KEY'), need('AZURE_SPEECH_REGION'));
  config.speechSynthesisVoiceName = process.env.AZURE_SPEECH_VOICE || 'en-GB-RyanNeural';
  const formats = sdk.SpeechSynthesisOutputFormat;
  config.speechSynthesisOutputFormat = formats.Audio24Khz48KBitRateMonoMp3 ?? formats.Audio16Khz32KBitRateMonoMp3;
  const synthesizer = new sdk.SpeechSynthesizer(config, sdk.AudioConfig.fromAudioFileOutput(outFile));
  const timings = [];
  synthesizer.wordBoundary = (_s, e) => {
    const isWord = sdk.SpeechSynthesisBoundaryType ? e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word : true;
    if (isWord && e.text) timings.push({ t: Math.round((e.audioOffset / 1e7) * 1000) / 1000, word: e.text });
  };
  await new Promise((resolve, reject) => {
    synthesizer.speakTextAsync(script, (result) => {
      synthesizer.close();
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) resolve();
      else reject(new Error(`Azure Speech didn't finish: ${result.errorDetails || result.reason}`));
    }, (err) => {
      synthesizer.close();
      reject(new Error(`Azure Speech failed: ${err}`));
    });
  });
  return timings;
}

async function elevenlabs(script, outFile) {
  const voice = need('ELEVENLABS_VOICE_ID');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': need('ELEVENLABS_API_KEY') },
    body: JSON.stringify({ text: script, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw new Error(`ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  fs.writeFileSync(outFile, Buffer.from(data.audio_base64, 'base64'));
  const a = data.alignment || data.normalized_alignment;
  return a ? wordsFromCharacters(a.characters, a.character_start_times_seconds) : [];
}

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dir = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(ROOT, 'flows', 'example'));
  const file = path.join(dir, 'flow.json');
  const flow = JSON.parse(fs.readFileSync(file, 'utf8'));
  const provider = (process.env.TTS_PROVIDER || 'browser').toLowerCase();
  if (!['browser', 'azure', 'elevenlabs'].includes(provider)) throw new Error(`Unknown TTS_PROVIDER "${provider}". Use browser, azure or elevenlabs.`);
  const voiceName = provider === 'azure' ? (process.env.AZURE_SPEECH_VOICE || 'en-GB-RyanNeural')
    : provider === 'elevenlabs' ? (process.env.ELEVENLABS_VOICE_ID || '') : '';

  let made = 0;
  let skipped = 0;
  for (const [i, step] of flow.steps.entries()) {
    const v = step.voice;
    if (!v || !v.script || !String(v.script).trim()) continue;
    const hash = crypto.createHash('sha1').update(`${provider}|${voiceName}|${v.script}`).digest('hex').slice(0, 12);
    const audioOk = provider === 'browser' || (v.audio && fs.existsSync(path.join(dir, v.audio)));
    if (!force && v.hash === hash && audioOk) { skipped += 1; continue; }

    if (provider === 'browser') {
      v.audio = null;
      v.timings = [];
    } else {
      const rel = `assets/v${String(i).padStart(2, '0')}.mp3`;
      const out = path.join(dir, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      process.stdout.write(`  step ${i}: generating ${rel} … `);
      v.timings = provider === 'azure' ? await azure(v.script, out) : await elevenlabs(v.script, out);
      v.audio = rel;
      console.log(`${v.timings.length} word timings`);
    }
    v.hash = hash;
    made += 1;
  }
  fs.writeFileSync(file, `${JSON.stringify(flow, null, 2)}\n`);
  console.log(`${provider}: updated ${made} step${made === 1 ? '' : 's'}, skipped ${skipped} unchanged.`);
  if (provider === 'browser') console.log('The player will read these scripts with the browser\'s built-in voice.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
