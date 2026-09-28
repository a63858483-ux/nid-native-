import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useWindowDimensions } from 'react-native';

import { Sidebar } from '@/components/Sidebar';
import { usePalette } from '@/lib/colors';
import { useApp } from '@/state/app';

export default function MainLayout() {
  const { signedIn } = useApp();
  const { width } = useWindowDimensions();
  const pal = usePalette();
  if (!signedIn) return <Redirect href="/login" />;
  return (
    <Drawer
      drawerContent={(props) => <Sidebar {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerStyle: { width: Math.min(width * 0.82, 340), backgroundColor: pal.bg },
        overlayColor: 'transparent',
        swipeEdgeWidth: 32,
        sceneStyle: { backgroundColor: pal.bg },
      }}>
      <Drawer.Screen name="index" />
    </Drawer>
  );
}
