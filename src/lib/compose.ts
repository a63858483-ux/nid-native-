import type { Effect } from "./rich";

// The composer keeps plain text plus styled ranges, so formatting shows in the field
// itself; it only becomes **markup** / [fx:…] when the message is sent.
export type Format = "bold" | "italic" | "underline" | "strike";
export type Kind = Format | Effect;
export type Span = { start: number; end: number; kind: Kind };

const FORMATS: Format[] = ["bold", "italic", "underline", "strike"];
export const isFormat = (k: Kind): k is Format =>
  (FORMATS as string[]).includes(k);

// Carry ranges through an edit: find what changed by common prefix/suffix and shift.
export function shiftSpans(
  spans: Span[],
  before: string,
  after: string,
): Span[] {
  if (!spans.length) return spans;
  let p = 0;
  const max = Math.min(before.length, after.length);
  while (p < max && before[p] === after[p]) p++;
  let s = 0;
  while (
    s < max - p &&
    before[before.length - 1 - s] === after[after.length - 1 - s]
  )
    s++;
  const cutEnd = before.length - s;
  const delta = after.length - before.length;
  const map = (pos: number) =>
    pos <= p ? pos : pos >= cutEnd ? pos + delta : p;
  return spans
    .map((sp) => ({ ...sp, start: map(sp.start), end: map(sp.end) }))
    .filter((sp) => sp.end > sp.start);
}

// Apply a format/effect to [a, b); the same one again on the same range takes it off.
// A range carries one effect at a time.
export function toggleSpan(
  spans: Span[],
  a: number,
  b: number,
  kind: Kind,
): Span[] {
  if (b <= a) return spans;
  const same = spans.find(
    (sp) => sp.kind === kind && sp.start <= a && sp.end >= b,
  );
  if (same) {
    const rest = spans.filter((sp) => sp !== same);
    if (same.start < a) rest.push({ ...same, end: a });
    if (same.end > b) rest.push({ ...same, start: b });
    return rest;
  }
  let out = spans;
  if (!isFormat(kind)) {
    out = [];
    for (const sp of spans) {
      if (isFormat(sp.kind) || sp.end <= a || sp.start >= b) out.push(sp);
      else {
        if (sp.start < a) out.push({ ...sp, end: a });
        if (sp.end > b) out.push({ ...sp, start: b });
      }
    }
  }
  return [...out, { start: a, end: b, kind }];
}

// Cut the text wherever a range starts or ends; each piece knows what applies to it.
export function piecesOf(
  text: string,
  spans: Span[],
): { text: string; kinds: Kind[] }[] {
  const cuts = new Set([0, text.length]);
  for (const sp of spans) {
    cuts.add(Math.max(0, Math.min(text.length, sp.start)));
    cuts.add(Math.max(0, Math.min(text.length, sp.end)));
  }
  const at = [...cuts].sort((x, y) => x - y);
  const out: { text: string; kinds: Kind[] }[] = [];
  for (let i = 0; i < at.length - 1; i++) {
    const [a, b] = [at[i], at[i + 1]];
    if (b <= a) continue;
    out.push({
      text: text.slice(a, b),
      kinds: spans
        .filter((sp) => sp.start <= a && sp.end >= b)
        .map((sp) => sp.kind),
    });
  }
  return out;
}

const FENCE = { bold: "**", underline: "__", strike: "~~" };

export function serialize(text: string, spans: Span[]): string {
  if (!spans.length) return text;
  return piecesOf(text, spans)
    .map(({ text: t, kinds }) => {
      if (!kinds.length) return t;
      // fences can't cross a line break, so wrap each line on its own
      return t
        .split("\n")
        .map((line) => {
          const core = line.trim();
          if (!core) return line;
          const lead = line.slice(0, line.indexOf(core));
          const tail = line.slice(lead.length + core.length);
          // italic innermost; `_` next to `__` would be ambiguous, so it becomes `*` there
          let w = core;
          if (kinds.includes("italic"))
            w =
              kinds.includes("underline") && !kinds.includes("bold")
                ? `*${w}*`
                : `_${w}_`;
          for (const f of ["bold", "underline", "strike"] as const)
            if (kinds.includes(f)) w = FENCE[f] + w + FENCE[f];
          const fx = kinds.find((k) => !isFormat(k));
          if (fx) w = `[fx:${fx}]${w}[/fx]`;
          return lead + w + tail;
        })
        .join("\n");
    })
    .join("");
}
