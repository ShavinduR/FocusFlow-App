import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTaskStore } from '../store/useTaskStore';
import { onAuthChange } from '../sync/authService';
import { SYNC_ENABLED } from '../sync/config';
import { ApiError } from '../sync/http';
import { subscribeLocalChanges } from '../sync/localChanges';
import { syncNow } from '../sync/syncService';
import { useSyncStore } from '../sync/useSyncStore';

const LOCAL_CHANGE_DEBOUNCE_MS = 2_000;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

/**
 * Mount ONCE (e.g. in the tabs layout). Syncs:
 *  - on launch
 *  - when the app returns to the foreground (AppState → active)
 *  - when the network comes back (NetInfo offline → online)
 *  - ~2s after local edits (debounced), so other devices see changes quickly
 *  - after sign-in
 * Transient failures retry with exponential backoff while the app is active.
 */
export function useCloudSync() {
  const db = useTaskStore((s) => s.db);
  const setSync = useSyncStore((s) => s.set);

  const online = useRef(true);
  const active = useRef(AppState.currentState === 'active');
  const retryAttempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };

  const run = useCallback(async () => {
    if (!db) return;
    if (!SYNC_ENABLED) return setSync({ phase: 'disabled' });
    if (!online.current) return setSync({ phase: 'offline' });

    clearRetry();
    setSync({ phase: 'syncing' });
    try {
      const result = await syncNow(db);
      retryAttempt.current = 0;
      if (result.status === 'skipped') {
        setSync({ phase: result.reason === 'disabled' ? 'disabled' : 'signed_out' });
        return;
      }
      setSync({ phase: 'idle', lastSyncedAt: new Date().toISOString(), lastError: null });
      if (result.appliedLocally > 0) await useTaskStore.getState().refresh();
    } catch (e) {
      const transient = !(e instanceof ApiError) || e.isTransient;
      setSync({ phase: e instanceof ApiError && e.isNetwork ? 'offline' : 'error', lastError: (e as Error).message });
      if (transient && active.current) {
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** retryAttempt.current++);
        retryTimer.current = setTimeout(run, delay * (0.8 + Math.random() * 0.4)); // jitter
      }
    }
  }, [db, setSync]);

  useEffect(() => {
    if (!db) return;
    run(); // launch

    const appSub = AppState.addEventListener('change', (state) => {
      const wasActive = active.current;
      active.current = state === 'active';
      if (active.current && !wasActive) run();
      if (!active.current) clearRetry();
    });

    const netUnsub = NetInfo.addEventListener((state) => {
      // isInternetReachable is null while unknown; only treat an explicit false as offline.
      const nowOnline = !!state.isConnected && state.isInternetReachable !== false;
      const wasOnline = online.current;
      online.current = nowOnline;
      if (nowOnline && !wasOnline) {
        retryAttempt.current = 0;
        run(); // reconnected
      } else if (!nowOnline) {
        setSync({ phase: 'offline' });
      }
    });

    const localUnsub = subscribeLocalChanges(() => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(run, LOCAL_CHANGE_DEBOUNCE_MS);
    });

    const authUnsub = onAuthChange((session) => {
      if (session) run();
      else setSync({ phase: 'signed_out' });
    });

    return () => {
      appSub.remove();
      netUnsub();
      localUnsub();
      authUnsub();
      clearRetry();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [db, run, setSync]);

  return { syncNow: run };
}
