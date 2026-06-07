// tamagui.config.ts
import { createTamagui, createFont } from '@tamagui/core'
import { config } from '@tamagui/config/v3'

// Premium font configuration
const interFont = createFont({
  family: 'Inter',
  size: {
    1: 12, // Increased minimal size
    2: 13,
    3: 14,
    4: 16, // Default body
    5: 18,
    6: 20,
    7: 24, // Heading 3
    8: 30, // Heading 2
    9: 36, // Heading 1
    10: 48,
    11: 60,
    12: 72,
    true: 16,
  },
  lineHeight: {
    1: 18,
    2: 20,
    3: 22,
    4: 24,
    5: 28,
    6: 30,
    7: 34,
    8: 40,
    9: 48,
    10: 56,
    11: 70,
    12: 84,
    true: 24,
  },
  weight: {
    1: '400',
    2: '500',
    3: '600',
    4: '700',
    5: '800',
    6: '900',
    true: '400',
  },
  letterSpacing: {
    1: 0,
    2: -0.2,
    3: -0.3,
    4: -0.4,
    5: -0.5,
    6: -0.6,
    true: 0,
  },
  face: {
    400: { normal: 'InterRegular', italic: 'InterRegular' },
    500: { normal: 'InterMedium', italic: 'InterMedium' },
    600: { normal: 'InterSemiBold', italic: 'InterSemiBold' },
    700: { normal: 'InterBold', italic: 'InterBold' },
    800: { normal: 'InterExtraBold', italic: 'InterExtraBold' },
    900: { normal: 'InterBlack', italic: 'InterBlack' },
  },
})

// Japanese-style color palette - Sakura theme
const japaneseColors = {
  // Primary - Sakura pink / Deep crimson
  primary: '#E91E63',
  primaryDark: '#C2185B',
  primaryLight: '#F48FB1',
  
  // Secondary - Torii gate red
  secondary: '#D32F2F',
  secondaryLight: '#EF5350',
  
  // Accent - Cherry blossom
  accent: '#FFB7C5',
  accentLight: '#FFDCE4',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#E91E63',
  
  // Light mode backgrounds
  bgLight: '#FFF5F7',
  bgLightCard: '#FFFFFF',
  
  // Dark mode backgrounds
  bgDark: '#0D0D1A',
  bgDarkCard: '#1A1A2E',
  bgDarkCardHover: '#252540',
}

// Простая и рабочая конфигурация
const appConfig = createTamagui({
  ...config,
  fonts: {
    ...config.fonts,
    heading: interFont,
    body: interFont,
  },
  // Переопределяем только цвета
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      // Brand colors - Japanese Sakura
      primary: japaneseColors.primary,
      primaryHover: japaneseColors.primaryDark,
      // Status
      success: japaneseColors.success,
      error: japaneseColors.error,
      warning: japaneseColors.warning,
      // Backgrounds - Sakura theme
      background: japaneseColors.bgLight,
      backgroundHover: '#FFEEF2',
      backgroundFocus: '#FFE0E8',
      // Card backgrounds
      card: '#ffffff',
      cardHover: '#FFF8FA',
      // Glass effect - Sakura tint
      glass: 'rgba(255, 255, 255, 0.75)',
      glassStrong: 'rgba(255, 255, 255, 0.9)',
      glassBorder: 'rgba(233, 30, 99, 0.15)',
      // Text colors
      textPrimary: '#1A1A2E',
      textSecondary: '#4A4A68',
      textMuted: '#8E8EA0',
      // Icon backgrounds
      iconBg: 'rgba(233, 30, 99, 0.1)',
      iconBgStrong: 'rgba(233, 30, 99, 0.2)',
    },
    dark: {
      ...config.themes.dark,
      // Brand colors - Glowing Sakura
      primary: japaneseColors.primaryLight,
      primaryHover: japaneseColors.primary,
      // Status
      success: japaneseColors.success,
      error: japaneseColors.error,
      warning: japaneseColors.warning,
      // Backgrounds - Night Sakura
      background: japaneseColors.bgDark,
      backgroundHover: '#1A1A2E',
      backgroundFocus: '#252540',
      // Card backgrounds
      card: japaneseColors.bgDarkCard,
      cardHover: japaneseColors.bgDarkCardHover,
      // Glass effect for dark mode - Sakura tint
      glass: 'rgba(26, 26, 46, 0.8)',
      glassStrong: 'rgba(26, 26, 46, 0.95)',
      glassBorder: 'rgba(244, 143, 177, 0.2)',
      // Text colors
      textPrimary: '#F8F8FF',
      textSecondary: '#B8B8D0',
      textMuted: '#6E6E8A',
      // Icon backgrounds
      iconBg: 'rgba(244, 143, 177, 0.15)',
      iconBgStrong: 'rgba(244, 143, 177, 0.25)',
      // Override gray scale for dark mode - Japanese night theme
      gray1: '#0D0D1A',
      gray2: '#1A1A2E',
      gray3: '#252540',
      gray4: '#353555',
      gray5: '#454570',
      gray10: '#8E8EA0',
      gray11: '#B8B8D0',
      gray12: '#F8F8FF',
    }
  }
})

export default appConfig

export type Conf = typeof appConfig

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}