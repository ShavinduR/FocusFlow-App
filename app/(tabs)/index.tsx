import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { CategorySection } from '../../src/components/CategorySection';
import { QuickAddFab } from '../../src/components/QuickAddFab';
import { TaskItem } from '../../src/components/TaskItem';
import { DAY_CATEGORIES } from '../../src/constants/categories';
import { useTaskStore } from '../../src/store/useTaskStore';
import { useTheme } from '../../src/theme/useTheme';
import type { CategoryId, Task } from '../../src/types/task';
import { formatLongDate, greeting } from '../../src/utils/date';

export default function DailyScreen() {
  const { colors, fonts } = useTheme();
  const { today, tasks, brainDump, lastCategory, addTask, toggleTask, moveTask, deleteTask } = useTaskStore();

  const done = tasks.filter((t) => t.status === 'completed').length;
  const ratio = tasks.length ? done / tasks.length : 0;
  const mustLeft = tasks.filter((t) => t.category === 'must' && t.status !== 'completed').length;

  const barStyle = useAnimatedStyle(() => ({ width: withTiming(`${ratio * 100}%`, { duration: 500 }) }), [ratio]);

  const renderTask = useCallback(
    (task: Task) => (
      <TaskItem
        task={task}
        onToggle={toggleTask}
        onMove={(t: Task, c: CategoryId) => moveTask(t, c)}
        onDelete={deleteTask}
      />
    ),
    [toggleTask, moveTask, deleteTask],
  );

  // Default the quick-add chip to Must Do until the day has a frog.
  const hasMust = tasks.some((t) => t.category === 'must');
  const defaultCategory: CategoryId = hasMust ? (lastCategory === 'must' ? 'should' : lastCategory) : 'must';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.date, { color: colors.textMuted, fontFamily: fonts.medium }]}>{formatLongDate(today).toUpperCase()}</Text>
          <Text style={[styles.greeting, { color: colors.text, fontFamily: fonts.semibold }]}>{greeting()}</Text>
          <Text style={[styles.sub, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            {tasks.length === 0
              ? 'Tap + and start with one Must Do.'
              : mustLeft > 0
                ? `${mustLeft} Must Do ${mustLeft === 1 ? 'task' : 'tasks'} left. Start there.`
                : done === tasks.length
                  ? 'Everything done. Enjoy your evening ✨'
                  : 'Frogs eaten 🐸 Everything else is a bonus.'}
          </Text>

          {tasks.length > 0 && (
            <View style={styles.progressRow}>
              <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                <Animated.View style={[styles.fill, { backgroundColor: colors.success }, barStyle]} />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted, fontFamily: fonts.medium }]}>
                {done}/{tasks.length}
              </Text>
            </View>
          )}
        </View>

        {DAY_CATEGORIES.map((c) => (
          <CategorySection key={c} category={c} tasks={tasks.filter((t) => t.category === c)} renderTask={renderTask} />
        ))}

        <CategorySection category="brain_dump" tasks={brainDump} renderTask={renderTask} collapsible defaultCollapsed={brainDump.length > 5} />
        <Text style={[styles.footnote, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          Long-press any task to move it between lists.
        </Text>
      </ScrollView>

      <QuickAddFab defaultCategory={defaultCategory} onAdd={addTask} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 120, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { marginBottom: 28 },
  date: { fontSize: 12, letterSpacing: 1 },
  greeting: { fontSize: 28, marginTop: 2 },
  sub: { fontSize: 14, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 12 },
  footnote: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
