// The only files a flow may publish: what the player shows or plays, checked by
// content as well as by name. Anything else (SVG, HTML, scripts) could run code on the
// Pages site, which every one of the owner's GitHub Pages sites shares.
import fs from 'node:fs';
import path from 'node:path';

const MB = 1024 * 1024;
export const LIMITS = { image: 5 * MB, video: 20 * MB, audio: 3 * MB, flow: 50 * MB };
const MAGIC_BYTES = 16;

const has = (buf, offset, text) => buf.length >= offset + text.length
  && buf.toString('latin1', offset, offset + text.length) === text;
const isoMedia = (buf) => has(buf, 4, 'ftyp');
const jpeg = (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

export const MEDIA = {
  '.png': { kind: 'image', magic: (buf) => buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a },
  '.jpg': { kind: 'image', magic: jpeg },
  '.jpeg': { kind: 'image', magic: jpeg },
  '.webp': { kind: 'image', magic: (buf) => has(buf, 0, 'RIFF') && has(buf, 8, 'WEBP') },
  '.mp4': { kind: 'video', magic: isoMedia },
  '.webm': { kind: 'video', magic: (buf) => buf.length >= 4 && buf.readUInt32BE(0) === 0x1a45dfa3 },
  '.mp3': { kind: 'audio', magic: (buf) => has(buf, 0, 'ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) },
  '.m4a': { kind: 'audio', magic: isoMedia },
  '.ogg': { kind: 'audio', magic: (buf) => has(buf, 0, 'OggS') },
  '.wav': { kind: 'audio', magic: (buf) => has(buf, 0, 'RIFF') && has(buf, 8, 'WAVE') },
};
const ALLOWED = 'PNG, JPEG, WebP, MP4, WebM, MP3, M4A, OGG and WAV';
// Rounded up, so a file just over a limit never reads as equal to it.
const megabytes = (bytes) => `${Math.ceil((bytes / MB) * 10) / 10} MB`;

function firstBytes(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(MAGIC_BYTES);
    const read = fs.readSync(fd, buf, 0, MAGIC_BYTES, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

// Checks one file a flow uses. `kind` is what the field needs: image, video or audio.
// Returns the file size and a list of problems (empty when the file is fine).
export function checkMedia(file, kind) {
  const ext = path.extname(file).toLowerCase();
  const type = MEDIA[ext];
  if (!type) return { size: 0, problems: [`is a ${ext || 'extension-less'} file. Flows can only publish ${ALLOWED} files.`] };
  if (kind && type.kind !== kind) return { size: 0, problems: [`must be ${kind === 'image' ? 'an image' : `a ${kind} file`}, not ${ext}.`] };
  const { size } = fs.statSync(file);
  const problems = [];
  if (size > LIMITS[type.kind]) problems.push(`is ${megabytes(size)}; the limit for ${type.kind === 'image' ? 'an image' : `a ${type.kind} file`} is ${megabytes(LIMITS[type.kind])}.`);
  if (!type.magic(firstBytes(file))) problems.push(`doesn't look like a real ${ext} file (its content doesn't match its name).`);
  return { size, problems };
}

export { megabytes };
