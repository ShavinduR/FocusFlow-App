import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ALL_CATEGORIES, CATEGORIES } from '../constants/categories';
import { useTheme } from '../theme/useTheme';
import { withAlpha } from '../theme/tokens';
import type { CategoryId } from '../types/task';
import { haptics } from '../utils/haptics';

interface Props {
  defaultCategory: CategoryId;
  onAdd: (title: string, category: CategoryId) => Promise<void>;
}

/**
 * One button, one text field, four chips. No forms.
 * Enter adds the task and keeps the sheet open for rapid-fire entry.
 */
export function QuickAddFab({ defaultCategory, onAdd }: Props) {
  const { colors, fonts, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryId>(defaultCategory);
  const [lastAdded, setLastAdded] = useState<{ text: string; n: number } | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const fabScale = useSharedValue(1);

  // Reset the chip only when the sheet opens. Depending on defaultCategory
  // would let a just-finished save overwrite a chip the user tapped meanwhile.
  const defaultRef = useRef(defaultCategory);
  defaultRef.current = defaultCategory;
  useEffect(() => {
    if (open) setCategory(defaultRef.current);
  }, [open]);

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    haptics.light();
    setTitle('');
    await onAdd(value, category);
    setLastAdded((prev) => ({ text: `Added to ${CATEGORIES[category].label}`, n: (prev?.n ?? 0) + 1 }));
    inputRef.current?.focus();
  };

  const close = () => {
    setOpen(false);
    setTitle('');
    setLastAdded(null);
  };

  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  return (
    <>
      <Animated.View style={[styles.fabWrap, { bottom: 24 }, fabStyle]}>
        <Pressable
          onPressIn={() => (fabScale.value = withSpring(0.9))}
          onPressOut={() => (fabScale.value = withSpring(1))}
          onPress={() => {
            haptics.medium();
            setOpen(true);
          }}
          style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Add task"
        >
          <Ionicons name="add" size={30} color={colors.onPrimary} />
        </Pressable>
      </Animated.View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetContainer}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 16), borderColor: colors.border },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            <View style={[styles.inputRow, { backgroundColor: colors.surfaceAlt }]}>
              <TextInput
                ref={inputRef}
                autoFocus
                value={title}
                onChangeText={setTitle}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={submit}
                submitBehavior="submit"
                returnKeyType="done"
                keyboardAppearance={isDark ? 'dark' : 'light'}
                style={[styles.input, { color: colors.text, fontFamily: fonts.regular }, webNoOutline]}
                maxLength={140}
              />
              <Pressable
                onPress={submit}
                disabled={!title.trim()}
                style={[styles.send, { backgroundColor: title.trim() ? colors.primary : colors.border }]}
                accessibilityLabel="Save task"
              >
                <Ionicons name="arrow-up" size={18} color={colors.onPrimary} />
              </Pressable>
            </View>

            <View style={styles.chips}>
              {ALL_CATEGORIES.map((c) => {
                const meta = CATEGORIES[c];
                const active = c === category;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      haptics.selection();
                      setCategory(c);
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? withAlpha(meta.color, 0.16) : 'transparent',
                        borderColor: active ? meta.color : colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, { color: active ? meta.color : colors.textMuted, fontFamily: active ? fonts.semibold : fonts.regular }]}>
                      {meta.emoji} {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {lastAdded && (
              <Animated.Text
                key={lastAdded.n}
                entering={FadeIn.duration(200)}
                style={[styles.toast, { color: colors.success, fontFamily: fonts.medium }]}
              >
                ✓ {lastAdded.text}
              </Animated.Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// react-native-web: drop the browser focus ring; the filled input row already shows focus.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 20 },
  fab: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8,
    borderWidth: StyleSheet.hairlineWidth, width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingLeft: 14, paddingRight: 6 },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13 },
  toast: { fontSize: 12, marginTop: 12 },
});
