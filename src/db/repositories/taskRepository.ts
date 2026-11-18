import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { CATEGORY_ORDER_SQL } from '../../constants/categories';
import { mapTaskRow, type CategoryId, type Task, type TaskEventType, type TaskRow } from '../../types/task';
import { todayKey } from '../../utils/date';
import { deterministicUuid } from '../../utils/id';
import { notifyLocalChange } from '../../sync/localChanges';

const nowIso = () => new Date().toISOString();

async function logEvent(db: SQLiteDatabase, taskId: string, type: TaskEventType, category: CategoryId) {
  await db.runAsync(
    'INSERT INTO task_events (id, task_id, type, category, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    randomUUID(), taskId, type, category, todayKey(), nowIso(),
  );
}

async function getById(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<TaskRow>('SELECT * FROM tasks WHERE id = ?', id);
  return row ? mapTaskRow(row) : null;
}

// ─── Reads ────────────────────────────────────────────────────────────────

/** Today's list: open + completed tasks (rolled/dropped originals are history only). */
export async function getTasksForDate(db: SQLiteDatabase, date: string): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks
      WHERE scheduled_date = ? AND deleted_at IS NULL
        AND category != 'brain_dump' AND status IN ('pending','completed')
      ORDER BY ${CATEGORY_ORDER_SQL}, sort_order ASC`,
    date,
  );
  return rows.map(mapTaskRow);
}

export async function getBrainDump(db: SQLiteDatabase): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks
      WHERE category = 'brain_dump' AND status = 'pending' AND deleted_at IS NULL
      ORDER BY sort_order DESC`,
  );
  return rows.map(mapTaskRow);
}

/** Unfinished tasks from any previous day — the Morning Review candidates. */
export async function getPendingBefore(db: SQLiteDatabase, date: string): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks
      WHERE scheduled_date < ? AND status = 'pending'
        AND category != 'brain_dump' AND deleted_at IS NULL
      ORDER BY scheduled_date DESC, ${CATEGORY_ORDER_SQL}, sort_order ASC`,
    date,
  );
  return rows.map(mapTaskRow);
}

export async function hasReviewedDay(db: SQLiteDatabase, date: string) {
  const row = await db.getFirstAsync<{ date: string }>('SELECT date FROM day_reviews WHERE date = ?', date);
  return !!row;
}

// ─── Writes ───────────────────────────────────────────────────────────────

export async function createTask(
  db: SQLiteDatabase,
  input: { title: string; category: CategoryId; date: string },
): Promise<Task> {
  const id = randomUUID();
  const ts = nowIso();
  const scheduled = input.category === 'brain_dump' ? null : input.date;
  await db.runAsync(
    `INSERT INTO tasks (id, title, category, status, scheduled_date, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
    id, input.title.trim(), input.category, scheduled, Date.now(), ts, ts,
  );
  await logEvent(db, id, 'created', input.category);
  notifyLocalChange();
  return (await getById(db, id))!;
}

export async function setTaskCompleted(db: SQLiteDatabase, task: Task, completed: boolean) {
  const ts = nowIso();
  await db.runAsync(
    `UPDATE tasks SET status = ?, completed_at = ?, updated_at = ?, sync_status = 'dirty' WHERE id = ?`,
    completed ? 'completed' : 'pending', completed ? ts : null, ts, task.id,
  );
  await logEvent(db, task.id, completed ? 'completed' : 'uncompleted', task.category);
  notifyLocalChange();
}

/** Change category. Moving into a day bucket schedules it for today; into Brain Dump unschedules it. */
export async function moveTask(db: SQLiteDatabase, task: Task, category: CategoryId, today: string) {
  const scheduled = category === 'brain_dump' ? null : task.scheduledDate ?? today;
  await db.runAsync(
    `UPDATE tasks SET category = ?, scheduled_date = ?, sort_order = ?, updated_at = ?, sync_status = 'dirty' WHERE id = ?`,
    category, scheduled, Date.now(), nowIso(), task.id,
  );
  await logEvent(db, task.id, 'moved', category);
  notifyLocalChange();
}

export async function softDeleteTask(db: SQLiteDatabase, task: Task) {
  const ts = nowIso();
  await db.runAsync(`UPDATE tasks SET deleted_at = ?, updated_at = ?, sync_status = 'dirty' WHERE id = ?`, ts, ts, task.id);
  await logEvent(db, task.id, 'deleted', task.category);
  notifyLocalChange();
}

export async function markDayReviewed(db: SQLiteDatabase, date: string, migrated: number, released: number) {
  await db.runAsync(
    `INSERT OR REPLACE INTO day_reviews (date, reviewed_at, migrated_count, released_count) VALUES (?, ?, ?, ?)`,
    date, nowIso(), migrated, released,
  );
}

export type ReleaseAction = 'brain_dump' | 'drop';

/**
 * Morning Review commit. Runs atomically.
 *  - keepIds    → cloned onto `today` (same category), original marked rolled_over
 *  - everything else from `candidates`
 *      'brain_dump' → cloned into the inbox (nothing is lost), original rolled_over
 *      'drop'       → original marked dropped ("let it go")
 */
export async function applyRollover(
  db: SQLiteDatabase,
  params: { today: string; candidates: Task[]; keepIds: Set<string>; releaseAction: ReleaseAction },
) {
  const { today, candidates, keepIds, releaseAction } = params;
  const ts = nowIso();
  let migrated = 0;
  let released = 0;

  await db.withTransactionAsync(async () => {
    for (const [index, task] of candidates.entries()) {
      const keep = keepIds.has(task.id);

      if (keep || releaseAction === 'brain_dump') {
        const category: CategoryId = keep ? task.category : 'brain_dump';
        // Deterministic: the same task rolled over on the same day gets the same id on every device.
        const cloneId = await deterministicUuid(`rollover:${task.id}:${today}`);
        await db.runAsync(
          `INSERT INTO tasks (id, title, notes, category, status, scheduled_date, sort_order,
                              rolled_from_id, rollover_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          cloneId, task.title, task.notes, category, keep ? today : null, Date.now() + index,
          task.id, keep ? task.rolloverCount + 1 : task.rolloverCount, ts, ts,
        );
        await db.runAsync(
          `UPDATE tasks SET status = 'rolled_over', updated_at = ?, sync_status = 'dirty' WHERE id = ?`,
          ts, task.id,
        );
        await logEvent(db, task.id, keep ? 'rolled_over' : 'sent_to_brain_dump', task.category);
      } else {
        await db.runAsync(
          `UPDATE tasks SET status = 'dropped', updated_at = ?, sync_status = 'dirty' WHERE id = ?`,
          ts, task.id,
        );
        await logEvent(db, task.id, 'dropped', task.category);
      }
      keep ? migrated++ : released++;
    }
    await markDayReviewed(db, today, migrated, released);
  });

  notifyLocalChange();
  return { migrated, released };
}
