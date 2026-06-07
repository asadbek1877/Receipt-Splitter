// src/shared/lib/stores/theme-store.ts
// Theme customization store — user can fully customize colors, accent, mode

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== Preset color themes =====
export interface ColorPreset {
  id: string;
  name: string;
  emoji: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  gradientStart: string;
  gradientEnd: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'jade',
    name: 'Zen Jade',
    emoji: '🍃',
    primary: '#0D9488',
    primaryLight: '#5EEAD4',
    primaryDark: '#0F766E',
    secondary: '#06B6D4',
    accent: '#A7F3D0',
    gradientStart: '#0D9488',
    gradientEnd: '#06B6D4',
  },
  {
    id: 'sakura',
    name: 'Sakura',
    emoji: '🌸',
    primary: '#E91E63',
    primaryLight: '#F48FB1',
    primaryDark: '#C2185B',
    secondary: '#D32F2F',
    accent: '#FFB7C5',
    gradientStart: '#E91E63',
    gradientEnd: '#FF6090',
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    emoji: '🌊',
    primary: '#3B82F6',
    primaryLight: '#93C5FD',
    primaryDark: '#2563EB',
    secondary: '#0EA5E9',
    accent: '#BAE6FD',
    gradientStart: '#3B82F6',
    gradientEnd: '#0EA5E9',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    primary: '#F59E0B',
    primaryLight: '#FCD34D',
    primaryDark: '#D97706',
    secondary: '#EF4444',
    accent: '#FDE68A',
    gradientStart: '#F59E0B',
    gradientEnd: '#EF4444',
  },
  {
    id: 'violet',
    name: 'Violet Dream',
    emoji: '💜',
    primary: '#8B5CF6',
    primaryLight: '#C4B5FD',
    primaryDark: '#7C3AED',
    secondary: '#A78BFA',
    accent: '#DDD6FE',
    gradientStart: '#8B5CF6',
    gradientEnd: '#EC4899',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    emoji: '💎',
    primary: '#10B981',
    primaryLight: '#6EE7B7',
    primaryDark: '#059669',
    secondary: '#34D399',
    accent: '#A7F3D0',
    gradientStart: '#10B981',
    gradientEnd: '#059669',
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    emoji: '🌹',
    primary: '#F43F5E',
    primaryLight: '#FDA4AF',
    primaryDark: '#E11D48',
    secondary: '#FB7185',
    accent: '#FFE4E6',
    gradientStart: '#F43F5E',
    gradientEnd: '#E879F9',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    emoji: '🌙',
    primary: '#6366F1',
    primaryLight: '#A5B4FC',
    primaryDark: '#4F46E5',
    secondary: '#818CF8',
    accent: '#C7D2FE',
    gradientStart: '#6366F1',
    gradientEnd: '#4F46E5',
  },
];

// ===== Derived theme colors =====
export interface DerivedThemeColors {
  // Modes
  isDark: boolean;

  // Core brand
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  accent: string;

  // Backgrounds
  background: string;
  bgGradientStart: string;
  bgGradientEnd: string;
  bgSakura: string;

  // Glass
  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassBlur: string;

  // Card
  card: string;
  cardHover: string;
  cardBorder: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textLight: string;

  // Icon
  iconBg: string;
  iconBgStrong: string;

  // Shadow
  shadow: string;
  shadowStrong: string;

  // Status
  success: string;
  warning: string;
  error: string;

  // Decorative
  sakuraPetal: string;
  mountainMist: string;
  sunRise: string;
  sunSet: string;

