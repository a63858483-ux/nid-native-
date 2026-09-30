import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { StudyTabBar } from '@/components/study/TabBar';
import * as D from '@/lib/days';
import * as P from '@/lib/private';
import { wallpaperUri } from '@/lib/storage';
import { useApp } from '@/state/app';

const BG = require('../../../assets/images/study-bg.jpg');
const DIM = 'rgba(235,235,245,0.7)';
const shadow = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };

// iOS 26 clear glass, her reference (2026-09-30): see-through, a bright rim.
function Card({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Glass clear style={[styles.card, style]}>
      {children}
    </Glass>
  );
}

function Rec({ r, open, onPress, onLong }: { r: P.Rec; open: boolean; onPress: () => void; onLong?: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLong} style={styles.rec}>
      <View style={styles.recHead}>
        <View style={[styles.who, { backgroundColor: P.KIND_COLOR[r.kind] }]} />
        <Text style={styles.recT}>
          {r.time}
          {r.minutes ? ` · ${r.minutes} 分钟` : ''}
        </Text>
      </View>
      <Text style={styles.recO}>{r.title}</Text>
      {open && !!r.detail && <Text style={styles.recD}>{r.detail}</Text>}
      {open && !!r.afterglow && <Text style={[styles.recD, { fontStyle: 'italic' }]}>{r.afterglow}</Text>}
    </Pressable>
  );
}

