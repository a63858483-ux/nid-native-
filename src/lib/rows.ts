import type { Attachment, Inside } from './api';
import { parseReply, parseStick, parseTapback, resolveRef, type Stick } from './markers';
import { emojiOnly, parseMessage, splitBubbles, type Media } from './text';
import { collapseSteps } from './traces';
import type { Item } from '@/state/chat';

type Thought = { label: string; live: boolean; icon?: string };
export type Quote = { targetKey: string; text: string; role: 'user' | 'assistant' };
export type TapbackView = { emoji: string; mine: boolean };
export type Decor = { tapbacks: TapbackView[]; sticks: Stick[]; replies: number };

export type Row =
  | { type: 'divider'; key: string; label: string }
  | {
      type: 'bubble';
      key: string;
      itemKey: string;
      role: 'user' | 'assistant';
      text: string;
      big: boolean;
      tail: boolean;
      gapAbove: boolean;
      thought?: Thought;
      receipt?: string;
      fresh?: boolean;
      failed?: string;
      quote?: Quote;
      replies?: number;
      tapbacks?: TapbackView[];
      sticks?: Stick[];
    }
  | { type: 'media'; key: string; itemKey: string; role: 'user' | 'assistant'; att: Attachment; gapAbove: boolean; fresh?: boolean }
  | { type: 'inline'; key: string; itemKey: string; role: 'user' | 'assistant'; media: Media; gapAbove: boolean; fresh?: boolean }
  | { type: 'inside'; key: string; itemKey: string; item: Inside; gapAbove: boolean; fresh?: boolean }
  | { type: 'typing'; key: string; itemKey: string; thought?: Thought };

const HOUR = 3600_000;
// Nid runs on Beijing time whatever the phone's zone says.
const TZ = 'Asia/Shanghai';
const hm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });

export function dayParts(iso: string, now = Date.now()): { day: string; time: string } {
  const d = new Date(iso);
  const time = hm(d);
  const today = ymd(new Date(now));
  if (ymd(d) === today) return { day: 'Today', time };
  if (ymd(d) === ymd(new Date(now - 86400_000))) return { day: 'Yesterday', time };
  if (now - d.getTime() < 6 * 86400_000) return { day: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ }), time };
  const sameYear = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: TZ }) === new Date(now).toLocaleDateString('en-US', { year: 'numeric', timeZone: TZ });
  return { day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: TZ }), time };
}
export function dayLabel(iso: string, now = Date.now()): string {
  const p = dayParts(iso, now);
  return `${p.day} ${p.time}`;
}

function thoughtOf(i: Item): Thought | undefined {
  const steps = collapseSteps(i.traces);
  if (!i.thinking && steps.length === 0) return undefined;
  if (i.status === 'streaming' && !i.text) {
    const cur = steps[steps.length - 1];
    return cur ? { label: cur.label + '…', live: true, icon: cur.icon } : { label: 'Thinking…', live: true };
  }
  return { label: 'Thought process', live: false };
}

export type Segment = { kind: 'text'; text: string } | { kind: 'media'; media: Media };

// A message becomes segments in display order: paragraphs, then inline media/stickers/cards.
export function segmentsOf(it: Item): Segment[] {
  const body = parseReply(it.text)?.rest ?? it.text;
  const { text, media } = parseMessage(body);
  const segs: Segment[] = splitBubbles(text).map((p) => ({ kind: 'text', text: p }));
  for (const m of media) segs.push({ kind: 'media', media: m });
  return segs;
}

// Items (oldest → newest) become display rows, also oldest → newest.
// `reveal` caps how many segments of a fresh reply are shown yet (they arrive one by one).
// Reactions and reply links live in other messages; gather them per target first.
export function decorate(items: Item[]) {
  const decor = new Map<string, Decor>();
  const quotes = new Map<string, Quote>();
  const hidden = new Set<string>();
  const get = (k: string) => {
    let d = decor.get(k);
    if (!d) decor.set(k, (d = { tapbacks: [], sticks: [], replies: 0 }));
    return d;
  };
  items.forEach((it, idx) => {
    const tb = parseTapback(it.text);
    if (tb) {
      hidden.add(it.key);
      const t = resolveRef(tb.ref, items, idx);
      if (!t) return;
      const d = get(t.key);
      const mine = it.role === 'user';
      d.tapbacks = d.tapbacks.filter((x) => !(x.mine === mine && x.emoji === tb.emoji));
      if (!tb.off) d.tapbacks.push({ emoji: tb.emoji, mine });
      return;
    }
    const st = parseStick(it.text);
    if (st) {
      hidden.add(it.key);
      const t = resolveRef(st.ref, items, idx);
      if (t) get(t.key).sticks.push(st);
      return;
    }
    const rp = parseReply(it.text);
    if (rp) {
      const t = resolveRef(rp.ref, items, idx);
      if (t) {
        get(t.key).replies += 1;
        quotes.set(it.key, { targetKey: t.key, text: parseMessage(parseReply(t.text)?.rest ?? t.text).text.slice(0, 80) || '…', role: t.role });
      }
    }
  });
  return { decor, quotes, hidden };
}

