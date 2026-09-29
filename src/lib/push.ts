import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { call } from './api';
import { DEMO } from './config';

// The chat is the whole app, so a notification arriving while it is open stays quiet.
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

let current: string | null = null;

// The raw APNs device token goes to our own server; it pushes straight to Apple.
export async function registerPush() {
  if (DEMO || !Device.isDevice) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    const status = perm.granted ? perm : await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: true } });
    if (!status.granted) return;
    const { data } = await Notifications.getDevicePushTokenAsync();
    const token = String(data);
    if (!token || token === current) return;
    await call('/api/push/apns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, device: Device.modelName ?? '' }) });
    current = token;
  } catch {
    // no network or no permission: try again next launch
  }
}

export async function unregisterPush() {
  if (!current) return;
  try {
    await call('/api/push/apns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: current, remove: true }) });
  } catch {
    // signing out anyway
  }
  current = null;
}
