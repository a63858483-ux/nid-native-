import { Directory, File, Paths } from 'expo-file-system';

import { ttsBytes } from './api';

export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// A bar chart that stands in for the waveform: seeded by the words so a bubble always
// looks the same, more bars for longer clips.
export function waveBars(seed: string, seconds: number): number[] {
  const n = Math.max(12, Math.min(34, 12 + Math.round(seconds * 1.6)));
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const r = (h >>> 8) / 16777216;
    const env = 0.35 + 0.65 * Math.sin((i / n) * Math.PI * 0.92 + 0.25);
    out.push(Math.max(0.14, Math.min(1, r * env + 0.12)));
  }
  return out;
}

// His voice is synthesized on first play and kept on disk, so the second play is instant.
const dir = () => {
  const d = new Directory(Paths.cache, 'nid-tts');
  if (!d.exists) d.create({ intermediates: true });
  return d;
};
const hash = (t: string) => {
  let h = 5381;
  for (const ch of t) h = (Math.imul(h, 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(16);
};
const inflight = new Map<string, Promise<string>>();
export function ttsFile(text: string): Promise<string> {
  const f = new File(dir(), `${hash(text)}.wav`);
  if (f.exists) return Promise.resolve(f.uri);
  let p = inflight.get(f.uri);
  if (!p) {
    p = ttsBytes(text)
      .then((bytes) => {
        f.write(bytes);
        return f.uri;
      })
      .finally(() => inflight.delete(f.uri));
    inflight.set(f.uri, p);
  }
  return p;
}
