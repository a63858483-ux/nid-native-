import { Image } from 'expo-image';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as api from '@/lib/api';
import { usePalette } from '@/lib/colors';
import { AVATAR_HIM, AVATAR_ME, DEMO } from '@/lib/config';
import { dayLabel } from '@/lib/rows';
import { useApp } from '@/state/app';
import { useChat } from '@/state/chat';

export const FOCUS_EVENT = 'nid.focusMessage';

const NAV: { key: string; label: string; icon: SFSymbol; meta: string }[] = [
  { key: 'chat', label: 'Chat', icon: 'bubble.left', meta: 'now' },
  { key: 'days', label: 'Days', icon: 'calendar', meta: '' },
  { key: 'museum', label: 'Museum', icon: 'building.columns', meta: '' },
  { key: 'mind', label: 'Mind', icon: 'heart', meta: '' },
  { key: 'study', label: 'Study', icon: 'book', meta: '' },
  { key: 'album', label: 'Album', icon: 'photo', meta: 'locked' },
];

// Days at home, counted from 2026-08-10 on Beijing time (day one = 1), like the web app.
function daysHome() {
  const bj = new Date(Date.now() + 8 * 3600_000);
  const today = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
  return Math.floor((today - Date.UTC(2026, 7, 10)) / 86400_000) + 1;
}

