import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getWeeklyStats } from '../db/repositories/analyticsRepository';
import { generateInsights } from '../services/insights';
import { useTaskStore } from '../store/useTaskStore';
import type { Insight, WeeklyStats } from '../types/task';
import { addDays, startOfWeek, todayKey } from '../utils/date';

export function useWeeklyStats(weekOffset = 0) {
  const db = useTaskStore((s) => s.db);
  const tasks = useTaskStore((s) => s.tasks); // re-run when today's list changes
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  const load = useCallback(async () => {
    if (!db) return;
    const weekStart = addDays(startOfWeek(todayKey()), weekOffset * 7);
    const [current, previous] = await Promise.all([
      getWeeklyStats(db, weekStart),
      getWeeklyStats(db, addDays(weekStart, -7)),
    ]);
    setStats(current);
    setInsights(generateInsights(current, previous));
  }, [db, weekOffset]);

  useEffect(() => { load(); }, [load, tasks]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { stats, insights, reload: load };
}
