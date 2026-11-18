import { create } from 'zustand';

export type SyncPhase = 'disabled' | 'signed_out' | 'idle' | 'syncing' | 'offline' | 'error';

interface SyncState {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  lastError: string | null;
  set: (patch: Partial<Omit<SyncState, 'set'>>) => void;
}

/** Read-only view of sync status for UI (e.g. a cloud icon in the header). */
export const useSyncStore = create<SyncState>((set) => ({
  phase: 'idle',
  lastSyncedAt: null,
  lastError: null,
  set: (patch) => set(patch),
}));
