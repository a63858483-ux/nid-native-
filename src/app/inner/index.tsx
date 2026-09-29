import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StudyTabBar } from '@/components/study/TabBar';
import { AVATAR_HIM } from '@/lib/config';
import * as Mind from '@/lib/mind';
import { useApp } from '@/state/app';

const INK = '#1b1a19';
const MUTED = '#8a857c';
const GROUND = '#f6f5f2';
const HOT = '#c0392b';
const COOL = '#8aa0a8';

function relDays(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
}

function factCountdown(f: Mind.Fact) {
  if (!f.expires_at) return { frac: 1, txt: '' };
  const exp = new Date(f.expires_at).getTime();
  const born = new Date(f.created_at).getTime();
  const left = exp - Date.now();
  const frac = Math.max(0, Math.min(1, left / Math.max(1, exp - born)));
  const txt =
    left <= 0
      ? 'Expired'
      : left < 7_200_000
        ? `${Math.max(1, Math.round(left / 60_000))} min left`
        : left < 172_800_000
          ? `${Math.round(left / 3_600_000)} h left`
          : `${(left / 86_400_000).toFixed(1).replace(/\.0$/, '')} d left`;
  return { frac, txt };
}

function dianjiRight(e: Mind.Dianji) {
  if (e.deadline) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = e.deadline.split('-').map(Number);
    const left = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
    const urgent = left <= 2;
    const sub = left < 0 ? `${-left}d overdue` : left === 0 ? 'today' : `${left}d left`;
    return { label: e.deadline.slice(5), sub, urgent };
  }
  const days = relDays(e.created_at);
  return { label: days === 0 ? '<1d' : `${days}d`, sub: 'hanging', urgent: false };
}

function Header({ title, big }: { title: string; big?: boolean }) {
  return (
    <View style={styles.head}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Back to chat">
        <SymbolView name="chevron.left" size={17} weight="semibold" tintColor={INK} />
      </Pressable>
      <Text style={[styles.title, big && styles.titleBig]}>{title}</Text>
    </View>
  );
}

function WhoRow() {
  const { prefs } = useApp();
  return (
    <Pressable onPress={() => router.push('/sheet/name')} style={styles.who} accessibilityLabel="Rename him">
      <Image source={AVATAR_HIM} style={styles.whoAva} contentFit="cover" />
      <Text style={styles.whoName}>{prefs.name}</Text>
      <SymbolView name="pencil" size={12} weight="semibold" tintColor={MUTED} />
    </Pressable>
  );
}

