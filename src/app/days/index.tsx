import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Necklace } from '@/components/days/Necklace';
import { EditSheet, MonthSheet, type Editing } from '@/components/days/Sheets';
import { AVATAR_HIM, AVATAR_ME } from '@/lib/config';
import * as D from '@/lib/days';
import { wallpaperUri } from '@/lib/storage';
import { useApp } from '@/state/app';

const BG = require('../../../assets/images/study-bg.jpg');
const HOUR = 50;
const ymOf = (day: string) => day.slice(0, 7);
const mins = (t: string) => {
  const [a, b] = t.split(':').map(Number);
  return a * 60 + b;
};

type Ev = { kind: 'class' | 'agenda' | 'remind'; title: string; start: string; end: string; sub: string; onPress?: () => void };

function Circle({ icon, onPress, label, plain }: { icon: SFSymbol; onPress: () => void; label: string; plain?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [styles.circle, plain && styles.circlePlain, pressed && { opacity: 0.6 }]}>
      {!plain && <BlurView tint="systemUltraThinMaterialDark" intensity={50} style={StyleSheet.absoluteFill} />}
      <SymbolView name={icon} size={17} weight="semibold" tintColor="#fff" />
    </Pressable>
  );
}

function Glass({ children }: { children: ReactNode }) {
  return (
    <View style={styles.glass}>
      <BlurView tint="systemUltraThinMaterialDark" intensity={60} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glassTint]} />
      {children}
    </View>
  );
}

