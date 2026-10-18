import fs from 'node:fs';

// Reads width and height from a PNG or JPEG header, so the tools need no image library.
export function imageSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let p = 2;
    while (p + 9 < buf.length) {
      if (buf[p] !== 0xff) { p += 1; continue; }
      const marker = buf[p + 1];
      const len = buf.readUInt16BE(p + 2);
      const isFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
        || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isFrame) return { width: buf.readUInt16BE(p + 7), height: buf.readUInt16BE(p + 5) };
      p += 2 + len;
    }
  }
  throw new Error(`Can't read the image size of ${file}. Use PNG or JPEG screenshots.`);
}
