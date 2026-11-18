import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
export interface AuthSession {
  token: string;
  user: AuthUser;
}

const KEY = 'focusflow.session';

/**
 * Native: iOS Keychain / Android Keystore via expo-secure-store.
 * Web: localStorage (SecureStore has no web implementation). Any XSS on the
 * web build could read it, so keep the web build free of untrusted HTML.
 */
export async function loadSession(): Promise<AuthSession | null> {
  const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession) {
  const raw = JSON.stringify(session);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, raw);
  else await SecureStore.setItemAsync(KEY, raw);
}

export async function clearSession() {
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
  else await SecureStore.deleteItemAsync(KEY);
}
