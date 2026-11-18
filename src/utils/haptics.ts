import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// expo-haptics is a no-op on web; guard anyway so web never throws.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  success: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  light: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  selection: () => enabled && Haptics.selectionAsync(),
};
