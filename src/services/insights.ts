import type { Insight, WeeklyStats } from '../types/task';

const pct = (completed: number, total: number) => (total === 0 ? 0 : completed / total);
const fmt = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Pure, rule-based insight engine (easy to unit-test, works offline).
 * Rules are ordered by importance; we return at most `limit` insights.
 */
export function generateInsights(stats: WeeklyStats, previous?: WeeklyStats, limit = 4): Insight[] {
  const out: Insight[] = [];
  const { must, should, could } = stats.byCategory;
  const mustRate = pct(must.completed, must.total);
  const overall = pct(stats.totals.completed, stats.totals.total);

  if (stats.totals.total === 0) {
    return [{ id: 'empty', tone: 'info', emoji: '🌱', text: 'A fresh week. Start by choosing one Must Do for today.' }];
  }

  // 1. Must Do performance: the headline metric.
  if (must.total === 0) {
    out.push({ id: 'no-must', tone: 'nudge', emoji: '🐸', text: "You didn't set any Must Do tasks this week. Choosing just one each morning gives your day a clear win." });
  } else if (mustRate >= 0.8) {
    out.push({ id: 'must-great', tone: 'celebrate', emoji: '🔥', text: `Great job! You completed ${fmt(mustRate)} of your Must Do tasks this week.` });
  } else if (must.total >= 3 && mustRate < 0.5) {
    out.push({ id: 'must-low', tone: 'nudge', emoji: '🎯', text: `You finished ${fmt(mustRate)} of your Must Dos. Try fewer frogs per day (1–3) and tackle them first thing.` });
  }

  // 2. Focus balance: is effort going to low-value work?
  const doneTotal = stats.totals.completed;
  if (doneTotal >= 5 && could.completed / doneTotal > 0.4 && could.completed > must.completed) {
    out.push({ id: 'could-heavy', tone: 'nudge', emoji: '☕', text: "You focused mostly on Could Do tasks. Let's prioritise Must Do next week." });
  }

  // 3. Chronic rollovers: the stress signal.
  const [worst] = stats.chronicRollovers;
  if (worst) {
    out.push({ id: 'chronic', tone: 'nudge', emoji: '🔁', text: `"${worst.title}" has rolled over ${worst.rolloverCount} times. Break it into a smaller first step, or let it go.` });
  }

  // 4. Week-over-week trend.
  if (previous && previous.totals.total > 0) {
    const delta = overall - pct(previous.totals.completed, previous.totals.total);
    if (delta >= 0.1) out.push({ id: 'trend-up', tone: 'celebrate', emoji: '📈', text: `Your completion rate is up ${fmt(delta)} from last week. Momentum!` });
    else if (delta <= -0.15) out.push({ id: 'trend-down', tone: 'info', emoji: '🫶', text: 'A lighter week than last. That is okay. Rest is part of the process.' });
  }

  // 5. Should Do steadiness.
  if (should.total >= 3 && pct(should.completed, should.total) >= 0.75) {
    out.push({ id: 'should-good', tone: 'celebrate', emoji: '⭐', text: 'You stayed on top of your Should Dos. Assignments and notes are under control.' });
  }

  // 6. Best day.
  const best = [...stats.byDay].filter((d) => d.total > 0).sort((a, b) => b.completed - a.completed)[0];
  if (best && best.completed >= 3) {
    const day = new Date(best.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
    out.push({ id: 'best-day', tone: 'info', emoji: '🏆', text: `${day} was your most productive day (${best.completed} tasks done).` });
  }

  if (out.length === 0) {
    out.push({ id: 'steady', tone: 'info', emoji: '🌤️', text: `You've completed ${fmt(overall)} of planned tasks so far. Keep starting each day with your Must Do.` });
  }
  return out.slice(0, limit);
}