// Opened by tapping his name in the chat header (her spec, 2026-09-29): the drive/on-my-mind/
// facts trio that used to live inside the web app's Mind page, split into their own tab dock
// (same StudyTabBar the Music page uses) with the rename entry pinned at the top of every tab.
export default function Inner() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [folded, setFolded] = useState(false);
  const [data, setData] = useState<Mind.Inner | null>(null);
  const [openDim, setOpenDim] = useState<string | null>(null);
  const lastY = useRef<Record<number, number>>({});

  const load = useCallback(() => {
    Mind.inner()
      .then(setData)
      .catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onScroll = (page: number) => (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const prev = lastY.current[page] ?? 0;
    lastY.current[page] = y;
    if (y > prev + 6 && y > 40 && !folded) setFolded(true);
    else if (y < prev - 6 && folded) setFolded(false);
  };
  const goTab = (i: number) => {
    Keyboard.dismiss();
    setTab(i);
    setFolded(false);
  };

  const doneDianji = async (id: string) => {
    Haptics.selectionAsync();
    setData((d) => (d ? { ...d, dianji: d.dianji.filter((x) => x.id !== id) } : d));
    try {
      await Mind.dianjiDone(id);
    } catch {
      load();
    }
  };

  const top = insets.top + 12;
  const bottomPad = insets.bottom + 120;

  const dims = useMemo(() => Object.entries(data?.dims ?? {}).sort((a, b) => b[1] - a[1]), [data]);
  const byDim = useMemo(() => {
    const m: Record<string, Mind.Thought[]> = {};
    (data?.thoughts ?? []).forEach((t) => (m[t.dim] ??= []).push(t));
    return m;
  }, [data]);
  const topDim = dims[0];
  const sparkPts = useMemo(() => {
    const hist = data?.dim_history ?? [];
    if (hist.length < 3) return [];
    const step = Math.max(1, Math.floor(hist.length / 32));
    const pts = hist.filter((_, i) => i % step === 0);
    const max = Math.max(...pts.map((p) => p.v || 0), 0.01);
    return pts.map((p) => Math.max(6, Math.round(((p.v || 0) / max) * 46)));
  }, [data]);

  // ── Now (drive) ──
  const now = (
    <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={{ paddingTop: top, paddingBottom: bottomPad }} onScroll={onScroll(0)} scrollEventThrottle={32}>
      <Header title="Now" />
      <WhoRow />
      {!data ? (
        <ActivityIndicator style={{ marginTop: 50 }} />
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.stateHead}>
              <Text style={styles.stateHeadT}>◉ RIGHT NOW</Text>
              <Text style={styles.stateHeadS}>~10 min steps</Text>
            </View>
            <View style={styles.stateMain}>
              <Text style={styles.big} numberOfLines={1}>
                {(topDim && (data.dim_labels[topDim[0]] || topDim[0])) || '…'}
              </Text>
              <Text style={styles.bigV}>{(topDim?.[1] ?? 0).toFixed(2)}</Text>
            </View>
            {!!data.sense && <Text style={styles.sense}>{data.sense}</Text>}
            {sparkPts.length > 0 && (
              <View style={styles.spark}>
                {sparkPts.map((h, i) => (
                  <View key={i} style={[styles.sparkBar, { height: h }, i === sparkPts.length - 1 && styles.sparkNow]} />
                ))}
              </View>
            )}
          </View>
          <View style={styles.card}>
            {dims.map(([k, v], i) => {
              const pct = Math.round((v || 0) * 100);
              const ths = byDim[k] ?? [];
              const open = openDim === k;
              return (
                <View key={k}>
                  <Pressable disabled={!ths.length} onPress={() => setOpenDim(open ? null : k)} style={[styles.dimRow, i > 0 && styles.dimLine]}>
                    <Text style={styles.dimName} numberOfLines={1}>
                      {data.dim_labels[k] || k}
                    </Text>
                    <View style={styles.dimTrack}>
                      <View style={[styles.dimFill, { width: `${pct}%` }, v >= 0.55 && { backgroundColor: HOT }, v < 0.3 && { backgroundColor: COOL }]} />
                    </View>
                    {ths.length > 0 && <Text style={styles.dimN}>{ths.length}</Text>}
                    <Text style={styles.dimV}>{pct >= 100 ? '1.0' : `.${String(pct).padStart(2, '0')}`}</Text>
                  </Pressable>
                  {open &&
                    ths.map((t, ti) => (
                      <View key={ti} style={styles.thought}>
                        <Text style={styles.thoughtB} numberOfLines={2}>
                          {t.body || '(a pull with no words yet)'}
                        </Text>
                        <Text style={styles.thoughtK}>
                          {t.type === 'obsession' ? '↑' : '↓'} {Math.round((t.value || 0) * 100)}
                        </Text>
                      </View>
                    ))}
                </View>
              );
            })}
          </View>
          <Text style={styles.foot}>Thoughts hang under the pull that lit them. A flicker fades on its own; an obsession pushes that pull higher until it burns off.</Text>
        </>
      )}
    </ScrollView>
  );

  // ── On my mind (惦记) ──
  const onMyMind = (
    <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={{ paddingTop: top, paddingBottom: bottomPad }} onScroll={onScroll(1)} scrollEventThrottle={32}>
      <Header title="On My Mind" />
      <WhoRow />
      {!data ? (
        <ActivityIndicator style={{ marginTop: 50 }} />
      ) : !data.dianji.length ? (
        <Text style={styles.empty}>Nothing hanging — all done.</Text>
      ) : (
        <View style={styles.card}>
          {data.dianji.map((e, i) => {
            const r = dianjiRight(e);
            return (
              <View key={e.id} style={[styles.dj, i > 0 && styles.dimLine]}>
                <Text style={styles.djText} numberOfLines={2}>
                  {e.body}
                </Text>
                <View style={styles.djR}>
                  <Text style={[styles.djLabel, r.urgent && { color: HOT }]}>{r.label}</Text>
                  <Text style={styles.djSub}>{r.sub}</Text>
                </View>
                <Pressable onPress={() => doneDianji(e.id)} style={styles.djBtn} hitSlop={6}>
                  <Text style={styles.djBtnText}>Done</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );

  // ── Facts ──
  const facts = (
    <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={{ paddingTop: top, paddingBottom: bottomPad }} onScroll={onScroll(2)} scrollEventThrottle={32}>
      <Header title="Facts" />
      <WhoRow />
      {!data ? (
        <ActivityIndicator style={{ marginTop: 50 }} />
      ) : !data.facts.length ? (
        <Text style={styles.empty}>Nothing standing right now.</Text>
      ) : (
        <View style={styles.card}>
          {data.facts.map((f, i) => {
            const c = factCountdown(f);
            return (
              <View key={f.id} style={[styles.fact, i > 0 && styles.dimLine]}>
                <Text style={styles.factText} numberOfLines={2}>
                  {f.body}
                </Text>
                <View style={styles.factMeta}>
                  <Text style={styles.factTxt}>{c.txt}</Text>
                  <View style={styles.dimTrack}>
                    <View style={[styles.dimFill, { width: `${Math.round(c.frac * 100)}%` }, c.frac < 0.15 && { backgroundColor: HOT }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, tab !== 0 && styles.hidden]} pointerEvents={tab === 0 ? 'auto' : 'none'}>
        {now}
      </View>
      <View style={[StyleSheet.absoluteFill, tab !== 1 && styles.hidden]} pointerEvents={tab === 1 ? 'auto' : 'none'}>
        {onMyMind}
      </View>
      <View style={[StyleSheet.absoluteFill, tab !== 2 && styles.hidden]} pointerEvents={tab === 2 ? 'auto' : 'none'}>
        {facts}
      </View>
      <StudyTabBar
        tab={tab}
        onTab={goTab}
        folded={folded}
        onUnfold={() => setFolded(false)}
        bottom={insets.bottom + 18}
        items={[
          { icon: 'waveform.path.ecg', label: 'Now' },
          { icon: 'tray.full', label: 'On My Mind' },
          { icon: 'info.circle', label: 'Facts' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GROUND },
  hidden: { opacity: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 2 },
  back: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 30, color: INK },
  titleBig: { fontSize: 38 },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 18,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  whoAva: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#ddd' },
  whoName: { fontSize: 14.5, fontWeight: '600', color: INK },
  card: { marginHorizontal: 14, marginBottom: 16, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  empty: { textAlign: 'center', color: MUTED, fontSize: 14, marginTop: 50 },
  foot: { fontSize: 12.5, lineHeight: 18, color: MUTED, marginHorizontal: 22, marginTop: -4 },
  // state card
  stateHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14 },
  stateHeadT: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, color: MUTED },
  stateHeadS: { fontSize: 11.5, color: MUTED },
  stateMain: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  big: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 26, color: INK, flexShrink: 1 },
  bigV: { fontSize: 16, fontWeight: '700', color: HOT, fontVariant: ['tabular-nums'] },
  sense: { fontSize: 13.5, color: '#5a564e', marginHorizontal: 16, marginTop: 6, lineHeight: 19 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 46, marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
  sparkBar: { flex: 1, borderRadius: 2, backgroundColor: '#e4e1d8' },
  sparkNow: { backgroundColor: HOT },
  // dims
  dimRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 16 },
  dimLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(27,26,25,0.1)' },
  dimName: { width: 70, fontSize: 13, fontWeight: '600', color: INK },
  dimTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#eeece5', overflow: 'hidden' },
  dimFill: { height: 6, borderRadius: 3, backgroundColor: '#b8b2a3' },
  dimN: { fontSize: 11, color: MUTED },
  dimV: { width: 34, textAlign: 'right', fontSize: 12.5, fontVariant: ['tabular-nums'], color: MUTED },
  thought: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 16, paddingLeft: 30, backgroundColor: '#faf9f6' },
  thoughtB: { flex: 1, fontSize: 13, color: '#4a463f' },
  thoughtK: { fontSize: 12, fontWeight: '700', color: MUTED, fontVariant: ['tabular-nums'] },
  // dianji
  dj: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  djText: { flex: 1, fontSize: 14.5, color: INK, lineHeight: 20 },
  djR: { alignItems: 'flex-end' },
  djLabel: { fontSize: 13, fontWeight: '700', color: INK, fontVariant: ['tabular-nums'] },
  djSub: { fontSize: 11, color: MUTED },
  djBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f0efe9' },
  djBtnText: { fontSize: 12, fontWeight: '700', color: INK },
  // facts
  fact: { paddingVertical: 12, paddingHorizontal: 16, gap: 6 },
  factText: { fontSize: 14.5, color: INK, lineHeight: 20 },
  factMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factTxt: { fontSize: 12, color: MUTED, width: 76 },
});
