import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import * as D from '@/lib/days';

const INK = '#1b1a19';
const MUTED = '#8a857c';

function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.sheet}>
          <BlurView tint="systemThickMaterialLight" intensity={90} style={StyleSheet.absoluteFill} />
          <View style={styles.grab} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type DayDots = { classes: boolean; agenda: boolean; reminder: boolean; marked: boolean; holiday?: string; period: boolean };

// The whole month, opened from the month name: switch months, tap a day to swing the necklace there.
export function MonthSheet({
  visible,
  onClose,
  y,
  m,
  onShift,
  today,
  chosen,
  dotsOf,
  upcoming,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  y: number;
  m: number;
  onShift: (n: number) => void;
  today: string;
  chosen: string;
  dotsOf: (day: string) => DayDots;
  upcoming: { day: string; title: string; anniv: boolean }[];
  onPick: (day: string) => void;
}) {
  const first = new Date(Date.UTC(y, m, 1));
  const lead = first.getUTCDay();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = Math.ceil((lead + days) / 7) * 7;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.mh}>
        <Text style={styles.mTitle}>{D.MONTHS[m]}</Text>
        <Text style={styles.mYear}>{y}</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => onShift(-1)} style={styles.mBtn} accessibilityLabel="Previous month">
          <SymbolView name="chevron.left" size={14} weight="semibold" tintColor={INK} />
        </Pressable>
        <Pressable onPress={() => onShift(1)} style={styles.mBtn} accessibilityLabel="Next month">
          <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={INK} />
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
          if (n < 1 || n > days) return <View key={i} style={styles.cell} />;
          const day = `${y}-${D.pad(m + 1)}-${D.pad(n)}`;
          const dt = dotsOf(day);
          return (
            <Pressable key={i} onPress={() => onPick(day)} style={[styles.cell, dt.period && styles.period]}>
              <View style={[styles.num, day === chosen && styles.numOn]}>
                <Text style={[styles.numT, day === today && styles.numToday, day === chosen && { color: '#fff' }]}>{n}</Text>
              </View>
              <View style={styles.dots}>
                {dt.classes && <View style={[styles.d, { backgroundColor: '#8fae72' }]} />}
                {dt.agenda && <View style={[styles.d, { backgroundColor: '#d99a74' }]} />}
                {dt.reminder && <View style={[styles.d, { backgroundColor: '#958ed8' }]} />}
                {dt.marked && <View style={[styles.d, styles.dRing]} />}
              </View>
              {!!dt.holiday && (
                <Text style={styles.hol} numberOfLines={1}>
                  {dt.holiday}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coming}>
        {upcoming.map((u) => (
          <Pressable key={u.day + u.title} onPress={() => onPick(u.day)} style={styles.cm}>
            <Text style={styles.cmN}>{D.diff(today, u.day)}</Text>
            <Text style={styles.cmT} numberOfLines={1}>
              {u.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

export type Editing =
  { kind: 'agenda'; day: string; item?: D.AgendaItem } | { kind: 'countdown'; day: string; item?: D.Countdown } | { kind: 'anniv'; day: string; item?: D.Anniversary };

const KINDS: { k: Editing['kind']; label: string }[] = [
  { k: 'agenda', label: 'Agenda' },
  { k: 'countdown', label: 'Countdown' },
  { k: 'anniv', label: 'Anniversary' },
];
const ANNIV_KINDS = ['纪念日', '第一次', '锚点'];

// New / edit, for all three kinds. Dates and times are typed (YYYY-MM-DD, HH:MM).
export function EditSheet({ editing, onClose, onSaved, onError }: { editing: Editing | null; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  return (
    <Sheet visible={!!editing} onClose={onClose}>
      {editing && <EditForm key={`${editing.kind}-${editing.item?.id ?? 'new'}-${editing.day}`} editing={editing} onClose={onClose} onSaved={onSaved} onError={onError} />}
    </Sheet>
  );
}

function EditForm({ editing, onClose, onSaved, onError }: { editing: Editing; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const isNew = !editing.item;
  const [kind, setKind] = useState<Editing['kind']>(editing.kind);
  const ag = editing.kind === 'agenda' ? editing.item : undefined;
  const cd = editing.kind === 'countdown' ? editing.item : undefined;
  const an = editing.kind === 'anniv' ? editing.item : undefined;
  const [title, setTitle] = useState(ag?.title ?? cd?.title ?? an?.title ?? '');
  const [date, setDate] = useState(ag?.date ?? cd?.target.slice(0, 10) ?? an?.date ?? editing.day);
  const [start, setStart] = useState(ag?.start ?? (cd?.has_time ? cd.target.slice(11, 16) : ''));
  const [end, setEnd] = useState(ag?.end ?? '');
  const [weekly, setWeekly] = useState(ag?.weekly ?? false);
  const [note, setNote] = useState(ag?.note ?? '');
  const [akind, setAkind] = useState(an?.kind ?? '纪念日');
  const [busy, setBusy] = useState(false);

  const okDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const okTime = (t: string) => !t || /^\d{2}:\d{2}$/.test(t);
  const valid = !!title.trim() && okDate && okTime(start) && okTime(end);

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (kind === 'agenda') {
        const body = { title: title.trim(), date, start, end, weekly, note: note.trim() };
        await (ag ? D.agendaEdit(ag.id, body) : D.agendaAdd(body));
      } else if (kind === 'countdown') {
        const target = `${date}T${start || '00:00'}`;
        await (cd ? D.countdownEdit(cd.id, { title: title.trim(), target, has_time: !!start }) : D.countdownAdd(title.trim(), target, !!start));
      } else {
        await (an ? D.annivEdit(an.id, { date, title: title.trim(), kind: akind }) : D.annivAdd(date, title.trim(), akind));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
    } catch {
      onError("Couldn't save it");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      if (ag) await D.agendaDelete(ag.id);
      else if (cd) await D.countdownDelete(cd.id);
      else if (an) await D.annivDelete(an.id);
      onSaved();
    } catch {
      onError("Couldn't delete it");
    }
  };

  return (
    <View>
      <View style={styles.sh}>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.shBtn}>Cancel</Text>
        </Pressable>
        <Text style={styles.shTitle}>{isNew ? 'New' : 'Edit'}</Text>
        <Pressable onPress={save} hitSlop={8} disabled={!valid || busy}>
          <Text style={[styles.shBtn, styles.shOk, (!valid || busy) && { opacity: 0.35 }]}>Save</Text>
        </Pressable>
      </View>
      {isNew && (
        <View style={styles.seg}>
          {KINDS.map((k) => (
            <Pressable key={k.k} onPress={() => setKind(k.k)} style={[styles.segB, kind === k.k && styles.segOn]}>
              <Text style={styles.segT}>{k.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.form}>
        <Row label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={kind === 'agenda' ? '絮絮家教' : kind === 'countdown' ? '回家' : '第一次…'}
            placeholderTextColor="#b0aba2"
            style={styles.input}
          />
        </Row>
        <Row label="Date" line>
          <TextInput value={date} onChangeText={setDate} placeholder="2026-10-04" placeholderTextColor="#b0aba2" style={styles.input} keyboardType="numbers-and-punctuation" />
        </Row>
        {kind !== 'anniv' && (
          <Row label={kind === 'agenda' ? 'Starts' : 'Time'} line>
            <TextInput
              value={start}
              onChangeText={setStart}
              placeholder={kind === 'agenda' ? '18:30' : 'All day'}
              placeholderTextColor="#b0aba2"
              style={styles.input}
              keyboardType="numbers-and-punctuation"
            />
          </Row>
        )}
        {kind === 'agenda' && (
          <>
            <Row label="Ends" line>
              <TextInput value={end} onChangeText={setEnd} placeholder="20:00" placeholderTextColor="#b0aba2" style={styles.input} keyboardType="numbers-and-punctuation" />
            </Row>
            <Row label="Every week" line>
              <Switch value={weekly} onValueChange={setWeekly} />
            </Row>
            <Row label="Note" line>
              <TextInput value={note} onChangeText={setNote} placeholder="五年级英语" placeholderTextColor="#b0aba2" style={styles.input} />
            </Row>
          </>
        )}
        {kind === 'anniv' && (
          <Row label="Kind" line>
            <View style={styles.kinds}>
              {ANNIV_KINDS.map((k) => (
                <Pressable key={k} onPress={() => setAkind(k)} style={[styles.kind, akind === k && styles.kindOn]}>
                  <Text style={[styles.kindT, akind === k && { color: '#fff' }]}>{k}</Text>
                </Pressable>
              ))}
            </View>
          </Row>
        )}
      </View>
      {!isNew && (
        <Pressable onPress={remove} style={styles.del}>
          <Text style={styles.delT}>Delete</Text>
        </Pressable>
      )}
    </View>
  );
}

function Row({ label, line, children }: { label: string; line?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.row, line && styles.rowLine]}>
      <Text style={styles.rowL}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    overflow: 'hidden',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 36,
    backgroundColor: 'rgba(248,246,243,0.55)',
  },
  grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)', marginBottom: 12 },
  mh: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 6, paddingBottom: 12 },
  mTitle: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 28, color: INK },
  mYear: { fontSize: 13, fontWeight: '600', color: MUTED, letterSpacing: 1 },
  mBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(118,118,128,0.14)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 22, paddingVertical: 8 },
  wh: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '600', color: MUTED, paddingBottom: 6 },
  cell: { width: `${100 / 7}%`, height: 50, alignItems: 'center', paddingTop: 4, borderRadius: 14 },
  period: { backgroundColor: '#fbe7eb' },
  num: { width: 30, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numOn: { backgroundColor: INK },
  numT: { fontSize: 16, color: INK, fontVariant: ['tabular-nums'] },
  numToday: { color: '#e5484d', fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 2.5, height: 6, marginTop: 3 },
  d: { width: 5, height: 5, borderRadius: 3 },
  dRing: { borderWidth: 1.2, borderColor: INK, width: 6, height: 6 },
  hol: { position: 'absolute', bottom: 1, fontSize: 8.5, fontWeight: '700', color: '#c0392b' },
  coming: { gap: 8, paddingTop: 14, paddingHorizontal: 2 },
  cm: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 220,
  },
  cmN: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 17, color: INK },
  cmT: { fontSize: 13, color: INK, flexShrink: 1 },
  sh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 14 },
  shBtn: { fontSize: 17, color: INK },
  shOk: { fontWeight: '700' },
  shTitle: { fontSize: 17, fontWeight: '600', color: INK },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(118,118,128,0.14)', borderRadius: 12, padding: 2, marginBottom: 14 },
  segB: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segT: { fontSize: 14, fontWeight: '600', color: INK },
  form: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 50 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.12)' },
  rowL: { fontSize: 16, color: INK },
  input: { flex: 1, textAlign: 'right', fontSize: 16, color: INK, paddingVertical: 12 },
  kinds: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  kind: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(118,118,128,0.14)' },
  kindOn: { backgroundColor: INK },
  kindT: { fontSize: 14, color: INK },
  del: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  delT: { fontSize: 16, fontWeight: '600', color: '#d23b31' },
});
