import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCloudSync } from '../../src/hooks/useCloudSync';
import { useRolloverGate } from '../../src/hooks/useRolloverGate';
import { useTheme } from '../../src/theme/useTheme';

export default function TabsLayout() {
  const { colors, fonts } = useTheme();
  useRolloverGate();
  useCloudSync();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Web has no safe-area inset, so give Poppins' tall line height room.
          ...(Platform.OS === 'web' && { height: 60, paddingBottom: 6 }),
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="insights"
        options={{ title: 'Insights', tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
