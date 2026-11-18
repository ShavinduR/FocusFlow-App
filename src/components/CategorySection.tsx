import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, MUST_DO_SOFT_LIMIT } from '../constants/categories';
import { useTheme } from '../theme/useTheme';
import { withAlpha } from '../theme/tokens';
import type { CategoryId, Task } from '../types/task';

interface Props {
  category: CategoryId;
  tasks: Task[];
  renderTask: (task: Task) => ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function CategorySection({ category, tasks, renderTask, collapsible, defaultCollapsed }: Props) {
  const { colors, fonts } = useTheme();
  const meta = CATEGORIES[category];
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  const done = tasks.filter((t) => t.status === 'completed').length;
  const tooManyFrogs = category === 'must' && tasks.length - done > MUST_DO_SOFT_LIMIT;

  return (
    <View style={styles.section}>
      <Pressable
        disabled={!collapsible}
        onPress={() => setCollapsed((c) => !c)}
        style={styles.header}
        accessibilityRole={collapsible ? 'button' : 'header'}
      >
        <View style={[styles.emojiWrap, { backgroundColor: withAlpha(meta.color, 0.14) }]}>
          <Text style={styles.emoji}>{meta.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.text, fontFamily: fonts.semibold }]}>{meta.label}</Text>
          <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>{meta.hint}</Text>
        </View>
        {tasks.length > 0 && (
          <Text style={[styles.count, { color: colors.textMuted, fontFamily: fonts.medium }]}>
            {category === 'brain_dump' ? tasks.length : `${done}/${tasks.length}`}
          </Text>
        )}
        {collapsible && (
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textMuted} />
        )}
      </Pressable>

      {tooManyFrogs && (
        <Text style={[styles.warning, { color: meta.color, fontFamily: fonts.regular }]}>
          Tip: keep Must Do to {MUST_DO_SOFT_LIMIT} or fewer. Too many "priorities" means none.
        </Text>
      )}

      {!collapsed &&
        (tasks.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: fonts.regular }]}>{meta.emptyText}</Text>
          </View>
        ) : (
          tasks.map((t) => <View key={t.id}>{renderTask(t)}</View>)
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  emojiWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18 },
  label: { fontSize: 16 },
  hint: { fontSize: 12, marginTop: -2 },
  count: { fontSize: 13 },
  warning: { fontSize: 12, marginBottom: 8 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 14 },
  emptyText: { fontSize: 13 },
});
