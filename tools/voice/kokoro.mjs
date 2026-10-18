// Kokoro: a free voice that runs on your own computer. Apache-2.0.
// Needs `npm install kokoro-js` (about 210 MB with its runtime) and downloads an ~90 MB model
// the first time. It returns WAV; make-voice turns that into the shared MP3 format.

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const DEFAULT_VOICE = 'bm_george';
let loading;

async function model() {
  loading ??= (async () => {
    let KokoroTTS;
    try {
      ({ KokoroTTS } = await import('kokoro-js'));
    } catch {
      throw new Error('Kokoro needs its package: npm install kokoro-js');
    }
    return KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'cpu' });
  })();
  return loading;
}

export async function synth(text, { voice = DEFAULT_VOICE, speed = 1 } = {}, rawFile) {
  const tts = await model();
  if (!tts.voices[voice]) throw new Error(`Kokoro has no voice "${voice}". Run with --list-voices.`);
  const audio = await tts.generate(text, { voice, speed });
  audio.save(rawFile);
  return { timings: null };
}

export async function listVoices() {
  const tts = await model();
  return Object.entries(tts.voices)
    .filter(([id, info]) => /en-gb/i.test(info.language ?? '') || /^b[fm]_/.test(id))
    .map(([id, info]) => ({ id, name: `${info.name} (${info.gender})` }));
}
