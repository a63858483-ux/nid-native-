import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { bjDate, type Note } from '@/lib/study';

export const HER_MARK = '#ffd84d';
export const HIS_MARK = '#b9dcff';

// Every note that hangs off a root highlight, oldest first (replies can reply to replies).
export function threadOf(root: Note, all: Note[]) {
  const ids = new Set([root.id]);
  const out: Note[] = [];
  for (const n of [...all].sort((a, b) => a.created_at - b.created_at)) {
    if (n.reply_to_id != null && ids.has(n.reply_to_id)) {
      ids.add(n.id);
      out.push(n);
    }
  }
  return out;
}

// A highlight opened up: the quote, then both of us talking under it (hers right, his left).
// With no root yet it is the "Add Note" composer for a fresh selection.
export function NoteThread({
  quote,
  root,
  all,
  onSend,
  onClose,
  bottom,
}: {
  quote: string;
  root: Note | null;
  all: Note[];
  onSend: (text: string) => Promise<void>;
  onClose: () => void;
  bottom: number;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const msgs = root ? [...(root.text ? [root] : []), ...threadOf(root, all)] : [];
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onSend(t);
      setText('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView behavior="padding" style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close note" />
      <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(160)} style={[styles.card, { marginBottom: bottom }]}>
        <BlurView tint="systemChromeMaterialLight" intensity={90} style={StyleSheet.absoluteFill} />
        <View style={styles.head}>
          <Text style={styles.quote} numberOfLines={4}>
            {quote}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.x} accessibilityLabel="Close">
            <SymbolView name="xmark" size={11} weight="bold" tintColor="#555" />
          </Pressable>
        </View>
        {msgs.length > 0 && (
          <ScrollView style={styles.list} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {msgs.map((m) => {
              const me = m.author === 'ta';
              return (
                <View key={m.id} style={[styles.msg, me && styles.msgMe]}>
                  <View style={[styles.bub, me ? styles.bubMe : styles.bubHim]}>
                    <Text style={[styles.bubText, me && { color: '#fff' }]}>{m.text}</Text>
                  </View>
                  <Text style={styles.who}>
                    {me ? '挞挞' : 'Antoine'} · {bjDate(m.created_at).hm}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={root ? '回一句…' : '写点什么…'}
            placeholderTextColor="#999"
            style={styles.input}
            multiline
            autoFocus={!root}
          />
          <Pressable onPress={send} disabled={!text.trim() || busy} style={[styles.send, (!text.trim() || busy) && { opacity: 0.4 }]} accessibilityLabel="Send">
            <SymbolView name="arrow.up" size={15} weight="bold" tintColor="#fff" />
          </Pressable>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    borderRadius: 22,
    overflow: 'hidden',
    padding: 14,
    maxHeight: '62%',
    backgroundColor: 'rgba(250,250,250,0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  head: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  quote: { flex: 1, fontSize: 13, lineHeight: 19, color: '#666', borderLeftWidth: 3, borderLeftColor: HER_MARK, paddingLeft: 8 },
  x: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(118,118,128,0.16)', alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0, marginBottom: 8 },
  msg: { alignItems: 'flex-start' },
  msgMe: { alignItems: 'flex-end' },
  bub: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  bubMe: { backgroundColor: '#1982fc' },
  bubHim: { backgroundColor: '#e9e9eb' },
  bubText: { fontSize: 15, lineHeight: 21, color: '#111' },
  who: { fontSize: 11, color: '#999', marginTop: 2, marginHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 110,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15,
    color: '#222',
  },
  send: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1982fc', alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  editor: {
    marginTop: 'auto',
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    minHeight: 260,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  edHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  edTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  edTime: { fontWeight: '400', color: '#8e8e93' },
  edOk: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1c1c1e', alignItems: 'center', justifyContent: 'center' },
  edQuote: { flexDirection: 'row', gap: 10, marginTop: 16 },
  edBar: { width: 3, borderRadius: 2, backgroundColor: HER_MARK },
  edQuoteText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#333' },
  edInput: { fontSize: 17, lineHeight: 24, color: '#111', marginTop: 14, minHeight: 90, textAlignVertical: 'top' },
});

// Apple Books' note sheet: "Note 17:30", the quote under a yellow bar, the note itself, ✓ to keep it.
export function NoteEditor({
  quote,
  initial,
  at,
  onSave,
  onClose,
  bottom,
}: {
  quote: string;
  initial: string;
  at: number;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
  bottom: number;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const d = new Date(at + 8 * 3600_000);
  const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSave(text.trim());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView behavior="padding" style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.12)' }]} onPress={onClose} accessibilityLabel="Close note" />
      <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(160)} style={[styles.editor, { paddingBottom: 16 + bottom }]}>
        <View style={styles.edHead}>
          <Text style={styles.edTitle}>
            Note <Text style={styles.edTime}>{hm}</Text>
          </Text>
          <Pressable onPress={save} style={styles.edOk} accessibilityLabel="Done" hitSlop={8}>
            <SymbolView name="checkmark" size={17} weight="semibold" tintColor="#fff" />
          </Pressable>
        </View>
        <View style={styles.edQuote}>
          <View style={styles.edBar} />
          <Text style={styles.edQuoteText} numberOfLines={3}>
            {quote}
          </Text>
        </View>
        <TextInput value={text} onChangeText={setText} autoFocus multiline placeholder="Add a note" placeholderTextColor="#aaa" style={styles.edInput} />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
