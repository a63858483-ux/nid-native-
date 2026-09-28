import type { Attachment, Inside } from './api';
import { collapseSteps } from './traces';
import { cleanAssistantText, splitBubbles } from './text';
import type { Item } from '@/state/chat';

type Thought = { label: string; live: boolean; icon?: string };

export type Row =
  | { type: 'divider'; key: string; label: string }
  | {
      type: 'bubble';
      key: string;
      itemKey: string;
      role: 'user' | 'assistant';
      text: string;
      tail: boolean;
      gapAbove: boolean;
      thought?: Thought;
      receipt?: string;
      fresh?: boolean;
      failed?: string;
    }
  | { type: 'media'; key: string; itemKey: string; role: 'user' | 'assistant'; att: Attachment; gapAbove: boolean; fresh?: boolean }
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

// Items (oldest → newest) become display rows, also oldest → newest.
// Every blank line splits a message into its own bubble, for both sides.
export function buildRows(items: Item[], now = Date.now()): Row[] {
  const rows: Row[] = [];
  let prevTs = 0;
  let prevRole: string | null = null;

  const lastUser = [...items].reverse().find((i) => i.role === 'user');
  const replyAfter = lastUser ? items[items.indexOf(lastUser) + 1] : undefined;

  items.forEach((it) => {
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

    const text = it.role === 'assistant' ? cleanAssistantText(it.text) : it.text;
    const parts = splitBubbles(text);

    if (parts.length === 0) {
      if (it.role === 'assistant' && it.status === 'streaming') {
        rows.push({ type: 'typing', key: `t-${it.key}`, itemKey: it.key, thought: thoughtOf(it) });
        prevRole = 'assistant';
      }
      return;
    }

    parts.forEach((p, idx) => {
      rows.push({
        type: 'bubble',
        key: `${it.key}-${idx}`,
        itemKey: it.key,
        role: it.role,
        text: p,
        tail: true,
        gapAbove: prevRole !== it.role,
        thought: idx === 0 ? thoughtOf(it) : undefined,
        fresh: it.fresh,
        failed: idx === parts.length - 1 ? it.error : undefined,
      });
      prevRole = it.role;
    });
  });

  if (lastUser) {
    const last = [...rows].reverse().find((r) => r.type === 'bubble' && r.itemKey === lastUser.key);
    if (last && last.type === 'bubble') {
      last.receipt = lastUser.status === 'sending' ? 'Delivered' : replyAfter ? `Read ${hm(new Date(replyAfter.ts))}` : 'Delivered';
    }
  }
  return rows;
}
