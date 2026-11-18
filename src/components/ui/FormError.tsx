import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { withAlpha } from '../../theme/tokens';

/** Unobtrusive, form-level message (wrong password, offline…). Announced to screen readers. */
export function FormError({ message }: { message?: string }) {
  const { colors, fonts } = useTheme();
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(150)}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.box, { backgroundColor: withAlpha(colors.danger, 0.08), borderColor: withAlpha(colors.danger, 0.25) }]}
    >
      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
      <Text style={[styles.text, { color: colors.text, fontFamily: fonts.regular }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  text: { flex: 1, fontSize: 13.5, lineHeight: 20 },
});
