import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import Svg, { Circle, Rect } from 'react-native-svg';
import { ActivityIndicator, DeviceEventEmitter, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ALARMS_CHANGED, alarmId, alarmRecord, alarmTime, cancelAlarms, ensureAlarm } from '@/lib/alarms';
import { usePalette } from '@/lib/colors';
import { findSong, playSong, useNowPlaying, type Song } from '@/lib/music';
import { NidMusic } from '../../modules/nid-music';
import { useApp } from '@/state/app';

const clean = (t: string) => t.replace(/\s*[(（][^)）]*[)）]\s*/g, ' ').trim();

// A song he picked: cover, title, artist; the round button plays it in Apple Music.
export function SongCard({ query, mine }: { query: string; mine: boolean }) {
  const pal = usePalette();
  const { showToast } = useApp();
  const [song, setSong] = useState<Song | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const now = useNowPlaying(false);
  useEffect(() => {
    let live = true;
    findSong(query)
      .then((s) => live && setSong(s))
      .catch(() => live && setSong(null));
    return () => {
      live = false;
    };
  }, [query]);
  const isThis = !!song && now?.item?.songId === song.id;
  const playing = isThis && now?.playing;

  const onPlay = async () => {
    if (!song || busy) return;
    Haptics.selectionAsync();
    if (isThis && NidMusic) {
      if (playing) NidMusic.pause();
      else NidMusic.resume().catch(() => {});
      return;
    }
    setBusy(true);
    try {
      const r = await playSong(song);
      if (r === 'denied') showToast('Apple Music access is off in Settings');
    } catch {
      showToast("Couldn't play that one");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.song, mine ? styles.mine : styles.his, { backgroundColor: song?.color ? song.color + 'CC' : pal.hisFill }]}>
      {song ? (
        <Image source={song.artwork} style={styles.cover} contentFit="cover" transition={160} />
      ) : (
        <View style={[styles.cover, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {song === undefined ? (
          <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start' }} />
        ) : song ? (
          <>
            <Text numberOfLines={1} style={styles.title}>
              {clean(song.title)}
            </Text>
            <Text numberOfLines={1} style={styles.artist}>
              {song.artist}
            </Text>
            <View style={styles.brand}>
              <SymbolView name="music.note" size={11} tintColor="rgba(255,255,255,0.75)" />
              <Text style={styles.brandText}>Music</Text>
            </View>
          </>
        ) : (
          <>
            <Text numberOfLines={1} style={styles.title}>
              {query}
            </Text>
            <Text style={styles.artist}>Not on Apple Music</Text>
          </>
        )}
      </View>
      {song ? (
        <Pressable
          onPress={onPlay}
          hitSlop={8}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={({ pressed }) => [styles.play, isThis && styles.playOn, pressed && { transform: [{ scale: 0.92 }] }]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : isThis ? (
            <Ring playing={!!playing} fallback={song.duration} />
          ) : (
            <SymbolView name="play.fill" size={18} tintColor="#fff" style={{ marginLeft: 3 }} />
          )}
          {isThis && !playing && !busy && <SymbolView name="play.fill" size={15} tintColor="#FA2D48" style={styles.resume} />}
        </Pressable>
      ) : null}
    </View>
  );
}

// Like Messages: a red pause inside a ring that fills as the song goes. Only mounted for the
// song in the player, so only that card polls the play position.
function Ring({ playing, fallback }: { playing: boolean; fallback: number }) {
  const now = useNowPlaying(true);
  const dur = now?.item?.duration || fallback || 0;
  const frac = dur ? Math.min(1, (now?.time ?? 0) / dur) : 0;
  const c = 2 * Math.PI * 17.5;
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <Circle cx={20} cy={20} r={17.5} stroke="rgba(250,45,72,0.18)" strokeWidth={2.5} fill="none" />
      <Circle
        cx={20}
        cy={20}
        r={17.5}
        stroke="#FA2D48"
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c}`}
        strokeDashoffset={c * (1 - frac)}
        transform="rotate(-90 20 20)"
      />
      {playing && (
        <>
          <Rect x={14.5} y={13.5} width={4} height={13} rx={1.2} fill="#FA2D48" />
          <Rect x={21.5} y={13.5} width={4} height={13} rx={1.2} fill="#FA2D48" />
        </>
      )}
    </Svg>
  );
}

// An alarm he promised: the time big, day and title under it; it is set on this phone once.
export function AlarmCard({ msgKey, sentAt, time, date, title, mine }: { msgKey: string; sentAt: string; time: string; date?: string; title: string; mine: boolean }) {
  const pal = usePalette();
  const { showToast } = useApp();
  const id = alarmId(`${msgKey}|${date ?? ''}|${time}|${title}`);
  const at = alarmTime(sentAt, time, date);
  const [state, setState] = useState<string>(() => (alarmRecord(id)?.cancelled ? 'cancelled' : at <= Date.now() ? 'past' : alarmRecord(id) ? 'set' : 'pending'));
  useEffect(() => {
    if (state !== 'pending') return;
    let live = true;
    ensureAlarm(id, at, title)
      .then((s) => live && setState(s))
      .catch(() => live && setState('failed'));
    return () => {
      live = false;
    };
  }, [id, at, title, state]);

  // He can take it back later with [alarm-off:…]; the card follows.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(ALARMS_CHANGED, () => alarmRecord(id)?.cancelled && setState('cancelled'));
    return () => sub.remove();
  }, [id]);

  const d = new Date(at);
  const [today] = useState(() => new Date());
  const tomorrow = new Date(today.getTime() + 86400_000);
  const day =
    d.toDateString() === today.toDateString()
      ? 'Today'
      : d.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  const status =
    {
      set: 'Set',
      past: 'Went off',
      cancelled: 'Cancelled',
      pending: 'Setting…',
      denied: 'Alarms are off in Settings',
      unsupported: 'Needs the newer app',
      failed: "Couldn't set it",
    }[state] ?? '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dim = state === 'past' || state === 'cancelled';

  return (
    <Pressable
      onPress={() => Linking.openURL('clock-alarm://').catch(() => showToast('Open the Clock app to manage it'))}
      style={({ pressed }) => [styles.alarm, mine ? styles.mine : styles.his, { backgroundColor: pal.hisFill }, pressed && { opacity: 0.8 }]}>
      <View style={styles.dial}>
        <View style={[styles.hand, { transform: [{ rotate: `${(d.getHours() % 12) * 30 + d.getMinutes() * 0.5}deg` }] }]} />
        <View style={[styles.hand, styles.minute, { transform: [{ rotate: `${d.getMinutes() * 6}deg` }] }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.time, { color: pal.hisInk }, dim && { opacity: 0.45 }]}>
          {hh}:{mm}
        </Text>
        <Text numberOfLines={1} style={[styles.sub, { color: pal.meta }]}>
          {[day, title, status].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mine: { alignSelf: 'flex-end' },
  his: { alignSelf: 'flex-start' },
  song: { width: 290, maxWidth: '80%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderCurve: 'continuous' },
  cover: { width: 56, height: 56, borderRadius: 10 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  artist: { color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  brandText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FA2D48', alignItems: 'center', justifyContent: 'center' },
  playOn: { backgroundColor: 'rgba(255,255,255,0.55)' },
  resume: { position: 'absolute', marginLeft: 3 },
  alarm: {
    width: 250,
    maxWidth: '78%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  dial: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C1E',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hand: { position: 'absolute', width: 2.5, height: 12, borderRadius: 1.5, backgroundColor: '#fff', top: 8, left: 18.75, transformOrigin: 'bottom' },
  minute: { height: 16, top: 4, backgroundColor: '#FF9F0A' },
  time: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 32, lineHeight: 36, fontVariant: ['tabular-nums'] },
  sub: { fontSize: 13, marginTop: -1 },
});

// His [alarm-off:…]: the time he took back, struck through; nothing set at that time says so.
export function AlarmOffCard({ msgKey, time, date, mine }: { msgKey: string; time: string; date?: string; mine: boolean }) {
  const pal = usePalette();
  const [took, setTook] = useState<number[] | null>(null);
  useEffect(() => {
    let live = true;
    cancelAlarms(alarmId(`${msgKey}|off|${date ?? ''}|${time}`), time, date)
      .then((t) => live && setTook(t))
      .catch(() => live && setTook([]));
    return () => {
      live = false;
    };
  }, [msgKey, time, date]);
  const label = time === 'all' ? 'All alarms' : [date?.slice(5).replace('-', '/'), time].filter(Boolean).join(' ');
  const sub = took === null ? 'Cancelling…' : took.length ? (took.length > 1 ? `Cancelled ${took.length} alarms` : 'Cancelled') : 'No alarm set then';
  return (
    <View style={[styles.alarm, mine ? styles.mine : styles.his, { backgroundColor: pal.hisFill }]}>
      <View style={[styles.dial, { alignItems: 'center', justifyContent: 'center' }]}>
        <SymbolView name="alarm.waves.left.and.right" size={20} tintColor="rgba(255,255,255,0.55)" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.time, { color: pal.hisInk, opacity: 0.45, textDecorationLine: 'line-through' }, time === 'all' && { fontSize: 22 }]}>{label}</Text>
        <Text numberOfLines={1} style={[styles.sub, { color: pal.meta }]}>
          {sub}
        </Text>
      </View>
    </View>
  );
}
