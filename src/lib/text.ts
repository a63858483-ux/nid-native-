// Inline markers the server leaves in assistant text; the web app strips the same set.
const DROP = [
  /\[\/?voice\]/g,
  /\[toy:(?:suck|vibe|ems):\d+\]/g,
  /\[quiz:\{[\s\S]*?\}\]/g,
  /\[ask:\{[\s\S]*?\}\]/g,
  /<#\d{1,2}(?:\.\d{1,2})?#>/g,
  /<销·[^>]*\/>/g,
  /<等\s*\/>/g,
];
const PLACEHOLDER = /\[(sticker|artifact|file|note|letter):[^\]]*\]/g;

export function cleanAssistantText(raw: string): string {
  let t = raw || '';
  for (const re of DROP) t = t.replace(re, '');
  t = t.replace(PLACEHOLDER, (_, kind: string) => `[${kind}]`);
  t = t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S.*?)\*(?=\s|$)/g, '$1$2');
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// One bubble per paragraph, the way iMessage shows several short texts.
export function splitBubbles(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
