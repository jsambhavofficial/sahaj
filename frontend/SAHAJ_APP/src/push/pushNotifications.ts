/** Native push (FCM on Android, APNs on iOS) for the signed-in user. Needs a development build, not Expo Go. */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { request } from '../api/http';

/** Same id the backend puts in the FCM Android payload (backend/app/integrations/fcm.py). */
const CHANNEL_ID = 'sahaj_care_channel';

let registeredDeviceId: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks for permission, gets the device token and registers it with the backend. Never throws. */
export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    // Remote push is unavailable in Expo Go (Android, SDK 53+): skip quietly.
    if (
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
      Constants.appOwnership === 'expo' ||
      Constants.expoGoConfig != null
    ) {
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Sahaj care updates',
        importance: AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;

    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (typeof token !== 'string' || !token) return;
    const device = await request<{ id: string }>('/devices', {
      method: 'POST',
      body: { platform: Platform.OS === 'ios' ? 'ios' : 'android', token, app_version: Constants.expoConfig?.version ?? '' },
    });
    registeredDeviceId = device.id;
  } catch (e) {
    if (__DEV__) console.warn('[push] registration failed:', e);
  }
}

/** Stops pushes to this phone after sign-out. Call while the session is still valid. */
export async function unregisterPush(): Promise<void> {
  const id = registeredDeviceId;
  registeredDeviceId = null;
  if (!id) return;
  try {
    await request<void>(`/devices/${id}`, { method: 'DELETE' });
  } catch {
    // expired session: the backend revokes dead tokens itself
  }
}

/** Calls `onOpen` with the notification's data when the user taps a push. Returns an unsubscribe function. */
export function onNotificationTapped(onOpen: (data: Record<string, unknown>) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) =>
    onOpen((r.notification.request.content.data ?? {}) as Record<string, unknown>)
  );
  return () => sub.remove();
}
