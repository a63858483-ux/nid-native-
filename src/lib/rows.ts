import type { Attachment } from './api';
import { cleanAssistantText, splitBubbles } from './text';
import type { Item } from '@/state/chat';

type Thought = { label: string; live: boolean };

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
  | { type: 'typing'; key: string; itemKey: string; thought?: Thought };

const HOUR = 3600_000;
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return `Today ${hm(d)}`;
  if (same(d, yest)) return `Yesterday ${hm(d)}`;
  if (Date.now() - d.getTime() < 6 * 86400_000) return `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${hm(d)}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${hm(d)}`;
}

function thoughtOf(i: Item): Thought | undefined {
  if (!i.thinking) return undefined;
  if (i.status === 'streaming' && !i.text) return { label: 'Thinking…', live: true };
  if (i.thinkMs) return { label: `Thought for ${Math.max(1, Math.round(i.thinkMs / 1000))}s`, live: false };
  return { label: 'Thought process', live: false };
}

// Items (oldest → newest) become display rows, also oldest → newest.
// Every blank line splits a message into its own bubble, for both sides.
export function buildRows(items: Item[]): Row[] {
  const rows: Row[] = [];
  let prevTs = 0;
  let prevRole: string | null = null;

  const lastUser = [...items].reverse().find((i) => i.role === 'user');
  const replyAfter = lastUser ? items[items.indexOf(lastUser) + 1] : undefined;

  items.forEach((it) => {
    const t = new Date(it.ts).getTime();
    if (!prevTs || t - prevTs > HOUR) {
      rows.push({ type: 'divider', key: `d-${it.key}`, label: dayLabel(it.ts) });
      prevRole = null;
    }
    prevTs = t;

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
