import { useColorScheme } from 'react-native';
import { darkColors, fonts, lightColors, radius, spacing } from './tokens';

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return { isDark, colors: isDark ? darkColors : lightColors, fonts, spacing, radius };
}
export type Theme = ReturnType<typeof useTheme>;
