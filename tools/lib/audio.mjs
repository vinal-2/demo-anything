// ffmpeg helpers for narration audio.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PAD_SECONDS } from './narration.mjs';

const run = promisify(execFile);

export const FFMPEG_HELP = 'ffmpeg is needed for narration audio. Install it, then open a new terminal:\n'
  + '  Windows: winget install Gyan.FFmpeg\n  macOS:   brew install ffmpeg\n  Linux:   sudo apt install ffmpeg';

export async function checkFfmpeg() {
  try {
    await run('ffmpeg', ['-version']);
    await run('ffprobe', ['-version']);
  } catch {
    throw new Error(FFMPEG_HELP);
  }
}

// Length of an audio file in seconds.
export async function duration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const seconds = Number(stdout.trim());
  if (!(seconds > 0)) throw new Error(`Couldn't read the length of ${file}.`);
  return seconds;
}

// Turns any audio file into the narration format every flow uses: mono MP3, 44.1 kHz,
// about 96 kbps, loudness-normalised to -16 LUFS, with PAD_SECONDS of silence at each end.
export async function finishAudio(input, output) {
  const padMs = Math.round(PAD_SECONDS * 1000);
  const filters = [
    'aformat=channel_layouts=mono',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    `adelay=${padMs}:all=1`,
    `apad=pad_dur=${PAD_SECONDS}`,
  ].join(',');
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-af', filters, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', output]);
  return duration(output);
}
