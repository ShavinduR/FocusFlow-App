export const lightColors = {
  background: '#F8F9FB',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F2F5',
  text: '#15171C',
  textMuted: '#6B7180',
  border: '#E6E8EE',
  primary: '#5B5BD6',
  onPrimary: '#FFFFFF',
  success: '#22A06B',
  danger: '#E5484D',
  overlay: 'rgba(15,17,22,0.35)',
};

export type ColorTokens = typeof lightColors;

export const darkColors: ColorTokens = {
  background: '#0D0E11',
  surface: '#16181D',
  surfaceAlt: '#1E2127',
  text: '#F2F3F5',
  textMuted: '#9BA1AE',
  border: '#272A32',
  primary: '#8E8CF7',
  onPrimary: '#0D0E11',
  success: '#3DD68C',
  danger: '#FF6369',
  overlay: 'rgba(0,0,0,0.6)',
};

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

/** '#RRGGBB' + alpha (0–1) -> '#RRGGBBAA'. Used for soft category tints. */
export const withAlpha = (hex: string, alpha: number) =>
  hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
