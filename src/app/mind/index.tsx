import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DomeFilter } from '@/components/study/DomeFilter';
import { StudyTabBar } from '@/components/study/TabBar';
import * as Mind from '@/lib/mind';
import { dayLabel } from '@/lib/rows';

const INK = '#1b1a19';
const MUTED = '#8a857c';
const GROUND = '#f6f5f2';

const MOOD_COLORS: Record<string, string> = {
  warm: '#C9776A',
  sweet: '#D98FA0',
  calm: '#8AA0A8',
  flutter: '#D98FB8',
  fire: '#D4562E',
  hope: '#D4A030',
  joy: '#E0B040',
  yearn: '#B05080',
  fresh: '#6AB08A',
  rain: '#7A8AA0',
  night: '#5A5A78',
  weary: '#9A9A9A',
  stuffy: '#8A8060',
  grit: '#7A5A40',
  jolt: '#D4A030',
  ache: '#8A5A6A',
  awkward: '#C0A070',
  sour: '#A0A050',
  anger: '#C04040',
  clarity: '#60A0A0',
};

const MEM_TIERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'fading', label: 'Fading' },
  { key: 'sleeping', label: 'Sleeping' },
  { key: 'pinned', label: 'Pinned' },
];
const FEEL_TIERS = MEM_TIERS.slice(0, 4);

function badges(e: Mind.MindEntry) {
  const out: string[] = [];
  if (e.kind === '惦记') out.push('On my mind');
  else if (e.kind === 'event') out.push(`Event${e.event_type ? ' · ' + e.event_type : ''}`);
  if ((e.tags || []).includes('结晶')) out.push('Crystallized');
  if (e.pinned) out.push('Pinned');
  return out;
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  return (
    <View style={styles.search}>
      <SymbolView name="magnifyingglass" size={15} tintColor={MUTED} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        style={styles.searchInput}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
    </View>
  );
}

