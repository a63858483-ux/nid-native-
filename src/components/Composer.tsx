import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Glass } from './Glass';
import { inkOn, usePalette } from '@/lib/colors';

const SPRING = { damping: 16, stiffness: 260, mass: 0.7 };

export function Composer({
  myColor,
  plusOpen,
  onPlus,
  onSend,
  placeholder = 'Message',
}: {
  myColor: string;
  plusOpen: boolean;
  onPlus: () => void;
  onSend: (text: string) => void;
  placeholder?: string;
}) {
  const pal = usePalette();
  const [text, setText] = useState('');
  const ready = text.trim().length > 0;
  const show = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    show.value = withSpring(ready ? 1 : 0, SPRING);
  }, [ready, show]);
  useEffect(() => {
    rot.value = withSpring(plusOpen ? 45 : 0, SPRING);
  }, [plusOpen, rot]);

  const sendSt = useAnimatedStyle(() => ({ opacity: show.value, transform: [{ scale: 0.4 + 0.6 * show.value }] }));
  const micSt = useAnimatedStyle(() => ({ opacity: 1 - show.value, transform: [{ scale: 1 - 0.4 * show.value }] }));
  const plusSt = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const sendColor = myColor === 'glass' ? pal.blue : myColor;
  const submit = () => {
    if (!ready) return;
    onSend(text);
    setText('');
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={onPlus} accessibilityLabel="More">
        <Glass interactive style={styles.circle}>
          <Animated.View style={plusSt}>
            <SymbolView name="plus" size={20} weight="medium" tintColor={pal.ink} />
          </Animated.View>
        </Glass>
      </Pressable>
      <Glass style={styles.pill}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={pal.ink2}
          multiline
          style={[styles.input, { color: pal.ink }]}
        />
        <View style={styles.action}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, micSt]} pointerEvents={ready ? 'none' : 'auto'}>
            <SymbolView name="mic" size={19} tintColor={pal.ink2} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, sendSt]} pointerEvents={ready ? 'auto' : 'none'}>
            <Pressable onPress={submit} accessibilityLabel="Send" style={[styles.send, { backgroundColor: sendColor }]}>
              <SymbolView name="arrow.up" size={16} weight="bold" tintColor={myColor === 'glass' ? '#fff' : inkOn(sendColor)} />
            </Pressable>
          </Animated.View>
        </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: { flex: 1, minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 16, paddingRight: 5, paddingVertical: 5 },
  input: { flex: 1, fontSize: 17, lineHeight: 22, maxHeight: 132, paddingTop: 6, paddingBottom: 6 },
  action: { width: 34, height: 34, marginLeft: 6 },
  center: { alignItems: 'center', justifyContent: 'center' },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
