import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERIF } from '@/components/study/Covers';
import { HER_MARK, HIS_MARK, NoteThread } from '@/components/study/NoteThread';
import { AVATAR_HIM } from '@/lib/config';
import * as S from '@/lib/study';
import { useApp } from '@/state/app';

const PAPER = '#f7f3ea';
const INK = '#25221d';
const MUTED = '#8a8173';

type Seg = { text: string; mark?: S.Note };

// Split the text into plain runs and highlighted runs (each highlight found by its quote).
function segment(content: string, marks: S.Note[]): Seg[] {
  const spans: { at: number; end: number; mark: S.Note }[] = [];
  for (const m of marks) {
    const at = content.indexOf(m.quote);
    if (at < 0) continue;
    const end = at + m.quote.length;
    if (spans.some((s) => at < s.end && end > s.at)) continue;
    spans.push({ at, end, mark: m });
  }
  spans.sort((a, b) => a.at - b.at);
  const out: Seg[] = [];
  let i = 0;
  for (const s of spans) {
    if (s.at > i) out.push({ text: content.slice(i, s.at) });
    out.push({ text: content.slice(s.at, s.end), mark: s.mark });
    i = s.end;
  }
  if (i < content.length) out.push({ text: content.slice(i) });
  return out;
}

export default function EssayPage() {
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const essayId = Number(id);
  const [e, setE] = useState<S.EssayFull | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<S.Note | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [thread, setThread] = useState<{ quote: string; root: S.Note | null } | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    S.essay(essayId)
      .then(setE)
      .catch(() => showToast("Couldn't open this piece"));
  }, [essayId, showToast]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const all = useMemo(() => (e ? [...e.marks, ...e.replies] : []), [e]);
  const roots = useMemo(() => (e ? e.marks.filter((m) => m.reply_to_id == null) : []), [e]);
  const segs = useMemo(() => (e ? segment(e.content, roots) : []), [e, roots]);
  const byId = useMemo(() => new Map((e?.replies ?? []).map((r) => [r.id, r])), [e]);

  const onSelection = (s: { start: number; end: number }) => {
    if (s.end > s.start) return setSel(s);
    setSel(null);
    // A tap inside a highlight opens its notes.
    let at = 0;
    for (const g of segs) {
      if (g.mark && s.start >= at && s.start <= at + g.text.length) {
        setThread({ quote: g.mark.quote, root: g.mark });
        return;
      }
      at += g.text.length;
    }
  };

  const highlight = async (withNote: boolean) => {
    if (!e || !sel) return;
    const quote = e.content.slice(sel.start, sel.end).trim();
    setSel(null);
    if (!quote) return;
    Haptics.selectionAsync();
    if (withNote) return setThread({ quote, root: null });
    try {
      await S.addNote(essayId, { quote, color: HER_MARK });
      load();
    } catch {
      showToast("Couldn't save the highlight");
    }
  };

  const sendNote = async (t: string) => {
    if (!thread) return;
    try {
      const n = thread.root ? await S.addNote(essayId, { quote: thread.root.quote, text: t, reply_to_id: thread.root.id }) : await S.addNote(essayId, { quote: thread.quote, text: t, color: HER_MARK });
      if (!thread.root) setThread({ ...thread, root: n });
      load();
    } catch {
      showToast("Couldn't send it");
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await S.replyEssay(essayId, t, replyTo?.id);
      setText('');
      setReplyTo(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      load();
    } catch {
      showToast("Couldn't send it");
    } finally {
      setSending(false);
    }
  };

  const more = () => {
    if (!e) return;
    ActionSheetIOS.showActionSheetWithOptions({ options: ['Edit', 'Delete', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 }, (i) => {
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
                router.back();
              } catch {
                showToast("Couldn't delete it");
              }
            },
          },
        ]);
    });
  };

  const d = e ? S.bjDate(e.created_at) : null;
  const mine = e?.author === 'ta';
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 50, paddingHorizontal: 24, paddingBottom: insets.bottom + 90 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {!e ? (
          <ActivityIndicator style={{ marginTop: 80 }} color={MUTED} />
        ) : (
          <>
            <View style={styles.head}>
              <Text style={styles.title}>{e.title}</Text>
              <Text style={styles.meta}>
                {mine ? '挞挞' : 'ANTOINE'} · {d!.dots}
              </Text>
            </View>
            <TextInput editable={false} multiline scrollEnabled={false} contextMenuHidden={false} onSelectionChange={(ev) => onSelection(ev.nativeEvent.selection)} style={styles.body}>
              {segs.map((g, i) => (
                <Text key={i} style={g.mark ? { backgroundColor: g.mark.author === 'ta' ? HER_MARK : HIS_MARK } : undefined}>
                  {g.text}
                </Text>
              ))}
            </TextInput>

            <View style={styles.replies}>
              <Text style={styles.h4}>{e.replies.length ? `${e.replies.length} ${e.replies.length > 1 ? 'REPLIES' : 'REPLY'}` : 'REPLIES'}</Text>
              {e.replies.length === 0 && <Text style={styles.none}>{mine ? '他还没回。' : '还没有人回。'}</Text>}
              {e.replies.map((r) => {
                const me = r.author === 'ta';
                const to = r.reply_to_id ? byId.get(r.reply_to_id) : undefined;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setReplyTo(r);
                    }}
                    style={[styles.rp, me && styles.rpMe]}>
                    {me ? (
                      <View style={[styles.av, styles.avTa]}>
                        <Text style={{ fontSize: 12 }}>挞</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: AVATAR_HIM }} style={styles.av} />
                    )}
                    <View style={[styles.bx, me && styles.bxMe]}>
                      {to && (
                        <Text style={[styles.quote, me && styles.quoteMe]} numberOfLines={2}>
                          {to.text}
                        </Text>
                      )}
                      <Text style={[styles.bxText, me && { color: '#fff' }]}>{r.text}</Text>
                      <Text style={[styles.bxMeta, me && { color: 'rgba(255,255,255,0.75)', textAlign: 'right' }]}>
                        {me ? '挞挞' : 'Antoine'} · {S.bjDate(r.created_at).hm}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.topBtns, { top: insets.top + 8 }]}>
        {mine ? (
          <Pressable onPress={more} style={styles.round} hitSlop={8} accessibilityLabel="More">
            <SymbolView name="ellipsis" size={15} weight="bold" tintColor={INK} />
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={() => router.back()} style={styles.round} hitSlop={8} accessibilityLabel="Close">
          <SymbolView name="xmark" size={13} weight="bold" tintColor={INK} />
        </Pressable>
      </View>

      {sel && !thread && (
        <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOutDown.duration(120)} style={[styles.selBar, { bottom: insets.bottom + 70 }]}>
          <Pressable onPress={() => highlight(false)} style={styles.selBtn}>
            <View style={[styles.swatch, { backgroundColor: HER_MARK }]} />
            <Text style={styles.selText}>Highlight</Text>
          </Pressable>
          <View style={styles.selSep} />
          <Pressable onPress={() => highlight(true)} style={styles.selBtn}>
            <SymbolView name="note.text" size={15} tintColor="#fff" />
            <Text style={styles.selText}>Add Note</Text>
          </Pressable>
        </Animated.View>
      )}

      {!thread && (
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom - 6 }} style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          {replyTo && (
            <View style={styles.replyTo}>
              <Text style={styles.replyToText} numberOfLines={1}>
                回 {replyTo.author === 'ta' ? '自己' : 'Antoine'}：{replyTo.text}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <SymbolView name="xmark.circle.fill" size={16} tintColor={MUTED} />
              </Pressable>
            </View>
          )}
          <View style={styles.rin}>
            <TextInput value={text} onChangeText={setText} placeholder={mine ? '接着写一句…' : '回复这篇…'} placeholderTextColor="#aaa29a" style={styles.input} multiline />
            <Pressable onPress={send} disabled={!text.trim() || sending} style={[styles.go, (!text.trim() || sending) && { opacity: 0.4 }]}>
              <Text style={styles.goText}>Send</Text>
            </Pressable>
          </View>
        </KeyboardStickyView>
      )}

      {thread && <NoteThread quote={thread.quote} root={thread.root} all={all} onSend={sendNote} onClose={() => setThread(null)} bottom={insets.bottom + 10} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER },
  head: { alignItems: 'center', marginBottom: 18 },
  title: { fontFamily: SERIF, fontSize: 22, fontWeight: '600', color: INK, textAlign: 'center' },
  meta: { fontFamily: 'JosefinSans_400Regular', fontSize: 11, letterSpacing: 2.2, color: MUTED, marginTop: 6 },
  body: { fontFamily: SERIF, fontSize: 16, lineHeight: 30, color: INK, padding: 0 },
  replies: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#e0d9cc', paddingTop: 14 },
  h4: { fontSize: 13, letterSpacing: 1.3, color: MUTED, marginBottom: 10, fontWeight: '600' },
  none: { color: MUTED, fontSize: 14, marginBottom: 10 },
  rp: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-end' },
  rpMe: { flexDirection: 'row-reverse' },
  av: { width: 28, height: 28, borderRadius: 14 },
  avTa: { backgroundColor: '#ffd2da', alignItems: 'center', justifyContent: 'center' },
  bx: { maxWidth: '76%', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bxMe: { backgroundColor: '#1982fc' },
  bxText: { fontSize: 14.5, lineHeight: 21, color: INK },
  bxMeta: { fontSize: 11, color: '#9a9184', marginTop: 3 },
  quote: { fontSize: 12, color: '#9a9184', borderLeftWidth: 2, borderLeftColor: '#d9d0c0', paddingLeft: 6, marginBottom: 4 },
  quoteMe: { color: 'rgba(255,255,255,0.8)', borderLeftColor: 'rgba(255,255,255,0.5)' },
  topBtns: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(120,120,128,0.16)', alignItems: 'center', justifyContent: 'center' },
  inputBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 8, paddingHorizontal: 16, backgroundColor: 'rgba(247,243,234,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e0d9cc' },
  replyTo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  replyToText: { flex: 1, fontSize: 12.5, color: MUTED },
  rin: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 38, maxHeight: 120, borderRadius: 19, borderWidth: 1, borderColor: '#e0d9cc', backgroundColor: '#fff', color: INK, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, fontSize: 15 },
  go: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: '#1c1b19', alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  selBar: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,30,32,0.94)', borderRadius: 22, paddingHorizontal: 6, height: 44 },
  selBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44 },
  selSep: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: 'rgba(255,255,255,0.3)' },
  selText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  swatch: { width: 14, height: 14, borderRadius: 7 },
});
