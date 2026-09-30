import { call } from './api';

// Days (2026-09-30 redesign): her timetable, his agenda (家教 and the like), checklist reminders with a
// time, countdowns and anniversaries (纪念日 / 第一次 / 锚点). Dates are Beijing YYYY-MM-DD.

export type ClassItem = { id: string; name: string; start_time: string; end_time: string; location: string; canceled: boolean };
export type AgendaItem = { id: string; title: string; date: string; start: string; end: string; weekly: boolean; until: string; note: string; author: string };
export type Reminder = { id: number; title: string; time: string; done: boolean; created_by: string };
export type Countdown = { id: string; title: string; target: string; has_time: number; author: string };
export type Anniversary = { id: string; date: string; title: string; kind: string; author: string };
export type Period = { id: string; start: string; end: string | null };
export type Month = {
  schedule: Record<string, ClassItem[]>;
  agenda: Record<string, AgendaItem[]>;
  reminders: Record<string, Reminder[]>;
  holidays: Record<string, string>;
  countdowns: Countdown[];
  anniversaries: Anniversary[];
  periods: Period[];
  today: string;
};

export const month = (y: number, m: number) => call(`/api/days/month?y=${y}&m=${m}`) as Promise<Month>;

const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export type AgendaInput = { title: string; date: string; start?: string; end?: string; weekly?: boolean; until?: string; note?: string };
export const agendaAdd = (a: AgendaInput) => call('/api/days/agenda', json('POST', { ...a, author: '挞挞' }));
export const agendaEdit = (id: string, a: Partial<AgendaInput>) => call(`/api/days/agenda/${id}`, json('PUT', a));
export const agendaDelete = (id: string) => call(`/api/days/agenda/${id}`, { method: 'DELETE' });

export const countdownAdd = (title: string, target: string, has_time: boolean) => call('/api/days/countdowns', json('POST', { title, target, has_time, author: '挞挞' }));
export const countdownEdit = (id: string, c: { title?: string; target?: string; has_time?: boolean }) => call(`/api/days/countdowns/${id}`, json('PUT', c));
export const countdownDelete = (id: string) => call(`/api/days/countdowns/${id}`, { method: 'DELETE' });

// Anniversaries are rows of the events table; kind is 纪念日 / 第一次 / 锚点.
export const annivAdd = (date: string, title: string, kind: string) => call('/api/events', json('POST', { date, type: kind, one_line: title, author: '挞挞' }));
export const annivEdit = (id: string, a: { date?: string; title?: string; kind?: string }) =>
  call(`/api/events/${id}`, json('PUT', { date: a.date, type: a.kind, one_line: a.title }));
export const annivDelete = (id: string) => call(`/api/days/anniversaries/${id}`, { method: 'DELETE' });

/* ── dates ── */
export const pad = (n: number) => String(n).padStart(2, '0');
export const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
// Dates are handled as UTC midnights so the phone's own time zone never shifts a day.
export const d8 = (k: string) => new Date(`${k}T00:00:00Z`);
export const addDays = (k: string, n: number) => key(new Date(d8(k).getTime() + n * 86400_000));
export const diff = (a: string, b: string) => Math.round((d8(b).getTime() - d8(a).getTime()) / 86400_000);
export const bjToday = () => key(new Date(Date.now() + 8 * 3600_000));
export const bjMinutes = () => {
  const n = new Date(Date.now() + 8 * 3600_000);
  return n.getUTCHours() * 60 + n.getUTCMinutes();
};
export const TOGETHER = '2026-07-25';
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const ordinal = (n: number) =>
  n % 10 === 1 && n % 100 !== 11 ? `${n}st` : n % 10 === 2 && n % 100 !== 12 ? `${n}nd` : n % 10 === 3 && n % 100 !== 13 ? `${n}rd` : `${n}th`;