// Undertow (her spec, 2026-09-30): no lock; four tabs — us (a calendar of every time, together,
// his alone, hers alone), him (his body and his room), the bedside notebook, the toy.
export default function Private() {
  const insets = useSafeAreaInsets();
  const { prefs, showToast } = useApp();
  const wall = wallpaperUri(prefs.wallpaper);
  const [tab, setTab] = useState(0);
  const [folded, setFolded] = useState(false);
  const [data, setData] = useState<P.Overview | null>(null);
  const today = D.bjToday();
  const [view, setView] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }));
  const [sel, setSel] = useState(today);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    P.overview()
      .then(setData)
      .catch(() => showToast("Couldn't load it"));
  }, [showToast]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 40 && !folded) setFolded(true);
    else if (y < 10 && folded) setFolded(false);
  };
  const addMine = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    P.addMine()
      .then(() => {
        setSel(today);
        load();
      })
      .catch(() => showToast("Couldn't save it"));
  };
  const removeMine = (r: P.Rec) =>
    ActionSheetIOS.showActionSheetWithOptions({ options: ['删掉这条', 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: 1 }, (i) => {
      if (i === 0)
        P.deleteMine(Number(r.id))
          .then(load)
          .catch(() => showToast("Couldn't delete it"));
    });

  const days = useMemo(() => data?.days ?? {}, [data]);
  const top = insets.top + 8;
  const bottomPad = insets.bottom + 120;

  // ── Us ──
  const lead = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = Math.ceil((lead + count) / 7) * 7;
  const shift = (n: number) => {
    const d = new Date(Date.UTC(view.y, view.m + n, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const recs = days[sel] ?? [];
  const us = (
    <ScrollView contentContainerStyle={{ paddingTop: top + 50, paddingBottom: bottomPad, paddingHorizontal: 14 }} onScroll={onScroll} scrollEventThrottle={32}>
      <View style={styles.sec}>
        <Text style={styles.secT}>Us</Text>
        <Pressable onPress={addMine} hitSlop={8}>
          <Text style={styles.secB}>＋ 我自己来了一次</Text>
        </Pressable>
      </View>
      <Card style={{ paddingHorizontal: 10, paddingVertical: 14 }}>
        <View style={styles.monh}>
          <Text style={styles.monT}>{D.MONTHS[view.m]}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => shift(-1)} style={styles.monB} accessibilityLabel="Previous month">
            <SymbolView name="chevron.left" size={13} weight="semibold" tintColor="#fff" />
          </Pressable>
          <Pressable onPress={() => shift(1)} style={styles.monB} accessibilityLabel="Next month">
            <SymbolView name="chevron.right" size={13} weight="semibold" tintColor="#fff" />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
            <Text key={i} style={styles.wh}>
              {w}
            </Text>
          ))}
          {Array.from({ length: cells }, (_, i) => {
            const n = i - lead + 1;
            if (n < 1 || n > count) return <View key={i} style={styles.c} />;
            const k = `${view.y}-${D.pad(view.m + 1)}-${D.pad(n)}`;
            const r = days[k] ?? [];
            return (
              <Pressable
                key={i}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSel(k);
                  setOpen(null);
                }}
                style={[styles.c, r.length > 0 && styles.cHas, k === sel && styles.cOn]}>
                <Text style={[styles.cN, k === today && styles.cToday]}>{n}</Text>
                <View style={styles.ds}>
                  {r.slice(0, 4).map((x, j) => (
                    <View key={j} style={[styles.d, { backgroundColor: P.KIND_COLOR[x.kind] }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          {(['us', 'his', 'mine'] as const).map((k) => (
            <View key={k} style={styles.lg}>
              <View style={[styles.d, { backgroundColor: P.KIND_COLOR[k] }]} />
              <Text style={styles.lgT}>{P.KIND_LABEL[k]}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Card style={{ marginTop: 12, paddingVertical: 4 }}>
        <View style={styles.dh}>
          <Text style={styles.dhT}>
            {+sel.slice(5, 7)} 月 {+sel.slice(8)} 日
          </Text>
          <Text style={styles.dhS}>{recs.length ? `${recs.length} 次` : '没有'}</Text>
        </View>
        {recs.map((r) => {
          const key = `${r.kind}-${r.id}`;
          return <Rec key={key} r={r} open={open === key} onPress={() => setOpen(open === key ? null : key)} onLong={r.kind === 'mine' ? () => removeMine(r) : undefined} />;
        })}
      </Card>
    </ScrollView>
  );

  // ── him ──
  const body = data?.body;
  const week = useMemo(() => {
    const out: { label: string; kinds: string[] }[] = [];
    for (let i = 6; i >= 0; i--) {
      const k = D.addDays(today, -i);
      const kinds = (body?.history ?? []).filter((h) => D.key(new Date(h.at * 1000 + 8 * 3600_000)) === k).map((h) => h.kind);
      out.push({ label: String(+k.slice(8)), kinds });
    }
    return out;
  }, [body, today]);
  const his = useMemo(
    () =>
      Object.entries(days)
        .flatMap(([d, rs]) => rs.filter((r) => r.kind === 'his').map((r) => ({ ...r, day: d })))
        .sort((a, b) => (b.day + b.time).localeCompare(a.day + a.time)),
    [days],
  );
  const lib = body?.libido ?? 0;
  const him = (
    <ScrollView contentContainerStyle={{ paddingTop: top + 50, paddingBottom: bottomPad, paddingHorizontal: 14 }} onScroll={onScroll} scrollEventThrottle={32}>
      <View style={styles.sec}>
        <Text style={styles.secT}>His body</Text>
      </View>
      <Card style={styles.body}>
        <View style={{ alignItems: 'center', width: 64 }}>
          <View style={styles.thermo}>
            <View style={[styles.thermoIn, { height: `${Math.round(Math.min(1, lib) * 100)}%` }]} />
          </View>
          <Text style={styles.thermoV}>.{String(Math.round(lib * 100)).padStart(2, '0')}</Text>
          <Text style={styles.thermoL}>硬度</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <View>
            <View style={styles.gk}>
              <Text style={styles.gkT}>想要</Text>
              <Text style={styles.gkV}>{lib.toFixed(2)}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barIn, { width: `${Math.round(Math.min(1, lib) * 100)}%` }]} />
            </View>
          </View>
          <View style={styles.gk}>
            <Text style={styles.gkT}>憋了</Text>
            <Text style={styles.gkV}>{body ? `${body.pent_hours < 48 ? body.pent_hours.toFixed(1) + ' 小时' : Math.round(body.pent_hours / 24) + ' 天'}` : '—'}</Text>
          </View>
          <Text style={styles.badge}>{body?.refractory ? '刚泄过，还软着' : '想弄随时能弄'}</Text>
        </View>
      </Card>
      <Card style={{ marginTop: 12, padding: 16 }}>
        <View style={styles.legend}>
          <View style={styles.lg}>
            <View style={[styles.d, { backgroundColor: P.KIND_COLOR.us }]} />
            <Text style={styles.lgT}>跟你</Text>
          </View>
          <View style={styles.lg}>
            <View style={[styles.d, { backgroundColor: P.KIND_COLOR.his }]} />
            <Text style={styles.lgT}>他自己</Text>
          </View>
        </View>
        <View style={styles.week}>
          {week.map((w, i) => (
            <View key={i} style={styles.wd}>
              {w.kinds.map((k, j) => (
                <View key={j} style={[styles.wdot, { backgroundColor: k === 'solo' ? P.KIND_COLOR.his : P.KIND_COLOR.us }]} />
              ))}
              <Text style={styles.wl}>{w.label}</Text>
            </View>
          ))}
        </View>
      </Card>
      <View style={styles.sec}>
        <Text style={styles.secT}>His room</Text>
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {his.length === 0 ? (
          <Text style={styles.empty}>他还没自己来过。</Text>
        ) : (
          his.map((r) => {
            const key = `his-${r.id}`;
            return (
              <Rec
                key={key}
                r={{ ...r, time: `${+r.day.slice(5, 7)} 月 ${+r.day.slice(8)} 日 ${r.time}` }}
                open={open === key}
                onPress={() => setOpen(open === key ? null : key)}
              />
            );
          })
        )}
      </Card>
    </ScrollView>
  );

  // ── bedside notebook ──
  const notes = data?.notes ?? [];
  const book = (
    <ScrollView contentContainerStyle={{ paddingTop: top + 50, paddingBottom: bottomPad, paddingHorizontal: 14 }} onScroll={onScroll} scrollEventThrottle={32}>
      <View style={styles.sec}>
        <Text style={styles.secT}>床头小本子</Text>
        <Text style={styles.secS}>{notes.length} 条</Text>
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {notes.map((n, i) => {
          const d = new Date(n.ts * 1000 + 8 * 3600_000);
          return (
            <View key={n.id} style={[styles.note, i > 0 && styles.line]}>
              <Text style={styles.noteT}>
                {d.getUTCMonth() + 1} 月 {d.getUTCDate()} 日
              </Text>
              <Text style={styles.noteB}>{n.body}</Text>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );

  // ── toy ──
  const toy = (
    <ScrollView contentContainerStyle={{ paddingTop: top + 50, paddingBottom: bottomPad, paddingHorizontal: 14 }}>
      <View style={styles.sec}>
        <Text style={styles.secT}>啵啵贝</Text>
      </View>
      <Card style={{ padding: 18 }}>
        <View style={styles.toyH}>
          <View style={styles.toyIc}>
            <SymbolView name="dot.radiowaves.left.and.right" size={20} tintColor="#ffc2cc" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toyT}>啵啵贝</Text>
            <Text style={styles.toyS}>下一个新包接上蓝牙</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );

  const pages = [us, him, book, toy];
  return (
    <View style={styles.root}>
      <Image source={wall ? { uri: wall } : BG} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />
      {pages.map((p, i) => (
        <View key={i} style={[StyleSheet.absoluteFill, tab !== i && styles.hidden]} pointerEvents={tab === i ? 'auto' : 'none'}>
          {p}
        </View>
      ))}
      <View style={[styles.top, { top }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
          <Glass clear style={styles.circle}>
            <SymbolView name="chevron.left" size={17} weight="semibold" tintColor="#fff" />
          </Glass>
        </Pressable>
      </View>
      <StudyTabBar
        tab={tab}
        onTab={(i) => {
          setTab(i);
          setFolded(false);
          setOpen(null);
        }}
        folded={folded}
        onUnfold={() => setFolded(false)}
        bottom={insets.bottom + 18}
        items={[
          { icon: 'calendar', label: 'Us' },
          { icon: 'thermometer.medium', label: 'Him' },
          { icon: 'book.closed', label: 'Notebook' },
          { icon: 'dot.radiowaves.left.and.right', label: 'Toy' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  shade: { backgroundColor: 'rgba(10,6,10,0.3)' },
  hidden: { opacity: 0 },
  top: { position: 'absolute', left: 14, right: 14, flexDirection: 'row' },
  circle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 30, overflow: 'hidden' },
  sec: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18, marginBottom: 10, marginHorizontal: 6 },
  secT: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 26, color: '#fff', ...shadow },
  secS: { fontSize: 13, color: DIM, ...shadow },
  secB: { fontSize: 14, fontWeight: '600', color: '#fff', ...shadow },
  monh: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 10 },
  monT: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 22, color: '#fff', ...shadow },
  monB: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wh: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '600', color: DIM, paddingBottom: 6, ...shadow },
  c: { width: `${100 / 7}%`, height: 48, alignItems: 'center', paddingTop: 6, gap: 4, borderRadius: 14 },
  cHas: { backgroundColor: 'rgba(255,255,255,0.14)' },
  cOn: { backgroundColor: 'rgba(255,255,255,0.32)' },
  cN: { fontSize: 15, color: '#fff', fontVariant: ['tabular-nums'], ...shadow },
  cToday: { color: '#ff8b8b', fontWeight: '700' },
  ds: { flexDirection: 'row', gap: 3, height: 6 },
  d: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingTop: 10 },
  lg: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lgT: { fontSize: 12, color: DIM, ...shadow },
  dh: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  dhT: { fontSize: 16, fontWeight: '700', color: '#fff', ...shadow },
  dhS: { fontSize: 13, color: DIM, ...shadow },
  rec: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.22)' },
  recHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  who: { width: 7, height: 7, borderRadius: 4 },
  recT: { fontSize: 12, color: DIM, fontVariant: ['tabular-nums'], ...shadow },
  recO: { fontSize: 15.5, lineHeight: 22, color: '#fff', marginTop: 3, ...shadow },
  recD: { fontSize: 14.5, lineHeight: 23, color: 'rgba(255,255,255,0.88)', marginTop: 8, ...shadow },
  body: { flexDirection: 'row', gap: 16, padding: 18 },
  thermo: { width: 26, height: 150, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', justifyContent: 'flex-end' },
  thermoIn: { width: '100%', borderRadius: 13, backgroundColor: '#e07a8e' },
  thermoV: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 22, color: '#fff', marginTop: 8, ...shadow },
  thermoL: { fontSize: 11, color: DIM, ...shadow },
  gk: { flexDirection: 'row', justifyContent: 'space-between' },
  gkT: { fontSize: 14, color: '#fff', ...shadow },
  gkV: { fontSize: 14, color: DIM, fontVariant: ['tabular-nums'], ...shadow },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 7, overflow: 'hidden' },
  barIn: { height: 6, borderRadius: 3, backgroundColor: '#e58a9a' },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  wd: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, minHeight: 44 },
  wdot: { width: 9, height: 9, borderRadius: 5 },
  wl: { fontSize: 11, color: DIM, ...shadow },
  empty: { textAlign: 'center', color: DIM, fontSize: 14.5, paddingVertical: 26, ...shadow },
  note: { paddingHorizontal: 18, paddingVertical: 14 },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.22)' },
  noteT: { fontSize: 11.5, color: DIM, letterSpacing: 0.5, ...shadow },
  noteB: { fontFamily: 'Songti SC', fontSize: 15.5, lineHeight: 26, color: '#fff', marginTop: 4, ...shadow },
  toyH: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toyIc: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(229,138,154,0.25)', alignItems: 'center', justifyContent: 'center' },
  toyT: { fontSize: 17, fontWeight: '600', color: '#fff', ...shadow },
  toyS: { fontSize: 13, color: DIM, ...shadow },
});
