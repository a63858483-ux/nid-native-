import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Fragment, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  withTiming,
} from "react-native-reanimated";

import { usePalette } from "@/lib/colors";

export type MenuAction = "reply" | "sticker" | "copy" | "select" | "emoji";
export const TAPBACKS = ["❤️", "👍", "👎", "😂", "‼️", "❓"];

const GROUPS: { key: MenuAction; label: string; icon: SFSymbol }[][] = [
  [
    { key: "reply", label: "Reply", icon: "arrowshape.turn.up.left" },
    { key: "sticker", label: "Attach Sticker", icon: "face.smiling" },
  ],
  [
    { key: "copy", label: "Copy", icon: "doc.on.doc" },
    { key: "select", label: "Select", icon: "crop" },
  ],
];
const BAR_H = 54;
const ITEM_H = 48;
const MENU_W = 236;
// Bar and menu ease out of the bubble: a short fade and a small scale, no bounce.
const ease = { duration: 230, easing: Easing.out(Easing.cubic) };
const grow = (dy: number) => () => {
  "worklet";
  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateY: dy }, { scale: 0.92 }],
    },
    animations: {
      opacity: withTiming(1, { duration: 180 }),
      transform: [
        { translateY: withTiming(0, ease) },
        { scale: withTiming(1, ease) },
      ],
    },
  };
};
const barEnter = grow(10);
const menuEnter = grow(-10);
const MENU_H =
  GROUPS.reduce((n, g) => n + g.length * ITEM_H, 0) +
  (GROUPS.length - 1) * 13 +
  12;

// Long-press, the Messages way: the bubble stays where it is, the chat dims behind it,
// a tapback bar sits above and a glass menu hangs below.
export function MessageMenu({
  rect,
  mine,
  active,
  bubble,
  onClose,
  onTapback,
  onAction,
}: {
  rect: { x: number; y: number; w: number; h: number };
  mine: boolean;
  active: string[];
  bubble: ReactNode;
  onClose: () => void;
  onTapback: (emoji: string) => void;
  onAction: (a: MenuAction) => void;
}) {
  const pal = usePalette();
  const { width: W, height: H } = useWindowDimensions();
  const minTop = 64 + BAR_H + 8;
  let top = rect.y;
  if (top < minTop) top = minTop;
  if (top + rect.h + 8 + MENU_H > H - 30)
    top = Math.max(minTop, H - 30 - MENU_H - 8 - rect.h);
  // a very tall bubble: let the menu overlap its lower part rather than fall off screen
  const menuTop = Math.min(top + rect.h + 8, H - 30 - MENU_H);
  const side = mine ? { right: W - (rect.x + rect.w) } : { left: rect.x };
  const edge = mine ? { right: 12 } : { left: 12 };
  const dark = pal.chrome;
  const ink = dark ? "#fff" : "#111";
  const sep = dark ? "rgba(255,255,255,0.14)" : "rgba(60,60,67,0.18)";
  const cardTint = dark ? "rgba(40,40,42,0.55)" : "rgba(255,255,255,0.6)";

  return (
    <Animated.View
      exiting={FadeOut.duration(160)}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View
        entering={FadeIn.duration(220)}
        style={StyleSheet.absoluteFill}
      >
        <BlurView
          tint={dark ? "dark" : "light"}
          intensity={dark ? 22 : 30}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: dark
                ? "rgba(0,0,0,0.28)"
                : "rgba(255,255,255,0.18)",
            },
          ]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        entering={barEnter}
        style={[styles.bar, { top: top - BAR_H - 8, maxWidth: W - 24 }, edge]}
      >
        <BlurView
          tint={dark ? "systemThickMaterialDark" : "systemThickMaterialLight"}
          intensity={90}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: cardTint }]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barRow}
        >
          {TAPBACKS.map((e) => {
            const on = active.includes(e);
            return (
              <Pressable
                key={e}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onTapback(e);
                }}
                style={({ pressed }) => [
                  styles.tb,
                  on && { backgroundColor: pal.blue },
                  pressed && { transform: [{ scale: 1.25 }] },
                ]}
              >
                <Text style={styles.tbText}>{e}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => onAction("emoji")}
            accessibilityLabel="More emoji"
            style={[
              styles.tb,
              styles.more,
              {
                backgroundColor: dark
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(120,120,128,0.14)",
              },
            ]}
          >
            <SymbolView name="face.smiling" size={21} tintColor={ink} />
          </Pressable>
        </ScrollView>
      </Animated.View>

      <View
        style={[styles.bubble, { top, width: rect.w, height: rect.h }, side]}
        pointerEvents="none"
      >
        {bubble}
      </View>

      <Animated.View
        entering={menuEnter}
        style={[
          styles.menu,
          { top: menuTop },
          mine
            ? { right: Math.max(12, W - (rect.x + rect.w)) }
            : { left: Math.max(12, rect.x) },
        ]}
      >
        <BlurView
          tint={dark ? "systemThickMaterialDark" : "systemThickMaterialLight"}
          intensity={90}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: cardTint }]}
        />
        {GROUPS.map((g, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <View style={[styles.sep, { backgroundColor: sep }]} />}
            {g.map((it) => (
              <Pressable
                key={it.key}
                onPress={() => onAction(it.key)}
                style={({ pressed }) => [
                  styles.item,
                  pressed && {
                    backgroundColor: dark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(120,120,128,0.14)",
                  },
                ]}
              >
                <View style={styles.icon}>
                  <SymbolView name={it.icon} size={19} tintColor={ink} />
                </View>
                <Text style={[styles.itemText, { color: ink }]}>
                  {it.label}
                </Text>
              </Pressable>
            ))}
          </Fragment>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    height: BAR_H,
    borderRadius: BAR_H / 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  barRow: { paddingHorizontal: 7, alignItems: "center", gap: 4 },
  tb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  more: { marginLeft: 2 },
  tbText: { fontSize: 26 },
  bubble: { position: "absolute" },
  menu: {
    position: "absolute",
    width: MENU_W,
    paddingVertical: 6,
    borderRadius: 24,
    overflow: "hidden",
    borderCurve: "continuous",
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 18,
    marginVertical: 6,
  },
  item: {
    height: ITEM_H,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: { width: 24, alignItems: "center" },
  itemText: { fontSize: 17 },
});
