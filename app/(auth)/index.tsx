import { Redirect } from 'expo-router';

/**
 * When the root guard sends a signed-out user to the (auth) group, Expo Router
 * resolves the group's own URL, which needs an index. Send it to login.
 */
export default function AuthIndex() {
  return <Redirect href="/login" />;
}
