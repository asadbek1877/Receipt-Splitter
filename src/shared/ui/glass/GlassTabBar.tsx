/**
 * Apple-style floating tab bar shared by the main sections (Home, History,
 * Analytics, Profile). Rendered once by the Tabs navigator, so it stays put
 * while sections change underneath it.
 *
 * - Liquid Glass capsule; a glass "lens" glides (and briefly stretches) to the
 *   selected tab on the UI thread, while navigation happens immediately.
 * - The primary action (scan a receipt) is a separate round glass button:
 *   tabs navigate, the button acts.
 * - Slides away on screens that are not one of the four sections.
 */
import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BarChart3, Clock3, Home as HomeIcon, ScanLine, User as UserIcon } from '@tamagui/lucide-icons';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Glass, GlassProvider, PressScale, useGlassPalette } from './GlassKit';

type TabKey = 'home' | 'history' | 'stats' | 'profile';

const TABS: { key: TabKey; route: string; path: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'home', route: 'index', path: '/tabs', icon: HomeIcon },
  { key: 'history', route: 'sessions/history/index', path: '/tabs/sessions/history', icon: Clock3 },
  { key: 'stats', route: 'analytics/index', path: '/tabs/analytics', icon: BarChart3 },
  { key: 'profile', route: 'profile', path: '/tabs/profile', icon: UserIcon },
];

/** Height the bar occupies above the safe area; screens pad their content by this. */
export const TAB_BAR_SPACE = 104;

type MinimalTabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

export default function GlassTabBar({ state, navigation }: MinimalTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { p } = useGlassPalette();
  const dummyTarget = useRef<View>(null);

  // The bar belongs to exactly four sections. Decide by the URL (not by route-name matching), so
  // every other screen — scanner, review, participants, split, finish, debts, ... — never shows it.
  const pathname = usePathname();
  const currentRoute = state.routes[state.index]?.name;
  const normPath = (pathname || '').replace(/\/+$/, '') || '/';
  const activeIndex = TABS.findIndex((tab) => tab.path === normPath);
  const visible = activeIndex >= 0;

  // Fully unmount after the hide animation: a hidden bar must never sit over a screen's buttons.
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(timer);
  }, [visible]);

  const [barWidth, setBarWidth] = useState(0);
  const [selected, setSelected] = useState(Math.max(0, activeIndex));
  const index = useSharedValue(Math.max(0, activeIndex));
  const stretch = useSharedValue(0);
  const shown = useSharedValue(visible ? 1 : 0);
  const glow = useSharedValue(0);

  // follow the navigator (also covers hardware back / programmatic navigation)
  useEffect(() => {
    if (activeIndex < 0) return;
    setSelected(activeIndex);
    index.value = withSpring(activeIndex, { damping: 17, stiffness: 210, mass: 0.8 });
  }, [activeIndex]);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
    if (!visible) {
      cancelAnimation(glow);
      return;
    }
    glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(glow);
  }, [visible]);

  const slot = barWidth > 0 ? (barWidth - 12) / TABS.length : 0;

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: interpolate(shown.value, [0, 1], [120, 0]) }],
  }));
  const lensStyle = useAnimatedStyle(() => ({
    width: slot,
    transform: [
      { translateX: 6 + index.value * slot },
      { scaleX: 1 + stretch.value * 0.28 },
      { scaleY: 1 - stretch.value * 0.1 },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.22, 0.55]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.12]) }],
  }));

  const press = (i: number) => {
    // instant feedback on the UI thread; navigation happens right away
    setSelected(i);
    stretch.value = withSequence(withTiming(1, { duration: 110 }), withSpring(0, { damping: 12, stiffness: 230 }));
    index.value = withSpring(i, { damping: 17, stiffness: 210, mass: 0.8 });
    if (TABS[i].route !== currentRoute) navigation.navigate(TABS[i].route);
  };

  const labels: Record<TabKey, string> = {
    home: t('navigation.tabs.home', 'Home'),
    history: t('home.nav.history', 'History'),
    stats: t('analytics.title', 'Analytics'),
    profile: t('profile.title', 'Profile'),
  };

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 4 }, wrapStyle]}
    >
      <GlassProvider target={dummyTarget}>
        <View style={[styles.bar, { borderColor: p.cardBorder }]} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
          <Glass p={p} fill={p.card} radius={34} />
          {slot > 0 && (
            <Animated.View pointerEvents="none" style={[styles.lens, { borderColor: `${p.accentGradient[1]}55` }, lensStyle]}>
              <Glass p={p} fill={`${p.accentGradient[1]}22`} radius={26} />
            </Animated.View>
          )}
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const isSelected = selected === i;
            return (
              <Pressable
                key={tab.key}
                onPress={() => press(i)}
                style={styles.item}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={labels[tab.key]}
              >
                <Icon size={22} color={isSelected ? p.accentGradient[1] : p.text} />
                <Text style={[styles.label, { color: isSelected ? p.accentGradient[1] : p.sub }]} numberOfLines={1}>
                  {labels[tab.key]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fabSlot}>
          <Animated.View pointerEvents="none" style={[styles.fabGlow, { backgroundColor: p.accentGradient[1] }, glowStyle]} />
          <PressScale onPress={() => navigation.navigate('scan-receipt')} style={[styles.fab, { borderColor: p.cardBorder }]}>
            <Glass p={p} fill={p.card} radius={34} />
            <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
              <ScanLine size={24} color="#FFFFFF" />
            </LinearGradient>
          </PressScale>
        </View>
      </GlassProvider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { flex: 1, height: 68, borderRadius: 34, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, overflow: 'hidden' },
  lens: { position: 'absolute', left: 0, top: 6, bottom: 6, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11, fontWeight: '600' },
  fabSlot: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  fabGlow: { position: 'absolute', width: 64, height: 64, borderRadius: 32 },
  fab: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fabInner: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
