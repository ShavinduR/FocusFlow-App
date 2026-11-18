/**
 * All "day" logic uses the user's LOCAL calendar day as 'YYYY-MM-DD'.
 * Never use toISOString() for day keys: it is UTC and breaks around midnight.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayKey = () => toDateKey(new Date());

export const fromDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number) => {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};

/** Monday-based week start. */
export const startOfWeek = (key: string) => {
  const d = fromDateKey(key);
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - offset);
  return toDateKey(d);
};

export const formatLongDate = (key: string) =>
  fromDateKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

export const formatShortDay = (key: string) =>
  fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short' });

export const relativeDayLabel = (key: string, today = todayKey()) => {
  if (key === addDays(today, -1)) return 'Yesterday';
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};
