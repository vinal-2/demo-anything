import { open } from 'node:fs/promises';

const PNG_SIGNATURE = '89504e470d0a1a0a';

// Reads width and height from a PNG header, so the tools need no image library.
export async function pngSize(file) {
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(24);
    await handle.read(header, 0, 24, 0);
    if (header.subarray(0, 8).toString('hex') !== PNG_SIGNATURE || header.toString('ascii', 12, 16) !== 'IHDR') {
      throw new Error(`${file} is not a PNG file`);
    }
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
}
