import { ApiError } from './http';

export type AuthField = 'name' | 'email' | 'password';

export interface AuthErrorView {
  /** Shown above the submit button. */
  form?: string;
  /** Shown under a specific input. */
  fields?: Partial<Record<AuthField, string>>;
}

/** Turns API/network failures into calm, human copy. Never shows raw error codes. */
export function describeAuthError(e: unknown): AuthErrorView {
  if (!(e instanceof ApiError)) return { form: 'Something went wrong. Please try again.' };
  switch (e.code) {
    case 'invalid_credentials':
      return { form: 'That email and password don’t match. Check them and try again.' };
    case 'email_taken':
      return { fields: { email: 'An account with this email already exists. Try signing in.' } };
    case 'timeout':
    case 'network':
      return { form: 'Can’t reach FocusFlow right now. Check your connection and try again.' };
  }
  if (e.status === 429) return { form: 'Too many attempts. Take a short break and try again in a few minutes.' };
  if (e.status >= 500) return { form: 'Our server is having a moment. Please try again shortly.' };
  return { form: e.message };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors the server's rules so most mistakes are caught before a request. */
export function validateAuthForm(values: { name?: string; email: string; password: string }, mode: 'login' | 'register') {
  const fields: Partial<Record<AuthField, string>> = {};
  if (mode === 'register' && !values.name?.trim()) fields.name = 'What should we call you?';
  if (!values.email.trim()) fields.email = 'Enter your email.';
  else if (!EMAIL_RE.test(values.email.trim())) fields.email = 'That doesn’t look like an email address.';
  if (!values.password) fields.password = 'Enter your password.';
  else if (mode === 'register' && values.password.length < 8) fields.password = 'Use at least 8 characters.';
  return fields;
}
