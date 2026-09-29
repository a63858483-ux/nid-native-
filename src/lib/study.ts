import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

import { authHeaders, call } from './api';
import { API_BASE } from './config';

// Study room: books (the shelf), essays (Paper) and her pomodoro. Essays live in the same
// books table as kind 'essay', so highlights and notes use the books annotation endpoints.

export type Who = 'xiaoke' | 'ta';

export type Book = {
  id: number;
  title: string;
  author: string | null;
  kind: string;
  cover_color: string | null;
  cover_url: string | null;
  file_url: string | null;
  file_ext: string | null;
  updated_at: number;
  progress: { percent: number; char_offset: number; page_no: number } | null;
  annotation_count: number;
};

export type Essay = {
  id: number;
  title: string;
  author: Who;
  kind: string;
  created_at: number;
  updated_at: number;
  cover_color: string | null;
  chars: number;
  excerpt: string;
  reply_count: number;
  mark_count: number;
};

export type Note = {
  id: number;
  book_id: number;
  page_no: number | null;
  quote: string;
  text: string | null;
  author: Who;
  reply_to_id: number | null;
  created_at: number;
  cfi: string | null;
  color: string | null;
};

export type EssayFull = Essay & { content: string; replies: Note[]; marks: Note[] };

export type Pomo = { id: number; started_at: string; hm: string; minutes: number; task: string; completed: boolean };
export type Active = { minutes: number; task: string; started: number; ends_at: number; remaining: number } | null;
export type Day = { date: string; count: number; minutes: number; stopped: number };

const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const books = async () => ((await call('/api/books?kind=book,booknote')) as { items: Book[] }).items;
export const deleteBook = (id: number) => call(`/api/books/${id}`, { method: 'DELETE' });
export const setProgress = (id: number, percent: number, page?: number) =>
  call(`/api/books/${id}/progress`, json('POST', { percent: Math.max(0, Math.min(100, percent)), char_offset: page }));

// Reader URL of a book: the file she uploaded, or an epub the server builds from the text.
export const bookFileUrl = (b: Pick<Book, 'id' | 'file_url'>) => API_BASE + (b.file_url || `/api/books/${b.id}/epub`);
export const coverUrl = (b: Pick<Book, 'cover_url'>) => (b.cover_url ? API_BASE + b.cover_url : null);

export const notes = async (bookId: number) => ((await call(`/api/books/${bookId}/annotations`)) as { items: Note[] }).items;
export const editNote = (bookId: number, id: number, text: string) => call(`/api/books/${bookId}/annotations/${id}`, json('PATCH', { text })) as Promise<Note>;
export const deleteNote = (bookId: number, id: number) => call(`/api/books/${bookId}/annotations/${id}`, { method: 'DELETE' });
export const addNote = (bookId: number, n: { quote: string; text?: string | null; page_no?: number; cfi?: string; color?: string; reply_to_id?: number }) =>
  call(`/api/books/${bookId}/annotations`, json('POST', n)) as Promise<Note>;

export const essays = async () => ((await call('/api/essays')) as { items: Essay[] }).items;
export const essay = (id: number) => call(`/api/essays/${id}`) as Promise<EssayFull>;
export const writeEssay = (title: string, content: string) => call('/api/essays', json('POST', { title, content })) as Promise<Essay>;
export const updateEssay = (id: number, title: string, content: string) => call(`/api/essays/${id}`, json('PUT', { title, content })) as Promise<Essay>;
export const deleteEssay = (id: number) => call(`/api/essays/${id}`, { method: 'DELETE' });
export const replyEssay = (id: number, text: string, replyTo?: number | null) =>
  call(`/api/essays/${id}/replies`, json('POST', { text, reply_to_id: replyTo ?? null })) as Promise<Note>;

export const pomoToday = () => call('/api/pomodoro/today') as Promise<{ date: string; items: Pomo[]; count: number; total_minutes: number }>;
export const pomoWeek = async () => ((await call('/api/pomodoro/week')) as { days: Day[] }).days;
export const pomoActive = async () => ((await call('/api/pomodoro/active')) as { active: Active }).active;
export const pomoStart = async (minutes: number, task: string) => ((await call('/api/pomodoro/start', json('POST', { minutes, task }))) as { active: Active }).active;
export const pomoStop = (completed: boolean) => call('/api/pomodoro/stop', json('POST', { completed }));
export const pomoDelete = (id: number) => call(`/api/pomodoro/${id}`, { method: 'DELETE' });

// Upload a book file: epub and pdf go up as a file, txt as text.
export async function uploadBook(file: { uri: string; name: string; mime: string }): Promise<{ id: number; title: string }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.txt')) {
    const text = await new File(file.uri).text();
    return call('/api/books/upload', json('POST', { title: file.name.replace(/\.txt$/i, ''), content: text }));
  }
  // The global fetch here is expo/fetch, which can't send RN-style { uri } form parts; the native uploader can.
  const res = await FileSystem.uploadAsync(`${API_BASE}/api/books/upload-file`, file.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: file.mime,
    headers: authHeaders(),
  });
  const body = (() => {
    try {
      return JSON.parse(res.body);
    } catch {
      return {};
    }
  })();
  if (res.status < 200 || res.status >= 300) throw new Error(body.detail || `upload ${res.status}`);
  return body;
}

// Beijing date parts for covers and meta lines.
export function bjDate(ms: number) {
  const d = new Date(ms + 8 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    dots: `${d.getUTCFullYear()} · ${p(d.getUTCMonth() + 1)} · ${p(d.getUTCDate())}`,
    hm: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}
