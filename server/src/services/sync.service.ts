import { Types, type AnyBulkWriteOperation } from 'mongoose';
import { SYNC } from '../config/sync.js';
import { TaskModel, type Task } from '../models/Task.js';
import { HttpError } from '../utils/HttpError.js';
import { TaskChangeSchema, type SyncRequest, type TaskChange } from '../validation/schemas.js';

// ─── Wire types ───────────────────────────────────────────────────────────
export type WireTask = TaskChange;

export interface SyncResponse {
  /** Server clock at the start of this request. The client stores the value from the FIRST page as its next last_sync_timestamp. */
  server_time: string;
  /** Pushed records that were written. updated_at is echoed because the server may clamp a skewed client clock. */
  accepted: { id: string; updated_at: string }[];
  /** Pushed records that lost to a newer server version; that version is included in `changes`. */
  conflicts: string[];
  /** Pushed records that could not be stored (validation failure, id owned by another account). */
  rejected: { id: string | null; reason: string }[];
  /** Records the client must upsert locally. */
  changes: WireTask[];
  has_more: boolean;
  /** Opaque; send back to fetch the next page. Null when has_more is false. */
  cursor: string | null;
}

// ─── Cursor (keyset pagination on server_updated_at, _id) ─────────────────
interface Cursor { t: string; id: string }
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof c?.t === 'string' && typeof c?.id === 'string' && !Number.isNaN(Date.parse(c.t))) return c;
  } catch { /* fall through */ }
  throw new HttpError(400, 'Invalid cursor', 'invalid_cursor');
}

// ─── Serialisation ────────────────────────────────────────────────────────
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

function toWire(t: Task): WireTask {
  return {
    id: t._id,
    title: t.title,
    notes: t.notes ?? null,
    category: t.category,
    status: t.status,
    scheduled_date: t.scheduled_date ?? null,
    sort_order: t.sort_order ?? 0,
    rolled_from_id: t.rolled_from_id ?? null,
    rollover_count: t.rollover_count ?? 0,
    created_at: iso(t.created_at)!,
    updated_at: iso(t.updated_at)!,
    completed_at: iso(t.completed_at),
    deleted_at: iso(t.deleted_at),
  };
}

