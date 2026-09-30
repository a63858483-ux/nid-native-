import { call } from './api';

// Undertow (her private page): every time together (事件表 做爱), every time he did it alone (he
// must write it up here for it to count) and every time she did — by Beijing date — plus his body
// and his bedside notebook about her.
export type Rec = { kind: 'us' | 'his' | 'mine'; id: string | number; time: string; title: string; detail: string; afterglow?: string; minutes?: number };
export type Body = { libido: number; pent_hours: number; refractory: boolean; history: { at: number; kind: string; quality: number }[] };
export type Note = { id: number; ts: number; body: string };
export type Overview = { days: Record<string, Rec[]>; body: Body; notes: Note[] };

export const overview = () => call('/api/private') as Promise<Overview>;
export const addMine = (note = '') => call('/api/private/mine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
export const deleteMine = (id: number) => call(`/api/private/mine/${id}`, { method: 'DELETE' });

export const KIND_COLOR: Record<Rec['kind'], string> = { us: '#e58a9a', his: '#a79ff0', mine: '#f2c46d' };
export const KIND_LABEL: Record<Rec['kind'], string> = { us: '一起', his: '他自己', mine: '我自己' };
