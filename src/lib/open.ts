import { Directory, File, Paths } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import { Share } from 'react-native';

import { authHeaders } from './api';
import { API_BASE } from './config';

const abs = (url: string) => (url.startsWith('http') ? url : API_BASE + url);

// Public files (his /media/…) open in the in-app Safari sheet, which previews PDFs, pages, images and Office docs.
export const openPublic = (url: string) => WebBrowser.openBrowserAsync(abs(url), { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });

// Files behind login are fetched with the token into the cache first.
export async function download(url: string, name: string, auth: boolean): Promise<File> {
  const dir = new Directory(Paths.cache, 'nid-files');
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, name.replace(/[/\\]/g, '_'));
  if (dest.exists) return dest;
  return File.downloadFileAsync(abs(url), dest, auth ? { headers: authHeaders() } : undefined);
}

// The system share sheet: preview, Save to Files / Save Image, send to other apps.
export async function shareFile(url: string, name: string, auth: boolean) {
  const f = await download(url, name, auth);
  await Share.share({ url: f.uri });
}
