import { BlurView } from 'expo-blur';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import * as P from '@/lib/payments';
import type { QuizCard } from '@/lib/text';

const INK = '#1c1c1e';
const MUTED = 'rgba(28,28,30,0.58)';
const ROSE = '#b5616f';
const OK = '#4C8A6B';
const BAD = '#C0685F';

/* ── the glass sheet both cards open (her call, 2026-09-30: cards in the thread solid white,
   what they open is liquid glass) ── */
function GlassSheet({ visible, onClose, children, dim = 0.08 }: { visible: boolean; onClose: () => void; children: ReactNode; dim?: number }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} onPress={onClose} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <BlurView tint="systemUltraThinMaterialLight" intensity={70} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.sheetTint]} pointerEvents="none" />
            <View style={styles.sheetShine} pointerEvents="none" />
            <View style={styles.grab} />
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── pay ── */
export function PayCard({ id, onOpen }: { id: string; onOpen: (p: P.Pay) => void }) {
  const [pay, setPay] = useState<P.Pay | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    P.get(id)
      .then(setPay)
      .catch(() => setFailed(true));
  }, [id]);
  useEffect(load, [load]);
  // while it is being paid, keep checking until it settles
  useEffect(() => {
    if (!pay || !P.LIVE.has(pay.status)) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [pay, load]);
  if (failed)
    return (
      <View style={[styles.pay, { padding: 14 }]}>
        <Text style={styles.muted}>这张单子读不到了</Text>
      </View>
    );
  if (!pay)
    return (
      <View style={[styles.pay, { padding: 18, alignItems: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  const pending = pay.status === 'pending_approval';
  const good = pay.status === 'paid' || pay.status === 'completed';
  const stopped = !pending && !good && !P.LIVE.has(pay.status);
  return (
    <Pressable onPress={() => onOpen(pay)} style={({ pressed }) => [styles.pay, stopped && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}>
      <View style={styles.payTop}>
        {!!pay.platform && <Text style={styles.brand}>{pay.platform}</Text>}
        <View style={styles.payState}>
          <View style={[styles.dot, { backgroundColor: good ? '#34c759' : pending || P.LIVE.has(pay.status) ? '#ff9f0a' : '#aeaeb2' }]} />
          <Text style={styles.payStateT}>{P.STATE[pay.status] ?? pay.status}</Text>
        </View>
      </View>
      <Text style={styles.payGoods} numberOfLines={2}>
        {pay.goods}
      </Text>
      <Text style={styles.paySpec} numberOfLines={1}>
        {[pay.spec, `×${pay.qty || 1}`].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.payAmt}>
        <Text style={styles.payBig}>
          <Text style={{ fontSize: 16 }}>¥</Text>
          {P.yuan(pay.total)}
        </Text>
        {!!pay.discount && !!pay.subtotal && <Text style={styles.payWas}>¥{P.yuan(pay.subtotal)}</Text>}
      </View>
      <View style={styles.payGo}>
        <Text style={[styles.payGoT, good && { color: '#34c759' }]}>{pending ? '查看并确认' : '看单据'}</Text>
        <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={good ? '#34c759' : '#1982fc'} />
      </View>
    </Pressable>
  );
}

export function PaySheet({ pay, onClose, onChanged }: { pay: P.Pay | null; onClose: () => void; onChanged: () => void }) {
  return (
    <GlassSheet visible={!!pay} onClose={onClose}>
      {pay && <PayBody key={pay.request_id} pay={pay} onClose={onClose} onChanged={onChanged} />}
    </GlassSheet>
  );
}

function PayBody({ pay, onClose, onChanged }: { pay: P.Pay; onClose: () => void; onChanged: () => void }) {
  const [cur, setCur] = useState<P.Pay>(pay);
  const [left, setLeft] = useState(pay.expires_in);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (cur.status !== 'pending_approval') return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [cur]);
  const pending = cur.status === 'pending_approval' && left > 0;
  const act = async (yes: boolean) => {
    setBusy(true);
    setErr('');
    try {
      const next = yes ? await P.approve(cur) : await P.reject(cur);
      setCur(next);
      Haptics.notificationAsync(yes ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      onChanged();
      if (!yes) onClose();
    } catch (e) {
      setErr(e instanceof Error && /400/.test(e.message) ? '这张单子确认不了了，让他重新出一张' : '网络不好，再试一次');
    } finally {
      setBusy(false);
    }
  };
  const rows: [string, string, boolean?][] = [];
  if (cur.merchant) rows.push(['商家', cur.merchant]);
  if (cur.subtotal) rows.push(['商品小计', `¥${P.yuan(cur.subtotal)}`]);
  if (cur.shipping != null) rows.push(['运费', cur.shipping ? `¥${P.yuan(cur.shipping)}` : '免运费']);
  if (cur.discount) rows.push([cur.discount_label || '优惠', `-¥${P.yuan(cur.discount)}`, true]);
  if (cur.method) rows.push(['支付方式', cur.method]);
  if (cur.address) rows.push(['送到', cur.address]);
  const good = cur.status === 'paid' || cur.status === 'completed';
  return (
    <>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 6 }}>
        <View style={styles.sh}>
          <Pressable onPress={onClose} style={styles.x} hitSlop={8} accessibilityLabel="Close">
            <SymbolView name="xmark" size={12} weight="bold" tintColor="#3a3a3c" />
          </Pressable>
          <Text style={styles.shT}>{pending ? '确认付款' : '单据'}</Text>
          <View style={{ width: 32 }} />
        </View>
        <Text style={styles.bigL}>实付金额</Text>
        <Text style={styles.big}>
          <Text style={{ fontSize: 24 }}>¥</Text>
          {P.yuan(cur.total)}
        </Text>
        <Text style={styles.goods}>{cur.goods}</Text>
        <Text style={styles.goodsSub}>{[cur.spec, `×${cur.qty || 1}`].filter(Boolean).join(' · ')}</Text>
        <View style={styles.grp}>
          {rows.map(([k, v, cut], i) => (
            <View key={k} style={[styles.row, i > 0 && styles.rowLine]}>
              <Text style={styles.rowK}>{k}</Text>
              <Text style={[styles.rowV, cut && { color: '#ff3b30' }]}>{v}</Text>
            </View>
          ))}
        </View>
        {!!cur.reason && (
          <View style={[styles.grp, { padding: 14 }]}>
            <Text style={styles.whyK}>他为什么挑这个</Text>
            <Text style={styles.why}>{cur.reason}</Text>
          </View>
        )}
        <Text style={styles.exp}>
          {pending
            ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} 内确认有效`
            : (P.STATE[cur.status] ?? cur.status) + (cur.error_code ? ` · ${cur.error_code}` : '')}
        </Text>
        {!!err && <Text style={[styles.exp, { color: '#ff3b30' }]}>{err}</Text>}
        {pending ? (
          <>
            <Pressable onPress={() => act(true)} disabled={busy} style={({ pressed }) => [styles.payBtn, pressed && { opacity: 0.85 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnT}>确认付款 ¥{P.yuan(cur.total)}</Text>}
            </Pressable>
            <Pressable onPress={() => act(false)} disabled={busy} style={styles.no}>
              <Text style={styles.noT}>不要了</Text>
            </Pressable>
          </>
        ) : good ? (
          <View style={[styles.payBtn, { backgroundColor: 'rgba(52,199,89,0.85)' }]}>
            <Text style={styles.payBtnT}>✓ 已付款</Text>
          </View>
        ) : null}
        <Text style={styles.fp}>单据指纹 {cur.fingerprint_short}</Text>
      </ScrollView>
    </>
  );
}

/* ── quiz ── */
const doneFile = () => new File(Paths.document, 'quiz-done.json');
let doneSet: Set<string> | null = null;
export function quizDone(key: string) {
  if (!doneSet) {
    try {
      const f = doneFile();
      doneSet = new Set(f.exists ? (JSON.parse(f.textSync()) as string[]) : []);
    } catch {
      doneSet = new Set();
    }
  }
  return doneSet.has(key);
}
function markQuizDone(key: string) {
  quizDone(key);
  doneSet!.add(key);
  try {
    doneFile().write(JSON.stringify([...doneSet!].slice(-300)));
  } catch {}
}

export function QuizPill({ count, ask, done, onPress }: { count: number; ask: boolean; done: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, done && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}>
      <View style={styles.pillQ}>
        <Text style={styles.pillQT}>?</Text>
      </View>
      <Text style={styles.pillT}>{done ? (ask ? '已选' : `已答 · ${count} 道`) : ask ? '选一个' : `答题 · ${count} 道`}</Text>
    </Pressable>
  );
}

type St = { pick: number | null; typed: string; done: boolean };
const isOpts = (c: QuizCard) => Array.isArray(c.options) && c.options.length > 0;
const graded = (c: QuizCard) => (isOpts(c) ? typeof c.a === 'number' : Array.isArray(c.accept));
const rightOf = (c: QuizCard, s: St) => (isOpts(c) ? s.pick === c.a : (c.accept ?? []).some((x) => x.trim().toLowerCase() === s.typed.trim().toLowerCase()));

// Pops up where the keyboard was when a new one arrives; one card at a time, judged on the spot.
export function QuizSheet({ open, onClose, onSend }: { open: { key: string; cards: QuizCard[]; ask: boolean } | null; onClose: () => void; onSend: (text: string) => void }) {
  return (
    <GlassSheet visible={!!open} onClose={onClose} dim={0.12}>
      {open && <QuizBody key={open.key} open={open} onClose={onClose} onSend={onSend} />}
    </GlassSheet>
  );
}

function QuizBody({ open, onClose, onSend }: { open: { key: string; cards: QuizCard[]; ask: boolean }; onClose: () => void; onSend: (text: string) => void }) {
  const cards = open.cards;
  const [i, setI] = useState(0);
  const [st, setSt] = useState<St[]>(() => cards.map(() => ({ pick: null, typed: '', done: false })));
  const [draft, setDraft] = useState('');
  const c = cards[i];
  const s = st[i];
  const last = i === cards.length - 1;
  const set = (patch: Partial<St>) => setSt((x) => x.map((y, k) => (k === i ? { ...y, ...patch } : y)));

  const finishAsk = (text: string) => {
    markQuizDone(open.key);
    onClose();
    onSend(text);
  };
  const submit = (all: St[]) => {
    const lines = cards.map((q, k) => {
      const a = all[k];
      const shortq = q.q
        .replace(/<[^>]+>/g, '__')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 16);
      const idpart = graded(q) && typeof q.id === 'number' ? `#${q.id}` : '';
      const ans = isOpts(q) ? (a.pick != null ? q.options![a.pick] : a.typed || '（跳过）') : a.typed || '（空）';
      const mark = graded(q) ? (rightOf(q, a) ? ' ✓' : ' ✗') : '';
      return `· ${q.tag || '日常'}${idpart} ${shortq} → ${ans}${mark}`;
    });
    markQuizDone(open.key);
    onClose();
    onSend(`【抽查·答完了】\n${lines.join('\n')}`);
  };
  const pick = (k: number) => {
    if (s.done) return;
    Haptics.selectionAsync();
    if (open.ask) return finishAsk(c.options![k]);
    set({ pick: k, done: true });
    Haptics.notificationAsync(graded(c) && c.a !== k ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
  };
  const typed = () => {
    const v = draft.trim();
    if (!v) return;
    if (open.ask) return finishAsk(v);
    set({ typed: v, done: true });
    setDraft('');
  };
  const next = () => (last ? submit(st) : setI(i + 1));

  return (
    <>
      <View style={styles.sh}>
        <Pressable onPress={onClose} style={styles.x} hitSlop={8} accessibilityLabel="Close">
          <SymbolView name="xmark" size={12} weight="bold" tintColor="#3a3a3c" />
        </Pressable>
        {cards.length > 1 ? (
          <View style={styles.nav}>
            <Pressable onPress={() => setI(Math.max(0, i - 1))} disabled={i === 0} hitSlop={8}>
              <SymbolView name="chevron.left" size={14} tintColor={i === 0 ? 'rgba(0,0,0,0.2)' : MUTED} />
            </Pressable>
            <Text style={styles.navT}>
              {i + 1} / {cards.length}
            </Text>
            <Pressable onPress={() => setI(Math.min(cards.length - 1, i + 1))} disabled={last || !s.done} hitSlop={8}>
              <SymbolView name="chevron.right" size={14} tintColor={last || !s.done ? 'rgba(0,0,0,0.2)' : MUTED} />
            </Pressable>
          </View>
        ) : (
          <View />
        )}
        <View style={{ width: 32 }} />
      </View>
      {!open.ask && (
        <View style={styles.eb}>
          {!!c.tag && <Text style={styles.chip}>{c.tag}</Text>}
          <Text style={styles.kind}>{c.t || (isOpts(c) ? '选择' : graded(c) ? '填空' : '问答')}</Text>
        </View>
      )}
      <Text style={styles.q}>{c.q}</Text>
      {isOpts(c) && (
        <View>
          {c.options!.map((o, k) => {
            const show = s.done && graded(c);
            const ok = show && k === c.a;
            const bad = show && k === s.pick && k !== c.a;
            const picked = s.done && !graded(c) && k === s.pick;
            return (
              <Pressable
                key={k}
                onPress={() => pick(k)}
                disabled={s.done}
                style={({ pressed }) => [styles.opt, k > 0 && styles.optLine, pressed && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                <View style={[styles.num, (ok || picked) && styles.numOk, bad && styles.numBad, picked && styles.numPick]}>
                  <Text style={[styles.numT, ok && { color: OK }, bad && { color: BAD }, picked && { color: ROSE }]}>{k + 1}</Text>
                </View>
                <Text style={styles.optT}>{o}</Text>
                {ok && <Text style={[styles.mark, { color: OK }]}>✓</Text>}
                {bad && <Text style={[styles.mark, { color: BAD }]}>✗</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
      {(!isOpts(c) || open.ask) && !s.done && (
        <View style={[styles.in, isOpts(c) && { marginTop: 10 }]}>
          <SymbolView name="pencil" size={15} tintColor={MUTED} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={open.ask ? '自己写…' : graded(c) ? '填这里' : '写给他…'}
            placeholderTextColor={MUTED}
            style={styles.input}
            autoFocus={!isOpts(c)}
            onSubmitEditing={typed}
            returnKeyType="done"
          />
          <Pressable onPress={typed} disabled={!draft.trim()} style={[styles.send, !draft.trim() && { opacity: 0.35 }]}>
            <Text style={styles.sendT}>{open.ask ? '发' : '好'}</Text>
          </Pressable>
        </View>
      )}
      {s.done && !isOpts(c) && <Text style={styles.typed}>你写的：{s.typed}</Text>}
      {s.done &&
        (graded(c) ? (
          rightOf(c, s) ? (
            <Text style={[styles.verdict, styles.vOk]}>✓ 对了。</Text>
          ) : (
            <Text style={[styles.verdict, styles.vBad]}>✗ 是 {isOpts(c) ? c.options![c.a!] : c.accept![0]}。</Text>
          )
        ) : (
          <Text style={[styles.verdict, styles.vOpen]}>交给他了，他会回你。</Text>
        ))}
      {s.done && (
        <View style={styles.foot}>
          <Pressable onPress={next} style={styles.next}>
            <Text style={styles.nextT}>{last ? '交卷' : '下一题'}</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  muted: { color: '#8e8e93', fontSize: 14 },
  // pay card in the thread: solid white
  pay: {
    width: 250,
    maxWidth: '78%',
    alignSelf: 'flex-start',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  payTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12 },
  brand: { fontSize: 11, fontWeight: '700', color: '#ff5000', backgroundColor: '#fff0e8', borderRadius: 6, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2 },
  payState: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  payStateT: { fontSize: 11.5, fontWeight: '600', color: '#8e8e93' },
  payGoods: { paddingHorizontal: 14, paddingTop: 8, fontSize: 15, fontWeight: '600', color: INK, lineHeight: 20 },
  paySpec: { paddingHorizontal: 14, paddingTop: 2, fontSize: 12.5, color: '#8e8e93' },
  payAmt: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  payBig: { fontSize: 28, fontWeight: '700', color: INK, fontVariant: ['tabular-nums'] },
  payWas: { fontSize: 12.5, color: '#8e8e93', textDecorationLine: 'line-through' },
  payGo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  payGoT: { fontSize: 15, fontWeight: '600', color: '#1982fc' },
  // glass sheet
  sheetWrap: { marginTop: 'auto', paddingHorizontal: 8, paddingBottom: 8 },
  sheet: {
    borderRadius: 34,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: 640,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  sheetTint: { backgroundColor: 'rgba(250,250,255,0.22)' },
  sheetShine: { position: 'absolute', top: 0, left: 24, right: 24, height: 1.5, backgroundColor: 'rgba(255,255,255,0.95)' },
  grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)', marginBottom: 10 },
  sh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  x: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.45)' },
  shT: { fontSize: 16, fontWeight: '600', color: INK },
  bigL: { textAlign: 'center', fontSize: 12.5, fontWeight: '600', color: MUTED, marginTop: 4 },
  big: { textAlign: 'center', fontSize: 44, fontWeight: '700', color: INK, fontVariant: ['tabular-nums'] },
  goods: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: INK, marginTop: 8 },
  goodsSub: { textAlign: 'center', fontSize: 13, color: MUTED, marginTop: 2 },
  grp: { marginTop: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingHorizontal: 16, paddingVertical: 11 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.7)' },
  rowK: { fontSize: 14.5, color: INK },
  rowV: { flex: 1, textAlign: 'right', fontSize: 14.5, color: MUTED },
  whyK: { fontSize: 11, fontWeight: '700', color: MUTED, marginBottom: 4 },
  why: { fontSize: 14, lineHeight: 20, color: '#3a3a3c' },
  exp: { textAlign: 'center', fontSize: 12.5, color: MUTED, marginTop: 12, fontVariant: ['tabular-nums'] },
  payBtn: { marginTop: 10, height: 54, borderRadius: 27, backgroundColor: 'rgba(20,20,22,0.85)', alignItems: 'center', justifyContent: 'center' },
  payBtnT: { color: '#fff', fontSize: 17, fontWeight: '600' },
  no: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  noT: { color: '#ff3b30', fontSize: 15 },
  fp: { textAlign: 'center', fontSize: 11, color: 'rgba(28,28,30,0.35)', marginTop: 4, fontFamily: 'Menlo' },
  // quiz pill in the thread: solid white
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pillQ: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#8e8e93', alignItems: 'center', justifyContent: 'center' },
  pillQT: { fontSize: 12, fontWeight: '700', color: '#8e8e93' },
  pillT: { fontSize: 15, fontWeight: '600', color: INK },
  // quiz sheet
  nav: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  navT: { fontSize: 13.5, color: MUTED, fontVariant: ['tabular-nums'] },
  eb: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  chip: {
    fontSize: 12,
    fontWeight: '600',
    color: ROSE,
    backgroundColor: 'rgba(246,228,231,0.75)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  kind: { fontSize: 12, fontWeight: '600', color: ROSE },
  q: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: INK, marginBottom: 12 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  optLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(60,60,67,0.2)' },
  num: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(60,60,67,0.22)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numOk: { borderColor: OK, backgroundColor: 'rgba(228,240,233,0.9)' },
  numBad: { borderColor: BAD, backgroundColor: 'rgba(246,227,225,0.9)' },
  numPick: { borderColor: ROSE, backgroundColor: 'rgba(246,228,231,0.9)' },
  numT: { fontSize: 13.5, color: MUTED, fontVariant: ['tabular-nums'] },
  optT: { flex: 1, fontSize: 16.5, color: INK, lineHeight: 22 },
  mark: { fontSize: 16, width: 18, textAlign: 'center' },
  in: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  input: { flex: 1, fontSize: 16.5, color: INK, paddingVertical: 8 },
  send: { backgroundColor: 'rgba(20,20,22,0.85)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  sendT: { color: '#fff', fontSize: 14, fontWeight: '600' },
  typed: { marginTop: 6, fontSize: 14, fontWeight: '500', color: MUTED },
  verdict: { marginTop: 14, fontSize: 14.5, lineHeight: 21, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, overflow: 'hidden' },
  vOk: { backgroundColor: 'rgba(228,240,233,0.8)', color: OK },
  vBad: { backgroundColor: 'rgba(246,227,225,0.8)', color: BAD },
  vOpen: { backgroundColor: 'rgba(246,228,231,0.75)', color: ROSE },
  foot: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  next: { backgroundColor: 'rgba(20,20,22,0.85)', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 },
  nextT: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
