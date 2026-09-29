import { JosefinSans_400Regular, JosefinSans_600SemiBold } from '@expo-google-fonts/josefin-sans';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_800ExtraBold_Italic, useFonts } from '@expo-google-fonts/playfair-display';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Toast } from '@/components/Toast';
import { AppProvider, useApp } from '@/state/app';
import { ChatProvider } from '@/state/chat';

SplashScreen.preventAutoHideAsync();

const sheet = (detents: number[]) =>
  ({ presentation: 'formSheet', sheetAllowedDetents: detents, sheetGrabberVisible: true, sheetCornerRadius: 30, contentStyle: { backgroundColor: 'transparent' } }) as const;

function Shell() {
  const { ready } = useApp();
  const [fonts] = useFonts({ PlayfairDisplay_800ExtraBold_Italic, PlayfairDisplay_600SemiBold, JosefinSans_400Regular, JosefinSans_600SemiBold });
  useEffect(() => {
    if (ready && fonts) SplashScreen.hideAsync();
  }, [ready, fonts]);
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync(), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="sheet/model" options={sheet([0.62, 0.95])} />
        <Stack.Screen name="sheet/bubble" options={sheet([0.55, 0.95])} />
        <Stack.Screen name="sheet/wallpaper" options={sheet([0.55, 0.95])} />
        <Stack.Screen name="sheet/name" options={sheet([0.4, 0.95])} />
        <Stack.Screen name="sheet/checklist" options={sheet([0.75, 0.95])} />
        <Stack.Screen name="sheet/stickers" options={sheet([0.6, 0.95])} />
        <Stack.Screen name="sheet/select" options={sheet([0.5, 0.95])} />
        <Stack.Screen name="sheet/thought" options={sheet([0.5, 0.95])} />
        <Stack.Screen name="sheet/add" options={sheet([0.5, 0.95])} />
        <Stack.Screen name="study/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="study/book/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="study/essay/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="study/compose" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="thread/[key]" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
      </Stack>
      <Toast />
    </View>
  );
}

export default function Root() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <KeyboardProvider>
        <AppProvider>
          <ChatProvider>
            <Shell />
          </ChatProvider>
        </AppProvider>
      </KeyboardProvider>
    </ThemeProvider>
  );
}
