import { call } from './api';

/* ── Inner (drive / on-my-mind / facts) — the three tabs opened from his name ── */

export type Thought = { dim: string; body: string; type: string; value: number };
export type DimPoint = { ts: number; v: number };
export type Fact = { id: string; body: string; created_at: string; expires_at: string | null };
export type Dianji = { id: string; body: string; created_at: string; deadline: string | null };
export type Inner = {
  counts: { memory: number; feel: number; portrait: number };
  dims: Record<string, number>;
  dim_labels: Record<string, string>;
  thoughts: Thought[];
  dim_history: DimPoint[];
  sense: string;
  facts: Fact[];
  dianji: Dianji[];
  pairs_pending: number;
};
export const inner = () => call('/api/mind/inner') as Promise<Inner>;
export const dianjiDone = (id: string) => call('/api/mind/dianji/done', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });

/* ── Mind page (memory / feel / portrait) — the rest, off the sidebar ── */

export type FeelBrief = { id?: string; body?: string; mood?: string | null; intensity?: number | null; created_at?: string };
export type MindEntry = {
  id: string;
  kind: string;
  content: string;
  mood: string | null;
  pinned: boolean;
  tier: string;
  intensity: number | null;
  feel: FeelBrief | null;
  event_type: string | null;
  event_date: string | null;
  detail: string | null;
  tags: string[] | null;
  created_at: string;
};
export async function listMind(kind: 'memory' | 'feel', opts: { tier?: string; q?: string; order?: string; max_results?: number } = {}) {
  const params = new URLSearchParams({ kind, tier: opts.tier || 'all', order: opts.order || 'date', max_results: String(opts.max_results || 60) });
  if (opts.q) params.set('q', opts.q);
  return ((await call(`/api/ombre/mind?${params}`)) as { entries: MindEntry[] }).entries;
}

export type Pair = { memory_id: string; memory_body: string; memory_mood: string | null; memory_created_at: string; feel: FeelBrief };
export const pairsPending = () => call('/api/mind/pairs/pending') as Promise<{ pairs: Pair[]; count: number }>;
export const pairConfirm = (memory_id: string) =>
  call('/api/mind/pairs/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memory_id }) });
export const pairUnlink = (memory_id: string) =>
  call('/api/mind/pairs/unlink', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memory_id }) });

export type Portrait = { id: string; subject: string; aspect: string; content: string; created_at: string };
export const PORTRAIT_ORDER = ['性格', '习惯', '身体', '喜好', '物件', '关系', '亲密'];
export const portraits = async () => ((await call('/api/mind/portraits')) as { entries: Portrait[] }).entries;
export const portraitDelete = (id: string) => call(`/api/mind/portraits/${encodeURIComponent(id)}`, { method: 'DELETE' });
