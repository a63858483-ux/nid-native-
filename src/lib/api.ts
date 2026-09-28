import * as FileSystem from 'expo-file-system/legacy';
import { fetch as streamFetch } from 'expo/fetch';

import { API_BASE, MAIN_TITLE } from './config';
import { SseParser } from './sse';

export type Message = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  thinking: string;
  attachments: { path?: string; name?: string; mime?: string }[];
  timestamp: string;
  origin: string | null;
  activity: unknown;
  seg?: number;
  traces?: Trace[];
  inside?: Inside[];
};
export type Trace = { type: string; name?: string; input?: unknown };
export type Inside = { tone?: string; text: string };

export type Session = { conv_id: string; title: string; last_modified: string | number };

export class AuthError extends Error {}

let token: string | null = null;
export const setToken = (t: string | null) => {
  token = t;
};

async function call(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...init, headers });
  if (res.status === 401) throw new AuthError('unauthorized');
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export async function login(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.status === 401) throw new AuthError('Wrong password');
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  return (await res.json()).token;
}

export async function mainConversationId(): Promise<string | null> {
  const { sessions } = (await call('/api/sessions')) as { sessions: Session[] };
  const main = sessions.find((s) => (s.title || '').trim() === MAIN_TITLE) ?? sessions[0];
  return main?.conv_id ?? null;
}

export async function history(convId: string, beforeId?: number, limit = 40) {
  const q = new URLSearchParams({ limit: String(limit), exclude_origin: 'toy' });
  if (beforeId) q.set('before_id', String(beforeId));
  return (await call(`/api/sessions/${encodeURIComponent(convId)}/messages?${q}`)) as {
    messages: Message[];
    has_more: boolean;
  };
}

export async function poll(convId: string, after: number) {
  const q = new URLSearchParams({ conversation_id: convId, after: String(after) });
  return (await call(`/api/messages/poll?${q}`)) as { messages: Message[] };
}

export const isBusy = async () => !!((await call('/api/chat/busy')) as { busy: boolean }).busy;
export const cancel = () => call('/api/chat/cancel', { method: 'POST' }).catch(() => {});

export type ChatBody = {
  message: string;
  conversation_id: string | null;
  model: string;
  effort: string;
  extended?: boolean;
  seg?: number;
  attachments?: string[];
};

export type StreamHandlers = {
  onConversation?: (d: { conversation_id: string; user_message_id?: number }) => void;
  onThinking?: (text: string) => void;
  onDelta?: (text: string) => void;
  onToolUse?: (d: { name: string; input: unknown }) => void;
  onDone?: (d: { assistant_message_id?: number; conversation_id?: string; drop_row?: boolean }) => void;
  onError?: (message: string) => void;
};

// /api/chat answers a plain POST with a chunked body of `event:/data:` frames.
export async function streamChat(body: ChatBody, h: StreamHandlers, signal?: AbortSignal) {
  const res = await streamFetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ extended: true, seg: 1, ...body }),
    signal,
  });
  if (res.status === 401) throw new AuthError('unauthorized');
  if (!res.ok || !res.body) {
    const detail = await res.json().catch(() => ({}) as { detail?: string });
    throw new Error((detail as { detail?: string }).detail || `Send failed (${res.status})`);
  }
  const parser = new SseParser();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let finished = false;
  const dispatch = (events: ReturnType<SseParser['push']>) => {
    for (const { event, data } of events) {
      if (event === 'conversation') h.onConversation?.(data);
      else if (event === 'thinking') h.onThinking?.(data.text ?? '');
      else if (event === 'delta') h.onDelta?.(data.text ?? '');
      else if (event === 'tool_use') h.onToolUse?.({ name: data.name ?? '', input: data.input });
      else if (event === 'done') {
        finished = true;
        h.onDone?.(data);
      } else if (event === 'error') {
        finished = true;
        h.onError?.(data.message ?? 'Something went wrong');
      }
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (value) dispatch(parser.push(decoder.decode(value, { stream: !done })));
    if (done) break;
  }
  dispatch(parser.flush());
  return finished;
}

export type SearchHit = { id: number; conv_id: string; role: 'user' | 'assistant'; text: string; timestamp: string };
export async function search(q: string) {
  const qs = new URLSearchParams({ q, limit: '60' });
  return ((await call(`/api/search/messages?${qs}`)) as { items: SearchHit[] }).items;
}

/* ── checklist ── */
export type ChecklistItem = {
  id: number;
  body: string;
  is_fixed: number;
  done: number;
  done_at: number | null;
  created_by: string;
  trigger_at: number | null;
  created_at: number;
};
export const checklistList = async () => ((await call('/api/checklist')) as { items: ChecklistItem[] }).items;
export const checklistAdd = (body: string, opts: { is_fixed?: boolean; at?: string } = {}) =>
  call('/api/checklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, created_by: 'user', ...opts }) }) as Promise<ChecklistItem>;
export const checklistToggle = (id: number, done: boolean) =>
  call(`/api/checklist/${id}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done }) });
export const checklistDelete = (id: number) => call(`/api/checklist/${id}`, { method: 'DELETE' });

/* ── sidebar: channel / background / quota ── */
export type ChannelState = { channel: 'max' | 'api'; model: string; models: { id: string; label: string }[] };
export const channelGet = () => call('/api/channel') as Promise<ChannelState>;
export const channelSet = (channel: 'max' | 'api', model?: string) =>
  call('/api/channel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, model }) }) as Promise<ChannelState>;
export const backgroundGet = async () => !!((await call('/api/background')) as { enabled: boolean }).enabled;
export const backgroundSet = (enabled: boolean) =>
  call('/api/background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
export type QuotaLimit = { kind: string; label: string; percent: number | null; resets_at: string | null };
export const quotaGet = () => call('/api/quota') as Promise<{ limits: QuotaLimit[]; error?: string }>;

/* ── uploads ── */
export type Attachment = { name: string; path: string; mime?: string; size?: number; is_image?: boolean };
export async function upload(convId: string | null, files: { uri: string; name: string; mime: string }[]) {
  const attachments: Attachment[] = [];
  let conversation_id = convId ?? '';
  for (const f of files) {
    const res = await FileSystem.uploadAsync(`${API_BASE}/api/upload`, f.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'files',
      mimeType: f.mime,
      parameters: conversation_id ? { conversation_id } : {},
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) throw new AuthError('unauthorized');
    if (res.status < 200 || res.status >= 300) throw new Error(`upload ${res.status}: ${res.body.slice(0, 120)}`);
    const data = JSON.parse(res.body) as { conversation_id: string; attachments: Attachment[] };
    conversation_id = data.conversation_id;
    attachments.push(...data.attachments);
  }
  return { conversation_id, attachments };
}
// Uploaded files are served per conversation; the server stores the absolute path.
export function attachmentUrl(convId: string, a: Attachment) {
  const file = a.path.split('/').pop() ?? '';
  return `${API_BASE}/api/uploads/${encodeURIComponent(convId)}/${encodeURIComponent(file)}`;
}
export const authHeaders = () => ({ Authorization: `Bearer ${token}` });
