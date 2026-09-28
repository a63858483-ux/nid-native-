// Inline formatting and Messages-style text effects, carried as plain markup so both
// sides (and the server) see the same text:
//   **bold**  _italic_  __underline__  ~~strike~~
//   [fx:shake]these words[/fx]   effects: big small shake nod explode ripple bloom jitter
export const EFFECTS = [
  "big",
  "small",
  "shake",
  "nod",
  "explode",
  "ripple",
  "bloom",
  "jitter",
] as const;
export type Effect = (typeof EFFECTS)[number];
export type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fx?: Effect;
};

const FX_RE =
  /\[fx:(big|small|shake|nod|explode|ripple|bloom|jitter)\]([\s\S]*?)\[\/fx\]/g;
// order matters: longer fences first
const MARKS: [RegExp, keyof Omit<Run, "text" | "fx">][] = [
  [/\*\*(.+?)\*\*/, "bold"],
  [/__(.+?)__/, "underline"],
  [/~~(.+?)~~/, "strike"],
  // ASCII-only word guard: snake_case stays literal, but 中文_斜体_中文 still works
  [/(?<![A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/u, "italic"],
  [/(?<![A-Za-z0-9*])\*([^*\n]+?)\*(?![A-Za-z0-9*])/u, "italic"],
];

function inline(text: string, base: Omit<Run, "text">): Run[] {
  if (!text) return [];
  let best: { m: RegExpExecArray; key: keyof Omit<Run, "text" | "fx"> } | null =
    null;
  for (const [re, key] of MARKS) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.m.index)) best = { m, key };
  }
  if (!best) return [{ ...base, text }];
  const { m, key } = best;
  return [
    ...inline(text.slice(0, m.index), base),
    ...inline(m[1], { ...base, [key]: true }),
    ...inline(text.slice(m.index + m[0].length), base),
  ];
}

export function parseRich(text: string): Run[] {
  const out: Run[] = [];
  let last = 0;
  FX_RE.lastIndex = 0;
  for (let m = FX_RE.exec(text); m; m = FX_RE.exec(text)) {
    out.push(...inline(text.slice(last, m.index), {}));
    out.push(...inline(m[2], { fx: m[1] as Effect }));
    last = m.index + m[0].length;
  }
  out.push(...inline(text.slice(last), {}));
  return out.filter((r) => r.text.length > 0);
}

export const hasRich = (text: string) =>
  /\[fx:|\*\*|__|~~|(?<![\p{L}\p{N}])[_*]\S/u.test(text);
export const plainOf = (text: string) =>
  parseRich(text)
    .map((r) => r.text)
    .join("");
