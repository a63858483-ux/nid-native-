import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { inkOn, usePalette } from '@/lib/colors';
import { API_BASE } from '@/lib/config';
import { fmtSec, ttsFile, waveBars } from '@/lib/voice';

export type VoiceSource = { kind: 'url'; url: string } | { kind: 'tts'; text: string };

// Only one voice plays at a time, like Messages.
let current: AudioPlayer | null = null;

// A voice message: play button, waveform that lights up as it plays, duration, and the
// words folded underneath (tap the bubble to open them).
export function VoiceBubble({
  mine,
  myColor,
  source,
  transcript,
  dur,
  tail,
}: {
  mine: boolean;
  myColor: string;
  source: VoiceSource;
  transcript: string;
  dur?: number;
  tail: boolean;
}) {
  const pal = usePalette();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loaded = useRef(false);
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  const seconds = status.duration > 0 ? status.duration : (dur ?? Math.min(60, 1.5 + transcript.length * 0.28));
  const bars = useMemo(() => waveBars(source.kind === 'url' ? source.url : source.text, seconds), [source, seconds]);
  const progress = status.playing || status.currentTime > 0 ? (status.duration > 0 ? status.currentTime / status.duration : 0) : 0;
  const shown = status.playing ? Math.max(0, seconds - status.currentTime) : seconds;

  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0);
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    if (status.playing) return player.pause();
    Haptics.selectionAsync();
    try {
      if (!loaded.current) {
        setLoading(true);
        setFailed(false);
        const uri = source.kind === 'url' ? (source.url.startsWith('http') ? source.url : API_BASE + source.url) : await ttsFile(source.text);
        player.replace({ uri });
        loaded.current = true;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (current && current !== player) {
        try {
          current.pause();
        } catch {
          // the other player may already be released
        }
      }
      current = player;
      player.play();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const fill = mine && myColor !== 'glass' ? myColor : mine ? pal.blue : pal.hisFill;
  const ink = mine ? inkOn(fill) : pal.hisInk;
  const dim = mine ? (ink === '#000000' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.72)') : pal.chrome ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)';
  const btnBg = mine ? (ink === '#000000' ? 'rgba(0,0,0,0.12)' : '#fff') : pal.chrome ? 'rgba(255,255,255,0.92)' : '#fff';
  const btnInk = mine ? (ink === '#000000' ? '#000' : fill) : '#111';
  const chev = useSharedValue(0);
  useEffect(() => {
    chev.set(withTiming(open ? 180 : 0, { duration: 200 }));
  }, [open, chev]);
  const chevSt = useAnimatedStyle(() => ({ transform: [{ rotate: `${chev.value}deg` }] }));

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      style={[
        styles.wrap,
        mine ? styles.mine : styles.his,
        // longer clips get wider bubbles, WeChat-style; a fixed width keeps the bars off the timer
        {
          width: Math.round(Math.min(300, 200 + seconds * 2.4)),
          backgroundColor: mine ? fill : 'transparent',
          borderBottomLeftRadius: !mine && tail ? 6 : 20,
          borderBottomRightRadius: mine && tail ? 6 : 20,
        },
      ]}>
      {!mine && (
        <>
          <BlurView tint={pal.hisBlur} intensity={pal.hisBlurIntensity} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        </>
      )}
      <View style={styles.bar}>
        <Pressable onPress={toggle} hitSlop={6} accessibilityLabel={status.playing ? 'Pause' : 'Play'} style={[styles.play, { backgroundColor: btnBg }]}>
          {loading ? (
            <ActivityIndicator size="small" color={btnInk} />
          ) : (
            <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={13} tintColor={btnInk} style={status.playing ? undefined : { marginLeft: 2 }} />
          )}
        </Pressable>
        <View style={styles.wave}>
          {bars.map((h, i) => (
            <View
              key={i}
              style={[styles.b, { height: `${Math.round(h * 100)}%`, backgroundColor: i / bars.length < progress ? ink : dim, opacity: i / bars.length < progress ? 1 : 0.7 }]}
            />
          ))}
        </View>
        <Text style={[styles.dur, { color: dim }]}>{failed ? '!' : fmtSec(shown)}</Text>
        {transcript ? (
          <Animated.View style={chevSt}>
            <SymbolView name="chevron.down" size={11} weight="semibold" tintColor={dim} />
          </Animated.View>
        ) : null}
      </View>
      {open && transcript ? <Text style={[styles.tr, { color: ink }, mine && styles.trMine]}>{transcript}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '82%', borderRadius: 20, paddingTop: 8, paddingBottom: 9, paddingLeft: 9, paddingRight: 13, borderCurve: 'continuous', overflow: 'hidden' },
  mine: { alignSelf: 'flex-end' },
  his: { alignSelf: 'flex-start' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  play: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, minWidth: 0, height: 28, flexDirection: 'row', alignItems: 'center', gap: 2, overflow: 'hidden' },
  b: { flex: 1, minWidth: 2, maxWidth: 3, borderRadius: 1.5 },
  dur: { fontSize: 13, fontVariant: ['tabular-nums'], minWidth: 30, textAlign: 'right' },
  tr: { marginTop: 6, marginHorizontal: 4, fontSize: 16, lineHeight: 22 },
  trMine: { fontSize: 14, lineHeight: 19, opacity: 0.85 },
});
