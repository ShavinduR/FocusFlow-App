export function relativeTime(iso: string | null, now = Date.now()) {
  if (!iso) return 'Never';
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 45) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
