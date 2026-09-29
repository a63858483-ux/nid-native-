import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { zoneAt, type Zone } from '@/components/RecordOverlay';
import type { HoldEvent } from '@/components/Composer';

export const VOICE_MIME = 'audio/mp4';
const MIN_SECONDS = 0.6;

export type Recording = { uri: string; seconds: number };
export type HoldState = { zone: Zone; seconds: number; level: number } | null;

// Hold to Talk: records while the finger is down, tracks which pill it is over, and hands
// the finished clip back with how the hold ended.
export function useVoiceRecorder(onDone: (rec: Recording, how: 'send' | 'text') => void, onTooShort: () => void, onDenied: () => void) {
  const { width: W, height: H } = useWindowDimensions();
  const [holding, setHolding] = useState<{ zone: Zone } | null>(null);
  const zone = useRef<Zone>(null);
  const active = useRef(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);
  const level = Math.max(0, Math.min(1, ((state.metering ?? -60) + 50) / 50));
  const hold: HoldState = holding ? { zone: holding.zone, seconds: (state.durationMillis || 0) / 1000, level } : null;

  // `down` flips the instant the finger lands or lifts; starting the recorder is async, so the
  // release can arrive before recording has begun. The end waits for the start to settle.
  const down = useRef(false);
  const starting = useRef<Promise<boolean> | null>(null);

  const start = useCallback(async (): Promise<boolean> => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      onDenied();
      return false;
    }
    if (!down.current) return false; // released while the permission prompt was up
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    if (!down.current) return false;
    recorder.record();
    return true;
  }, [recorder, onDenied]);

  const onHold = useCallback(
    async (e: HoldEvent) => {
      if (e.phase === 'start') {
        if (down.current) return;
        down.current = true;
        zone.current = null;
        active.current = true;
        setHolding({ zone: null });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        starting.current = start().catch(() => false);
        return;
      }
      if (!active.current) return;
      if (e.phase === 'move') {
        const z = zoneAt(e.x, e.y, W, H);
        if (z !== zone.current) {
          zone.current = z;
          Haptics.selectionAsync();
          setHolding({ zone: z });
        }
        return;
      }
      // release
      down.current = false;
      active.current = false;
      const how = zone.current;
      setHolding(null);
      const recording = await (starting.current ?? Promise.resolve(false));
      starting.current = null;
      if (!recording) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
        if (how !== 'cancel') onTooShort();
        return;
      }
      const seconds = (recorder.getStatus().durationMillis || 0) / 1000;
      try {
        await recorder.stop();
      } catch {
        return;
      } finally {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      }
      const uri = recorder.uri;
      if (how === 'cancel' || !uri) return;
      if (seconds < MIN_SECONDS) return onTooShort();
      onDone({ uri, seconds }, how === 'text' ? 'text' : 'send');
    },
    [recorder, W, H, onDone, onTooShort, start],
  );

  return { hold, onHold };
}