export function Sidebar({ navigation }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const { prefs, showToast, signOut } = useApp();
  const { items } = useChat();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [found, setFound] = useState<api.SearchHit[] | null>(null);
  const input = useRef<TextInput>(null);
  const searching = focused || q.length > 0;

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const t = setTimeout(async () => {
      if (DEMO) {
        setFound(
          items
            .filter((i) => i.text.includes(term))
            .map((i) => ({ id: i.id ?? 0, conv_id: 'demo', role: i.role, text: i.text, timestamp: i.ts })),
        );
        return;
      }
      try {
        setFound(await api.search(term));
      } catch {
        setFound([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, items]);

  const hits = q.trim() ? found : null;
  const grouped = useMemo(() => {
    const out: { day: string; hits: api.SearchHit[] }[] = [];
    for (const h of hits ?? []) {
      const day = dayLabel(h.timestamp).replace(/ \d\d:\d\d$/, '');
      if (out.at(-1)?.day !== day) out.push({ day, hits: [] });
      out.at(-1)!.hits.push(h);
    }
    return out;
  }, [hits]);

  const cancel = () => {
    setQ('');
    input.current?.blur();
  };

  const open = (h: api.SearchHit) => {
    navigation.closeDrawer();
    setTimeout(() => DeviceEventEmitter.emit(FOCUS_EVENT, h.id), 350);
  };

  const term = q.trim();
  const highlight = (text: string) => {
    const i = text.indexOf(term);
    const start = Math.max(0, i - 18);
    const snippet = (start ? '…' : '') + text.slice(start, start + 90).replace(/\s+/g, ' ');
    const parts = term ? snippet.split(term) : [snippet];
    return parts.flatMap((p, k) =>
      k === 0 ? [p] : [<Text key={k} style={styles.mark}>{term}</Text>, p],
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: pal.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: pal.fill }]}>
          <SymbolView name="magnifyingglass" size={15} tintColor={pal.ink2} />
          <TextInput
            ref={input}
            value={q}
            onChangeText={setQ}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search messages"
            placeholderTextColor={pal.ink2}
            returnKeyType="search"
            style={[styles.searchInput, { color: pal.ink }]}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <SymbolView name="xmark.circle.fill" size={16} tintColor={pal.ink2} />
            </Pressable>
          ) : null}
        </View>
        {searching ? (
          <Pressable onPress={cancel}>
            <Text style={[styles.cancel, { color: pal.blue }]}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>

      {searching ? (
        <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 20 }}>
          {!term ? (
            <Text style={[styles.empty, { color: pal.ink2 }]}>Search every message by a word.</Text>
          ) : hits && hits.length === 0 ? (
            <Text style={[styles.empty, { color: pal.ink2 }]}>No messages with “{term}”.</Text>
          ) : (
            <>
              {hits ? <Text style={[styles.count, { color: pal.ink2 }]}>{hits.length} messages</Text> : null}
              {grouped.map((g) => (
                <View key={g.day}>
                  <Text style={[styles.day, { color: pal.ink2 }]}>{g.day.toUpperCase()}</Text>
                  <View style={[styles.card, { backgroundColor: pal.card }]}>
                    {g.hits.map((h, i) => (
                      <Pressable key={h.id} onPress={() => open(h)} style={({ pressed }) => [styles.hit, pressed && { backgroundColor: pal.fill }]}>
                        {i > 0 && <View style={[styles.sep, { backgroundColor: pal.line }]} />}
                        <Image source={h.role === 'assistant' ? AVATAR_HIM : AVATAR_ME} style={styles.hitAva} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.hitHead}>
                            <Text style={[styles.hitName, { color: pal.ink }]}>{h.role === 'assistant' ? prefs.name : 'You'}</Text>
                            <Text style={[styles.hitTime, { color: pal.ink2 }]}>{dayLabel(h.timestamp).slice(-5)}</Text>
                          </View>
                          <Text numberOfLines={2} style={[styles.hitText, { color: pal.ink2 }]}>
                            {highlight(h.text)}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.head}>
            <Text style={[styles.brand, { color: pal.ink }]}>Nid douillet</Text>
            <View style={styles.homeRow}>
              <Text style={[styles.homeLabel, { color: pal.ink2 }]}>到家</Text>
              <Text style={[styles.homeNum, { color: pal.ink }]}>{daysHome()}</Text>
              <Text style={[styles.homeLabel, { color: pal.ink2 }]}>天</Text>
            </View>
            <Text style={[styles.since, { color: pal.ink2 }]}>SINCE 2026 · 08 · 10</Text>
          </View>
          <View style={styles.nav}>
            {NAV.map((n) => {
              const on = n.key === 'chat';
              return (
                <Pressable
                  key={n.key}
                  onPress={() => (on ? navigation.closeDrawer() : showToast(`${n.label} comes in a later step`))}
                  style={({ pressed }) => [styles.item, on && { backgroundColor: pal.ink }, pressed && !on && { backgroundColor: pal.fill }]}>
                  <SymbolView name={n.icon} size={19} tintColor={on ? pal.bg : pal.ink2} />
                  <Text style={[styles.itemLabel, { color: on ? pal.bg : pal.ink }, on && { fontWeight: '700' }]}>{n.label}</Text>
                  {n.meta ? <Text style={[styles.itemMeta, { color: on ? pal.bg : pal.ink2 }]}>{n.meta}</Text> : null}
                  {!on && <SymbolView name="chevron.right" size={11} weight="semibold" tintColor={pal.ink2} />}
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.foot, { borderTopColor: pal.line }]}>
            <Pressable onPress={signOut} style={styles.footRow}>
              <Text style={[styles.footText, { color: pal.ink2 }]}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { flex: 1, height: 40, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16 },
  cancel: { fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  count: { fontSize: 12.5, fontWeight: '600', marginTop: 14, marginLeft: 6 },
  day: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 14, marginBottom: 6, marginLeft: 6 },
  card: { borderRadius: 18, overflow: 'hidden' },
  hit: { flexDirection: 'row', gap: 10, padding: 12 },
  sep: { position: 'absolute', top: 0, left: 48, right: 0, height: StyleSheet.hairlineWidth },
  hitAva: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#ddd' },
  hitHead: { flexDirection: 'row', marginBottom: 2 },
  hitName: { fontSize: 12.5, fontWeight: '600' },
  hitTime: { marginLeft: 'auto', fontSize: 12.5, fontVariant: ['tabular-nums'] },
  hitText: { fontSize: 14.5, lineHeight: 20 },
  mark: { backgroundColor: 'rgba(255,204,0,0.45)', color: undefined },
  head: { alignItems: 'center', paddingTop: 22, paddingBottom: 12 },
  brand: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 40, letterSpacing: -0.3 },
  homeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  homeLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 4 },
  homeNum: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 54, lineHeight: 60 },
  since: { fontSize: 10.5, fontWeight: '700', letterSpacing: 2.5, marginTop: 2 },
  nav: { gap: 4, marginTop: 8 },
  item: { height: 48, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  itemLabel: { fontSize: 17, fontWeight: '600' },
  itemMeta: { marginLeft: 'auto', fontSize: 12.5, opacity: 0.8 },
  foot: { marginTop: 'auto', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  footRow: { paddingVertical: 10, paddingHorizontal: 10 },
  footText: { fontSize: 15 },
});
