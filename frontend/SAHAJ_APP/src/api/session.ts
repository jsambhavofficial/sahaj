/**
 * Where the signed-in session lives between app launches.
 * Native: expo-secure-store (encrypted, one small key per value). Web: localStorage.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SessionUser } from '../types';

const KEY = {
  access: 'samarth.access',
  refresh: 'samarth.refresh',
  user: 'samarth.user',
  device: 'samarth.device', // a paired senior phone's long-lived token, so it never has to be paired twice
};

interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

const nativeStore: Store = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v),
  del: (k) => SecureStore.deleteItemAsync(k),
};

const webStore: Store = {
  get: async (k) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(k)),
  set: async (k, v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
  },
  del: async (k) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
  },
};

const store: Store = Platform.OS === 'web' ? webStore : nativeStore;

export interface Session {
  accessToken: string;
  refreshToken: string | null;
  user: SessionUser;
  deviceToken?: string | null;
}

export async function loadSession(): Promise<Session | null> {
  try {
    const [access, refresh, user, device] = await Promise.all([
      store.get(KEY.access), store.get(KEY.refresh), store.get(KEY.user), store.get(KEY.device),
    ]);
    if (!access || !user) return null;
    return { accessToken: access, refreshToken: refresh, user: JSON.parse(user) as SessionUser, deviceToken: device };
  } catch {
    return null; // unreadable storage means "signed out", never a crash
  }
}

export async function saveSession(s: Session): Promise<void> {
  await store.set(KEY.access, s.accessToken);
  if (s.refreshToken) await store.set(KEY.refresh, s.refreshToken);
  else await store.del(KEY.refresh);
  await store.set(KEY.user, JSON.stringify(s.user));
  if (s.deviceToken) await store.set(KEY.device, s.deviceToken);
}

export async function saveTokens(access: string, refresh: string | null): Promise<void> {
  await store.set(KEY.access, access);
  if (refresh) await store.set(KEY.refresh, refresh);
}

export async function clearSession(): Promise<void> {
  await Promise.all(Object.values(KEY).map((k) => store.del(k).catch(() => undefined)));
}
