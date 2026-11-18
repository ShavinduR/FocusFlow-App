import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressRing } from '../../src/components/ProgressRing';
import { CATEGORIES, DAY_CATEGORIES } from '../../src/constants/categories';
import { useWeeklyStats } from '../../src/hooks/useWeeklyStats';
import { useTheme } from '../../src/theme/useTheme';
import { withAlpha } from '../../src/theme/tokens';
import { formatShortDay, fromDateKey, todayKey } from '../../src/utils/date';

const rate = (c: number, t: number) => (t ? c / t : 0);

export default function InsightsScreen() {
  const { colors, fonts } = useTheme();
  const { stats, insights } = useWeeklyStats();
  if (!stats) return null;

  const overall = rate(stats.totals.completed, stats.totals.total);
  const maxDay = Math.max(1, ...stats.byDay.map((d) => d.total));
  const range = `${fromDateKey(stats.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${fromDateKey(stats.weekEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.kicker, { color: colors.textMuted, fontFamily: fonts.medium }]}>THIS WEEK · {range.toUpperCase()}</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semibold }]}>Your progress</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ProgressRing progress={overall} size={150} stroke={14} color={colors.primary} label={`${Math.round(overall * 100)}%`} sublabel={`${stats.totals.completed} of ${stats.totals.total} done`} />
          <View style={styles.ringRow}>
            {DAY_CATEGORIES.map((c) => {
              const s = stats.byCategory[c];
              return (
                <View key={c} style={styles.ringItem}>
                  <ProgressRing progress={rate(s.completed, s.total)} size={72} stroke={8} color={CATEGORIES[c].color} label={CATEGORIES[c].emoji} />
                  <Text style={[styles.ringLabel, { color: colors.text, fontFamily: fonts.medium }]}>{CATEGORIES[c].label}</Text>
                  <Text style={[styles.ringSub, { color: colors.textMuted, fontFamily: fonts.regular }]}>{s.completed}/{s.total}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semibold }]}>Daily completion</Text>
          <View style={styles.bars}>
            {stats.byDay.map((d) => {
              const isToday = d.date === todayKey();
              return (
                <View key={d.date} style={styles.barCol}>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={[styles.barPlanned, { height: `${(d.total / maxDay) * 100}%`, backgroundColor: withAlpha(colors.primary, 0.2) }]}>
                      <View style={[styles.barDone, { height: `${rate(d.completed, d.total) * 100}%`, backgroundColor: colors.primary }]} />
                    </View>
                  </View>
                  <Text style={[styles.barLabel, { color: isToday ? colors.primary : colors.textMuted, fontFamily: isToday ? fonts.semibold : fonts.regular }]}>
                    {formatShortDay(d.date).slice(0, 2)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semibold, marginTop: 8 }]}>Insights</Text>
        {insights.map((i) => {
          const tint = i.tone === 'celebrate' ? colors.success : i.tone === 'nudge' ? CATEGORIES.must.color : colors.primary;
          return (
            <View key={i.id} style={[styles.insight, { backgroundColor: withAlpha(tint, 0.1), borderColor: withAlpha(tint, 0.3) }]}>
              <Text style={styles.insightEmoji}>{i.emoji}</Text>
              <Text style={[styles.insightText, { color: colors.text, fontFamily: fonts.regular }]}>{i.text}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' },
  kicker: { fontSize: 12, letterSpacing: 1 },
  title: { fontSize: 28, marginBottom: 16 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 20, marginBottom: 16, alignItems: 'center' },
  cardTitle: { fontSize: 16, alignSelf: 'flex-start', marginBottom: 12 },
  ringRow: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 20 },
  ringItem: { alignItems: 'center' },
  ringLabel: { fontSize: 12, marginTop: 6 },
  ringSub: { fontSize: 11 },
  bars: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', height: 140 },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: { flex: 1, width: 18, borderRadius: 9, justifyContent: 'flex-end', overflow: 'hidden' },
  barPlanned: { width: '100%', borderRadius: 9, justifyContent: 'flex-end', overflow: 'hidden' },
  barDone: { width: '100%', borderRadius: 9 },
  barLabel: { fontSize: 11, marginTop: 6 },
  insight: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10, alignItems: 'flex-start' },
  insightEmoji: { fontSize: 20 },
  insightText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
