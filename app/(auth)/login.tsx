import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { AuthLayout } from '../../src/components/ui/AuthLayout';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';
import { TextField } from '../../src/components/ui/TextField';
import { useShake } from '../../src/hooks/useShake';
import { useAuthStore } from '../../src/store/useAuthStore';
import { describeAuthError, validateAuthForm, type AuthErrorView } from '../../src/sync/authErrors';
import { useTheme } from '../../src/theme/useTheme';
import { haptics } from '../../src/utils/haptics';

export default function LoginScreen() {
  const { colors, fonts } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthErrorView>({});
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const { style: shakeStyle, shake } = useShake();

  const submit = async () => {
    const fields = validateAuthForm({ email, password }, 'login');
    if (Object.keys(fields).length) {
      setErrors({ fields });
      shake();
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await signIn(email, password);
      haptics.success();
      // No navigation here: the root layout's Stack.Protected guard swaps to (tabs)
      // as soon as auth state flips, and useCloudSync runs the first sync on mount.
    } catch (e) {
      setErrors(describeAuthError(e));
      shake();
      setSubmitting(false);
    }
  };

  // Clear a field's error as soon as the user starts fixing it.
  const clear = (field: 'email' | 'password') =>
    setErrors((e) => (e.fields?.[field] || e.form ? { fields: { ...e.fields, [field]: undefined } } : e));

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to sync your tasks across your devices."
      formStyle={shakeStyle}
      footer={
        <Text style={[styles.footer, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          New to FocusFlow?{' '}
          <Link href="/register" replace style={{ color: colors.primary, fontFamily: fonts.semibold }}>
            Create an account
          </Link>
        </Text>
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={(v) => { setEmail(v); clear('email'); }}
        error={errors.fields?.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!submitting}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        password
        value={password}
        onChangeText={(v) => { setPassword(v); clear('password'); }}
        error={errors.fields?.password}
        placeholder="Your password"
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!submitting}
      />
      <View style={styles.spacer} />
      <FormError message={errors.form} />
      <Button title="Sign in" onPress={submit} loading={submitting} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  spacer: { height: 8 },
  footer: { fontSize: 14 },
});
