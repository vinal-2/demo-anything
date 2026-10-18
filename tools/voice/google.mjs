// Google Cloud Text-to-Speech with Chirp 3 HD voices. Needs GOOGLE_API_KEY (an API key
// restricted to the Text-to-Speech API). Chirp 3 HD returns no word timings, so make-voice
// estimates them from the audio length, or aligns them with --align.
import fs from 'node:fs';

const API = 'https://texttospeech.googleapis.com/v1';
export const DEFAULT_VOICE = 'en-GB-Chirp3-HD-Charon';

function key() {
  if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY isn\'t set. Add it to .env.');
  return process.env.GOOGLE_API_KEY;
}

export async function synth(text, { voice = DEFAULT_VOICE, speed = 1 } = {}, rawFile) {
  const res = await fetch(`${API}/text:synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key() },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voice.slice(0, 5), name: voice },
      audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 44100, speakingRate: Math.min(2, Math.max(0.25, speed)) },
    }),
  });
  if (!res.ok) throw new Error(`Google Text-to-Speech answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { audioContent } = await res.json();
  fs.writeFileSync(rawFile, Buffer.from(audioContent, 'base64'));
  return { timings: null };
}

export async function listVoices() {
  const res = await fetch(`${API}/voices?languageCode=en-GB`, { headers: { 'X-Goog-Api-Key': key() } });
  if (!res.ok) throw new Error(`Google Text-to-Speech answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { voices = [] } = await res.json();
  return voices
    .filter((v) => v.name.includes('Chirp3-HD'))
    .map((v) => ({ id: v.name, name: `${v.name.split('-').pop()} (${String(v.ssmlGender || '').toLowerCase()})` }));
}
