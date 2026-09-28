// Replies, tapbacks and stuck-on stickers ride inside the message text, the same way
// [sticker:id] already does, so the server and his side need nothing new:
//   [reply:#123 "first few words"] the reply text…
//   [tapback:#123 "first few words":❤️]            (a message that is only this)
//   [stick:#123 "first few words":🥺:0.82:0.15:-14]  emoji or sticker:<id>, x, y (0–1), angle
// He has no message ids, so his markers may carry only the quoted words; both resolve.

export type Ref = { id?: number; quote?: string };
export type Tapback = { ref: Ref; emoji: string; off: boolean };
export type Stick = { ref: Ref; what: string; x: number; y: number; angle: number };

const REF = '#?(\\d+)?\\s*(?:"([^"]{1,60})")?';
const REPLY_RE = new RegExp(`^\\s*\\[reply:${REF}\\]\\s*`);
const TAPBACK_RE = new RegExp(`^\\s*\\[tapback:${REF}:([^\\]:]+?)(?::off)?\\]\\s*$`);
const STICK_RE = new RegExp(`^\\s*\\[stick:${REF}:([^\\]:]+?):([\\d.]+):([\\d.]+):(-?[\\d.]+)\\]\\s*$`);

const ref = (id?: string, quote?: string): Ref => ({ id: id ? Number(id) : undefined, quote: quote || undefined });

export function parseReply(text: string): { ref: Ref; rest: string } | null {
  const m = REPLY_RE.exec(text || '');
  if (!m || (!m[1] && !m[2])) return null;
  return { ref: ref(m[1], m[2]), rest: text.slice(m[0].length) };
}

export function parseTapback(text: string): Tapback | null {
  const m = TAPBACK_RE.exec(text || '');
  if (!m || (!m[1] && !m[2])) return null;
  return { ref: ref(m[1], m[2]), emoji: m[3].trim(), off: /:off\]\s*$/.test(text) };
}

export function parseStick(text: string): Stick | null {
  const m = STICK_RE.exec(text || '');
  if (!m || (!m[1] && !m[2])) return null;
  return { ref: ref(m[1], m[2]), what: m[3].trim(), x: Number(m[4]), y: Number(m[5]), angle: Number(m[6]) };
}

export const isReactionOnly = (text: string) => !!parseTapback(text) || !!parseStick(text);

const snippet = (t: string) => t.replace(/\s+/g, ' ').replace(/"/g, '”').trim().slice(0, 14);
const refOf = (id: number | undefined, text: string) => `${id ? `#${id} ` : ''}"${snippet(text)}"`;

export const replyMarker = (id: number | undefined, text: string) => `[reply:${refOf(id, text)}]`;
export const tapbackMarker = (id: number | undefined, text: string, emoji: string, off = false) =>
  `[tapback:${refOf(id, text)}:${emoji}${off ? ':off' : ''}]`;
export function stickMarker(id: number | undefined, text: string, what: string) {
  // random spot along the bubble's edge, a little tilted, like a sticker slapped on
  const edge = Math.random();
  const x = edge < 0.5 ? 0.78 + Math.random() * 0.22 : Math.random() * 0.22;
  const y = Math.random() < 0.5 ? Math.random() * 0.25 : 0.7 + Math.random() * 0.3;
  const angle = Math.round((Math.random() - 0.5) * 40);
  return `[stick:${refOf(id, text)}:${what}:${x.toFixed(2)}:${y.toFixed(2)}:${angle}]`;
}

// Resolve a marker to a message: by id when given, else the latest earlier message
// (from the other side, preferably) whose text contains the quoted words.
export function resolveRef<T extends { id?: number; text: string; role: string }>(r: Ref, items: T[], before: number): T | undefined {
  if (r.id) {
    const hit = items.find((i) => i.id === r.id);
    if (hit) return hit;
  }
  if (!r.quote) return undefined;
  const q = r.quote.replace(/\s+/g, '');
  for (let i = Math.min(before, items.length) - 1; i >= 0; i--) {
    const it = items[i];
    if (it.text.replace(/\s+/g, '').includes(q)) return it;
  }
  return undefined;
}
