// src/shared/ui/JapaneseTheme.tsx
// Japanese-themed color palette — Zen Jade & Liquid Glass
// Inspired by bamboo groves, jade stones, and misty teal landscapes

export const japaneseColors = {
  // Light mode — Zen Jade / Teal glass
  light: {
    // Primary — Jade teal (翡翠)
    primary: '#0D9488',
    primaryLight: '#5EEAD4',
    primaryDark: '#0F766E',

    // Secondary — Cool cyan
    secondary: '#06B6D4',
    secondaryLight: '#67E8F9',

    // Accent — Emerald bamboo (竹)
    accent: '#A7F3D0',
    accentLight: '#D1FAE5',

    // Background — Misty mint white
    background: '#F0FDFA',
    bgGradientStart: '#E0F7FA',
    bgGradientEnd: '#F0FDFA',
    bgSakura: '#ECFDF5',

    // Glass effects — Frosted teal
    glass: 'rgba(255, 255, 255, 0.72)',
    glassStrong: 'rgba(255, 255, 255, 0.92)',
    glassBorder: 'rgba(13, 148, 136, 0.12)',
    glassBlur: 'rgba(94, 234, 212, 0.18)',

    // Card backgrounds
    card: 'rgba(255, 255, 255, 0.85)',
    cardHover: 'rgba(240, 253, 250, 0.9)',
    cardBorder: 'rgba(13, 148, 136, 0.10)',

    // Text
    text: '#134E4A',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    textLight: '#FFFFFF',

    // Icon backgrounds
    iconBg: 'rgba(13, 148, 136, 0.08)',
    iconBgStrong: 'rgba(13, 148, 136, 0.16)',

    // Shadow
    shadow: 'rgba(13, 148, 136, 0.08)',
    shadowStrong: 'rgba(0, 0, 0, 0.10)',

    // Status
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',

    // Decorative — bamboo / leaf green
    sakuraPetal: '#86EFAC',
    mountainMist: '#CCFBF1',
    sunRise: '#14B8A6',
    sunSet: '#F59E0B',
  },

  // Dark mode — Night Jade
  dark: {
    // Primary — Glowing teal
    primary: '#2DD4BF',
    primaryLight: '#5EEAD4',
    primaryDark: '#14B8A6',

    // Secondary — Neon cyan
    secondary: '#22D3EE',
    secondaryLight: '#67E8F9',

    // Accent — Muted jade
    accent: '#6EE7B7',
    accentLight: '#A7F3D0',

    // Background — Deep ocean teal
    background: '#042F2E',
    bgGradientStart: '#0A3D3C',
    bgGradientEnd: '#042F2E',
    bgSakura: '#064E3B',

    // Glass effects — Dark frosted glass
    glass: 'rgba(4, 47, 46, 0.75)',
    glassStrong: 'rgba(4, 47, 46, 0.92)',
    glassBorder: 'rgba(45, 212, 191, 0.15)',
    glassBlur: 'rgba(94, 234, 212, 0.08)',

    // Card backgrounds
    card: 'rgba(15, 60, 58, 0.85)',
    cardHover: 'rgba(20, 75, 72, 0.9)',
    cardBorder: 'rgba(45, 212, 191, 0.12)',

    // Text
    text: '#F0FDFA',
    textSecondary: '#CCFBF1',
    textMuted: '#99F6E4',
    textLight: '#FFFFFF',

    // Icon backgrounds
    iconBg: 'rgba(45, 212, 191, 0.12)',
    iconBgStrong: 'rgba(45, 212, 191, 0.24)',

    // Shadow
    shadow: 'rgba(0, 0, 0, 0.35)',
    shadowStrong: 'rgba(0, 0, 0, 0.55)',

    // Status
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',

    // Decorative — subdued bamboo
    sakuraPetal: 'rgba(110, 231, 183, 0.45)',
    mountainMist: 'rgba(20, 184, 166, 0.15)',
    sunRise: '#2DD4BF',
    sunSet: '#FBBF24',
  },
};

export const getJapaneseColors = (isDark: boolean) => isDark ? japaneseColors.dark : japaneseColors.light;

// Re-export theme store hook for easy migration
export { useThemeColors } from '@/shared/lib/stores/theme-store';

// Animation timing configurations
export const animationConfig = {
  spring: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  },
  timing: {
    short: 150,
    medium: 300,
    long: 500,
  },
  easing: {
    smooth: 'ease-in-out',
  },
};

// Japanese-style border radius values (subtle and clean)
export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};

// Shadow configurations - Subtle and refined (zen principles)
export const shadows = {
  small: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  medium: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  large: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  }),
};
