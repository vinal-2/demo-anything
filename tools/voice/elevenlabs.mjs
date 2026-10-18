// ElevenLabs "with timestamps" endpoint: audio plus character timings.
// Needs ELEVENLABS_API_KEY; the voice comes from ELEVENLABS_VOICE_ID or --voice.
import fs from 'node:fs';

const API = 'https://api.elevenlabs.io/v1';
const need = (name) => {
  if (!process.env[name]) throw new Error(`${name} isn't set. Add it to .env.`);
  return process.env[name];
};

export const DEFAULT_VOICE = null; // There is no safe default; pick one with --list-voices.

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

export async function synth(text, { voice, speed = 1 } = {}, rawFile) {
  const voiceId = voice || need('ELEVENLABS_VOICE_ID');
  const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': need('ELEVENLABS_API_KEY') },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, speed)) },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  fs.writeFileSync(rawFile, Buffer.from(data.audio_base64, 'base64'));
  const a = data.alignment || data.normalized_alignment;
  return { timings: a ? wordsFromCharacters(a.characters, a.character_start_times_seconds) : null };
}

export async function listVoices() {
  const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': need('ELEVENLABS_API_KEY') } });
  if (!res.ok) throw new Error(`ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { voices = [] } = await res.json();
  return voices
    .filter((v) => /brit|english|en-gb/i.test(`${v.labels?.accent ?? ''} ${v.labels?.language ?? ''}`))
    .map((v) => ({ id: v.voice_id, name: `${v.name} (${[v.labels?.accent, v.labels?.gender].filter(Boolean).join(', ')})` }));
}
