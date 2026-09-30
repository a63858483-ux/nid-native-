import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const HAS_GLASS = isGlassEffectAPIAvailable();

// Liquid Glass on iOS 26; a system material blur anywhere the API is missing.
export function Glass({
  style,
  children,
  interactive,
  tint,
  clear,
}: {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  interactive?: boolean;
  tint?: string;
  clear?: boolean; // iOS 26 "Clear" glass: see-through, no frosting (her liquid glass)
}) {
  if (HAS_GLASS) {
    return (
      <GlassView style={style} isInteractive={interactive} tintColor={tint} glassEffectStyle={clear ? 'clear' : 'regular'}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <BlurView tint="systemThinMaterial" intensity={80} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}
