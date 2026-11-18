import type { SqlDb, WireTask } from './types';

/**
 * All SQL used by sync. Kept free of React Native imports so it can be
 * tested in Node against real SQLite.
 */
const COLUMNS = [
  'id', 'title', 'notes', 'category', 'status', 'scheduled_date', 'sort_order', 'rolled_from_id',
  'rollover_count', 'created_at', 'updated_at', 'completed_at', 'deleted_at',
] as const;
const COLUMN_LIST = COLUMNS.join(', ');

export interface PushCursor {
  updatedAt: string;
  id: string;
}

/**
 * Next batch of unsynced rows, in a stable (updated_at, id) order.
 * Keyset pagination guarantees a sync session terminates even if the server
 * keeps rejecting something: each row is offered at most once per session.
 */
export function getDirtyBatch(db: SqlDb, after: PushCursor | null, limit: number) {
  const a = after ?? { updatedAt: '', id: '' };
  return db.getAllAsync<WireTask>(
    `SELECT ${COLUMN_LIST} FROM tasks
      WHERE sync_status = 'dirty'
        AND (updated_at > ? OR (updated_at = ? AND id > ?))
      ORDER BY updated_at, id
      LIMIT ?`,
    a.updatedAt, a.updatedAt, a.id, limit,
  );
}

/**
 * Mark pushed rows as synced, but ONLY if they were not edited again while the
 * request was in flight (updated_at still equals what we sent). Otherwise the
 * row stays dirty and the newer edit goes out on the next sync.
 * The server may have clamped updated_at (skewed clock), so store its value.
 */
export async function markAccepted(db: SqlDb, sent: Map<string, string>, accepted: { id: string; updated_at: string }[]) {
  for (const a of accepted) {
    const sentUpdatedAt = sent.get(a.id);
    if (!sentUpdatedAt) continue;
    await db.runAsync(
      `UPDATE tasks SET sync_status = 'synced', updated_at = ? WHERE id = ? AND updated_at = ? AND sync_status = 'dirty'`,
      a.updated_at, a.id, sentUpdatedAt,
    );
  }
}

/** Permanently rejected rows are parked as 'error' (no retry loop); any later local edit sets them dirty again. */
export async function markRejected(db: SqlDb, sent: Map<string, string>, ids: string[]) {
  for (const id of ids) {
    const sentUpdatedAt = sent.get(id);
    if (!sentUpdatedAt) continue;
    await db.runAsync(
      `UPDATE tasks SET sync_status = 'error' WHERE id = ? AND updated_at = ? AND sync_status = 'dirty'`,
      id, sentUpdatedAt,
    );
  }
}

/**
 * UPSERT server records. The WHERE clause is the client half of
 * last-write-wins: a server copy only replaces the local row if it is at least
 * as new. A local edit made after the server copy stays and is pushed next time.
 * Ties go to the server, matching the server's own tie-break.
 */
const UPSERT_SQL = `
  INSERT INTO tasks (${COLUMN_LIST}, sync_status)
  VALUES (${COLUMNS.map(() => '?').join(', ')}, 'synced')
  ON CONFLICT(id) DO UPDATE SET
    ${COLUMNS.filter((c) => c !== 'id' && c !== 'created_at').map((c) => `${c} = excluded.${c}`).join(',\n    ')},
    sync_status = 'synced'
  WHERE excluded.updated_at >= tasks.updated_at`;

export async function applyRemoteChanges(db: SqlDb, changes: WireTask[]) {
  let applied = 0;
  for (const t of changes) {
    const result = await db.runAsync(UPSERT_SQL, ...COLUMNS.map((c) => t[c] as string | number | null));
    applied += result.changes;
  }
  return applied;
}

export async function getSetting(db: SqlDb, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SqlDb, key: string, value: string | null) {
  if (value === null) await db.runAsync('DELETE FROM settings WHERE key = ?', key);
  else await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

export async function countUnsynced(db: SqlDb) {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM tasks WHERE sync_status != 'synced'`);
  return row?.n ?? 0;
}

/** Used on sign-out so the next account never inherits (or uploads) this account's data. */
export async function wipeLocalData(db: SqlDb) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM task_events');
    await db.runAsync('DELETE FROM day_reviews');
    await db.runAsync('DELETE FROM tasks');
    await db.runAsync(`DELETE FROM settings WHERE key IN ('last_sync_timestamp')`);
  });
}
