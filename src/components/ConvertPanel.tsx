import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '@/lib/colors';

// After releasing on Convert to Text: the words, editable, and three ways out.
export function ConvertPanel({
  text,
  myColor,
  onCancel,
  onSendText,
  onSendVoice,
}: {
  text: string | null;
  myColor: string;
  onCancel: () => void;
  onSendText: (t: string) => void;
  onSendVoice: () => void;
}) {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  // the transcript arrives a moment after the panel opens; edits take over from there
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? text ?? '';
  const blue = myColor === 'glass' ? pal.blue : myColor;
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={[StyleSheet.absoluteFill, styles.dim]}>
      <KeyboardAvoidingView behavior="padding" style={[styles.col, { paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.box}>
          {text === null ? (
            <View style={styles.wait}>
              <ActivityIndicator color="#111" />
              <Text style={styles.waitText}>Listening back…</Text>
            </View>
          ) : (
            <TextInput autoFocus multiline value={value} onChangeText={setDraft} style={styles.input} />
          )}
        </View>
        <View style={styles.acts}>
          <Act label="Cancel" icon="xmark" onPress={onCancel} />
          <Act label="Send text" icon="checkmark" big onPress={() => onSendText(value)} disabled={text === null || !value.trim()} />
          <Act label="Send voice" icon="mic.fill" bg={blue} onPress={onSendVoice} />
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function Act({
  label,
  icon,
  big,
  bg,
  disabled,
  onPress,
}: {
  label: string;
  icon: 'xmark' | 'checkmark' | 'mic.fill';
  big?: boolean;
  bg?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const size = big ? 68 : 60;
  const fill = bg ?? (big ? '#fff' : 'rgba(255,255,255,0.14)');
  const ink = big ? '#111' : '#fff';
  return (
    <View style={styles.act}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={label}
        style={({ pressed }) => [styles.btn, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}>
        <SymbolView name={icon} size={big ? 28 : 24} weight="semibold" tintColor={ink} />
      </Pressable>
      <Text style={styles.cap}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(46,46,48,0.94)' },
  col: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 22, gap: 26 },
  box: { minHeight: 96, maxHeight: '40%', borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderCurve: 'continuous' },
  input: { fontSize: 17, lineHeight: 24, color: '#111', maxHeight: 220 },
  wait: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  waitText: { color: '#555', fontSize: 15 },
  acts: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 36 },
  act: { alignItems: 'center', gap: 6 },
  btn: { alignItems: 'center', justifyContent: 'center' },
  cap: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
