import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Glass } from './Glass';
import { usePalette } from '@/lib/colors';
import { AVATAR_HIM } from '@/lib/config';

// iOS 26 scroll-edge look: content fades into a soft blur under the floating controls.
export function EdgeBlur({ height, from }: { height: number; from: 'top' | 'bottom' }) {
  const pal = usePalette();
  const top = from === 'top';
  return (
    <MaskedView
      pointerEvents="none"
      style={[styles.edge, top ? { top: 0 } : { bottom: 0 }, { height }]}
      maskElement={
        <Svg width="100%" height={height}>
          <Defs>
            <LinearGradient id="g" x1="0" y1={top ? '0' : '1'} x2="0" y2={top ? '1' : '0'}>
              <Stop offset="0" stopColor="#000" stopOpacity="1" />
              <Stop offset="0.55" stopColor="#000" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={height} fill="url(#g)" />
        </Svg>
      }>
      <BlurView tint={pal.dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'} intensity={50} style={StyleSheet.absoluteFill} />
    </MaskedView>
  );
}

export function ChatHeader({ name, onMenu, onName, onCall }: { name: string; onMenu: () => void; onName: () => void; onCall: () => void }) {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
      <Pressable onPress={onMenu} accessibilityLabel="Menu">
        <Glass interactive style={styles.circle}>
          <SymbolView name="line.3.horizontal" size={19} weight="medium" tintColor={pal.ink} />
        </Glass>
      </Pressable>
      <View style={styles.who}>
        <Image source={AVATAR_HIM} style={styles.avatar} contentFit="cover" transition={200} />
        <Pressable onPress={onName}>
          <Glass interactive style={styles.name}>
            <Text style={[styles.nameText, { color: pal.ink }]}>{name}</Text>
            <SymbolView name="chevron.right" size={9} weight="bold" tintColor={pal.ink2} />
          </Glass>
        </Pressable>
      </View>
      <Pressable onPress={onCall} accessibilityLabel="Call">
        <Glass interactive style={styles.circle}>
          <SymbolView name="phone" size={18} tintColor={pal.ink} />
        </Glass>
      </Pressable>
    </View>
  );
}

export const HEADER_H = 104;

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, right: 0 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 12 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  who: { alignItems: 'center', marginTop: -2 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ddd' },
  name: { height: 24, borderRadius: 12, paddingLeft: 11, paddingRight: 9, flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: -3 },
  nameText: { fontSize: 12.5, fontWeight: '500' },
});
