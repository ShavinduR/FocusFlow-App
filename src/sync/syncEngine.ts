import * as repo from './syncRepository';
import type { SqlDb, SyncRequestBody, SyncResponseBody, SyncResult } from './types';

export const PUSH_BATCH = 200;
const MAX_ROUNDS = 100; // hard stop: 100 × (200 pushed + 500 pulled) per session
export const SETTING_LAST_SYNC = 'last_sync_timestamp';

export interface SyncDeps {
  db: SqlDb;
  deviceId: string;
  /** POST /api/sync. Throws on HTTP/network errors. */
  send: (body: SyncRequestBody) => Promise<SyncResponseBody>;
}

/**
 * One full two-way sync session:
 *
 *   loop:
 *     1. take the next ≤200 dirty rows (keyset order)
 *     2. POST them with last_sync_timestamp + pull cursor
 *     3. in ONE local transaction: mark accepted → synced, rejected → error,
 *        UPSERT every server change (last-write-wins)
 *   until nothing left to push AND the server has no more pages
 *
 * The cursor is only advanced after the whole session succeeds, so a crash or
 * network drop midway just means the next session re-pulls (idempotent).
 */
export async function runSyncSession({ db, deviceId, send }: SyncDeps): Promise<SyncResult> {
  const lastSync = await repo.getSetting(db, SETTING_LAST_SYNC);
  let since = lastSync;
  let pullCursor: string | null = null;
  let pushCursor: repo.PushCursor | null = null;
  let sessionServerTime: string | null = null;
  const totals = { pushed: 0, pulled: 0, conflicts: 0, rejected: 0, appliedLocally: 0 };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const dirty = await repo.getDirtyBatch(db, pushCursor, PUSH_BATCH);
    const last = dirty[dirty.length - 1];
    if (last) pushCursor = { updatedAt: last.updated_at, id: last.id };
    const sent = new Map(dirty.map((t) => [t.id, t.updated_at]));

    const res = await send({ device_id: deviceId, last_sync_timestamp: since, cursor: pullCursor, changes: dirty });
    sessionServerTime ??= res.server_time;

    await db.withTransactionAsync(async () => {
      await repo.markAccepted(db, sent, res.accepted);
      await repo.markRejected(db, sent, res.rejected.map((r) => r.id).filter((id): id is string => !!id));
      totals.appliedLocally += await repo.applyRemoteChanges(db, res.changes);
    });

    totals.pushed += res.accepted.length;
    totals.pulled += res.changes.length;
    totals.conflicts += res.conflicts.length;
    totals.rejected += res.rejected.length;

    const morePush = dirty.length === PUSH_BATCH;
    if (res.has_more) {
      pullCursor = res.cursor;
    } else {
      if (!morePush) break;
      // Pull finished but there is more to push: further rounds only need what changed since this session began.
      since = sessionServerTime;
      pullCursor = null;
    }
  }

  // Save the FIRST response's server_time: everything up to it has been pulled.
  // Anything written after it is caught next time (the server also re-reads a small overlap window).
  if (sessionServerTime) await repo.setSetting(db, SETTING_LAST_SYNC, sessionServerTime);

  return { status: 'ok', ...totals, serverTime: sessionServerTime ?? undefined };
}
