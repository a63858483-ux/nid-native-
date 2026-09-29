import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import * as S from '@/lib/study';
import { useApp } from '@/state/app';

type Notifications = typeof import('expo-notifications');
let N: Notifications | null = null;
async function notifications() {
  if (!N) N = await import('expo-notifications').catch(() => null);
  return N;
}

// Everything the study room shows, loaded together and refreshed whenever it comes back into view.
export function useStudy() {
  const { showToast } = useApp();
  const [books, setBooks] = useState<S.Book[]>([]);
  const [essays, setEssays] = useState<S.Essay[]>([]);
  const [today, setToday] = useState<S.Pomo[]>([]);
  const [week, setWeek] = useState<S.Day[]>([]);
  const [active, setActive] = useState<S.Active>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [b, e, t, w, a] = await Promise.allSettled([S.books(), S.essays(), S.pomoToday(), S.pomoWeek(), S.pomoActive()]);
    if (b.status === 'fulfilled') setBooks(b.value);
    if (e.status === 'fulfilled') setEssays(e.value);
    if (t.status === 'fulfilled') setToday(t.value.items);
    if (w.status === 'fulfilled') setWeek(w.value);
    if (a.status === 'fulfilled') setActive(a.value);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('nid.studyChanged', load);
    return () => sub.remove();
  }, [load]);

  // Timer: counts down from the server's end time, so leaving and coming back never drifts.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [active]);
  const remaining = active ? (now ? Math.max(0, Math.round(active.ends_at - now / 1000)) : active.remaining) : 0;
  const finishing = useRef(false);
  useEffect(() => {
    if (active && remaining === 0 && !finishing.current) {
      finishing.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load().finally(() => {
        finishing.current = false;
      });
    }
  }, [active, remaining, load]);

  const notifId = useRef<string | null>(null);
  const start = useCallback(
    async (minutes: number, task: string) => {
      try {
        const a = await S.pomoStart(minutes, task);
        setActive(a);
        setNow(Date.now());
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const n = await notifications();
        if (n && a) {
          notifId.current = await n
            .scheduleNotificationAsync({
              content: { title: 'Focus done', body: task ? `${task} · ${minutes} min` : `${minutes} min`, sound: true },
              trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(a.ends_at * 1000) },
            })
            .catch(() => null);
        }
      } catch {
        showToast("Couldn't start the timer");
      }
    },
    [showToast],
  );
  const stop = useCallback(async () => {
    try {
      await S.pomoStop(false);
      setActive(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const n = await notifications();
      if (n && notifId.current) n.cancelScheduledNotificationAsync(notifId.current).catch(() => {});
      notifId.current = null;
      load();
    } catch {
      showToast("Couldn't stop the timer");
    }
  }, [load, showToast]);

  return { books, essays, today, week, active, remaining, loaded, load, start, stop, setBooks, setEssays };
}
