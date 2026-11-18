import type { CategoryId, DayCategoryId } from '../types/task';

export interface CategoryMeta {
  id: CategoryId;
  emoji: string;
  label: string;
  hint: string;
  emptyText: string;
  color: string;
}

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  must: {
    id: 'must',
    emoji: '🔥',
    label: 'Must Do',
    hint: 'Eat the frog: your most important task',
    emptyText: 'What is the one thing that would make today a win?',
    color: '#F2682A',
  },
  should: {
    id: 'should',
    emoji: '⭐',
    label: 'Should Do',
    hint: 'Important, but not urgent',
    emptyText: 'Assignments, notes, follow-ups…',
    color: '#D9A21B',
  },
  could: {
    id: 'could',
    emoji: '☕',
    label: 'Could Do',
    hint: 'Only if there is time. No pressure.',
    emptyText: 'Nice-to-haves live here.',
    color: '#3BA58B',
  },
  brain_dump: {
    id: 'brain_dump',
    emoji: '📥',
    label: 'Brain Dump',
    hint: 'Get it out of your head. Plan it later.',
    emptyText: 'Your mind is clear. Nice.',
    color: '#8B8FA3',
  },
};

export const DAY_CATEGORIES: DayCategoryId[] = ['must', 'should', 'could'];
export const ALL_CATEGORIES: CategoryId[] = ['must', 'should', 'could', 'brain_dump'];

/** Soft cap: more than this many frogs tends to cause overwhelm. */
export const MUST_DO_SOFT_LIMIT = 3;

/** Used in SQL ORDER BY so Must Do always comes first. */
export const CATEGORY_ORDER_SQL = `CASE category WHEN 'must' THEN 0 WHEN 'should' THEN 1 WHEN 'could' THEN 2 ELSE 3 END`;
