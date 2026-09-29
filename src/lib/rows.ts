import type { Attachment, Inside } from './api';
import { parseReply, parseStick, parseTapback, resolveRef, type Stick } from './markers';
import { plainOf } from './rich';
import { emojiOnly, parseMessage, splitBubbles, type Media } from './text';
import { collapseSteps } from './traces';
import type { Item } from '@/state/chat';

type Thought = { label: string; live: boolean; icon?: string };
export type Quote = { targetKey: string; seg: number; text: string; role: 'user' | 'assistant' };
export type TapbackView = { emoji: string; mine: boolean };
export type Decor = { tapbacks: TapbackView[]; sticks: Stick[]; replies: number };

export type Row =
  | { type: 'divider'; key: string; label: string }
  | {
      type: 'bubble';
      key: string;
      itemKey: string;
      seg: number;
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
  | {
      type: 'voice';
      key: string;
      itemKey: string;
      role: 'user' | 'assistant';
      url?: string;
      ttsText?: string;
      transcript: string;
      dur?: number;
      gapAbove: boolean;
      fresh?: boolean;
      tail: boolean;
      receipt?: string;
    }
  | { type: 'link'; key: string; itemKey: string; role: 'user' | 'assistant'; url: string; gapAbove: boolean; fresh?: boolean; tail: boolean }
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

const URL_RE = /https?:\/\/[^\s<>"'`，。！？、）】)\]]+/;
const firstUrl = (t: string) => URL_RE.exec(t)?.[0]?.replace(/[.,;:!?]+$/, '') ?? null;

export type Segment = { kind: 'text'; text: string } | { kind: 'media'; media: Media };

const flat = (t: string) => t.replace(/\s+/g, '').replace(/"/g, '”');
// Which text segment a quoted snippet points at; the last text one when it can't tell.
export function segIndex(segs: Segment[], quote?: string): number {
  let last = 0;
  segs.forEach((s, i) => {
    if (s.kind === 'text') last = i;
  });
  if (!quote) return last;
  const q = flat(quote);
  const hit = segs.findIndex((s) => s.kind === 'text' && flat(s.text).includes(q));
  return hit >= 0 ? hit : last;
}

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
  // Reactions land on the one bubble (paragraph) the quoted words come from.
  const at = (t: Item, quote?: string) => {
    const segs = segmentsOf(t);
    const i = segIndex(segs, quote);
    return { key: `${t.key}:${i}`, seg: i, text: segs[i]?.kind === 'text' ? segs[i].text : '' };
  };
  items.forEach((it, idx) => {
    const tb = parseTapback(it.text);
    if (tb) {
      hidden.add(it.key);
      const t = resolveRef(tb.ref, items, idx);
      if (!t) return;
      const d = get(at(t, tb.ref.quote).key);
      const mine = it.role === 'user';
      d.tapbacks = d.tapbacks.filter((x) => !(x.mine === mine && x.emoji === tb.emoji));
      if (!tb.off) d.tapbacks.push({ emoji: tb.emoji, mine });
      return;
    }
    const st = parseStick(it.text);
    if (st) {
      hidden.add(it.key);
      const t = resolveRef(st.ref, items, idx);
      if (t) get(at(t, st.ref.quote).key).sticks.push(st);
      return;
    }
    const rp = parseReply(it.text);
    if (rp) {
      const t = resolveRef(rp.ref, items, idx);
      if (t) {
        const seg = at(t, rp.ref.quote);
        get(seg.key).replies += 1;
        quotes.set(it.key, { targetKey: t.key, seg: seg.seg, text: plainOf(seg.text).slice(0, 80) || '…', role: t.role });
      }
    }
  });
  return { decor, quotes, hidden };
}

// Everything in one reply thread: the original bubble plus the messages replying to it.
export function threadOf(items: Item[], targetKey: string, seg?: number): Item[] {
  const root = items.find((i) => i.key === targetKey);
  if (!root) return [];
  const segs = segmentsOf(root);
  const out = [root];
  items.forEach((it, idx) => {
    const rp = parseReply(it.text);
    if (!rp || resolveRef(rp.ref, items, idx)?.key !== targetKey) return;
    if (seg === undefined || segIndex(segs, rp.ref.quote) === seg) out.push(it);
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
    // Her recording: the message text is its transcript, so no text bubble for it.
    const voiceAtt = (it.attachments ?? []).find((a) => a.type === 'voice' && a.url);
    for (const att of it.attachments ?? []) {
      if (att === voiceAtt) {
        rows.push({
          type: 'voice',
          key: `${it.key}-v`,
          itemKey: it.key,
          role: it.role,
          url: att.url,
          transcript: plainOf(parseMessage(it.text).text),
          dur: att.dur,
          gapAbove: prevRole !== it.role,
          fresh: it.fresh,
          tail: true,
        });
      } else if (att.path) {
        rows.push({ type: 'media', key: `${it.key}-a-${att.path}`, itemKey: it.key, role: it.role, att, gapAbove: prevRole !== it.role, fresh: it.fresh });
      }
      prevRole = it.role;
    }

    const segs = voiceAtt ? [] : segmentsOf(it);
    const streaming = it.role === 'assistant' && it.status === 'streaming';
    const paced = it.role === 'assistant' && it.fresh;
    const shown = paced ? Math.min(segs.length, reveal[it.key] ?? 0) : segs.length;
    const thought = thoughtOf(it);

    segs.slice(0, shown).forEach((seg, idx) => {
      const gapAbove = prevRole !== it.role;
      if (seg.kind === 'media' && seg.media.kind === 'voice') {
        rows.push({
          type: 'voice',
          key: `${it.key}-m-${idx}`,
          itemKey: it.key,
          role: it.role,
          ttsText: seg.media.text,
          transcript: seg.media.text,
          gapAbove,
          fresh: it.fresh,
          tail: true,
        });
      } else if (seg.kind === 'media') {
        rows.push({ type: 'inline', key: `${it.key}-m-${idx}`, itemKey: it.key, role: it.role, media: seg.media, gapAbove, fresh: it.fresh });
      } else {
        rows.push({
          type: 'bubble',
          key: `${it.key}-${idx}`,
          itemKey: it.key,
          seg: idx,
          role: it.role,
          text: seg.text,
          big: emojiOnly(plainOf(seg.text)),
          tail: true,
          gapAbove,
          thought: idx === 0 ? thought : undefined,
          fresh: it.fresh,
          failed: idx === segs.length - 1 ? it.error : undefined,
          quote: idx === 0 ? quotes.get(it.key) : undefined,
          replies: decor.get(`${it.key}:${idx}`)?.replies || undefined,
          tapbacks: decor.get(`${it.key}:${idx}`)?.tapbacks,
          sticks: decor.get(`${it.key}:${idx}`)?.sticks,
        });
        // A link gets a preview card under its bubble; a bubble that is only the link gives way to the card.
        const url = firstUrl(seg.text);
        if (url && !streaming) {
          const d = decor.get(`${it.key}:${idx}`);
          const bare = plainOf(seg.text).trim() === url && !d?.tapbacks?.length && !d?.sticks?.length && !d?.replies && !(idx === 0 && quotes.get(it.key));
          if (bare) rows.pop();
          rows.push({ type: 'link', key: `${it.key}-l-${idx}`, itemKey: it.key, role: it.role, url, gapAbove: bare ? gapAbove : false, fresh: it.fresh, tail: true });
        }
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
    if (a.type !== 'bubble' && a.type !== 'voice' && a.type !== 'link') continue;
    const bRole = b.type === 'typing' ? 'assistant' : b.type === 'divider' ? null : b.type === 'inside' ? 'assistant' : b.role;
    if (bRole === a.role) a.tail = false;
  }

  if (lastUser) {
    const last = [...rows].reverse().find((r) => (r.type === 'bubble' || r.type === 'voice') && r.itemKey === lastUser.key);
    if (last && (last.type === 'bubble' || last.type === 'voice')) {
      last.receipt = lastUser.status === 'sending' ? 'Delivered' : replyAfter ? `Read ${hm(new Date(replyAfter.ts))}` : 'Delivered';
    }
  }
  return rows;
}
