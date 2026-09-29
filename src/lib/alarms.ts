import { File, Paths } from 'expo-file-system';

import { NidAlarm } from '../../modules/nid-alarm';

export type AlarmRecord = { at: number; title: string; cancelled?: boolean };
const file = () => new File(Paths.document, 'alarms.json');
let book: Record<string, AlarmRecord> | null = null;
function load(): Record<string, AlarmRecord> {
  if (book) return book;
  try {
    const f = file();
    book = f.exists ? (JSON.parse(f.textSync()) as Record<string, AlarmRecord>) : {};
  } catch {
    book = {};
  }
  return book;
}
function save() {
  try {
    file().write(JSON.stringify(book ?? {}));
  } catch {
    // losing the record only means the card can't tell "set" from "not set"
  }
}

// A stable UUID per message + marker, so re-rendering or reinstalling never sets it twice.
export function alarmId(key: string): string {
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (const ch of key) {
    h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ ch.charCodeAt(0), 2246822519) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`.toUpperCase();
}

// "07:30" means the next 07:30 after the message was sent; a date pins it.
export function alarmTime(sentAt: string, time: string, date?: string): number {
  const [h, m] = time.split(':').map(Number);
  if (date) {
    const [y, mo, d] = date.split('-').map(Number);
    return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
  }
  const sent = new Date(sentAt);
  const t = new Date(sent);
  t.setHours(h, m, 0, 0);
  if (t.getTime() <= sent.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime();
}

export const alarmsAvailable = () => !!NidAlarm;
export const alarmRecord = (id: string) => load()[id];

export async function ensureAlarm(id: string, at: number, title: string): Promise<'set' | 'past' | 'denied' | 'unsupported' | 'cancelled'> {
  const rec = load()[id];
  if (rec?.cancelled) return 'cancelled';
  if (at <= Date.now()) return 'past';
  if (rec) return 'set';
  if (!NidAlarm) return 'unsupported';
  const auth = await NidAlarm.authorize();
  if (auth !== 'authorized') return 'denied';
  await NidAlarm.schedule(id, at, title || 'Antoine');
  load()[id] = { at, title };
  save();
  return 'set';
}