// Everything in one reply thread: the original plus the messages replying to it.
export function threadOf(items: Item[], targetKey: string): Item[] {
  const root = items.find((i) => i.key === targetKey);
  if (!root) return [];
  const out = [root];
  items.forEach((it, idx) => {
    const rp = parseReply(it.text);
    if (rp && resolveRef(rp.ref, items, idx)?.key === targetKey) out.push(it);
  });
  return out;
}

export function buildRows(items: Item[], now = Date.now(), reveal: Record<string, number> = {}): Row[] {
  const rows: Row[] = [];
  let prevTs = 0;
  let prevRole: string | null = null;
  const { decor, quotes, hidden } = decorate(items);

  const lastUser = [...items].reverse().find((i) => i.role === 'user');
  const replyAfter = lastUser ? items[items.indexOf(lastUser) + 1] : undefined;

  items.forEach((it) => {
    if (hidden.has(it.key)) return;
    const t = new Date(it.ts).getTime();
    if (!prevTs || t - prevTs > HOUR) {
      rows.push({ type: 'divider', key: `d-${it.key}`, label: dayLabel(it.ts, now) });
      prevRole = null;
    }
    prevTs = t;

    if (it.role === 'assistant' && it.origin === 'wake') {
      for (const ins of it.inside ?? []) {
        rows.push({ type: 'inside', key: `${it.key}-i-${ins.text.slice(0, 12)}`, itemKey: it.key, item: ins, gapAbove: prevRole !== it.role, fresh: it.fresh });
        prevRole = it.role;
      }
    }
    for (const att of it.attachments ?? []) {
      rows.push({ type: 'media', key: `${it.key}-a-${att.path}`, itemKey: it.key, role: it.role, att, gapAbove: prevRole !== it.role, fresh: it.fresh });
      prevRole = it.role;
    }

    const segs = segmentsOf(it);
    const streaming = it.role === 'assistant' && it.status === 'streaming';
    const paced = it.role === 'assistant' && it.fresh;
    const shown = paced ? Math.min(segs.length, reveal[it.key] ?? 0) : segs.length;
    const thought = thoughtOf(it);

    segs.slice(0, shown).forEach((seg, idx) => {
      const gapAbove = prevRole !== it.role;
      if (seg.kind === 'media') {
        rows.push({ type: 'inline', key: `${it.key}-m-${idx}`, itemKey: it.key, role: it.role, media: seg.media, gapAbove, fresh: it.fresh });
      } else {
        rows.push({
          type: 'bubble',
          key: `${it.key}-${idx}`,
          itemKey: it.key,
          role: it.role,
          text: seg.text,
          big: emojiOnly(seg.text),
          tail: true,
          gapAbove,
          thought: idx === 0 ? thought : undefined,
          fresh: it.fresh,
          failed: idx === segs.length - 1 ? it.error : undefined,
          quote: idx === 0 ? quotes.get(it.key) : undefined,
          replies: idx === segs.length - 1 ? decor.get(it.key)?.replies || undefined : undefined,
          tapbacks: idx === segs.length - 1 ? decor.get(it.key)?.tapbacks : undefined,
          sticks: idx === segs.length - 1 ? decor.get(it.key)?.sticks : undefined,
        });
      }
      prevRole = it.role;
    });

    if (it.role === 'assistant' && (streaming || shown < segs.length)) {
      rows.push({ type: 'typing', key: `t-${it.key}`, itemKey: it.key, thought: shown === 0 ? thought : undefined });
      prevRole = 'assistant';
    }
  });

  // Messages: only the last bubble of a run keeps its tail.
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (a.type !== 'bubble') continue;
    const bRole = b.type === 'typing' ? 'assistant' : b.type === 'divider' ? null : b.type === 'inside' ? 'assistant' : b.role;
    if (bRole === a.role) a.tail = false;
  }

  if (lastUser) {
    const last = [...rows].reverse().find((r) => r.type === 'bubble' && r.itemKey === lastUser.key);
    if (last && last.type === 'bubble') {
      last.receipt = lastUser.status === 'sending' ? 'Delivered' : replyAfter ? `Read ${hm(new Date(replyAfter.ts))}` : 'Delivered';
    }
  }
  return rows;
}
