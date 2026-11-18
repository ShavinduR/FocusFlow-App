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
import { useTaskStore } from '../src/store/useTaskStore';
import { useTheme } from '../src/theme/useTheme';

SplashScreen.preventAutoHideAsync();

/** Hands the opened DB to the store and waits for the first load. */
function StoreBootstrap({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const ready = useTaskStore((s) => s.ready);
  const init = useTaskStore((s) => s.init);

  useEffect(() => {
    init(db);
  }, [db, init]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  return ready ? <>{children}</> : null;
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
        <StoreBootstrap>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="rollover"
              options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade_from_bottom' }}
            />
          </Stack>
        </StoreBootstrap>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
