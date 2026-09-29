// Messages carry inline markers the web app also understands: a trailing [sticker:id],
// [file:name:title] / [artifact:file:title] cards, [note:..] / [letter:..] pointers, and bare
// image paths (/media/…, /api/albums/media/…) he pastes after taking a camera shot or a screenshot.
export type Media =
  | { kind: 'sticker'; id: string }
  | { kind: 'image'; url: string }
  | { kind: 'card'; icon: 'doc' | 'artifact' | 'note' | 'letter'; title: string; sub?: string; url?: string }
  | { kind: 'voice'; text: string }
  | { kind: 'song'; query: string }
  | { kind: 'alarm'; date?: string; time: string; title: string }
  | { kind: 'alarmOff'; date?: string; time: string };

const IMG_RE = /(?:\/media\/[^\s)\]"<>`']+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)\]"<>`']*)?)|(?:\/api\/albums\/media\/[^\s)\]"<>`']+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)\]"<>`']*)?)/gi;
const DROP = [
  /\[\/?voice\]/g,
  /\[toy:(?:suck|vibe|ems):\d+\]/g,
  /\[quiz:\{[\s\S]*?\}\]/g,
  /\[ask:\{[\s\S]*?\}\]/g,
  /\[pay:\{[\s\S]*?\}\]/g,
  /<#\d{1,2}(?:\.\d{1,2})?#>/g,
  /<销·[^>]*\/>/g,
  /<等\s*\/>/g,
  /<succhia_\w+>[\s\S]*?<\/succhia_\w+>/g,
];

export function parseMessage(raw: string): { text: string; media: Media[] } {
  let t = raw || '';
  const media: Media[] = [];
  // [voice]…[/voice] is a spoken reply: the words become a voice bubble. An unclosed
  // [voice] is one still streaming in; nothing of it shows until it closes.
  t = t.replace(/\[voice\]([\s\S]*?)\[\/voice\]/g, (_, inner: string) => {
    const v = stripTone(inner).trim();
    if (v) media.push({ kind: 'voice', text: v });
    return '';
  });
  const open = t.indexOf('[voice]');
  if (open >= 0) t = t.slice(0, open);
  for (const re of DROP) t = t.replace(re, '');
  // [song:歌手 歌名] → a playable Apple Music card
  t = t.replace(/\[song:([^\]]+)\]/g, (_, q: string) => {
    media.push({ kind: 'song', query: q.trim() });
    return '';
  });
  // [alarm:07:30 早八] or [alarm:2026-10-01 07:30 早八] → a real system alarm
  t = t.replace(/\[alarm:(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}:\d{2})(?:\s+([^\]]*))?\]/g, (_, date: string | undefined, time: string, title: string | undefined) => {
    media.push({ kind: 'alarm', date, time, title: (title || '').trim() });
    return '';
  });
  // [alarm-off:07:30], [alarm-off:2026-10-01 07:30] or [alarm-off:all] → he takes back an alarm he set
  t = t.replace(/\[alarm-off:(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}:\d{2}|all)\s*\]/g, (_, date: string | undefined, time: string) => {
    media.push({ kind: 'alarmOff', date, time });
    return '';
  });
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
  t = t
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: t, media };
}

// Tone marks only steer the voice: <语气·calm/>, (sighs), <#0.4#> never show as words.
const TONE_RE =
  /<语气·[a-zA-Z]{3,12}\s*\/?>|\((?:laughs|chuckle|sighs|breath|pant|inhale|exhale|gasps|groans|sniffs|coughs|clear-throat|humming|emm|lip-smacking|snorts|hissing|sneezes|burps)\)|<#\d{1,2}(?:\.\d{1,2})?#>/g;
export const stripTone = (t: string) => t.replace(TONE_RE, '').replace(/[ \t]{2,}/g, ' ');

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
