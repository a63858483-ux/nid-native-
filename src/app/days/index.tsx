import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Necklace } from '@/components/days/Necklace';
import { EditSheet, MonthSheet, type Editing } from '@/components/days/Sheets';
import { AVATAR_HIM, AVATAR_ME } from '@/lib/config';
import * as D from '@/lib/days';
import { useApp } from '@/state/app';

const HOUR = 56;
const ymOf = (day: string) => day.slice(0, 7);
const mins = (t: string) => {
  const [a, b] = t.split(':').map(Number);
  return a * 60 + b;
};

type Ev = { kind: 'class' | 'agenda' | 'remind'; title: string; start: string; end: string; sub: string; onPress?: () => void };

function Circle({ icon, onPress, label, plain }: { icon: SFSymbol; onPress: () => void; label: string; plain?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [styles.circle, plain && styles.circlePlain, pressed && { opacity: 0.6 }]}>
      <SymbolView name={icon} size={17} weight="semibold" tintColor={INK} />
    </Pressable>
  );
}

// Days (her sketch, 2026-09-30): us at the top, the days strung on a necklace under us, the chosen
// day's glass card below. One page, no tabs; the month name opens the whole month.
export default function Days() {
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();
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

  // ── the day, like Calendar (her call, 2026-09-30): white, one day at a time ──
  const d = D.d8(day);
  const EMO = (name: string) => (/法语/.test(name) ? '🇫🇷' : /舞蹈/.test(name) ? '💃' : /写作/.test(name) ? '✍️' : /演讲/.test(name) ? '🎤' : '📚');
  const evs: Ev[] = [
    ...classesOf(day).map((c) => ({ kind: 'class' as const, title: `课程 | ${EMO(c.name)} ${c.name}`, start: c.start_time, end: c.end_time, sub: c.location })),
    ...agendaOf(day)
      .filter((a) => a.start)
      .map((a) => ({
        kind: 'agenda' as const,
        title: `日程 | 🧑‍🏫 ${a.title}`,
        start: a.start,
        end: a.end || a.start,
        sub: a.note,
        onPress: () => setEditing({ kind: 'agenda', day, item: a }),
      })),
    ...remindersOf(day).map((r) => ({
      kind: 'remind' as const,
      title: `提醒 | ⏰ ${r.title}`,
      start: r.time,
      end: r.time,
      sub: '',
      onPress: () => router.push('/sheet/checklist'),
    })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const allDayAgenda = agendaOf(day).filter((a) => !a.start);
  const holiday = months[ymOf(day)]?.holidays[day];
  const annToday = anOn(day);
  const nowM = D.bjMinutes();
  const lo = Math.min(7, ...evs.map((e) => Math.floor(mins(e.start) / 60)));
  const y = (t: string) => ((mins(t) - lo * 60) / 60) * HOUR;
  const upcomingCds = countdowns.filter((c) => c.target.slice(0, 10) >= today).sort((a, b) => a.target.localeCompare(b.target));

  return (
    <GestureHandlerRootView style={styles.root}>
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

        {upcomingCds.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cdRow}>
            <Text style={styles.cdL}>倒数</Text>
            {upcomingCds.map((c) => {
              const left = D.diff(today, c.target.slice(0, 10));
              return (
                <Pressable
                  key={c.id}
                  onPress={() => pickDay(c.target.slice(0, 10))}
                  onLongPress={() => setEditing({ kind: 'countdown', day: c.target.slice(0, 10), item: c })}
                  style={[styles.cd, left <= 7 && styles.cdNear]}>
                  <Text style={[styles.cdN, left <= 7 && { color: RED }]}>{left}</Text>
                  <Text style={styles.cdU}>天</Text>
                  <Text style={styles.cdT} numberOfLines={1}>
                    {c.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.dayHead}>
          <Text style={styles.dayHeadT}>
            {D.WEEKDAYS[d.getUTCDay()]} – {D.MONTHS[d.getUTCMonth()].slice(0, 3)} {d.getUTCDate()}, {d.getUTCFullYear()}
          </Text>
        </View>
        {(annToday.length > 0 || !!holiday || allDayAgenda.length > 0 || periodOn(day)) && (
          <View style={styles.allDay}>
            {annToday.map((a) => {
              const yrs = +day.slice(0, 4) - +a.date.slice(0, 4);
              return (
                <Pressable key={a.id} onPress={() => setEditing({ kind: 'anniv', day, item: a })} style={[styles.ad, styles.adAn]}>
                  <Text style={styles.adT} numberOfLines={2}>
                    ❤️ {a.title}
                    {yrs ? ` · ${yrs} 周年` : ''}
                  </Text>
                </Pressable>
              );
            })}
            {!!holiday && (
              <View style={[styles.ad, styles.adHol]}>
                <Text style={styles.adT}>🎈 {holiday}</Text>
              </View>
            )}
            {allDayAgenda.map((a) => (
              <Pressable key={a.id} onPress={() => setEditing({ kind: 'agenda', day, item: a })} style={[styles.ad, styles.adAg]}>
                <Text style={styles.adT} numberOfLines={2}>
                  🧑‍🏫 {a.title}
                  {a.note ? ` · ${a.note}` : ''}
                </Text>
              </Pressable>
            ))}
            {periodOn(day) && (
              <View style={[styles.ad, styles.adPeriod]}>
                <Text style={styles.adT}>🩸 生理期</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.grid}>
          {Array.from({ length: 24 - lo + 1 }, (_, k) => (
            <View key={k} style={[styles.hr, k === 24 - lo && { height: 20 }]}>
              <Text style={styles.hrT}>{D.pad((lo + k) % 24)}:00</Text>
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
                style={[styles.ev, styles[e.kind], point ? { top: top - 14, height: 28, justifyContent: 'center' } : { top: top + 1, height: Math.max(36, y(e.end) - top - 2) }]}>
                <Text style={[styles.evT, styles[`${e.kind}Ink`], point && { fontSize: 13 }]} numberOfLines={point ? 1 : 2}>
                  {e.title}
                  {point ? ` · ${e.start}` : ''}
                </Text>
                {!point && (
                  <View style={styles.evS}>
                    <SymbolView name="clock" size={10} tintColor={INK_OF[e.kind]} />
                    <Text style={[styles.evST, styles[`${e.kind}Ink`]]} numberOfLines={1}>
                      {e.start}–{e.end}
                      {e.sub ? ` · ${e.sub}` : ''}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          {day === today && nowM >= lo * 60 && (
            <>
              <View style={[styles.now, { top: ((nowM - lo * 60) / 60) * HOUR }]} />
              <View style={[styles.nowPill, { top: ((nowM - lo * 60) / 60) * HOUR - 10 }]}>
                <Text style={styles.nowT}>
                  {D.pad(Math.floor(nowM / 60))}:{D.pad(nowM % 60)}
                </Text>
              </View>
            </>
          )}
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

const INK = '#1c1c1e';
const GRAY = '#8e8e93';
const RED = '#ff3b30';
const LINE = '#e5e5ea';
const INK_OF = { class: '#2f5a24', agenda: '#1d4f99', remind: '#6a2f96' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 },
  circle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7' },
  circlePlain: { backgroundColor: 'transparent' },
  us: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: -6 },
  ava: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#fff', backgroundColor: '#ddd' },
  tog: { textAlign: 'center', marginTop: 12, fontSize: 12.5, fontWeight: '700', letterSpacing: 3, color: GRAY },
  togN: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 24, letterSpacing: 0, color: INK },
  month: { alignSelf: 'center', alignItems: 'center', marginTop: 18, paddingHorizontal: 12, paddingVertical: 4 },
  monthT: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 30, color: INK },
  monthY: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: GRAY, marginTop: 2 },
  cdRow: { alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 },
  cdL: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: GRAY },
  cd: { flexDirection: 'row', alignItems: 'baseline', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#f2f2f7', maxWidth: 230 },
  cdNear: { backgroundColor: '#fff0ef' },
  cdN: { fontSize: 20, fontWeight: '700', color: INK, fontVariant: ['tabular-nums'] },
  cdU: { fontSize: 13.5, color: INK },
  cdT: { fontSize: 12, color: GRAY, marginLeft: 2, flexShrink: 1 },
  dayHead: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE, paddingVertical: 12, alignItems: 'center' },
  dayHeadT: { fontSize: 17, fontWeight: '600', color: INK },
  allDay: { gap: 4, paddingVertical: 6, paddingLeft: 66, paddingRight: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LINE },
  ad: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 8, paddingVertical: 4 },
  adAn: { backgroundColor: '#fde8ec', borderLeftColor: '#e0607a' },
  adHol: { backgroundColor: '#fff0e0', borderLeftColor: '#f0a040' },
  adAg: { backgroundColor: '#e2edfb', borderLeftColor: '#3b82e0' },
  adPeriod: { backgroundColor: '#fbe7eb', borderLeftColor: '#d9667a' },
  adT: { fontSize: 13, color: INK },
  grid: { marginRight: 8, marginTop: 10 },
  hr: { height: HOUR, flexDirection: 'row' },
  hrT: { width: 52, textAlign: 'right', fontSize: 12.5, color: GRAY, marginTop: -8, fontVariant: ['tabular-nums'] },
  hrLine: { flex: 1, marginLeft: 10, height: StyleSheet.hairlineWidth, backgroundColor: LINE },
  ev: { position: 'absolute', left: 66, right: 0, borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden' },
  class: { backgroundColor: '#eaf4e4', borderLeftColor: '#6bb05a' },
  agenda: { backgroundColor: '#e2edfb', borderLeftColor: '#3b82e0' },
  remind: { backgroundColor: '#f3e8fc', borderLeftColor: '#b36fe0' },
  classInk: { color: INK_OF.class },
  agendaInk: { color: INK_OF.agenda },
  remindInk: { color: INK_OF.remind },
  evT: { fontSize: 14.5, fontWeight: '600', lineHeight: 19 },
  evS: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  evST: { fontSize: 12.5, opacity: 0.85, fontVariant: ['tabular-nums'], flexShrink: 1 },
  now: { position: 'absolute', left: 62, right: 0, height: 2, backgroundColor: RED },
  nowPill: { position: 'absolute', left: 2, backgroundColor: RED, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  nowT: { color: '#fff', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
