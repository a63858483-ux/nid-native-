import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Footnote, Group } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import * as api from '@/lib/api';
import { usePalette } from '@/lib/colors';
import { useApp } from '@/state/app';

const GREEN = '#34C759';
const hm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function ChecklistSheet() {
  const pal = usePalette();
  const { showToast } = useApp();
  const [items, setItems] = useState<api.ChecklistItem[] | null>(null);
  const [draft, setDraft] = useState('');
  const [fixed, setFixed] = useState(false);
  const [at, setAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.checklistList());
    } catch {
      showToast("Couldn't load the checklist");
    }
  }, [showToast]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = async (it: api.ChecklistItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((cur) => cur?.map((x) => (x.id === it.id ? { ...x, done: it.done ? 0 : 1 } : x)) ?? cur);
    try {
      await api.checklistToggle(it.id, !it.done);
    } catch {
      load();
    }
  };
  const remove = async (it: api.ChecklistItem) => {
    setItems((cur) => cur?.filter((x) => x.id !== it.id) ?? cur);
    try {
      await api.checklistDelete(it.id);
    } catch {
      load();
    }
  };
  const add = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    const time = at.trim();
    if (time && !/^\d{1,2}:\d{2}$/.test(time)) return showToast('Time looks like 21:30');
    setBusy(true);
    try {
      await api.checklistAdd(body, { is_fixed: fixed, ...(time ? { at: time } : {}) });
      setDraft('');
      setAt('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load();
    } catch {
      showToast("Couldn't add that");
    } finally {
      setBusy(false);
    }
  };

  const all = items ?? [];
  const done = all.filter((x) => x.done).length;
  const daily = all.filter((x) => x.is_fixed);
  const once = all.filter((x) => !x.is_fixed);
  const C = 2 * Math.PI * 18;

  const Row = ({ it, first }: { it: api.ChecklistItem; first: boolean }) => {
    const late = !!it.trigger_at && !it.done && it.trigger_at * 1000 < Date.now();
    return (
      <Animated.View exiting={FadeOut.duration(180)} layout={LinearTransition.springify().damping(18)} style={styles.row}>
        {!first && <View style={[styles.sep, { backgroundColor: pal.line }]} />}
        <Pressable onPress={() => toggle(it)} hitSlop={6} style={[styles.ck, { borderColor: it.done ? GREEN : pal.ink2 }, !!it.done && { backgroundColor: GREEN }]}>
          {it.done ? <SymbolView name="checkmark" size={12} weight="bold" tintColor="#fff" /> : null}
        </Pressable>
        <Pressable onPress={() => toggle(it)} style={{ flex: 1 }}>
          <Text style={[styles.body, { color: it.done ? pal.ink2 : pal.ink }, !!it.done && styles.struck]}>{it.body}</Text>
          {(it.trigger_at || it.created_by === 'assistant') && (
            <View style={styles.meta}>
              {it.trigger_at ? (
                <View style={[styles.pill, late ? styles.pillLate : { backgroundColor: pal.fill }]}>
                  <SymbolView name="bell.fill" size={9} tintColor={late ? '#FF3B30' : pal.ink2} />
                  <Text style={[styles.pillText, { color: late ? '#FF3B30' : pal.ink2 }]}>{hm(it.trigger_at * 1000)}</Text>
                </View>
              ) : null}
              {it.created_by === 'assistant' ? (
                <View style={[styles.pill, styles.pillHim]}>
                  <Text style={[styles.pillText, { color: pal.blue }]}>from Antoine</Text>
                </View>
              ) : null}
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => remove(it)} hitSlop={8} accessibilityLabel="Delete" style={styles.x}>
          <SymbolView name="xmark" size={11} tintColor={pal.ink2} />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <SheetHeader title="Checklist" />
      <View style={styles.head}>
        <Svg width={48} height={48} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={24} cy={24} r={18} stroke={pal.fill} strokeWidth={5} fill="none" />
          <Circle cx={24} cy={24} r={18} stroke={GREEN} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (all.length ? done / all.length : 0))} />
        </Svg>
        <View style={{ flex: 1 }}>
          <Text style={[styles.count, { color: pal.ink }]}>{items ? `${done} of ${all.length} done` : ' '}</Text>
          <Text style={[styles.sub, { color: pal.ink2 }]}>{items ? (all.length - done ? `${all.length - done} left` : 'All done.') : 'Loading…'}</Text>
        </View>
        <Text style={[styles.date, { color: pal.ink2 }]}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
      </View>

      {items === null ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : (
        <>
          {daily.length > 0 && (
            <>
              <Text style={[styles.sec, { color: pal.ink2 }]}>EVERY DAY  <Text style={styles.secNote}>resets at midnight</Text></Text>
              <Group>{daily.map((it, i) => <Row key={it.id} it={it} first={i === 0} />)}</Group>
            </>
          )}
          <Text style={[styles.sec, { color: pal.ink2 }]}>TODAY  <Text style={styles.secNote}>cleared tomorrow</Text></Text>
          <Group>
            {once.map((it, i) => <Row key={it.id} it={it} first={i === 0} />)}
            {once.length === 0 && <Text style={[styles.empty, { color: pal.ink2 }]}>Nothing here yet.</Text>}
          </Group>
        </>
      )}

      <Group>
        <View style={styles.addRow}>
          <View style={[styles.ghost, { borderColor: pal.ink2 }]} />
          <TextInput value={draft} onChangeText={setDraft} placeholder="Add something…" placeholderTextColor={pal.ink2} onSubmitEditing={add} returnKeyType="done" style={[styles.addInput, { color: pal.ink }]} />
        </View>
        <View style={styles.opts}>
          <Pressable onPress={() => setFixed((f) => !f)} style={[styles.opt, { backgroundColor: fixed ? pal.ink : pal.fill }]}>
            <SymbolView name="repeat" size={11} tintColor={fixed ? pal.bg : pal.ink2} />
            <Text style={[styles.optText, { color: fixed ? pal.bg : pal.ink2 }]}>Every day</Text>
          </Pressable>
          <View style={[styles.opt, { backgroundColor: pal.fill }]}>
            <SymbolView name="bell" size={11} tintColor={pal.ink2} />
            <TextInput value={at} onChangeText={setAt} placeholder="Remind 21:30" placeholderTextColor={pal.ink2} keyboardType="numbers-and-punctuation" style={[styles.optInput, { color: pal.ink }]} />
          </View>
          <Pressable onPress={add} disabled={!draft.trim() || busy} style={[styles.go, { backgroundColor: pal.blue }, (!draft.trim() || busy) && { opacity: 0.4 }]}>
            <SymbolView name="arrow.up" size={14} weight="bold" tintColor="#fff" />
          </Pressable>
        </View>
      </Group>
      <Footnote>Shared with him. Daily items reset at midnight, one-offs are cleared the next day.</Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingBottom: 6 },
  count: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sub: { fontSize: 13.5, marginTop: 2 },
  date: { fontSize: 12.5, fontWeight: '600', alignSelf: 'flex-start', marginTop: 4 },
  sec: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.6, marginHorizontal: 24, marginTop: 10, marginBottom: 6 },
  secNote: { fontWeight: '500', letterSpacing: 0, fontSize: 11.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 },
  sep: { position: 'absolute', top: 0, left: 52, right: 0, height: StyleSheet.hairlineWidth },
  ck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 16, lineHeight: 21 },
  struck: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', gap: 6, marginTop: 5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillLate: { backgroundColor: 'rgba(255,59,48,0.12)' },
  pillHim: { backgroundColor: 'rgba(10,132,255,0.12)' },
  pillText: { fontSize: 11.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  x: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', opacity: 0.6 },
  empty: { padding: 16, fontSize: 14 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12, paddingTop: 10 },
  ghost: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.6, borderStyle: 'dashed' },
  addInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  opts: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 52, paddingRight: 12, paddingBottom: 10 },
  opt: { height: 28, borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  optText: { fontSize: 12.5, fontWeight: '600' },
  optInput: { fontSize: 12.5, fontWeight: '600', width: 96, paddingVertical: 0 },
  go: { marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
