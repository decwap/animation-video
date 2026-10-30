// Minimal WAV helpers (16-bit PCM). Silent placeholders keep a build complete before the real
// voice, music and sound effects exist; wavDuration reads a file's length from its header.
import fs from 'node:fs';
import path from 'node:path';

export function writeSilentWav(file, seconds, { sampleRate = 48000, channels = 2 } = {}) {
  const frames = Math.max(1, Math.round(seconds * sampleRate));
  const data = frames * channels * 2;
  const buf = Buffer.alloc(44 + data);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * channels * 2, 28); buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(data, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return file;
}

// Seconds of audio in a PCM/float WAV, from its fmt and data chunks.
export function wavDuration(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file} is not a WAV file`);
  let byteRate = 0;
  for (let at = 12; at + 8 <= buf.length;) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(at + 16);
    if (id === 'data') return byteRate ? Math.min(size, buf.length - at - 8) / byteRate : 0;
    at += 8 + size + (size % 2);
  }
  throw new Error(`${file} has no data chunk`);
}
