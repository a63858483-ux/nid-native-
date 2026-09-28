// Messages carry inline markers the web app also understands: a trailing [sticker:id],
// [file:name:title] / [artifact:file:title] cards, [note:..] / [letter:..] pointers, and bare
// image paths (/media/…, /api/albums/media/…) he pastes after taking a camera shot or a screenshot.
export type Media =
  | { kind: 'sticker'; id: string }
  | { kind: 'image'; url: string }
  | { kind: 'card'; icon: 'doc' | 'artifact' | 'note' | 'letter'; title: string; sub?: string; url?: string };

const IMG_RE = /(?:\/media\/[^\s)\]"<>`']+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)\]"<>`']*)?)|(?:\/api\/albums\/media\/[^\s)\]"<>`']+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)\]"<>`']*)?)/gi;
const DROP = [/\[\/?voice\]/g, /\[toy:(?:suck|vibe|ems):\d+\]/g, /\[quiz:\{[\s\S]*?\}\]/g, /\[ask:\{[\s\S]*?\}\]/g, /\[pay:\{[\s\S]*?\}\]/g, /<#\d{1,2}(?:\.\d{1,2})?#>/g, /<销·[^>]*\/>/g, /<等\s*\/>/g, /<succhia_\w+>[\s\S]*?<\/succhia_\w+>/g];

export function parseMessage(raw: string): { text: string; media: Media[] } {
  let t = raw || '';
  const media: Media[] = [];
  for (const re of DROP) t = t.replace(re, '');
  t = t.replace(/\[sticker:([^\]]+)\]/g, (_, id: string) => {
    media.push({ kind: 'sticker', id: id.trim() });
    return '';
  });
  t = t.replace(IMG_RE, (m) => {
    media.push({ kind: 'image', url: m });
    return '';
  });
  t = t.replace(/\[artifact:([^:\]]+):([^\]]*)\]/g, (_, file: string, title: string) => {
    media.push({ kind: 'card', icon: 'artifact', title: title || file, sub: file, url: `/media/artifacts/${file}` });
    return '';
  });
  t = t.replace(/\[file:([^:\]]+):([^\]]*)\]/g, (_, file: string, title: string) => {
    media.push({ kind: 'card', icon: 'doc', title: title || file, sub: file, url: `/media/files/${file}` });
    return '';
  });
  t = t.replace(/\[note:(\d+):([^\]]*)\]/g, (_, _id: string, title: string) => {
    media.push({ kind: 'card', icon: 'note', title: '留了张便签', sub: title });
    return '';
  });
  t = t.replace(/\[letter:(\d+):([^\]]*)\]/g, (_, _id: string, title: string) => {
    media.push({ kind: 'card', icon: 'letter', title: '写了封信', sub: title });
    return '';
  });
  // **bold** / _italic_ etc. stay in: RichText renders them.
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: t, media };
}

export const cleanAssistantText = (raw: string) => parseMessage(raw).text;

// One bubble per paragraph, the way Messages shows several short texts.
export function splitBubbles(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Up to three emoji and nothing else: Messages drops the bubble and shows them big.
export function emojiOnly(text: string): boolean {
  const s = text.replace(/\s/g, '');
  if (!s) return false;
  const stripped = s.replace(/\p{Extended_Pictographic}|\p{Emoji_Presentation}|️|‍|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]/gu, '');
  if (stripped.length) return false;
  const count = (s.match(/\p{Extended_Pictographic}|\p{Emoji_Presentation}/gu) || []).length;
  return count > 0 && count <= 3;
}
