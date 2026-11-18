/**
 * Local SQLite schema (expo-sqlite).
 *
 * Design notes
 * - TEXT UUID primary keys, so records created offline never collide when
 *   they are later synced to MongoDB (they map 1:1 to a `clientId` field).
 * - Every row has updated_at + deleted_at (tombstone) + sync_status so a
 *   future "push dirty rows / pull changes since X" sync is trivial.
 * - Rollover never mutates history: the old task is marked `rolled_over`
 *   and a fresh clone is created for today (rolled_from_id links the chain).
 *   That keeps per-day completion stats honest for the weekly analytics.
 * - task_events is an append-only log used for streaks, analytics and,
 *   later, conflict-free server sync.
 */
export const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY NOT NULL,
    title           TEXT NOT NULL,
    notes           TEXT,
    category        TEXT NOT NULL CHECK (category IN ('must','should','could','brain_dump')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','rolled_over','dropped')),
    scheduled_date  TEXT,                       -- local 'YYYY-MM-DD'; NULL = Brain Dump
    sort_order      REAL NOT NULL DEFAULT 0,
    rolled_from_id  TEXT REFERENCES tasks(id),
    rollover_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,              -- ISO-8601 UTC
    updated_at      TEXT NOT NULL,
    completed_at    TEXT,
    deleted_at      TEXT,
    sync_status     TEXT NOT NULL DEFAULT 'dirty' CHECK (sync_status IN ('dirty','synced'))
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_day      ON tasks (scheduled_date, status);
  CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks (category, status);
  CREATE INDEX IF NOT EXISTS idx_tasks_sync     ON tasks (sync_status);

  -- One row per day the user completed the Morning Review.
  CREATE TABLE IF NOT EXISTS day_reviews (
    date            TEXT PRIMARY KEY NOT NULL,  -- 'YYYY-MM-DD'
    reviewed_at     TEXT NOT NULL,
    migrated_count  INTEGER NOT NULL DEFAULT 0,
    released_count  INTEGER NOT NULL DEFAULT 0
  );

  -- Append-only history log.
  CREATE TABLE IF NOT EXISTS task_events (
    id          TEXT PRIMARY KEY NOT NULL,
    task_id     TEXT NOT NULL REFERENCES tasks(id),
    type        TEXT NOT NULL,                  -- see TaskEventType
    category    TEXT NOT NULL,
    date        TEXT NOT NULL,                  -- local day the event happened
    created_at  TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'dirty'
  );
  CREATE INDEX IF NOT EXISTS idx_events_date ON task_events (date, type);

  -- Key/value settings (theme override, last used category, last sync cursor…)
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,

  // v2 — cloud sync
  //  * Drop the FK on rolled_from_id: synced tasks can arrive before their
  //    parent (pagination, or the parent was purged), and the FK would reject them.
  //  * sync_status gains 'error' (server permanently rejected the row; it is
  //    retried only after the next local edit).
  //  * Index for the "dirty rows in (updated_at, id) order" push query.
  `
  CREATE TABLE tasks_v2 (
    id              TEXT PRIMARY KEY NOT NULL,
    title           TEXT NOT NULL,
    notes           TEXT,
    category        TEXT NOT NULL CHECK (category IN ('must','should','could','brain_dump')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','rolled_over','dropped')),
    scheduled_date  TEXT,
    sort_order      REAL NOT NULL DEFAULT 0,
    rolled_from_id  TEXT,
    rollover_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    completed_at    TEXT,
    deleted_at      TEXT,
    sync_status     TEXT NOT NULL DEFAULT 'dirty' CHECK (sync_status IN ('dirty','synced','error'))
  );
  INSERT INTO tasks_v2 (id, title, notes, category, status, scheduled_date, sort_order, rolled_from_id,
                        rollover_count, created_at, updated_at, completed_at, deleted_at, sync_status)
    SELECT id, title, notes, category, status, scheduled_date, sort_order, rolled_from_id,
           rollover_count, created_at, updated_at, completed_at, deleted_at, sync_status
      FROM tasks;
  DROP TABLE tasks;
  ALTER TABLE tasks_v2 RENAME TO tasks;
  CREATE INDEX IF NOT EXISTS idx_tasks_day      ON tasks (scheduled_date, status);
  CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks (category, status);
  CREATE INDEX IF NOT EXISTS idx_tasks_dirty    ON tasks (sync_status, updated_at, id);
  `,
];
