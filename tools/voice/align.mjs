// Optional real word timings with Whisper (faster-whisper or openai-whisper), if installed.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const PYTHON = process.env.PYTHON || 'python';

const SCRIPT = `
import sys, json
audio = sys.argv[1]
try:
    from faster_whisper import WhisperModel
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio, word_timestamps=True, language="en")
    words = [{"t": round(w.start, 3), "word": w.word.strip()} for s in segments for w in s.words]
except ImportError:
    import whisper
    result = whisper.load_model("base.en").transcribe(audio, word_timestamps=True, language="en")
    words = [{"t": round(w["start"], 3), "word": w["word"].strip()} for s in result["segments"] for w in s["words"]]
print(json.dumps(words))
`;

export async function whisperAvailable() {
  try {
    await run(PYTHON, ['-c', 'import importlib.util as u, sys; sys.exit(0 if (u.find_spec("faster_whisper") or u.find_spec("whisper")) else 1)']);
    return true;
  } catch {
    return false;
  }
}

// Word start times measured from the audio itself.
export async function alignWords(audioFile) {
  const { stdout } = await run(PYTHON, ['-c', SCRIPT, audioFile], { maxBuffer: 10 * 1024 * 1024 });
  const words = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
  return words.filter((w) => w.word);
}
