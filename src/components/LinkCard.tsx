import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { call } from '@/lib/api';
import { usePalette } from '@/lib/colors';
import { openPublic } from '@/lib/open';

type Preview = { url: string; title: string; description: string; image: string; site: string };
const cache = new Map<string, Preview>();
const inflight = new Map<string, Promise<Preview>>();
function preview(url: string): Promise<Preview> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(url);
  if (!p) {
    p = (call(`/api/unfurl?url=${encodeURIComponent(url)}`) as Promise<Preview>)
      .then((d) => {
        cache.set(url, d);
        return d;
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}
const hostOf = (url: string) =>
  url
    .replace(/^https?:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/^www\./, '');

// A link's preview: the page's picture on top, its title and site underneath; tap to open it in-app.
export function LinkCard({ url, mine, tail }: { url: string; mine: boolean; tail: boolean }) {
  const pal = usePalette();
  const [d, setD] = useState<Preview | null>(() => cache.get(url) ?? null);
  useEffect(() => {
    if (d) return;
    let live = true;
    preview(url)
      .then((p) => live && setD(p))
      .catch(() => live && setD({ url, title: '', description: '', image: '', site: hostOf(url) }));
    return () => {
      live = false;
    };
  }, [url, d]);
  const title = d?.title || hostOf(url);
  return (
    <Pressable
      onPress={() => openPublic(url)}
      style={({ pressed }) => [
        styles.card,
        mine ? styles.mine : styles.his,
        { backgroundColor: pal.hisFill, borderBottomLeftRadius: !mine && tail ? 6 : 18, borderBottomRightRadius: mine && tail ? 6 : 18 },
        pressed && { opacity: 0.8 },
      ]}>
      {d?.image ? <Image source={d.image} style={styles.img} contentFit="cover" transition={160} /> : null}
      <View style={styles.body}>
        <Text numberOfLines={2} style={[styles.title, { color: pal.hisInk }]}>
          {d ? title : ' '}
        </Text>
        <Text numberOfLines={1} style={[styles.site, { color: pal.meta }]}>
          {hostOf(url)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 264, maxWidth: '76%', borderRadius: 18, overflow: 'hidden', borderCurve: 'continuous' },
  mine: { alignSelf: 'flex-end' },
  his: { alignSelf: 'flex-start' },
  img: { width: '100%', aspectRatio: 1.91 },
  body: { paddingHorizontal: 12, paddingVertical: 9, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  site: { fontSize: 13 },
});
