import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, MUST_DO_SOFT_LIMIT } from '../src/constants/categories';
import { applyRollover, getPendingBefore, markDayReviewed, type ReleaseAction } from '../src/db/repositories/taskRepository';
import { useTaskStore } from '../src/store/useTaskStore';
import { useTheme } from '../src/theme/useTheme';
import { withAlpha } from '../src/theme/tokens';
import type { Task } from '../src/types/task';
import { greeting, relativeDayLabel, todayKey } from '../src/utils/date';
import { haptics } from '../src/utils/haptics';

export default function RolloverScreen() {
  const router = useRouter();
  const { colors, fonts, radius } = useTheme();
  const db = useTaskStore((s) => s.db)!;
  const refresh = useTaskStore((s) => s.refresh);
  const setRolloverOpen = useTaskStore((s) => s.setRolloverOpen);

  const today = useMemo(todayKey, []);
  const [candidates, setCandidates] = useState<Task[] | null>(null);
  // Nothing is pre-selected: the user consciously chooses what comes along.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [releaseAction, setReleaseAction] = useState<ReleaseAction>('brain_dump');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRolloverOpen(true);
    getPendingBefore(db, today).then(async (rows) => {
      if (rows.length === 0) {
        await markDayReviewed(db, today, 0, 0);
        close();
        return;
      }
      setCandidates(rows);
    });
    return () => setRolloverOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    candidates?.forEach((t) => {
      const key = t.scheduledDate!;
      map.set(key, [...(map.get(key) ?? []), t]);
    });
    return [...map.entries()];
  }, [candidates]);

  const toggle = (id: string) => {
    haptics.selection();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectWhere = (pred: (t: Task) => boolean) => {
    haptics.light();
    setSelected(new Set(candidates?.filter(pred).map((t) => t.id)));
  };

  const confirm = async () => {
    if (!candidates) return;
    setSubmitting(true);
    try {
      await applyRollover(db, { today, candidates, keepIds: selected, releaseAction });
      haptics.success();
      await refresh();
      close();
    } finally {
      setSubmitting(false);
    }
  };

  if (!candidates) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const selectedMust = candidates.filter((t) => selected.has(t.id) && t.category === 'must').length;
  const unselected = candidates.length - selected.size;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[styles.kicker, { color: colors.primary, fontFamily: fonts.semibold }]}>MORNING REVIEW</Text>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semibold }]}>{greeting()} ☀️</Text>
          <Text style={[styles.body, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            {candidates.length} {candidates.length === 1 ? 'task was' : 'tasks were'} left open. That's normal.
            Pick only what still matters <Text style={{ fontFamily: fonts.semibold }}>today</Text>.
          </Text>
        </Animated.View>

        <View style={styles.quickRow}>
          <QuickButton label="🔥 All Must Do" onPress={() => selectWhere((t) => t.category === 'must')} />
          <QuickButton label="Select all" onPress={() => selectWhere(() => true)} />
          <QuickButton label="Clear" onPress={() => selectWhere(() => false)} />
        </View>

        {groups.map(([date, items], gi) => (
          <Animated.View key={date} entering={FadeInDown.delay(80 * (gi + 1)).duration(350)} style={styles.group}>
            <Text style={[styles.groupLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>{relativeDayLabel(date, today)}</Text>
            {items.map((task) => {
              const meta = CATEGORIES[task.category];
              const on = selected.has(task.id);
              return (
                <Animated.View key={task.id} layout={LinearTransition}>
                  <Pressable
                    onPress={() => toggle(task.id)}
                    style={[
                      styles.row,
                      {
                        borderRadius: radius.md,
                        backgroundColor: on ? withAlpha(meta.color, 0.1) : colors.surface,
                        borderColor: on ? meta.color : colors.border,
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? meta.color : colors.textMuted} />
                    <View style={styles.flex}>
                      <Text numberOfLines={2} style={[styles.taskTitle, { color: colors.text, fontFamily: fonts.medium }]}>
                        {task.title}
                      </Text>
                      <Text style={[styles.meta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                        {meta.emoji} {meta.label}
                        {task.rolloverCount >= 2 ? `  ·  carried ${task.rolloverCount}× already` : ''}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>
        ))}

        {task_hint(selectedMust, colors.textMuted, fonts.regular)}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {unselected > 0 && (
          <View style={styles.releaseRow}>
            <Text style={[styles.releaseLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              The other {unselected}:
            </Text>
            <Segment
              options={[
                { value: 'brain_dump', label: '📥 Brain Dump' },
                { value: 'drop', label: '🍃 Let go' },
              ]}
              value={releaseAction}
              onChange={(v) => setReleaseAction(v as ReleaseAction)}
            />
          </View>
        )}
        <Pressable
          onPress={confirm}
          disabled={submitting}
          style={[styles.cta, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaText, { color: colors.onPrimary, fontFamily: fonts.semibold }]}>
            {selected.size === 0 ? 'Start with a clean slate' : `Bring ${selected.size} ${selected.size === 1 ? 'task' : 'tasks'} into today`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  function task_hint(mustCount: number, color: string, fontFamily: string) {
    if (mustCount <= MUST_DO_SOFT_LIMIT) return null;
    return (
      <Text style={[styles.hint, { color, fontFamily }]}>
        That's {mustCount} Must Dos. Consider moving a few to Should Do after you start your day.
      </Text>
    );
  }
}

function QuickButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.quickBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function Segment({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptics.selection();
              onChange(o.value);
            }}
            style={[styles.segmentItem, active && { backgroundColor: colors.surface }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={{ fontSize: 12, color: active ? colors.text : colors.textMuted, fontFamily: active ? fonts.semibold : fonts.regular }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  kicker: { fontSize: 12, letterSpacing: 1.2 },
  title: { fontSize: 28, marginTop: 4 },
  body: { fontSize: 15, marginTop: 6, lineHeight: 22 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 8, flexWrap: 'wrap' },
  quickBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  group: { marginTop: 16 },
  groupLabel: { fontSize: 12, marginBottom: 8, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, marginBottom: 8 },
  taskTitle: { fontSize: 15 },
  meta: { fontSize: 12, marginTop: 2 },
  hint: { fontSize: 12, marginTop: 8 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  releaseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', maxWidth: 640, alignSelf: 'center' },
  releaseLabel: { fontSize: 13 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  cta: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', width: '100%', maxWidth: 640, alignSelf: 'center' },
  ctaText: { fontSize: 16 },
});
