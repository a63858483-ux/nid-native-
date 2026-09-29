import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERIF } from '@/components/study/Covers';
import * as S from '@/lib/study';
import { useApp } from '@/state/app';

const INK = '#1c1b19';

// Write a piece for Paper (or edit one of hers). No title means today's date, like a diary.
export default function Compose() {
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id ? Number(id) : null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [orig, setOrig] = useState({ title: '', body: '' });

  useEffect(() => {
    if (!editing) return;
    S.essay(editing)
      .then((e) => {
        setTitle(e.title);
        setBody(e.content);
        setOrig({ title: e.title, body: e.content });
      })
      .catch(() => showToast("Couldn't load it"));
  }, [editing, showToast]);

  const dirty = title !== orig.title || body !== orig.body;
  const close = () => {
    if (!dirty || !body.trim()) return router.back();
    Alert.alert(editing ? 'Discard changes?' : 'Discard this piece?', undefined, [
      { text: 'Keep Writing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };
  const post = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      if (editing) await S.updateEssay(editing, title.trim(), body);
      else await S.writeEssay(title.trim(), body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(editing ? 'Saved' : 'Posted. He will see it.');
      router.back();
    } catch {
      showToast("Couldn't post it");
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={close} style={styles.round} hitSlop={8} accessibilityLabel="Close">
          <SymbolView name="xmark" size={14} weight="bold" tintColor={INK} />
        </Pressable>
        <Pressable onPress={post} disabled={!body.trim() || busy} style={[styles.post, (!body.trim() || busy) && { opacity: 0.35 }]}>
          <Text style={styles.postText}>{editing ? 'Save' : 'Post'}</Text>
        </Pressable>
      </View>
      <KeyboardAwareScrollView bottomOffset={30} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <TextInput value={title} onChangeText={setTitle} placeholder="标题（可以不写，默认用今天的日期）" placeholderTextColor="#b3aa9b" style={styles.title} returnKeyType="next" />
        <TextInput value={body} onChangeText={setBody} placeholder="写点什么…" placeholderTextColor="#b3aa9b" style={styles.body} multiline autoFocus={!editing} scrollEnabled={false} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f3ee' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  post: { height: 34, paddingHorizontal: 16, borderRadius: 17, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  postText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  title: { fontFamily: SERIF, fontSize: 24, fontWeight: '600', color: INK, paddingTop: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e0d9cc' },
  body: { fontFamily: SERIF, fontSize: 16, lineHeight: 30, color: INK, minHeight: 360, paddingTop: 14, textAlignVertical: 'top' },
});
