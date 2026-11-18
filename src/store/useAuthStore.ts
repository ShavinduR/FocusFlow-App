import { create } from 'zustand';
import * as authService from '../sync/authService';
import { SYNC_ENABLED } from '../sync/config';
import type { AuthSession } from '../sync/sessionStorage';
import { useTaskStore } from './useTaskStore';

export type AuthStatus = 'loading' | 'signed_in' | 'signed_out';

interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  /** True when the app should show the main tabs: signed in, OR running local-only (no API configured). */
  canUseApp: () => boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const db = () => {
  const d = useTaskStore.getState().db;
  if (!d) throw new Error('Database not ready');
  return d;
};

let unsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,

  canUseApp: () => !SYNC_ENABLED || get().status === 'signed_in',

  init: async () => {
    // Single source of truth: authService emits on login, register, logout AND
    // when the server rejects a token (expireSession). Routing follows automatically.
    unsubscribe ??= authService.onAuthChange((session) =>
      set({ session, status: session ? 'signed_in' : 'signed_out' }),
    );
    // Reads secure storage only: works offline, no network round-trip on launch.
    const session = await authService.getSession();
    set({ session, status: session ? 'signed_in' : 'signed_out' });
  },

  signIn: async (email, password) => {
    await authService.login(db(), email.trim(), password);
  },

  signUp: async (name, email, password) => {
    await authService.register(db(), email.trim(), password, name.trim());
  },

  signOut: async () => {
    await authService.logout(db()); // wipes local data so the next account starts clean
    await useTaskStore.getState().refresh();
  },
}));
