import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'nid.token';

export const loadToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const saveToken = (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export type Prefs = {
  bubble: string; // hex, or 'glass'
  wallpaper: string | null; // file name inside Documents/wallpaper
  model: string;
  effort: 'Low' | 'Medium' | 'High' | 'Max';
  name: string;
};

export const DEFAULT_PREFS: Prefs = {
  bubble: '#1982fc',
  wallpaper: null,
  model: 'claude-opus-5-5',
  effort: 'High',
  name: 'Antoine',
};

const prefsFile = () => new File(Paths.document, 'prefs.json');

export async function loadPrefs(): Promise<Prefs> {
  try {
    const f = prefsFile();
    if (!f.exists) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(await f.text()) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: Prefs) {
  try {
    prefsFile().write(JSON.stringify(p));
  } catch {}
}

const wallDir = () => new Directory(Paths.document, 'wallpaper');

// The container path changes across installs, so prefs keep only the file name.
export function wallpaperUri(name: string | null): string | null {
  if (!name) return null;
  const f = new File(wallDir(), name);
  return f.exists ? f.uri : null;
}

// Copy a picked photo into our own folder so it survives the picker's cache cleanup.
export async function keepWallpaper(uri: string): Promise<string> {
  const dir = wallDir();
  dir.create({ intermediates: true, idempotent: true });
  for (const f of dir.list()) f.delete();
  const src = new File(uri);
  const name = `bg-${Date.now()}${src.extension || '.jpg'}`;
  await src.copy(new File(dir, name));
  return name;
}

export function dropWallpaper() {
  const dir = wallDir();
  if (dir.exists) for (const f of dir.list()) f.delete();
}