// ─── Push ─────────────────────────────────────────────────────────────────
function validateChanges(raw: unknown[]) {
  const byId = new Map<string, TaskChange>();
  const rejected: SyncResponse['rejected'] = [];

  for (const item of raw) {
    const parsed = TaskChangeSchema.safeParse(item);
    if (!parsed.success) {
      const id = typeof (item as { id?: unknown })?.id === 'string' ? (item as { id: string }).id : null;
      rejected.push({ id, reason: 'invalid: ' + parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ') });
      continue;
    }
    // Same id twice in one batch: keep the newest.
    const prev = byId.get(parsed.data.id);
    if (!prev || Date.parse(parsed.data.updated_at) > Date.parse(prev.updated_at)) byId.set(parsed.data.id, parsed.data);
  }
  return { valid: [...byId.values()], rejected };
}

/** Guards against a device whose clock is far in the future "winning" every conflict forever. */
function clampToServerClock(updatedAt: string, now: Date) {
  const t = new Date(updatedAt);
  return t.getTime() - now.getTime() > SYNC.MAX_CLOCK_SKEW_MS ? now : t;
}

/**
 * Last-write-wins, done atomically by MongoDB per document:
 *
 *   updateOne({ _id, user_id, updated_at: { $lt: incoming } }, { $set: incoming }, { upsert: true })
 *
 *  - no doc yet          → filter misses → upsert INSERTS            → accepted
 *  - server doc older    → filter matches → UPDATE                   → accepted
 *  - server doc same/newer → filter misses → upsert tries INSERT with
 *                          an existing _id → E11000 duplicate key    → conflict (server wins ties)
 *
 * No read-modify-write window, so two devices syncing at the same instant
 * cannot overwrite each other with stale data.
 */
interface PushResult {
  accepted: SyncResponse['accepted'];
  conflicts: Task[];
  rejected: SyncResponse['rejected'];
}

async function applyClientChanges(userId: Types.ObjectId, changes: TaskChange[], now: Date, deviceId: string | null): Promise<PushResult> {
  if (changes.length === 0) return { accepted: [], conflicts: [], rejected: [] };

  const effectiveUpdatedAt = changes.map((c) => clampToServerClock(c.updated_at, now));

  const ops: AnyBulkWriteOperation[] = changes.map((c, i) => ({
    updateOne: {
      filter: { _id: c.id, user_id: userId, updated_at: { $lt: effectiveUpdatedAt[i] } },
      update: {
        $set: {
          title: c.title,
          notes: c.notes,
          category: c.category,
          status: c.status,
          scheduled_date: c.scheduled_date,
          sort_order: c.sort_order,
          rolled_from_id: c.rolled_from_id,
          rollover_count: c.rollover_count,
          updated_at: effectiveUpdatedAt[i],
          completed_at: c.completed_at ? new Date(c.completed_at) : null,
          deleted_at: c.deleted_at ? new Date(c.deleted_at) : null,
          server_updated_at: now,
          last_modified_by: deviceId,
        },
        $setOnInsert: { created_at: new Date(c.created_at) }, // created_at is immutable
      },
      upsert: true,
    },
  }));

  const lostIndexes = new Set<number>();
  try {
    await TaskModel.bulkWrite(ops, { ordered: false });
  } catch (err) {
    const writeErrors = (err as { writeErrors?: unknown }).writeErrors;
    if (!writeErrors) throw err;
    for (const we of ([] as { index: number; code: number }[]).concat(writeErrors as never)) {
      if (we.code !== 11000) throw err; // anything but "server copy is newer" is a real failure
      lostIndexes.add(we.index);
    }
  }

  const accepted = changes
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => !lostIndexes.has(i))
    .map(({ c, i }) => ({ id: c.id, updated_at: effectiveUpdatedAt[i].toISOString() }));

  const lostIds = [...lostIndexes].map((i) => changes[i].id);
  // A duplicate key can also mean the UUID belongs to ANOTHER user. Only this user's docs count as conflicts.
  const ownedLosers = lostIds.length
    ? await TaskModel.find({ _id: { $in: lostIds }, user_id: userId }).lean<Task[]>()
    : [];
  const ownedIds = new Set(ownedLosers.map((t) => t._id));

  return {
    accepted,
    conflicts: ownedLosers,
    rejected: lostIds.filter((id) => !ownedIds.has(id)).map((id) => ({ id, reason: 'id_conflict' })),
  };
}

// ─── Pull ─────────────────────────────────────────────────────────────────
async function pullChanges(userId: Types.ObjectId, since: string | null | undefined, rawCursor: string | null | undefined, excludeIds: string[]) {
  const and: Record<string, unknown>[] = [{ user_id: userId }];

  if (rawCursor) {
    const c = decodeCursor(rawCursor);
    const t = new Date(c.t);
    and.push({ $or: [{ server_updated_at: { $gt: t } }, { server_updated_at: t, _id: { $gt: c.id } }] });
  } else if (since) {
    and.push({ server_updated_at: { $gt: new Date(Date.parse(since) - SYNC.OVERLAP_MS) } });
  }
  if (excludeIds.length) and.push({ _id: { $nin: excludeIds } });

  const docs = await TaskModel.find({ $and: and })
    .sort({ server_updated_at: 1, _id: 1 })
    .limit(SYNC.PAGE_SIZE + 1)
    .lean<Task[]>();

  const hasMore = docs.length > SYNC.PAGE_SIZE;
  const page = hasMore ? docs.slice(0, SYNC.PAGE_SIZE) : docs;
  const last = page[page.length - 1];
  return {
    docs: page,
    has_more: hasMore,
    cursor: hasMore && last ? encodeCursor({ t: last.server_updated_at.toISOString(), id: last._id }) : null,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────
export async function syncTasks(userIdRaw: string, req: SyncRequest): Promise<SyncResponse> {
  const userId = new Types.ObjectId(userIdRaw);
  const now = new Date();

  const { valid, rejected: invalid } = validateChanges(req.changes);
  const pushed = await applyClientChanges(userId, valid, now, req.device_id ?? null);

  // The client already has what it just pushed, so don't echo accepted records back.
  const pulled = await pullChanges(userId, req.last_sync_timestamp, req.cursor, pushed.accepted.map((a) => a.id));

  // Conflict winners must reach the client even if outside the pull window.
  const changes = new Map<string, WireTask>();
  for (const d of [...pushed.conflicts, ...pulled.docs]) changes.set(d._id, toWire(d));

  return {
    server_time: now.toISOString(),
    accepted: pushed.accepted,
    conflicts: pushed.conflicts.map((t) => t._id),
    rejected: [...invalid, ...pushed.rejected],
    changes: [...changes.values()],
    has_more: pulled.has_more,
    cursor: pulled.cursor,
  };
}
