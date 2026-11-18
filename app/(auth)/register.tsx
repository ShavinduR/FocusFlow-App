import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { AuthLayout } from '../../src/components/ui/AuthLayout';
import { Button } from '../../src/components/ui/Button';
import { FormError } from '../../src/components/ui/FormError';
import { TextField } from '../../src/components/ui/TextField';
import { useShake } from '../../src/hooks/useShake';
import { useAuthStore } from '../../src/store/useAuthStore';
import { describeAuthError, validateAuthForm, type AuthErrorView, type AuthField } from '../../src/sync/authErrors';
import { useTheme } from '../../src/theme/useTheme';
import { haptics } from '../../src/utils/haptics';

export default function RegisterScreen() {
  const { colors, fonts } = useTheme();
  const signUp = useAuthStore((s) => s.signUp);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthErrorView>({});
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const { style: shakeStyle, shake } = useShake();

  const submit = async () => {
    const fields = validateAuthForm({ name, email, password }, 'register');
    if (Object.keys(fields).length) {
      setErrors({ fields });
      shake();
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await signUp(name, email, password);
      haptics.success();
      // Root layout switches to (tabs); tasks created before signing up are uploaded by the first sync.
    } catch (e) {
      setErrors(describeAuthError(e));
      shake();
      setSubmitting(false);
    }
  };

  const clear = (field: AuthField) =>
    setErrors((e) => (e.fields?.[field] || e.form ? { fields: { ...e.fields, [field]: undefined } } : e));

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Keep your plan in sync on your phone and laptop. It takes 20 seconds."
      formStyle={shakeStyle}
      footer={
        <Text style={[styles.footer, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          Already have an account?{' '}
          <Link href="/login" replace style={{ color: colors.primary, fontFamily: fonts.semibold }}>
            Sign in
          </Link>
        </Text>
      }
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={(v) => { setName(v); clear('name'); }}
        error={errors.fields?.name}
        placeholder="Alex"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        editable={!submitting}
        maxLength={100}
      />
      <TextField
        ref={emailRef}
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
        placeholder="At least 8 characters"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!submitting}
        maxLength={128}
      />
      <View style={styles.spacer} />
      <FormError message={errors.form} />
      <Button title="Create account" onPress={submit} loading={submitting} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  spacer: { height: 8 },
  footer: { fontSize: 14 },
});
