import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ALL_CATEGORIES, CATEGORIES } from '../constants/categories';
import { useTheme } from '../theme/useTheme';
import { withAlpha } from '../theme/tokens';
import type { CategoryId, Task } from '../types/task';
import { haptics } from '../utils/haptics';

interface Props {
  task: Task;
  onToggle: (task: Task) => void;
  onMove: (task: Task, category: CategoryId) => void;
  onDelete: (task: Task) => void;
}

export const TaskItem = memo(function TaskItem({ task, onToggle, onMove, onDelete }: Props) {
  const { colors, fonts, radius } = useTheme();
  const accent = CATEGORIES[task.category].color;
  const done = task.status === 'completed';
  const [showActions, setShowActions] = useState(false);

  // 0 → 1 drives the strike line, the fade and the check fill together.
  const progress = useSharedValue(done ? 1 : 0);
  const checkScale = useSharedValue(1);
  const textWidth = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(done ? 1 : 0, { duration: 340, easing: Easing.out(Easing.cubic) });
  }, [done, progress]);

  const handleToggle = () => {
    checkScale.value = withSequence(withTiming(0.75, { duration: 70 }), withSpring(1, { damping: 7, stiffness: 320 }));
    done ? haptics.light() : haptics.success();
    onToggle(task);
  };

  const onTextLayout = (e: LayoutChangeEvent) => {
    textWidth.value = e.nativeEvent.layout.width;
  };

  const strikeStyle = useAnimatedStyle(() => ({ width: textWidth.value * progress.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [1, 0.45]) }));
  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.3, 1]) }],
  }));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
      <Pressable
        onPress={handleToggle}
        onLongPress={() => {
          haptics.medium();
          setShowActions((v) => !v);
        }}
        delayLongPress={350}
        style={styles.row}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={task.title}
        accessibilityHint="Double tap to toggle. Long press for options."
      >
        <Animated.View style={[styles.checkbox, { borderColor: accent }, boxStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.checkFill, { backgroundColor: accent }, fillStyle]}>
            <Ionicons name="checkmark" size={15} color="#fff" />
          </Animated.View>
        </Animated.View>

        <View style={styles.titleWrap}>
          <Animated.Text
            onLayout={onTextLayout}
            numberOfLines={1}
            style={[styles.title, { color: colors.text, fontFamily: fonts.medium }, titleStyle]}
          >
            {task.title}
          </Animated.Text>
          <Animated.View pointerEvents="none" style={[styles.strike, { backgroundColor: colors.textMuted }, strikeStyle]} />
        </View>

        {task.rolloverCount > 0 && !done && (
          <View style={[styles.badge, { backgroundColor: withAlpha(accent, 0.14) }]}>
            <Ionicons name="return-down-forward" size={11} color={accent} />
            <Text style={[styles.badgeText, { color: accent, fontFamily: fonts.medium }]}>{task.rolloverCount}</Text>
          </View>
        )}
      </Pressable>

      {showActions && (
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          {ALL_CATEGORIES.filter((c) => c !== task.category).map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                haptics.selection();
                setShowActions(false);
                onMove(task, c);
              }}
              style={[styles.actionChip, { backgroundColor: colors.surfaceAlt }]}
            >
              <Text style={[styles.actionText, { color: colors.text, fontFamily: fonts.regular }]}>
                {CATEGORIES[c].emoji} {CATEGORIES[c].label}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => onDelete(task)} style={styles.deleteBtn} accessibilityLabel="Delete task">
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Pressable>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, marginBottom: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, overflow: 'hidden' },
  checkFill: { alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 15, alignSelf: 'flex-start', maxWidth: '100%' },
  strike: { position: 'absolute', left: 0, height: 2, borderRadius: 1, top: '50%', marginTop: -1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  actionText: { fontSize: 12 },
  deleteBtn: { marginLeft: 'auto', padding: 6 },
});
