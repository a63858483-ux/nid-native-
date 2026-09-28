import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Footnote, Group, Row } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';
import { dropWallpaper, keepWallpaper, wallpaperUri } from '@/lib/storage';
import { useApp } from '@/state/app';

export default function WallpaperSheet() {
  const pal = usePalette();
  const { prefs, setPrefs, showToast } = useApp();
  const uri = wallpaperUri(prefs.wallpaper);

  const choose = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    try {
      const name = await keepWallpaper(res.assets[0].uri);
      setPrefs({ wallpaper: name });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      showToast("Couldn't save that photo. Try another one.");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <SheetHeader title="Wallpaper" />
      <View style={[styles.preview, { backgroundColor: pal.fill }]}>
        {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={{ color: pal.ink2 }}>No wallpaper</Text>}
      </View>
      <Group>
        <Row first title="Choose from Photos" chevron onPress={choose} />
        {uri ? (
          <Row
            title="Remove wallpaper"
            onPress={() => {
              dropWallpaper();
              setPrefs({ wallpaper: null });
            }}
          />
        ) : null}
      </Group>
      <Footnote>The photo stays on this phone. Bubbles and the input bar let it show through.</Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  preview: { height: 220, marginHorizontal: 16, marginVertical: 12, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
