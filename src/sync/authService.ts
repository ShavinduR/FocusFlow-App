import { apiRequest } from './http';
import { clearSession, loadSession, saveSession, type AuthSession } from './sessionStorage';
import { countUnsynced, setSetting, wipeLocalData } from './syncRepository';
import { SETTING_LAST_SYNC } from './syncEngine';
import type { SqlDb } from './types';

type Listener = (session: AuthSession | null) => void;
const listeners = new Set<Listener>();
export const onAuthChange = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const emit = (s: AuthSession | null) => listeners.forEach((l) => l(s));

export const getSession = loadSession;

async function start(db: SqlDb, session: AuthSession) {
  await saveSession(session);
  // New login → full pull. Local tasks never synced before are still 'dirty', so they upload to this account.
  await setSetting(db, SETTING_LAST_SYNC, null);
  emit(session);
  return session;
}

export async function register(db: SqlDb, email: string, password: string, name?: string) {
  const session = await apiRequest<AuthSession>('/api/auth/register', { method: 'POST', body: { email, password, name } });
  return start(db, session);
}

export async function login(db: SqlDb, email: string, password: string) {
  const session = await apiRequest<AuthSession>('/api/auth/login', { method: 'POST', body: { email, password } });
  return start(db, session);
}

/** UI should confirm before signing out if this is > 0: those edits would be lost. */
export const unsyncedCount = countUnsynced;

/** Signs out and wipes local data so the next account starts clean. */
export async function logout(db: SqlDb) {
  await clearSession();
  await wipeLocalData(db);
  emit(null);
}

/** Server rejected the token (expired/revoked): drop it but KEEP local data so nothing is lost; signing in again resumes sync. */
export async function expireSession() {
  await clearSession();
  emit(null);
}