// Days (her sketch, 2026-09-30): us at the top, the days strung on a necklace under us, the chosen
// day's glass card below. One page, no tabs; the month name opens the whole month.
export default function Days() {
  const insets = useSafeAreaInsets();
  const { prefs, showToast } = useApp();
  const today = D.bjToday();
  const days = useMemo(() => Array.from({ length: D.diff(D.TOGETHER, today) + 400 }, (_, i) => D.addDays(D.TOGETHER, i)), [today]);
  const todayIdx = days.indexOf(today);
  const [idx, setIdx] = useState(todayIdx);
  const [months, setMonths] = useState<Record<string, D.Month>>({});
  const loading = useRef(new Set<string>());
  const goRef = useRef<((i: number) => void) | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [mview, setMview] = useState({ y: 0, m: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const wall = wallpaperUri(prefs.wallpaper);
  const day = days[idx];

  const load = useCallback((ym: string, force = false) => {
    if (loading.current.has(ym) && !force) return;
    loading.current.add(ym);
    const [y, m] = ym.split('-').map(Number);
    D.month(y, m)
      .then((data) => setMonths((cur) => ({ ...cur, [ym]: data })))
      .catch(() => loading.current.delete(ym));
  }, []);
  const around = useCallback(
    (d: string, force = false) => {
      const [y, m] = d.split('-').map(Number);
      for (const k of [-1, 0, 1]) {
        const dt = new Date(Date.UTC(y, m - 1 + k, 1));
        load(`${dt.getUTCFullYear()}-${D.pad(dt.getUTCMonth() + 1)}`, force);
      }
    },
    [load],
  );
  useFocusEffect(
    useCallback(() => {
      around(day, true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const onIndex = (i: number) => {
    setIdx(i);
    around(days[i]);
  };

  // countdowns / anniversaries / periods come whole with every month; take the newest copy
  const anyMonth = months[ymOf(day)] ?? Object.values(months)[0];
  const countdowns = useMemo(() => anyMonth?.countdowns ?? [], [anyMonth]);
  const annivs = useMemo(() => anyMonth?.anniversaries ?? [], [anyMonth]);
  const periods = useMemo(() => anyMonth?.periods ?? [], [anyMonth]);

  const classesOf = useCallback((d: string) => (months[ymOf(d)]?.schedule[d] ?? []).filter((c) => !c.canceled), [months]);
  const agendaOf = useCallback((d: string) => months[ymOf(d)]?.agenda[d] ?? [], [months]);
  const remindersOf = useCallback((d: string) => months[ymOf(d)]?.reminders[d] ?? [], [months]);
  const cdOn = useCallback((d: string) => countdowns.filter((c) => c.target.slice(0, 10) === d), [countdowns]);
  const anOn = useCallback((d: string) => annivs.filter((a) => a.date.slice(5) === d.slice(5) && d >= a.date), [annivs]);
  const periodOn = useCallback((d: string) => periods.some((p) => d >= p.start && d <= (p.end || today)), [periods, today]);
  const infoOf = useCallback(
    (d: string) => ({ has: classesOf(d).length + agendaOf(d).length + remindersOf(d).length > 0, marked: cdOn(d).length + anOn(d).length > 0 }),
    [classesOf, agendaOf, remindersOf, cdOn, anOn],
  );

  const openMonth = () => {
    const [y, m] = day.split('-').map(Number);
    setMview({ y, m: m - 1 });
    setMonthOpen(true);
  };
  const shiftMonth = (n: number) => {
    const dt = new Date(Date.UTC(mview.y, mview.m + n, 1));
    setMview({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() });
    load(`${dt.getUTCFullYear()}-${D.pad(dt.getUTCMonth() + 1)}`);
  };
  const pickDay = (d: string) => {
    setMonthOpen(false);
    const i = days.indexOf(d);
    if (i >= 0) goRef.current?.(i);
  };
  const upcoming = useMemo(() => {
    const out: { day: string; title: string; anniv: boolean }[] = countdowns
      .filter((c) => c.target.slice(0, 10) >= today)
      .map((c) => ({ day: c.target.slice(0, 10), title: c.title, anniv: false }));
    for (const a of annivs) {
      let next = `${today.slice(0, 4)}${a.date.slice(4)}`;
      if (next < today) next = `${+today.slice(0, 4) + 1}${a.date.slice(4)}`;
      if (next > a.date) out.push({ day: next, title: a.title.split('——')[0], anniv: true });
    }
    return out.sort((a, b) => a.day.localeCompare(b.day));
  }, [countdowns, annivs, today]);
  const saved = () => {
    setEditing(null);
    around(day, true);
  };

  // ── the card ──
  const d = D.d8(day);
  const n = D.diff(today, day);
  const rel = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`;
  const evs: Ev[] = [
    ...classesOf(day).map((c) => ({ kind: 'class' as const, title: c.name, start: c.start_time, end: c.end_time, sub: c.location })),
    ...agendaOf(day)
      .filter((a) => a.start)
      .map((a) => ({ kind: 'agenda' as const, title: a.title, start: a.start, end: a.end || a.start, sub: a.note, onPress: () => setEditing({ kind: 'agenda', day, item: a }) })),
    ...remindersOf(day).map((r) => ({ kind: 'remind' as const, title: r.title, start: r.time, end: r.time, sub: '', onPress: () => router.push('/sheet/checklist') })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const allDayAgenda = agendaOf(day).filter((a) => !a.start);
  const holiday = months[ymOf(day)]?.holidays[day];

  let timeline: ReactNode = null;
  if (evs.length) {
    let lo = Math.floor(mins(evs[0].start) / 60);
    let hi = Math.ceil(Math.max(...evs.map((e) => mins(e.end) + (e.start === e.end ? 30 : 0))) / 60);
    const nowM = D.bjMinutes();
    if (day === today) {
      lo = Math.min(lo, Math.floor(nowM / 60));
      hi = Math.max(hi, Math.ceil(nowM / 60));
    }
    const y = (t: string) => ((mins(t) - lo * 60) / 60) * HOUR;
    timeline = (
      <View style={{ marginTop: 14 }}>
        {Array.from({ length: hi - lo + 1 }, (_, k) => (
          <View key={k} style={[styles.hr, k === hi - lo && { height: 8 }]}>
            <Text style={styles.hrT}>{D.pad(lo + k)}:00</Text>
            <View style={styles.hrLine} />
          </View>
        ))}
        {evs.map((e, k) => {
          const top = y(e.start);
          const point = e.start === e.end;
          return (
            <Pressable
              key={k}
              disabled={!e.onPress}
              onPress={e.onPress}
              style={[
                styles.ev,
                styles[e.kind],
                point ? { top: top - 18, height: 36, flexDirection: 'row', alignItems: 'center', gap: 10 } : { top: top + 1, height: Math.max(40, y(e.end) - top - 3) },
              ]}>
              <Text style={[styles.evT, styles[`${e.kind}Ink`]]} numberOfLines={point ? 1 : 2}>
                {e.title}
              </Text>
              <Text style={[styles.evS, styles[`${e.kind}Ink`]]} numberOfLines={1}>
                {point ? e.start : `${e.start} – ${e.end}${e.sub ? ' · ' + e.sub : ''}`}
              </Text>
            </Pressable>
          );
        })}
        {day === today && <View style={[styles.now, { top: ((nowM - lo * 60) / 60) * HOUR }]} />}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Image source={wall ? { uri: wall } : BG} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.top}>
          <Circle icon="chevron.left" label="Back" plain onPress={() => router.back()} />
          <Circle icon="plus" label="Add" onPress={() => setEditing({ kind: 'agenda', day })} />
        </View>

        <View style={styles.us}>
          <Image source={AVATAR_ME} style={styles.ava} contentFit="cover" />
          <Image source={AVATAR_HIM} style={styles.ava} contentFit="cover" />
        </View>
        <Text style={styles.tog}>
          在一起 <Text style={styles.togN}>{D.diff(D.TOGETHER, today) + 1}</Text> 天
        </Text>

        <Pressable onPress={openMonth} style={styles.month} accessibilityLabel="Open the month">
          <Text style={styles.monthT}>{D.MONTHS[d.getUTCMonth()]}</Text>
          <Text style={styles.monthY}>{d.getUTCFullYear()} ▾</Text>
        </Pressable>

        <Necklace days={days} index={todayIdx} today={today} infoOf={infoOf} onIndex={onIndex} goRef={goRef} />

        <View style={{ paddingHorizontal: 14 }}>
          <Glass>
            <View style={styles.ch}>
              <Text style={styles.chT}>
                {D.MONTHS[d.getUTCMonth()].slice(0, 3)} {d.getUTCDate()}
              </Text>
              <Text style={styles.chS}>
                {D.WEEKDAYS[d.getUTCDay()]} · {rel}
              </Text>
            </View>
            {anOn(day).map((a) => {
              const yrs = +day.slice(0, 4) - +a.date.slice(0, 4);
              return (
                <Pressable key={a.id} onPress={() => setEditing({ kind: 'anniv', day, item: a })} style={[styles.ban, styles.banAn]}>
                  <Text style={styles.banK}>{a.kind === '纪念日' ? 'EVERY YEAR' : a.kind}</Text>
                  <Text style={[styles.banT, { color: '#ffd6dd' }]} numberOfLines={2}>
                    {a.title}
                  </Text>
                  <Text style={styles.banB}>{yrs ? D.ordinal(yrs) : 'Day one'}</Text>
                </Pressable>
              );
            })}
            {cdOn(day).map((c) => (
              <Pressable key={c.id} onPress={() => setEditing({ kind: 'countdown', day, item: c })} style={styles.ban}>
                <Text style={styles.banK}>COUNTDOWN</Text>
                <Text style={styles.banT} numberOfLines={2}>
                  {c.title}
                </Text>
                <Text style={styles.banB}>{n > 0 ? `${n} days` : n === 0 ? 'Today' : 'Done'}</Text>
              </Pressable>
            ))}
            {!!holiday && (
              <View style={[styles.ban, styles.banHol]}>
                <Text style={styles.banK}>HOLIDAY</Text>
                <Text style={[styles.banT, { color: '#ffc4b8' }]}>{holiday}</Text>
              </View>
            )}
            {allDayAgenda.map((a) => (
              <Pressable key={a.id} onPress={() => setEditing({ kind: 'agenda', day, item: a })} style={[styles.ban, styles.banAg]}>
                <Text style={styles.banK}>AGENDA</Text>
                <Text style={styles.banT} numberOfLines={2}>
                  {a.title}
                  {a.note ? ` · ${a.note}` : ''}
                </Text>
              </Pressable>
            ))}
            {periodOn(day) && <Text style={styles.period}>生理期</Text>}
            {timeline}
            {!evs.length && !anOn(day).length && !cdOn(day).length && !holiday && !allDayAgenda.length && <Text style={styles.empty}>Nothing planned.</Text>}
            <Pressable onPress={() => setEditing({ kind: 'agenda', day })} style={styles.add}>
              <SymbolView name="plus" size={14} weight="semibold" tintColor="#fff" />
              <Text style={styles.addT}>Add to this day</Text>
            </Pressable>
          </Glass>
        </View>
      </ScrollView>

      <MonthSheet
        visible={monthOpen}
        onClose={() => setMonthOpen(false)}
        y={mview.y}
        m={mview.m}
        onShift={shiftMonth}
        today={today}
        chosen={day}
        dotsOf={(x) => ({
          classes: classesOf(x).length > 0,
          agenda: agendaOf(x).length > 0,
          reminder: remindersOf(x).length > 0,
          marked: cdOn(x).length + anOn(x).length > 0,
          holiday: months[ymOf(x)]?.holidays[x],
          period: periodOn(x),
        })}
        upcoming={upcoming}
        onPick={pickDay}
      />
      <EditSheet editing={editing} onClose={() => setEditing(null)} onSaved={saved} onError={showToast} />
    </GestureHandlerRootView>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  shade: { backgroundColor: 'rgba(0,0,0,0.2)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 },
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
  circlePlain: { borderWidth: 0, backgroundColor: 'transparent' },
  us: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: -6 },
  ava: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: '#ddd' },
  tog: { textAlign: 'center', marginTop: 12, fontSize: 12.5, fontWeight: '700', letterSpacing: 3, color: 'rgba(255,255,255,0.88)', ...shadow },
  togN: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 24, letterSpacing: 0, color: '#fff' },
  month: { alignSelf: 'center', alignItems: 'center', marginTop: 18, paddingHorizontal: 12, paddingVertical: 4 },
  monthT: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 30, color: '#fff', ...shadow },
  monthY: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.82)', marginTop: 2, ...shadow },
  glass: { borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', padding: 18, minHeight: 300 },
  glassTint: { backgroundColor: 'rgba(38,40,44,0.32)' },
  ch: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  chT: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 30, color: '#fff' },
  chS: { fontSize: 13, color: 'rgba(235,235,245,0.66)' },
  ban: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  banAn: { backgroundColor: 'rgba(217,102,122,0.28)' },
  banHol: { backgroundColor: 'rgba(255,120,100,0.2)' },
  banAg: { backgroundColor: 'rgba(248,228,216,0.18)' },
  banK: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, color: 'rgba(235,235,245,0.6)' },
  banT: { flex: 1, fontSize: 14, color: '#fff' },
  banB: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 17, color: '#fff' },
  period: { marginTop: 10, fontSize: 12.5, color: '#ffb8c4' },
  hr: { height: HOUR, flexDirection: 'row' },
  hrT: { width: 40, textAlign: 'right', fontSize: 11, color: 'rgba(235,235,245,0.55)', marginTop: -7, fontVariant: ['tabular-nums'] },
  hrLine: { flex: 1, marginLeft: 10, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)' },
  ev: { position: 'absolute', left: 50, right: 0, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  class: { backgroundColor: '#e6eedb' },
  agenda: { backgroundColor: '#f8e4d8' },
  remind: { backgroundColor: '#eae8f7' },
  classInk: { color: '#3f5a2e' },
  agendaInk: { color: '#8a4a2a' },
  remindInk: { color: '#4b4390' },
  evT: { fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
  evS: { fontSize: 12, opacity: 0.75, fontVariant: ['tabular-nums'] },
  now: { position: 'absolute', left: 46, right: 0, height: 1.5, backgroundColor: '#e5484d' },
  empty: { textAlign: 'center', color: 'rgba(235,235,245,0.6)', fontSize: 15, paddingVertical: 50 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  addT: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
});
