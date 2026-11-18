import type { SQLiteDatabase } from 'expo-sqlite';
import { DAY_CATEGORIES } from '../../constants/categories';
import type { DayCategoryId, WeeklyStats } from '../../types/task';
import { addDays } from '../../utils/date';

/**
 * Completion rate = completed / planned, where "planned" is every task that
 * was on a given day's list (incl. ones later rolled over or dropped).
 * A task rolled over 3 times therefore counts as 3 missed commitments + 1 hit,
 * which is exactly the signal the insights engine wants.
 */
export async function getWeeklyStats(db: SQLiteDatabase, weekStart: string): Promise<WeeklyStats> {
  const weekEnd = addDays(weekStart, 6);

  const rows = await db.getAllAsync<{ category: DayCategoryId; day: string; total: number; completed: number }>(
    `SELECT category, scheduled_date AS day,
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM tasks
      WHERE deleted_at IS NULL AND category != 'brain_dump'
        AND scheduled_date BETWEEN ? AND ?
      GROUP BY category, scheduled_date`,
    weekStart, weekEnd,
  );

  const chronic = await db.getAllAsync<{ title: string; rollover_count: number }>(
    `SELECT title, rollover_count FROM tasks
      WHERE deleted_at IS NULL AND status = 'pending' AND rollover_count >= 3
        AND scheduled_date BETWEEN ? AND ?
      ORDER BY rollover_count DESC LIMIT 5`,
    weekStart, weekEnd,
  );

  const byCategory = Object.fromEntries(
    DAY_CATEGORIES.map((c) => [c, { total: 0, completed: 0 }]),
  ) as WeeklyStats['byCategory'];
  const dayMap = new Map<string, { total: number; completed: number }>();
  for (let i = 0; i < 7; i++) dayMap.set(addDays(weekStart, i), { total: 0, completed: 0 });

  for (const r of rows) {
    byCategory[r.category].total += r.total;
    byCategory[r.category].completed += r.completed ?? 0;
    const d = dayMap.get(r.day);
    if (d) {
      d.total += r.total;
      d.completed += r.completed ?? 0;
    }
  }

  const totals = DAY_CATEGORIES.reduce(
    (acc, c) => ({ total: acc.total + byCategory[c].total, completed: acc.completed + byCategory[c].completed }),
    { total: 0, completed: 0 },
  );

  return {
    weekStart,
    weekEnd,
    byCategory,
    byDay: [...dayMap.entries()].map(([date, v]) => ({ date, ...v })),
    totals,
    chronicRollovers: chronic.map((c) => ({ title: c.title, rolloverCount: c.rollover_count })),
  };
}
