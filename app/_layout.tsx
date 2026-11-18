import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { migrateDbIfNeeded } from '../src/db/migrate';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTaskStore } from '../src/store/useTaskStore';
import { useTheme } from '../src/theme/useTheme';

SplashScreen.preventAutoHideAsync();

/** Hands the opened DB to the task store, restores the saved session, then reveals the app. */
function Bootstrap({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const tasksReady = useTaskStore((s) => s.ready);
  const initTasks = useTaskStore((s) => s.init);
  const authStatus = useAuthStore((s) => s.status);
  const initAuth = useAuthStore((s) => s.init);
  const ready = tasksReady && authStatus !== 'loading';

  useEffect(() => {
    initTasks(db);
    initAuth();
  }, [db, initTasks, initAuth]);

  useEffect(() => {
    // Keep the splash up until we know which stack to show: no flash of the login screen.
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  return ready ? <>{children}</> : null;
}

function RootStack() {
  const { colors } = useTheme();
  // Re-renders on sign-in / sign-out / token expiry; Stack.Protected then redirects
  // to the first available screen of whichever group just became allowed.
  const canUseApp = useAuthStore((s) => s.canUseApp());

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={canUseApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="rollover"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade_from_bottom' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!canUseApp}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SQLiteProvider databaseName="focusflow.db" onInit={migrateDbIfNeeded}>
        <Bootstrap>
          <RootStack />
        </Bootstrap>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
