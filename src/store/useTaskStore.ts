import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as repo from '../db/repositories/taskRepository';
import type { CategoryId, Task } from '../types/task';
import { todayKey } from '../utils/date';

interface TaskState {
  db: SQLiteDatabase | null;
  ready: boolean;
  today: string;
  tasks: Task[];      // today's Must/Should/Could
  brainDump: Task[];
  lastCategory: CategoryId;
  rolloverOpen: boolean;

  init: (db: SQLiteDatabase) => Promise<void>;
  refresh: () => Promise<void>;
  addTask: (title: string, category: CategoryId) => Promise<void>;
  toggleTask: (task: Task) => Promise<void>;
  moveTask: (task: Task, category: CategoryId) => Promise<void>;
  deleteTask: (task: Task) => Promise<void>;
  setRolloverOpen: (open: boolean) => void;
}

const requireDb = (db: SQLiteDatabase | null) => {
  if (!db) throw new Error('Database not initialised');
  return db;
};

export const useTaskStore = create<TaskState>((set, get) => ({
  db: null,
  ready: false,
  today: todayKey(),
  tasks: [],
  brainDump: [],
  lastCategory: 'must',
  rolloverOpen: false,

  init: async (db) => {
    set({ db });
    await get().refresh();
    set({ ready: true });
  },

  refresh: async () => {
    const db = get().db;
    if (!db) return;
    const today = todayKey(); // re-evaluated so an app left open overnight rolls to the new day
    const [tasks, brainDump] = await Promise.all([repo.getTasksForDate(db, today), repo.getBrainDump(db)]);
    set({ today, tasks, brainDump });
  },

  addTask: async (title, category) => {
    if (!title.trim()) return;
    const db = requireDb(get().db);
    const task = await repo.createTask(db, { title, category, date: get().today });
    set((s) =>
      category === 'brain_dump'
        ? { brainDump: [task, ...s.brainDump], lastCategory: category }
        : { tasks: [...s.tasks, task], lastCategory: category },
    );
  },

  // Optimistic: flip state first so the strike-through animation starts instantly.
  toggleTask: async (task) => {
    const db = requireDb(get().db);
    const completed = task.status !== 'completed';
    const patch = (t: Task): Task =>
      t.id === task.id ? { ...t, status: completed ? 'completed' : 'pending', completedAt: completed ? new Date().toISOString() : null } : t;
    set((s) => ({ tasks: s.tasks.map(patch), brainDump: s.brainDump.map(patch) }));
    try {
      await repo.setTaskCompleted(db, task, completed);
      if (task.category === 'brain_dump') await get().refresh();
    } catch (e) {
      await get().refresh(); // roll back to truth
      throw e;
    }
  },

  moveTask: async (task, category) => {
    await repo.moveTask(requireDb(get().db), task, category, get().today);
    await get().refresh();
  },

  deleteTask: async (task) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== task.id), brainDump: s.brainDump.filter((t) => t.id !== task.id) }));
    await repo.softDeleteTask(requireDb(get().db), task);
  },

  setRolloverOpen: (open) => set({ rolloverOpen: open }),
}));
