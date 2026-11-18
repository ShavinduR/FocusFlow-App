import { randomUUID } from 'expo-crypto';
import { SYNC_ENABLED } from './config';
import { apiRequest, ApiError } from './http';
import { expireSession } from './authService';
import { loadSession } from './sessionStorage';
import { runSyncSession } from './syncEngine';
import { getSetting, setSetting } from './syncRepository';
import type { SqlDb, SyncRequestBody, SyncResponseBody, SyncResult } from './types';

async function getDeviceId(db: SqlDb) {
  let id = await getSetting(db, 'device_id');
  if (!id) {
    id = randomUUID();
    await setSetting(db, 'device_id', id);
  }
  return id;
}

const skipped = (reason: SyncResult['reason']): SyncResult => ({
  status: 'skipped', reason, pushed: 0, pulled: 0, conflicts: 0, rejected: 0, appliedLocally: 0,
});

let inFlight: Promise<SyncResult> | null = null;
let rerunRequested = false;

/**
 * Two-way sync with the cloud. Single-flight: calls made while a sync is
 * running don't start a parallel one; they schedule ONE follow-up run so
 * edits made during the sync are not left behind.
 */
export function syncNow(db: SqlDb): Promise<SyncResult> {
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      let result: SyncResult;
      do {
        rerunRequested = false;
        result = await syncOnce(db);
      } while (rerunRequested && result.status === 'ok');
      return result;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

async function syncOnce(db: SqlDb): Promise<SyncResult> {
  if (!SYNC_ENABLED) return skipped('disabled');
  const session = await loadSession();
  if (!session) return skipped('signed_out');

  const deviceId = await getDeviceId(db);
  const send = (body: SyncRequestBody) =>
    apiRequest<SyncResponseBody>('/api/sync', { method: 'POST', body, token: session.token });

  try {
    return await runSyncSession({ db, deviceId, send });
  } catch (e) {
    if (e instanceof ApiError && e.isUnauthorized) {
      await expireSession();
      return skipped('signed_out');
    }
    throw e;
  }
}
