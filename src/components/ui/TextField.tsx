import { forwardRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { FadeIn, FadeOut, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  /** Adds a show/hide toggle and hides the text by default. */
  password?: boolean;
}

/**
 * Minimal input: label above, soft filled field, accent border on focus,
 * inline error underneath (announced to screen readers).
 */
export const TextField = forwardRef<ComponentRef<typeof TextInput>, Props>(function TextField(
  { label, error, password, onFocus, onBlur, ...inputProps },
  ref,
) {
  const { colors, fonts, isDark } = useTheme();
  const [hidden, setHidden] = useState(true);
  const focus = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: error
      ? colors.danger
      : interpolateColor(focus.value, [0, 1], [colors.surfaceAlt, colors.primary]),
  }));

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.medium }]}>{label}</Text>
      <Animated.View style={[styles.field, { backgroundColor: colors.surfaceAlt }, borderStyle]}>
        <TextInput
          ref={ref}
          {...inputProps}
          secureTextEntry={password ? hidden : inputProps.secureTextEntry}
          placeholderTextColor={colors.textMuted}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          accessibilityLabel={label}
          accessibilityHint={error}
          onFocus={(e) => {
            focus.value = withTiming(1, { duration: 160 });
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = withTiming(0, { duration: 160 });
            onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text, fontFamily: fonts.regular }, webNoOutline]}
        />
        {password && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </Animated.View>
      {!!error && (
        <Animated.Text
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: colors.danger, fontFamily: fonts.regular }]}
        >
          {error}
        </Animated.Text>
      )}
    </View>
  );
});

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 6, marginLeft: 2 },
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5 },
  input: { flex: 1, minWidth: 0, fontSize: 16, paddingHorizontal: 16, paddingVertical: 14 }, // minWidth 0: let it shrink so the eye icon stays inside the field
  eye: { paddingHorizontal: 14 },
  error: { fontSize: 12.5, marginTop: 6, marginLeft: 2, lineHeight: 18 },
});
