import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, type AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { withAlpha } from '../../theme/tokens';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  /** Animated style applied to the form card (used for the error shake). */
  formStyle?: AnimatedStyle<ViewStyle>;
}

export function AuthLayout({ title, subtitle, children, footer, formStyle }: Props) {
  const { colors, fonts } = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(450)}>
            <View style={[styles.logo, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
              <Text style={styles.logoEmoji}>🐸</Text>
            </View>
            <Text style={[styles.brand, { color: colors.primary, fontFamily: fonts.semibold }]}>FOCUSFLOW</Text>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semibold }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.regular }]}>{subtitle}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(90).duration(450)} style={formStyle}>
            {children}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(450)} style={styles.footer}>
            {footer}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 440, alignSelf: 'center' },
  logo: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoEmoji: { fontSize: 28 },
  brand: { fontSize: 12, letterSpacing: 1.6 },
  title: { fontSize: 30, marginTop: 4, lineHeight: 40 },
  subtitle: { fontSize: 15, marginTop: 4, marginBottom: 32, lineHeight: 22 },
  footer: { marginTop: 24, alignItems: 'center' },
});
