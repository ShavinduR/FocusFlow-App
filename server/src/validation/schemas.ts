import { z } from 'zod';
import { TASK_CATEGORIES, TASK_STATUSES } from '../models/Task.js';
import { SYNC } from '../config/sync.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.string().regex(UUID_RE, 'Invalid UUID');
const isoDate = z.iso.datetime({ offset: true });

// ─── Auth ─────────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  email: z.email().max(254).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().trim().max(100).optional(),
});

export const LoginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

// ─── Sync ─────────────────────────────────────────────────────────────────
/** One task as it travels over the wire (same shape as the SQLite row). */
export const TaskChangeSchema = z.object({
  id: uuid,
  title: z.string().min(1).max(500),
  notes: z.string().max(5000).nullable().default(null),
  category: z.enum(TASK_CATEGORIES),
  status: z.enum(TASK_STATUSES),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  sort_order: z.number().finite(),
  rolled_from_id: uuid.nullable().default(null),
  rollover_count: z.number().int().min(0),
  created_at: isoDate,
  updated_at: isoDate,
  completed_at: isoDate.nullable(),
  deleted_at: isoDate.nullable(),
});
export type TaskChange = z.infer<typeof TaskChangeSchema>;

/**
 * `changes` is validated per item (not here) so one bad record is reported
 * back individually instead of failing the whole batch.
 */
export const SyncRequestSchema = z.object({
  device_id: z.string().min(1).max(100).optional(),
  last_sync_timestamp: isoDate.nullable().optional(),
  cursor: z.string().max(500).nullable().optional(),
  changes: z.array(z.unknown()).max(SYNC.MAX_PUSH).default([]),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;
