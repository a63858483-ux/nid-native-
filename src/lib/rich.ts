// Inline formatting and Messages-style text effects, carried as plain markup so both
// sides (and the server) see the same text:
//   **bold**  _italic_  __underline__  ~~strike~~
//   [fx:shake]these words[/fx]   effects: big small shake nod explode ripple bloom jitter
export const EFFECTS = ['big', 'small', 'shake', 'nod', 'explode', 'ripple', 'bloom', 'jitter'] as const;
export type Effect = (typeof EFFECTS)[number];
export type Block = 'quote' | 'heading' | 'code';
export type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fx?: Effect;
  code?: boolean;
  link?: string;
  block?: Block;
  bullet?: boolean;
};

const FX_RE = /\[fx:(big|small|shake|nod|explode|ripple|bloom|jitter)\]([\s\S]*?)\[\/fx\]/g;
type Mark = keyof Pick<Run, 'bold' | 'italic' | 'underline' | 'strike'>;
// order matters: longer fences first
const MARKS: [RegExp, Mark][] = [
  [/\*\*(.+?)\*\*/, 'bold'],
  [/__(.+?)__/, 'underline'],
  [/~~(.+?)~~/, 'strike'],
  // ASCII-only word guard: snake_case stays literal, but 中文_斜体_中文 still works
  [/(?<![A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/u, 'italic'],
  [/(?<![A-Za-z0-9*])\*([^*\n]+?)\*(?![A-Za-z0-9*])/u, 'italic'],
];
// literal spans: their insides are not parsed further
const CODE_RE = /`([^`\n]+)`/;
const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/;
const URL_RE = /https?:\/\/[^\s<>"'`，。！？、）】]+/;

function inline(text: string, base: Omit<Run, 'text'>): Run[] {
  if (!text) return [];
  type Hit = { m: RegExpExecArray; make: (m: RegExpExecArray) => Run[] };
  let best: Hit | null = null;
  const consider = (re: RegExp, make: Hit['make']) => {
    const m = re.exec(text);
    if (m && (!best || m.index < best.m.index)) best = { m, make };
  };
  consider(CODE_RE, (m) => [{ ...base, text: m[1], code: true }]);
  consider(LINK_RE, (m) => inline(m[1], { ...base, link: m[2] }));
  if (!base.link) consider(URL_RE, (m) => [{ ...base, text: m[0], link: m[0] }]);
  for (const [re, key] of MARKS) consider(re, (m) => inline(m[1], { ...base, [key]: true }));
  if (!best) return [{ ...base, text }];
  const { m, make } = best as Hit;
  return [...inline(text.slice(0, m.index), base), ...make(m), ...inline(text.slice(m.index + m[0].length), base)];
}

function line(text: string, base: Omit<Run, 'text'>): Run[] {
  const out: Run[] = [];
  let last = 0;
  FX_RE.lastIndex = 0;
  for (let m = FX_RE.exec(text); m; m = FX_RE.exec(text)) {
    out.push(...inline(text.slice(last, m.index), base));
    out.push(...inline(m[2], { ...base, fx: m[1] as Effect }));
    last = m.index + m[0].length;
  }
  out.push(...inline(text.slice(last), base));
  return out;
}

// Markdown the way he writes it: quotes, headings, bullets and ``` blocks per line,
// inline marks, `code` and links within a line. Line breaks come back as "\n" runs.
export function parseRich(text: string): Run[] {
  const out: Run[] = [];
  let fenced = false;
  const lines = text.split('\n');
  lines.forEach((raw, i) => {
    const nl = i < lines.length - 1 ? '\n' : '';
    if (/^\s*```/.test(raw)) {
      fenced = !fenced;
      return;
    }
    if (fenced) {
      out.push({ text: raw + nl, code: true, block: 'code' });
      return;
    }
    let m: RegExpExecArray | null;
    if ((m = /^\s{0,3}>\s?(.*)$/.exec(raw))) out.push(...line(m[1], { block: 'quote' }));
    else if ((m = /^\s{0,3}#{1,6}\s+(.*)$/.exec(raw))) out.push(...line(m[1], { block: 'heading', bold: true }));
    else if ((m = /^(\s*)[-*+•]\s+(.*)$/.exec(raw))) out.push({ text: m[1] + '• ', bullet: true }, ...line(m[2], {}));
    else out.push(...line(raw, {}));
    if (nl) out.push({ text: nl });
  });
  return out.filter((r) => r.text.length > 0);
}

export const hasRich = (text: string) => /\[fx:|\*\*|__|~~|(?<![\p{L}\p{N}])[_*]\S/u.test(text);
export const plainOf = (text: string) =>
  parseRich(text)
    .map((r) => r.text)
    .join('');
