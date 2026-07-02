// ─── EdgePay 3.0 Design Tokens (Premium White-First) ──────────────────

import { useStore } from '../store/useStore';

export const lightColors = {
  primary: '#007AFF',
  primaryLight: 'rgba(0, 122, 255, 0.08)',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#F5F5F7',
  card: '#FFFFFF',
  cardBorder: 'rgba(0, 0, 0, 0.04)',
  textPrimary: '#1C1C1E',
  textSecondary: '#636366',
  textTertiary: '#AEAEB2',
  border: 'rgba(0, 0, 0, 0.06)',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  gsmActive: '#FF9500',
  gsmBackground: 'rgba(255, 149, 0, 0.06)',
  gsmBorder: 'rgba(255, 149, 0, 0.12)',
};

export const darkColors = {
  primary: '#0A84FF',
  primaryLight: 'rgba(10, 132, 255, 0.12)',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  surfaceHighlight: '#3A3A3C',
  card: '#1C1C1E',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#F5F5F7',
  textSecondary: 'rgba(245, 245, 247, 0.65)',
  textTertiary: 'rgba(245, 245, 247, 0.4)',
  border: 'rgba(255, 255, 255, 0.10)',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  error: '#FF453A',
  success: '#30D158',
  warning: '#FF9F0A',
  gsmActive: '#FF9F0A',
  gsmBackground: 'rgba(255, 159, 10, 0.08)',
  gsmBorder: 'rgba(255, 159, 10, 0.15)',
};

export const useTheme = () => {
  const theme = useStore(state => state.theme);
  const colors = theme === 'dark' ? darkColors : lightColors;
  return { colors, theme };
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48, xxl: 56,
};

export const borderRadius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, xxl: 32, full: 999,
};

export const gradients = {
  primary: ['#007AFF', '#5856D6'],
  card: ['#007AFF', '#5856D6'],
  success: ['#34C759', '#30D158'],
  error: ['#FF3B30', '#FF453A'],
  glass: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'],
};

export const typography = {
  h0: { fontSize: 34, fontWeight: '800' as const, lineHeight: 41, letterSpacing: -0.5 },
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  bodyLarge: { fontSize: 17, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 4,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
};

// Legacy support
export const colors = lightColors;