  // Gradient for header
  headerGradient: readonly [string, string];
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function buildThemeColors(preset: ColorPreset, isDark: boolean): DerivedThemeColors {
  if (!isDark) {
    return {
      isDark: false,
      primary: preset.primary,
      primaryLight: preset.primaryLight,
      primaryDark: preset.primaryDark,
      secondary: preset.secondary,
      accent: preset.accent,
      background: '#F0FDFA',
      bgGradientStart: lightenHex(preset.primary, 180),
      bgGradientEnd: '#F0FDFA',
      bgSakura: lightenHex(preset.primary, 200),
      glass: 'rgba(255, 255, 255, 0.72)',
      glassStrong: 'rgba(255, 255, 255, 0.92)',
      glassBorder: hexToRgba(preset.primary, 0.12),
      glassBlur: hexToRgba(preset.primaryLight, 0.18),
      card: 'rgba(255, 255, 255, 0.85)',
      cardHover: 'rgba(240, 253, 250, 0.9)',
      cardBorder: hexToRgba(preset.primary, 0.10),
      text: darkenHex(preset.primary, 80),
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
      textLight: '#FFFFFF',
      iconBg: hexToRgba(preset.primary, 0.08),
      iconBgStrong: hexToRgba(preset.primary, 0.16),
      shadow: hexToRgba(preset.primary, 0.08),
      shadowStrong: 'rgba(0, 0, 0, 0.10)',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      sakuraPetal: preset.accent,
      mountainMist: lightenHex(preset.primary, 180),
      sunRise: preset.primary,
      sunSet: '#F59E0B',
      headerGradient: [preset.gradientStart, preset.gradientEnd] as const,
    };
  } else {
    return {
      isDark: true,
      primary: preset.primaryLight,
      primaryLight: preset.primaryLight,
      primaryDark: preset.primary,
      secondary: lightenHex(preset.secondary, 40),
      accent: lightenHex(preset.accent, 20),
      background: '#0F172A',
      bgGradientStart: '#1E293B',
      bgGradientEnd: '#0F172A',
      bgSakura: '#1E293B',
      glass: 'rgba(15, 23, 42, 0.75)',
      glassStrong: 'rgba(15, 23, 42, 0.92)',
      glassBorder: hexToRgba(preset.primaryLight, 0.15),
      glassBlur: hexToRgba(preset.primaryLight, 0.08),
      card: 'rgba(30, 41, 59, 0.85)',
      cardHover: 'rgba(51, 65, 85, 0.9)',
      cardBorder: hexToRgba(preset.primaryLight, 0.12),
      text: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      textLight: '#FFFFFF',
      iconBg: hexToRgba(preset.primaryLight, 0.12),
      iconBgStrong: hexToRgba(preset.primaryLight, 0.24),
      shadow: 'rgba(0, 0, 0, 0.35)',
      shadowStrong: 'rgba(0, 0, 0, 0.55)',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      sakuraPetal: hexToRgba(preset.accent, 0.45),
      mountainMist: hexToRgba(preset.primary, 0.15),
      sunRise: preset.primaryLight,
      sunSet: '#FBBF24',
      headerGradient: [darkenHex(preset.gradientStart, 30), darkenHex(preset.gradientEnd, 50)] as const,
    };
  }
}

// ===== Store =====
interface ThemeStore {
  // Current preset
  presetId: string;
  
  // Custom primary color (overrides preset when set)
  customPrimaryColor: string | null;

  // Actions
  setPreset: (presetId: string) => void;
  setCustomPrimaryColor: (color: string | null) => void;
  getPreset: () => ColorPreset;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      presetId: 'jade',
      customPrimaryColor: null,

      setPreset: (presetId: string) => {
        set({ presetId, customPrimaryColor: null });
      },

      setCustomPrimaryColor: (color: string | null) => {
        set({ customPrimaryColor: color });
      },

      getPreset: () => {
        const { presetId, customPrimaryColor } = get();
        const preset = COLOR_PRESETS.find((p) => p.id === presetId) || COLOR_PRESETS[0];
        
        if (customPrimaryColor) {
          return {
            ...preset,
            id: 'custom',
            name: 'Custom',
            emoji: '🎨',
            primary: customPrimaryColor,
            primaryLight: lightenHex(customPrimaryColor, 60),
            primaryDark: darkenHex(customPrimaryColor, 30),
            gradientStart: customPrimaryColor,
            gradientEnd: darkenHex(customPrimaryColor, 40),
          };
        }
        
        return preset;
      },
    }),
    {
      name: 'theme-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        presetId: state.presetId,
        customPrimaryColor: state.customPrimaryColor,
      }),
    }
  )
);

// ===== Hook for derived theme =====
import { useAppStore } from './app-store';

export function useThemeColors(): DerivedThemeColors {
  const isDark = useAppStore((s) => s.theme === 'dark');
  const getPreset = useThemeStore((s) => s.getPreset);
  const presetId = useThemeStore((s) => s.presetId);
  const customColor = useThemeStore((s) => s.customPrimaryColor);
  
  // Re-derive when any dependency changes
  const preset = getPreset();
  return buildThemeColors(preset, isDark);
}
