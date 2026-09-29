import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover, EssayCover, SERIF } from '@/components/study/Covers';
import { DomeFilter, WhoRow } from '@/components/study/DomeFilter';
import { FocusRing, TOMATO } from '@/components/study/FocusRing';
import { StudyTabBar } from '@/components/study/TabBar';
import { useStudy } from '@/components/study/useStudy';
import * as S from '@/lib/study';
import { wallpaperUri } from '@/lib/storage';
import { useApp } from '@/state/app';

const BG = require('../../../assets/images/study-bg.jpg');
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// The last seven Beijing days, oldest first, with how many focus sessions each finished.
function lastWeek(week: S.Day[]) {
  const out: { label: string; n: number; today: boolean }[] = [];
  const base = Date.now() + 8 * 3600_000;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: WEEK[d.getUTCDay()], n: week.find((w) => w.date === key)?.count ?? 0, today: i === 0 });
  }
  return out;
}

type Tile = { k: 'book'; b: S.Book; at: number } | { k: 'paper'; e: S.Essay; at: number };

function GlassCard({ style, children, onPress }: { style?: StyleProp<ViewStyle>; children: ReactNode; onPress?: () => void }) {
  const body = (
    <View style={[styles.glass, style]}>
      <BlurView tint="systemUltraThinMaterialDark" intensity={60} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glassTint]} />
      {children}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

function Circle({ icon, onPress, light, label }: { icon: SFSymbol; onPress: () => void; light?: boolean; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [styles.circle, light && styles.circleLight, pressed && { opacity: 0.6 }]}>
      {!light && <BlurView tint="systemUltraThinMaterialDark" intensity={50} style={StyleSheet.absoluteFill} />}
      <SymbolView name={icon} size={17} weight="semibold" tintColor={light ? '#111' : '#fff'} />
    </Pressable>
  );
}

