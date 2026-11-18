export type CategoryId = 'must' | 'should' | 'could' | 'brain_dump';
/** Categories that belong to a specific day (everything except the inbox). */
export type DayCategoryId = Exclude<CategoryId, 'brain_dump'>;

/**
 * pending     – open task
 * completed   – done on its scheduled day
 * rolled_over – not finished on its day; user carried it forward (a clone exists)
 * dropped     – user consciously "let it go" during the morning review
 */
export type TaskStatus = 'pending' | 'completed' | 'rolled_over' | 'dropped';
export type SyncStatus = 'dirty' | 'synced' | 'error';

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  category: CategoryId;
  status: TaskStatus;
  /** Local calendar day 'YYYY-MM-DD'. NULL for Brain Dump items. */
  scheduledDate: string | null;
  sortOrder: number;
  /** Points at the task this one was rolled over from (history chain). */
  rolledFromId: string | null;
  /** How many days this task has been carried forward. */
  rolloverCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Soft-delete tombstone so deletions can sync to the server later. */
  deletedAt: string | null;
  syncStatus: SyncStatus;
}

/** Raw SQLite row (snake_case). */
export interface TaskRow {
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
  sync_status: SyncStatus;
}

export const mapTaskRow = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  category: r.category,
  status: r.status,
  scheduledDate: r.scheduled_date,
  sortOrder: r.sort_order,
  rolledFromId: r.rolled_from_id,
  rolloverCount: r.rollover_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  completedAt: r.completed_at,
  deletedAt: r.deleted_at,
  syncStatus: r.sync_status,
});

export type TaskEventType =
  | 'created'
  | 'completed'
  | 'uncompleted'
  | 'moved'
  | 'rolled_over'
  | 'sent_to_brain_dump'
  | 'dropped'
  | 'deleted';

export interface CategoryStat {
  total: number;
  completed: number;
}

export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  byCategory: Record<DayCategoryId, CategoryStat>;
  byDay: { date: string; total: number; completed: number }[];
  totals: CategoryStat;
  /** Tasks that keep getting carried forward – a strong stress signal. */
  chronicRollovers: { title: string; rolloverCount: number }[];
}

export type InsightTone = 'celebrate' | 'nudge' | 'info';
export interface Insight {
  id: string;
  tone: InsightTone;
  emoji: string;
  text: string;
}