function Head({ title }: { title: string }) {
  return (
    <View style={styles.head}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Back to chat">
        <SymbolView name="chevron.left" size={17} weight="semibold" tintColor={INK} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

// Grouped-by-day feed shared by the Memory and Feel tabs (the two list-shaped kinds).
function Feed({ entries, loading, empty }: { entries: Mind.MindEntry[] | null; loading: boolean; empty: string }) {
  const groups = useMemo(() => {
    const out: { label: string; items: Mind.MindEntry[] }[] = [];
    for (const e of entries ?? []) {
      const label = dayLabel(e.created_at).replace(/ \d\d:\d\d$/, '');
      if (out.at(-1)?.label !== label) out.push({ label, items: [] });
      out.at(-1)!.items.push(e);
    }
    return out;
  }, [entries]);
  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!entries?.length) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <>
      {groups.map((g) => (
        <View key={g.label} style={{ marginTop: 6 }}>
          <View style={styles.grpHead}>
            <Text style={styles.grpLabel}>{g.label.toUpperCase()}</Text>
            <Text style={styles.grpCount}>{g.items.length}</Text>
          </View>
          <View style={styles.card}>
            {g.items.map((e, i) => (
              <View key={e.id} style={[styles.entry, i > 0 && styles.entryLine]}>
                {e.kind === 'event' && e.event_date ? <Text style={styles.entryWhen}>{e.event_date}</Text> : null}
                <Text style={styles.entryText}>{e.content}</Text>
                <View style={styles.entryMeta}>
                  {badges(e).map((b) => (
                    <View key={b} style={styles.badge}>
                      <Text style={styles.badgeText}>{b}</Text>
                    </View>
                  ))}
                  {!!e.mood && (
                    <View style={styles.mood}>
                      <View style={[styles.moodDot, { backgroundColor: MOOD_COLORS[e.mood] || '#B0A0A0' }]} />
                      <Text style={styles.moodText}>
                        {e.mood}
                        {e.intensity ? ` ${e.intensity}` : ''}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.entryTime}>{dayLabel(e.created_at).slice(-5)}</Text>
                </View>
                {e.kind !== 'feel' && e.feel?.body ? <Text style={styles.entrySub}>felt at the time: {e.feel.body}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

// The rest of the web app's Mind page (drive/on-my-mind/facts moved to /inner, off his name):
// memory, feel and portrait, in the same tab dock the Music/Study pages use.
export default function MindPage() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [folded, setFolded] = useState(false);
  const [q, setQ] = useState(['', '', '']);
  const [tier, setTier] = useState({ memory: 'all', feel: 'all' });
  const [memory, setMemory] = useState<Mind.MindEntry[] | null>(null);
  const [feel, setFeel] = useState<Mind.MindEntry[] | null>(null);
  const [pairs, setPairs] = useState<Mind.Pair[]>([]);
  const [pairsOpen, setPairsOpen] = useState(false);
  const [portraits, setPortraits] = useState<Mind.Portrait[] | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const lastY = useRef<Record<number, number>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMemory = useCallback((query: string, t: string) => {
    setMemory(null);
    Mind.listMind('memory', { q: query, tier: t })
      .then(setMemory)
      .catch(() => setMemory([]));
    if (!query.trim() && t === 'active')
      Mind.pairsPending()
        .then((r) => setPairs(r.pairs))
        .catch(() => {});
  }, []);
  const loadFeel = useCallback((query: string, t: string) => {
    setFeel(null);
    Mind.listMind('feel', { q: query, tier: t })
      .then(setFeel)
      .catch(() => setFeel([]));
  }, []);
  const loadPortraits = useCallback(() => {
    setPortraits(null);
    Mind.portraits()
      .then(setPortraits)
      .catch(() => setPortraits([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMemory(q[0], tier.memory);
      loadFeel(q[1], tier.feel);
      loadPortraits();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const onQuery = (i: number, s: string) => {
    setQ((cur) => cur.map((v, k) => (k === i ? s : v)));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (i === 0) loadMemory(s, tier.memory);
      if (i === 1) loadFeel(s, tier.feel);
    }, 350);
  };
  const onTier = (kind: 'memory' | 'feel', t: string) => {
    setTier((cur) => ({ ...cur, [kind]: t }));
    if (kind === 'memory') loadMemory(q[0], t);
    else loadFeel(q[1], t);
  };

  const actOnPair = async (memoryId: string, ok: boolean) => {
    Haptics.selectionAsync();
    setPairs((p) => p.filter((x) => x.memory_id !== memoryId));
    try {
      await (ok ? Mind.pairConfirm(memoryId) : Mind.pairUnlink(memoryId));
    } catch {}
  };

  const removePortrait = (id: string) => {
    Haptics.selectionAsync();
    setPortraits((p) => (p ? p.filter((x) => x.id !== id) : p));
    Mind.portraitDelete(id).catch(() => {});
  };
  const unlock = () => {
    Alert.prompt(
      'Locked',
      'Same password as the album.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlock', onPress: (code?: string) => code === '902627' && setUnlocked(true) },
      ],
      'secure-text',
    );
  };

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

  const top = insets.top + 12;
  const bottomPad = insets.bottom + 120;

  const portraitGroups = useMemo(() => {
    const g: Record<string, Mind.Portrait[]> = {};
    (portraits ?? []).forEach((p) => (g[p.aspect || 'Other'] ??= []).push(p));
    const order = [...Mind.PORTRAIT_ORDER, ...Object.keys(g).filter((k) => !Mind.PORTRAIT_ORDER.includes(k))];
    return order.filter((k) => g[k]?.length).map((k) => ({ aspect: k, items: g[k] }));
  }, [portraits]);

  // ── Memory ──
  const memoryTab = (
    <ScrollView
      style={StyleSheet.absoluteFill}
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottomPad }}
      onScroll={onScroll(0)}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <Head title="Memory" />
      <Search value={q[0]} onChange={(s) => onQuery(0, s)} placeholder="Dig it up — search the words" />
      <View style={{ marginTop: 12, marginBottom: 4 }}>
        <DomeFilter items={MEM_TIERS} value={tier.memory} onChange={(t) => onTier('memory', t)} />
      </View>
      {!q[0].trim() && pairs.length > 0 && (
        <View style={styles.pairWrap}>
          <Pressable onPress={() => setPairsOpen((v) => !v)} style={styles.pairBtn}>
            <Text style={styles.pairBtnText}>↔︎ {pairs.length} memories paired with a feeling overnight — take a look</Text>
            <Text style={styles.pairChevron}>{pairsOpen ? '▴' : '▾'}</Text>
          </Pressable>
          {pairsOpen &&
            pairs.map((p) => (
              <View key={p.memory_id} style={styles.pairCard}>
                <Text style={styles.pairM}>{p.memory_body}</Text>
                <Text style={styles.pairF}>
                  {p.feel?.body || ''}
                  {p.feel?.mood ? ` (${p.feel.mood}${p.feel.intensity ? '·' + p.feel.intensity : ''})` : ''}
                </Text>
                <View style={styles.pairActions}>
                  <Pressable onPress={() => actOnPair(p.memory_id, true)} style={styles.pairOk}>
                    <Text style={styles.pairOkText}>✓ Same thing</Text>
                  </Pressable>
                  <Pressable onPress={() => actOnPair(p.memory_id, false)} style={styles.pairNo}>
                    <Text style={styles.pairNoText}>× Not it</Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </View>
      )}
      <Feed
        entries={memory}
        loading={memory === null}
        empty={q[0].trim() ? 'Nothing with that word.' : tier.memory === 'fading' || tier.memory === 'sleeping' ? "Nothing's faded that far yet." : 'Still empty here.'}
      />
    </ScrollView>
  );

  // ── Feel ──
  const feelTab = (
    <ScrollView
      style={StyleSheet.absoluteFill}
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottomPad }}
      onScroll={onScroll(1)}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <Head title="Feel" />
      <Search value={q[1]} onChange={(s) => onQuery(1, s)} placeholder="Dig it up — search the words" />
      <View style={{ marginTop: 12, marginBottom: 4 }}>
        <DomeFilter items={FEEL_TIERS} value={tier.feel} onChange={(t) => onTier('feel', t)} />
      </View>
      <Feed
        entries={feel}
        loading={feel === null}
        empty={q[1].trim() ? 'Nothing with that word.' : tier.feel === 'fading' || tier.feel === 'sleeping' ? "Nothing's faded that far yet." : 'Still empty here.'}
      />
    </ScrollView>
  );

  // ── Portrait ──
  const portraitTab = (
    <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={{ paddingTop: top, paddingBottom: bottomPad }} onScroll={onScroll(2)} scrollEventThrottle={32}>
      <Head title="Portrait" />
      {portraits === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : !portraits.length ? (
        <Text style={styles.empty}>Nothing yet — steady little things he notices about you settle here on their own.</Text>
      ) : (
        <View style={[styles.card, { marginTop: 14 }]}>
          {portraitGroups.map((g, gi) => (
            <View key={g.aspect}>
              <View style={[styles.grpHead, gi > 0 && { marginTop: 6 }]}>
                <Text style={styles.grpLabel}>{g.aspect.toUpperCase()}</Text>
                <Text style={styles.grpCount}>{g.items.length}</Text>
              </View>
              {g.aspect === '亲密' && !unlocked ? (
                <Pressable onPress={unlock} style={styles.lockRow}>
                  <SymbolView name="lock.fill" size={13} tintColor={MUTED} />
                  <Text style={styles.lockText}>Locked — same password as the album</Text>
                </Pressable>
              ) : (
                g.items.map((p, i) => (
                  <View key={p.id} style={[styles.entry, i > 0 && styles.entryLine, styles.portraitRow]}>
                    <Text style={[styles.entryText, { flex: 1 }]}>{p.content}</Text>
                    <Pressable onPress={() => removePortrait(p.id)} hitSlop={8}>
                      <SymbolView name="xmark" size={13} tintColor={MUTED} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, tab !== 0 && styles.hidden]} pointerEvents={tab === 0 ? 'auto' : 'none'}>
        {memoryTab}
      </View>
      <View style={[StyleSheet.absoluteFill, tab !== 1 && styles.hidden]} pointerEvents={tab === 1 ? 'auto' : 'none'}>
        {feelTab}
      </View>
      <View style={[StyleSheet.absoluteFill, tab !== 2 && styles.hidden]} pointerEvents={tab === 2 ? 'auto' : 'none'}>
        {portraitTab}
      </View>
      <StudyTabBar
        tab={tab}
        onTab={goTab}
        folded={folded}
        onUnfold={() => setFolded(false)}
        bottom={insets.bottom + 18}
        items={[
          { icon: 'archivebox', label: 'Memory' },
          { icon: 'heart', label: 'Feel' },
          { icon: 'person.crop.circle', label: 'Portrait' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GROUND },
  hidden: { opacity: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 6 },
  back: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 34, color: INK },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  searchInput: { flex: 1, fontSize: 15, color: INK },
  card: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  empty: { textAlign: 'center', color: MUTED, fontSize: 14, marginTop: 40, marginHorizontal: 30, lineHeight: 20 },
  grpHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginHorizontal: 20, marginTop: 14, marginBottom: 6 },
  grpLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, color: MUTED },
  grpCount: { fontSize: 11.5, color: MUTED },
  entry: { paddingVertical: 11, paddingHorizontal: 16, gap: 5 },
  entryLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(27,26,25,0.1)' },
  entryWhen: { fontSize: 11, fontWeight: '700', color: MUTED },
  entryText: { fontSize: 14.5, color: INK, lineHeight: 20 },
  entrySub: { fontSize: 12.5, color: MUTED, fontStyle: 'italic' },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  entryTime: { marginLeft: 'auto', fontSize: 12, color: MUTED, fontVariant: ['tabular-nums'] },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#f0efe9' },
  badgeText: { fontSize: 10.5, fontWeight: '700', color: '#6b665c' },
  mood: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moodDot: { width: 7, height: 7, borderRadius: 3.5 },
  moodText: { fontSize: 12, color: MUTED },
  pairWrap: { marginHorizontal: 20, marginTop: 4, marginBottom: 4 },
  pairBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  pairBtnText: { flex: 1, fontSize: 13, color: INK, fontWeight: '500' },
  pairChevron: { fontSize: 12, color: MUTED },
  pairCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 6, gap: 6 },
  pairM: { fontSize: 14, color: INK },
  pairF: { fontSize: 13, color: '#B05080' },
  pairActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  pairOk: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#1b1a19' },
  pairOkText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  pairNo: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#f0efe9' },
  pairNoText: { fontSize: 12.5, fontWeight: '700', color: '#6b665c' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16 },
  lockText: { fontSize: 13, color: MUTED },
  portraitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