export default function Study() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { prefs, showToast } = useApp();
  const st = useStudy();
  const [tab, setTab] = useState(0);
  const [folded, setFolded] = useState(false);
  const [lib, setLib] = useState('all');
  const [who, setWho] = useState('all');
  const [mins, setMins] = useState(25);
  const [task, setTask] = useState('');
  const lastY = useRef<Record<number, number>>({});
  const wall = wallpaperUri(prefs.wallpaper);
  const bg = wall ? { uri: wall } : BG;

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

  const tiles = useMemo<Tile[]>(() => {
    const out: Tile[] = [
      ...st.books.map((b) => ({ k: 'book' as const, b, at: Math.max(b.updated_at, (b.progress as { updated_at?: number } | null)?.updated_at ?? 0) })),
      ...st.essays.map((e) => ({ k: 'paper' as const, e, at: e.created_at })),
    ];
    return out.sort((a, b) => b.at - a.at);
  }, [st.books, st.essays]);
  // The book she's in the middle of (else the one touched last), and the newest piece of Paper.
  const current = useMemo(() => {
    const bs = st.books.filter((b) => b.kind === 'book');
    const reading = bs.filter((b) => (b.progress?.percent ?? 0) > 0 && (b.progress?.percent ?? 0) < 100);
    const by = (b: S.Book) => Math.max(b.updated_at, (b.progress as { updated_at?: number } | null)?.updated_at ?? 0);
    return [...(reading.length ? reading : bs)].sort((a, b) => by(b) - by(a))[0] ?? null;
  }, [st.books]);
  const latest = useMemo(() => [...st.essays].sort((a, b) => b.created_at - a.created_at)[0] ?? null, [st.essays]);
  const shown = tiles.filter((t) => (lib === 'all' || t.k === lib) && (lib !== 'paper' || who === 'all' || (t.k === 'paper' && t.e.author === who)));

  const openBook = (b: S.Book) =>
    router.push({
      pathname: '/study/book/[id]',
      params: { id: String(b.id), title: b.title, file: S.bookFileUrl(b), ext: b.file_ext || 'epub', percent: String(b.progress?.percent ?? 0) },
    });
  const openEssay = (e: S.Essay) => router.push({ pathname: '/study/essay/[id]', params: { id: String(e.id) } });
  const add = () => router.push('/sheet/add');

  const bookMore = (b: S.Book) =>
    ActionSheetIOS.showActionSheetWithOptions({ title: b.title, options: ['Delete Book', 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: 1 }, (i) => {
      if (i !== 0) return;
      Alert.alert('Delete this book?', 'Its highlights and notes go with it.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await S.deleteBook(b.id);
              st.setBooks((x) => x.filter((y) => y.id !== b.id));
            } catch {
              showToast("Couldn't delete it");
            }
          },
        },
      ]);
    });
  const essayMore = (e: S.Essay) =>
    ActionSheetIOS.showActionSheetWithOptions({ title: e.title, options: ['Edit', 'Delete', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 }, (i) => {
      if (i === 0) router.push({ pathname: '/study/compose', params: { id: String(e.id) } });
      if (i === 1)
        Alert.alert('Delete this piece?', 'Replies under it go too.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await S.deleteEssay(e.id);
                st.setEssays((x) => x.filter((y) => y.id !== e.id));
              } catch {
                showToast("Couldn't delete it");
              }
            },
          },
        ]);
    });
  const tile = (t: Tile, w: number, dark: boolean) =>
    t.k === 'book' ? (
      <BookCover key={`b${t.b.id}`} book={t.b} width={w} dark={dark} onPress={() => openBook(t.b)} onMore={() => bookMore(t.b)} />
    ) : (
      <EssayCover key={`e${t.e.id}`} essay={t.e} width={w} dark={dark} onPress={() => openEssay(t.e)} onMore={t.e.author === 'ta' ? () => essayMore(t.e) : undefined} />
    );

  const running = !!st.active;
  const total = running ? st.active!.minutes * 60 : mins * 60;
  const secs = running ? st.remaining : mins * 60;
  const doneCount = st.today.filter((p) => p.completed).length;
  const doneMins = st.today.reduce((n, p) => n + p.minutes, 0);
  const toggle = () => {
    Keyboard.dismiss();
    if (running) st.stop();
    else st.start(mins, task.trim());
  };
  const adj = (d: number) => {
    if (running) return;
    Haptics.selectionAsync();
    setMins((m) => Math.max(5, Math.min(120, m + d)));
  };
  const taskValue = running ? st.active!.task : task;

  const top = insets.top + 12;
  const bottomPad = insets.bottom + 120;
  const col = (width - 36 - 24) / 3;

  // ── Study (home) ──
  const home = (
    <ScrollView
      style={StyleSheet.absoluteFill}
      contentContainerStyle={{ paddingTop: top, paddingHorizontal: 14, paddingBottom: bottomPad }}
      onScroll={onScroll(0)}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <Circle icon="chevron.left" label="Back to chat" onPress={() => router.back()} />
        <Circle icon="ellipsis" label="More" onPress={add} />
      </View>
      <Text style={styles.brand}>Study</Text>
      <View style={styles.stats}>
        <Pressable onPress={() => (setLib('book'), goTab(2))}>
          <Text style={styles.stat}>
            {st.books.length}
            <Text style={styles.statSmall}> BOOKS</Text>
          </Text>
        </Pressable>
        <Pressable onPress={() => (setLib('paper'), goTab(2))}>
          <Text style={styles.stat}>
            {st.essays.length}
            <Text style={styles.statSmall}> PAPERS</Text>
          </Text>
        </Pressable>
        <Pressable onPress={() => goTab(1)}>
          <Text style={styles.stat}>
            {doneCount}
            <Text style={styles.statSmall}> TODAY</Text>
          </Text>
        </Pressable>
      </View>

      <GlassCard style={styles.focus} onPress={() => goTab(1)}>
        <FocusRing size={108} stroke={6} seconds={secs} total={total} sub={running ? 'LEFT' : 'FOCUS'} />
        <View style={styles.focusR}>
          <Text style={styles.lbl}>FOCUS</Text>
          <TextInput
            value={taskValue}
            onChangeText={setTask}
            editable={!running}
            placeholder="在做什么…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.task}
            returnKeyType="done"
          />
          <View style={styles.row2}>
            <Pressable onPress={() => adj(-5)} style={styles.pm} hitSlop={4}>
              <Text style={styles.pmText}>−</Text>
            </Pressable>
            <Text style={styles.mins}>{running ? st.active!.minutes : mins}</Text>
            <Pressable onPress={() => adj(5)} style={styles.pm} hitSlop={4}>
              <Text style={styles.pmText}>+</Text>
            </Pressable>
            <Pressable onPress={toggle} style={[styles.go, running && styles.goStop]}>
              <Text style={styles.goText}>{running ? 'Stop' : 'Start'}</Text>
            </Pressable>
          </View>
          <Text style={styles.today}>
            今天 <Text style={styles.todayB}>{doneCount}</Text> 颗 · <Text style={styles.todayB}>{doneMins}</Text> 分
          </Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.shelf} onPress={() => (setLib('all'), goTab(2))}>
        <View style={styles.shead}>
          <Text style={styles.sheadB}>Library</Text>
          <View style={styles.sheadR}>
            <Text style={styles.sheadS}>All {tiles.length} ›</Text>
            <Pressable onPress={add} hitSlop={10} accessibilityLabel="Add">
              <SymbolView name="plus" size={17} weight="medium" tintColor="#fff" />
            </Pressable>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.covers}>
          {tiles.slice(0, 8).map((t) => tile(t, 92, false))}
          {st.loaded && tiles.length === 0 && <Text style={styles.empty}>Nothing on the shelf yet. Tap + to add a book.</Text>}
        </ScrollView>
      </GlassCard>

      {current && (
        <GlassCard style={styles.cont} onPress={() => openBook(current)}>
          <BookCover book={current} width={64} onPress={() => openBook(current)} />
          <View style={styles.contR}>
            <Text style={styles.lbl}>CONTINUE READING</Text>
            <Text style={styles.contTitle} numberOfLines={2}>
              {current.title}
            </Text>
            {!!current.author && (
              <Text style={styles.contSub} numberOfLines={1}>
                {current.author}
              </Text>
            )}
            <View style={styles.contBar}>
              <View style={[styles.contFill, { width: `${Math.max(2, Math.round(current.progress?.percent ?? 0))}%` }]} />
            </View>
            <Text style={styles.contSub}>{Math.round(current.progress?.percent ?? 0)}% read</Text>
          </View>
        </GlassCard>
      )}

      {latest && (
        <GlassCard style={styles.paper} onPress={() => openEssay(latest)}>
          <View style={styles.paperHead}>
            <Text style={styles.lbl}>LATEST PAPER</Text>
            <Text style={styles.contSub}>
              {latest.author === 'ta' ? '挞挞' : 'Antoine'} · {String(S.bjDate(latest.created_at).m).padStart(2, '0')}·{String(S.bjDate(latest.created_at).d).padStart(2, '0')}
            </Text>
          </View>
          <Text style={styles.paperTitle} numberOfLines={1}>
            {latest.title}
          </Text>
          {!!latest.excerpt && (
            <Text style={styles.paperEx} numberOfLines={3}>
              {latest.excerpt}
            </Text>
          )}
          {latest.reply_count > 0 && (
            <Text style={[styles.contSub, { marginTop: 8 }]}>
              {latest.reply_count} {latest.reply_count > 1 ? 'replies' : 'reply'}
            </Text>
          )}
        </GlassCard>
      )}
    </ScrollView>
  );

  // ── Focus ──
  const days = lastWeek(st.week);
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const focus = (
    <ScrollView
      style={StyleSheet.absoluteFill}
      contentContainerStyle={{ paddingTop: top + 50, paddingHorizontal: 18, paddingBottom: bottomPad }}
      onScroll={onScroll(1)}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled">
      <View style={{ alignSelf: 'center', marginBottom: 18 }}>
        <FocusRing size={250} stroke={10} seconds={secs} total={total} sub={running ? 'LEFT' : 'FOCUS'} />
      </View>
      <TextInput
        value={taskValue}
        onChangeText={setTask}
        editable={!running}
        placeholder="在做什么…"
        placeholderTextColor="rgba(255,255,255,0.5)"
        style={[styles.task, styles.taskBig]}
        returnKeyType="done"
      />
      <View style={[styles.row2, { justifyContent: 'center', gap: 14, marginVertical: 14 }]}>
        <Pressable onPress={() => adj(-5)} style={[styles.pm, styles.pmBig]}>
          <Text style={[styles.pmText, { fontSize: 20 }]}>−</Text>
        </Pressable>
        <Text style={[styles.mins, { fontSize: 26 }]}>{running ? st.active!.minutes : mins}</Text>
        <Pressable onPress={() => adj(5)} style={[styles.pm, styles.pmBig]}>
          <Text style={[styles.pmText, { fontSize: 20 }]}>+</Text>
        </Pressable>
      </View>
      <Pressable onPress={toggle} style={[styles.go, styles.goBig, running && styles.goStop]}>
        <Text style={[styles.goText, { fontSize: 17 }]}>{running ? 'Stop' : 'Start'}</Text>
      </Pressable>
      <Text style={styles.sect}>TODAY</Text>
      <GlassCard style={{ paddingVertical: 4 }}>
        {st.today.length === 0 && <Text style={[styles.liText, { padding: 16, color: 'rgba(235,235,245,0.66)' }]}>No focus yet today.</Text>}
        {st.today.map((p, i) => (
          <View key={p.id} style={[styles.li, i > 0 && styles.liLine]}>
            <View style={[styles.dot, !p.completed && styles.dotX]} />
            <Text style={styles.liText} numberOfLines={1}>
              {p.task || '—'}
            </Text>
            <Text style={styles.liMeta}>
              {p.hm} · {p.minutes} min
            </Text>
          </View>
        ))}
      </GlassCard>
      <Text style={styles.sect}>THIS WEEK</Text>
      <GlassCard style={styles.week}>
        {days.map((d, i) => (
          <View key={i} style={styles.weekCol}>
            <Text style={styles.weekN}>{d.n || ''}</Text>
            <View style={[styles.bar, { height: Math.max(4, (d.n / maxDay) * 60) }, d.today && { backgroundColor: '#fff' }]} />
            <Text style={styles.weekN}>{d.label}</Text>
          </View>
        ))}
      </GlassCard>
    </ScrollView>
  );

  // ── Library ──
  const library = (
    <ScrollView
      style={StyleSheet.absoluteFill}
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottomPad }}
      stickyHeaderIndices={[2]}
      onScroll={onScroll(2)}
      scrollEventThrottle={32}>
      <View style={[styles.top, { paddingHorizontal: 14 }]}>
        <View />
        <Circle icon="plus" label="Add" onPress={add} />
      </View>
      <Text style={styles.ptitle}>Library</Text>
      <View style={[styles.sticky, { paddingTop: insets.top > 0 ? 6 : 0 }]}>
        <BlurView tint="systemUltraThinMaterialDark" intensity={40} style={StyleSheet.absoluteFill} />
        <DomeFilter
          items={[
            { key: 'all', label: 'All' },
            { key: 'book', label: 'Books' },
            { key: 'paper', label: 'Paper' },
          ]}
          value={lib}
          onChange={setLib}
        />
        {lib === 'paper' && (
          <Animated.View entering={FadeIn.duration(180)}>
            <WhoRow
              items={[
                { key: 'all', label: 'Both' },
                { key: 'xiaoke', label: 'Antoine' },
                { key: 'ta', label: '挞挞' },
              ]}
              value={who}
              onChange={setWho}
            />
          </Animated.View>
        )}
      </View>
      <View style={styles.grid}>{shown.map((t) => tile(t, col, false))}</View>
      <Text style={styles.count}>{st.loaded ? `${shown.length} ${shown.length === 1 ? 'item' : 'items'}` : ''}</Text>
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <Image source={bg} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, styles.shade, tab === 2 && styles.shadeDeep]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, tab !== 0 && styles.hidden]} pointerEvents={tab === 0 ? 'auto' : 'none'}>
        {home}
      </View>
      <View style={[StyleSheet.absoluteFill, tab !== 1 && styles.hidden]} pointerEvents={tab === 1 ? 'auto' : 'none'}>
        {focus}
      </View>
      <View style={[StyleSheet.absoluteFill, tab !== 2 && styles.hidden]} pointerEvents={tab === 2 ? 'auto' : 'none'}>
        {library}
      </View>
      <StudyTabBar tab={tab} onTab={goTab} folded={folded} onUnfold={() => setFolded(false)} bottom={insets.bottom + 18} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  shade: { backgroundColor: 'rgba(0,0,0,0.18)' },
  hidden: { opacity: 0 },
  glass: { borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  glassTint: { backgroundColor: 'rgba(38,40,44,0.32)' },
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(38,40,44,0.3)',
  },
  circleLight: { backgroundColor: 'rgba(255,255,255,0.85)', borderColor: 'rgba(0,0,0,0.06)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: {
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 2,
    fontFamily: 'PlayfairDisplay_800ExtraBold_Italic',
    fontSize: 40,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 2 },
  },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 26, marginTop: 6, marginBottom: 16 },
  stat: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 24, color: '#fff', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 },
  statSmall: { fontFamily: 'JosefinSans_400Regular', fontSize: 12, letterSpacing: 1.9, color: 'rgba(255,255,255,0.85)' },
  focus: { padding: 16, flexDirection: 'row', gap: 16, alignItems: 'center' },
  focusR: { flex: 1, minWidth: 0, gap: 9 },
  lbl: { fontFamily: 'JosefinSans_600SemiBold', fontSize: 12, letterSpacing: 2.4, color: 'rgba(255,255,255,0.9)' },
  task: {
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 12,
  },
  taskBig: { height: 44, fontSize: 16, textAlign: 'center' },
  row2: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pm: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pmBig: { width: 40, height: 40, borderRadius: 20 },
  pmText: { color: '#fff', fontSize: 17, lineHeight: 20 },
  mins: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, minWidth: 28, textAlign: 'center', color: '#fff', fontVariant: ['tabular-nums'] },
  go: { marginLeft: 'auto', height: 32, paddingHorizontal: 16, borderRadius: 16, backgroundColor: TOMATO, alignItems: 'center', justifyContent: 'center' },
  goBig: { alignSelf: 'center', marginLeft: 0, height: 48, paddingHorizontal: 44, borderRadius: 24 },
  goStop: { backgroundColor: 'rgba(255,255,255,0.16)' },
  goText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  today: { fontSize: 12, color: 'rgba(235,235,245,0.66)' },
  todayB: { fontFamily: 'PlayfairDisplay_600SemiBold', color: '#fff', fontSize: 14 },
  shelf: { marginTop: 14, paddingVertical: 14 },
  shead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  sheadB: { fontSize: 19, fontWeight: '700', color: '#fff' },
  sheadR: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheadS: { color: 'rgba(235,235,245,0.66)', fontSize: 14 },
  covers: { gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  empty: { color: 'rgba(235,235,245,0.66)', fontSize: 14, paddingVertical: 40 },
  sect: { fontFamily: 'JosefinSans_600SemiBold', letterSpacing: 2.4, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 22, marginBottom: 8, marginHorizontal: 4 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  liLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.14)' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: TOMATO },
  dotX: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  liText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' },
  liMeta: { color: 'rgba(235,235,245,0.66)', fontSize: 13, fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  weekCol: { alignItems: 'center', gap: 6 },
  weekN: { fontSize: 11, color: 'rgba(235,235,245,0.66)' },
  bar: { width: 18, borderRadius: 6, backgroundColor: 'rgba(212,85,63,0.85)' },
  shadeDeep: { backgroundColor: 'rgba(0,0,0,0.38)' },
  ptitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 34,
    color: '#fff',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowRadius: 10,
  },
  sticky: { paddingHorizontal: 18, paddingBottom: 14, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 18, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 30 },
  count: { textAlign: 'center', color: 'rgba(235,235,245,0.66)', fontSize: 14, paddingBottom: 30 },
  cont: { marginTop: 14, padding: 16, flexDirection: 'row', gap: 16, alignItems: 'center' },
  contR: { flex: 1, minWidth: 0, gap: 5 },
  contTitle: { fontFamily: SERIF, fontSize: 17, fontWeight: '600', color: '#fff', lineHeight: 23 },
  contSub: { fontSize: 12.5, color: 'rgba(235,235,245,0.66)' },
  contBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden', marginTop: 4 },
  contFill: { height: 4, borderRadius: 2, backgroundColor: '#fff' },
  paper: { marginTop: 14, padding: 16 },
  paperHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paperTitle: { fontFamily: SERIF, fontSize: 19, fontWeight: '600', color: '#fff', marginTop: 10 },
  paperEx: { fontSize: 14, lineHeight: 22, color: 'rgba(235,235,245,0.8)', marginTop: 6 },
});
