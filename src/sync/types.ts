import type { CategoryId, TaskStatus } from '../types/task';

/** A task on the wire. Identical to the server's TaskChangeSchema and to a SQLite row minus sync_status. */
export interface WireTask {
  id: string;
  title: string;
  notes: string | null;
  category: CategoryId;
  status: TaskStatus;
  scheduled_date: string | null;
  sort_order: number;
  rolled_from_id: string | null;
  rollover_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface SyncRequestBody {
  device_id: string;
  last_sync_timestamp: string | null;
  cursor: string | null;
  changes: WireTask[];
}

export interface SyncResponseBody {
  server_time: string;
  accepted: { id: string; updated_at: string }[];
  conflicts: string[];
  rejected: { id: string | null; reason: string }[];
  changes: WireTask[];
  has_more: boolean;
  cursor: string | null;
}

export interface SyncResult {
  status: 'ok' | 'skipped';
  reason?: 'signed_out' | 'disabled';
  pushed: number;
  pulled: number;
  conflicts: number;
  rejected: number;
  /** Rows whose local copy actually changed: if > 0 the UI should reload. */
  appliedLocally: number;
  serverTime?: string;
}

/** Minimal slice of expo-sqlite's SQLiteDatabase the sync code needs (lets tests use node:sqlite). */
export interface SqlDb {
  runAsync(source: string, ...params: (string | number | null)[]): Promise<{ changes: number }>;
  getAllAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
