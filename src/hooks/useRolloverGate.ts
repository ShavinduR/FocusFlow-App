import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { getPendingBefore, hasReviewedDay, markDayReviewed } from '../db/repositories/taskRepository';
import { useTaskStore } from '../store/useTaskStore';
import { todayKey } from '../utils/date';

/**
 * Shows the Morning Review once per day, on launch AND when the app returns
 * to the foreground (covers "left the app open overnight").
 * If there is nothing to review, the day is silently marked as reviewed.
 */
export function useRolloverGate() {
  const router = useRouter();
  const db = useTaskStore((s) => s.db);

  const check = useCallback(async () => {
    if (!db) return;
    const store = useTaskStore.getState();
    await store.refresh();
    if (store.rolloverOpen) return;

    const today = todayKey();
    if (await hasReviewedDay(db, today)) return;

    const pending = await getPendingBefore(db, today);
    if (pending.length === 0) {
      await markDayReviewed(db, today, 0, 0);
      return;
    }
    useTaskStore.getState().setRolloverOpen(true);
    router.push('/rollover');
  }, [db, router]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);
}
