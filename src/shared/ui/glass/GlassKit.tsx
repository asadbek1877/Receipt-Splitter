/**
 * GlassKit — the app's shared visual language for in-app screens:
 * palettes (light = green, dark = blue → violet), a fixed animated background
 * (light beams, drifting colour orbs, coins / receipts / sparkles), Liquid Glass
 * surfaces and small building blocks.
 *
 * Ambient loops pause automatically while their screen is not focused, so tabs
 * kept alive in the background cost nothing and navigation stays smooth.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurTargetView, BlurView } from 'expo-blur';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { create } from 'zustand';

import { useAppStore } from '@/shared/lib/stores/app-store';

export type Pair = readonly [string, string];
export type Tile = { bg: string; fg: string };

// Light = green (matches the mock); dark = blue → violet (matches the auth screens).
export const GLASS_PALETTES = {
  light: {
    bg: '#E9F5EE',
    heroBg: ['#FFFFFF', '#F8FAFC'] as Pair,
    pageBg: ['#DCF4E5', '#EDF3F0'] as Pair,
    orbs: ['#4ADE80', '#86EFAC', '#FACC15'],
    orbOpacity: 0.55,
    /** whole-background blur (expo-blur intensity) */
    bgBlur: 35,
    glassTint: 'light' as 'light' | 'dark',
    glassHighlight: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0)'] as Pair,
    glassCaustic: 'rgba(255,255,255,0.5)',
    glassRim: 'rgba(255,255,255,1)',
    glassRimSoft: 'rgba(255,255,255,0.55)',
    glassOpaque: '#FFFFFF',
    particleReceipt: '#FFFFFF',
    beam: ['#86EFAC', '#DCFCE7'] as Pair,
    beamOpacity: 0.85,
    shine: 'rgba(255,255,255,0.9)',
    text: '#0F172A',
    sub: '#334155',
    muted: '#64748B',
    label: '#475569',
    accent: '#16A34A',
    accentGradient: ['#34D27B', '#16A34A'] as Pair,
    avatarRing: 'transparent',
    card: 'rgba(255,255,255,0.42)',
    cardBorder: 'rgba(255,255,255,0.75)',
    divider: '#EEF1F4',
    chevron: '#64748B',
    inputBg: '#F3F5F8',
    inputBorder: '#E5E7EB',
    cameraBg: '#FFFFFF',
    cameraIcon: '#0F172A',
    logoutBg: 'rgba(253,226,226,0.6)',
    logoutBorder: '#F8C9C9',
    logoutText: '#DC2626',
    tiles: {
      user: { bg: '#E8F8EF', fg: '#22C55E' },
      mail: { bg: '#FEF3E2', fg: '#F59E0B' },
      lock: { bg: '#FDECEC', fg: '#EF4444' },
      upload: { bg: '#E8F8EF', fg: '#22C55E' },
      reset: { bg: '#FDEAF3', fg: '#EC4899' },
      info: { bg: '#F1ECFE', fg: '#8B5CF6' },
    } as Record<string, Tile>,
  },
  dark: {
    bg: '#0A0F1E',
    heroBg: ['#0B1022', '#0A0F1E'] as Pair,
    pageBg: ['#0A0F1E', '#0E1430'] as Pair,
    orbs: ['#3B82F6', '#8B5CF6', '#6366F1'],
    orbOpacity: 0.32,
    /** whole-background blur (expo-blur intensity) */
    bgBlur: 30,
    glassTint: 'dark' as 'light' | 'dark',
    glassHighlight: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'] as Pair,
    glassCaustic: 'rgba(167,139,250,0.12)',
    glassRim: 'rgba(255,255,255,0.32)',
    glassRimSoft: 'rgba(255,255,255,0.10)',
    glassOpaque: '#141A2E',
    particleReceipt: '#1B2240',
    beam: ['#4F8BFF', '#A855F7'] as Pair,
    beamOpacity: 0.55,
    shine: 'rgba(168,85,247,0.95)',
    text: '#FFFFFF',
    sub: '#CBD5E1',
    muted: '#94A3B8',
    label: '#94A3B8',
    accent: '#8B9CFF',
    accentGradient: ['#4F8BFF', '#A855F7'] as Pair,
    avatarRing: '#8B5CF6',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.09)',
    divider: 'rgba(255,255,255,0.07)',
    chevron: '#CBD5E1',
    inputBg: 'rgba(255,255,255,0.05)',
    inputBorder: 'rgba(255,255,255,0.10)',
    cameraBg: '#111827',
    cameraIcon: '#E2E8F0',
    logoutBg: 'rgba(127,29,29,0.30)',
    logoutBorder: 'rgba(239,68,68,0.55)',
    logoutText: '#F87171',
    tiles: {
      user: { bg: 'rgba(79,139,255,0.16)', fg: '#60A5FA' },
      mail: { bg: 'rgba(245,158,11,0.18)', fg: '#FBBF24' },
      lock: { bg: 'rgba(239,68,68,0.18)', fg: '#F87171' },
      upload: { bg: 'rgba(79,139,255,0.16)', fg: '#60A5FA' },
      reset: { bg: 'rgba(236,72,153,0.18)', fg: '#F472B6' },
      info: { bg: 'rgba(139,92,246,0.20)', fg: '#A78BFA' },
    } as Record<string, Tile>,
  },
};

export type GlassPalette = (typeof GLASS_PALETTES)['light'];
type Palette = GlassPalette;

/** Palette for the current theme. */
export function useGlassPalette() {
  const theme = useAppStore((st) => st.theme);
  const isDark = theme === 'dark';
  return { p: isDark ? GLASS_PALETTES.dark : GLASS_PALETTES.light, isDark };
}

// ---------------------------------------------------------------------------
// Ambient activity: loops run only while the owning screen is focused
// ---------------------------------------------------------------------------
const AmbientActiveContext = createContext(true);

export function useAmbientActive() {
  return useContext(AmbientActiveContext);
}

/**
 * Screen shell: fixed animated background (also the blur target for every
 * <Glass> inside), glass context, and focus-aware pausing.
 */
export function GlassScreen({ p, children }: { p: GlassPalette; children: React.ReactNode }) {
  const focused = useIsFocused();
  const bgRef = useRef<View>(null);
  return (
    <AmbientActiveContext.Provider value={focused}>
      <GlassProvider target={bgRef}>
        <View style={{ flex: 1, backgroundColor: p.bg }}>
          <BlurTargetView ref={bgRef} style={StyleSheet.absoluteFill}>
            <LinearGradient colors={p.pageBg} style={StyleSheet.absoluteFill} />
            <HeroBeams p={p} />
            <AmbientOrbs p={p} />
            <HeroParticles p={p} />
          </BlurTargetView>
          <BackdropBlur p={p} />
          {children}
          <ThemeFadeOverlay />
        </View>
      </GlassProvider>
    </AmbientActiveContext.Provider>
  );
}


/** Softens the whole animated background (≈30–35%) once the screen has settled. */
function BackdropBlur({ p }: { p: GlassPalette }) {
  const { target, ready, reduce } = useContext(GlassContext);
  if (reduce || !ready) return null;
  return (
    <Animated.View entering={FadeIn.duration(450)} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={p.bgBlur}
        tint="default"
        blurMethod="dimezisBlurViewSdk31Plus"
        blurReductionFactor={3}
        blurTarget={target ?? undefined}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Smooth theme switching
//
// Re-theming re-renders every mounted screen at once, which drops frames if it
// happens in plain sight. Instead: fade a veil in the NEW background colour
// over the screen (UI thread), switch the theme behind it, wait two frames for
// the re-render to land, then fade the veil out.
// ---------------------------------------------------------------------------
type ThemeFadeState = { color: string | null; visible: boolean; busy: boolean };
const useThemeFadeStore = create<ThemeFadeState>(() => ({ color: null, visible: false, busy: false }));

const VEIL_IN_MS = 160;
const VEIL_OUT_MS = 340;

export function useSmoothThemeToggle() {
  const theme = useAppStore((st) => st.theme);
  const setTheme = useAppStore((st) => st.setTheme);
  return () => {
    if (useThemeFadeStore.getState().busy) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    useThemeFadeStore.setState({ color: GLASS_PALETTES[next].bg, visible: true, busy: true });
    setTimeout(() => {
      setTheme(next);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          useThemeFadeStore.setState({ visible: false });
          setTimeout(() => useThemeFadeStore.setState({ busy: false, color: null }), VEIL_OUT_MS);
        }),
      );
    }, VEIL_IN_MS + 10);
  };
}

function ThemeFadeOverlay() {
  const color = useThemeFadeStore((st) => st.color);
  const visible = useThemeFadeStore((st) => st.visible);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: visible ? VEIL_IN_MS : VEIL_OUT_MS,
      easing: visible ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad),
    });
  }, [visible]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!color) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
}

// ---------------------------------------------------------------------------
// Hero background: diagonal light beams with a slow shine sweeping across
// ---------------------------------------------------------------------------
export function HeroBeams({ p }: { p: Palette }) {
  const { width } = useWindowDimensions();
  const sweep = useSharedValue(0);
  const drift = useSharedValue(0);

  const active = useAmbientActive();
  useEffect(() => {
    if (!active) return;
    sweep.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }), -1, false);
    drift.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(drift);
    };
  }, [active]);

  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-width * 0.4, width * 0.5]) }],
  }));
  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(drift.value, [0, 1], [0, 14]) }],
  }));

  const w = width;
  const h = 320;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, beamStyle]}>
        <Svg width={w} height={h}>
          <Defs>
            <SvgLinearGradient id="beamA" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0%" stopColor={p.beam[0]} stopOpacity={0} />
              <Stop offset="55%" stopColor={p.beam[0]} stopOpacity={p.beamOpacity} />
              <Stop offset="100%" stopColor={p.beam[1]} stopOpacity={p.beamOpacity * 0.6} />
            </SvgLinearGradient>
            <SvgLinearGradient id="beamB" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0%" stopColor={p.beam[1]} stopOpacity={0} />
              <Stop offset="100%" stopColor={p.beam[1]} stopOpacity={p.beamOpacity * 0.8} />
            </SvgLinearGradient>
          </Defs>
          <Polygon points={`${w * 0.42},${h} ${w * 0.62},${h} ${w * 1.05},${h * 0.05} ${w * 0.86},${h * 0.05}`} fill="url(#beamA)" />
          <Polygon points={`${w * 0.7},${h} ${w * 0.8},${h} ${w * 1.1},${h * 0.35} ${w * 1.0},${h * 0.35}`} fill="url(#beamB)" />
          <Polygon points={`${w * 0.25},${h} ${w * 0.3},${h} ${w * 0.78},${h * -0.1} ${w * 0.73},${h * -0.1}`} fill="url(#beamB)" opacity={0.5} />
        </Svg>
      </Animated.View>
      {/* travelling shine line */}
      <Animated.View style={[StyleSheet.absoluteFill, shineStyle]}>
        <Svg width={w} height={h}>
          <Polygon points={`${w * 0.5},${h * 0.9} ${w * 0.515},${h * 0.9} ${w * 0.83},${h * 0.1} ${w * 0.815},${h * 0.1}`} fill={p.shine} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero ambience: a breathing glow plus coins, mini receipts and sparkles that
// drift up behind the name — the "money being split" theme, kept subtle so the
// text stays readable.
// ---------------------------------------------------------------------------
type ParticleKind = 'coin' | 'receipt' | 'spark';
type ParticleSpec = { kind: ParticleKind; x: number; size: number; duration: number; delay: number; sway: number };

const PARTICLES: ParticleSpec[] = [
  { kind: 'coin', x: 0.82, size: 18, duration: 14000, delay: 2500, sway: 16 },
  { kind: 'receipt', x: 0.9, size: 18, duration: 16000, delay: 8000, sway: 14 },
  { kind: 'spark', x: 0.76, size: 11, duration: 12000, delay: 5500, sway: 10 },
  { kind: 'coin', x: 0.04, size: 15, duration: 15000, delay: 10000, sway: 12 },
  { kind: 'coin', x: 0.08, size: 22, duration: 9000, delay: 0, sway: 14 },
  { kind: 'receipt', x: 0.3, size: 20, duration: 11000, delay: 1800, sway: 18 },
  { kind: 'spark', x: 0.52, size: 12, duration: 7500, delay: 900, sway: 10 },
  { kind: 'coin', x: 0.42, size: 16, duration: 10000, delay: 4200, sway: 12 },
  { kind: 'spark', x: 0.18, size: 10, duration: 8200, delay: 3000, sway: 8 },
  { kind: 'receipt', x: 0.6, size: 16, duration: 12000, delay: 6000, sway: 16 },
  { kind: 'coin', x: 0.24, size: 13, duration: 9500, delay: 7200, sway: 10 },
  { kind: 'spark', x: 0.66, size: 9, duration: 7000, delay: 5200, sway: 8 },
];

function ParticleGlyph({ kind, size, p }: { kind: ParticleKind; size: number; p: Palette }) {
  const [a, b] = p.accentGradient;
  if (kind === 'coin') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <SvgLinearGradient id="pcoin" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={a} />
            <Stop offset="100%" stopColor={b} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={12} cy={12} r={11} fill="url(#pcoin)" />
        <Circle cx={12} cy={12} r={7.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.4} />
        {/* ÷ */}
        <Circle cx={12} cy={8.6} r={1.3} fill="#FFFFFF" />
        <Rect x={8} y={11.2} width={8} height={1.6} rx={0.8} fill="#FFFFFF" />
        <Circle cx={12} cy={15.4} r={1.3} fill="#FFFFFF" />
      </Svg>
    );
  }
  if (kind === 'receipt') {
    return (
      <Svg width={size} height={size * 1.25} viewBox="0 0 20 25">
        <Path d="M2 1h16v21l-2.7-1.8-2.6 1.8-2.7-1.8-2.6 1.8-2.7-1.8L2 22z" fill={p.particleReceipt} stroke={a} strokeWidth={1.3} />
        <Rect x={5} y={6} width={10} height={1.6} rx={0.8} fill={a} opacity={0.8} />
        <Rect x={5} y={10} width={7} height={1.6} rx={0.8} fill={a} opacity={0.6} />
        <Rect x={5} y={14} width={9} height={1.6} rx={0.8} fill={b} opacity={0.6} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={b} />
    </Svg>
  );
}

function Particle({ spec, p, width, height }: { spec: ParticleSpec; p: Palette; width: number; height: number }) {
  const t = useSharedValue(0);
  const active = useAmbientActive();
  useEffect(() => {
    if (!active) return;
    t.value = withDelay(spec.delay, withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [active]);
  const style = useAnimatedStyle(() => {
    const v = t.value;
    return {
      opacity: interpolate(v, [0, 0.12, 0.75, 1], [0, 0.85, 0.85, 0]),
      transform: [
        { translateY: interpolate(v, [0, 1], [height, -spec.size * 2]) },
        { translateX: Math.sin(v * Math.PI * 2) * spec.sway },
        { rotate: `${interpolate(v, [0, 1], [-25, 25])}deg` },
        { scale: interpolate(v, [0, 0.2, 1], [0.6, 1, 0.9]) },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: spec.x * width, top: 0 }, style]}>
      <ParticleGlyph kind={spec.kind} size={spec.size} p={p} />
    </Animated.View>
  );
}

export function HeroParticles({ p }: { p: Palette }) {
  const { width, height } = useWindowDimensions();
  const breathe = useSharedValue(0);
  const active = useAmbientActive();
  useEffect(() => {
    if (!active) return;
    breathe.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breathe);
  }, [active]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.35, 0.7]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.9, 1.12]) }],
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {/* breathing glow behind the name */}
      <Animated.View style={[{ position: 'absolute', left: -70, top: 40 }, glowStyle]}>
        <Svg width={280} height={280}>
          <Defs>
            <RadialGradient id="pglow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={p.accentGradient[0]} stopOpacity={0.45} />
              <Stop offset="60%" stopColor={p.accentGradient[1]} stopOpacity={0.12} />
              <Stop offset="100%" stopColor={p.accentGradient[1]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={140} cy={140} r={140} fill="url(#pglow)" />
        </Svg>
      </Animated.View>

      {PARTICLES.map((spec, i) => (
        <Particle key={i} spec={spec} p={p} width={width} height={height} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Liquid Glass for the cards: real backdrop blur of the fixed background
// (Android blurs the BlurTargetView), translucent fill, specular sheen and a
// rim light. Blur mounts after the screen settles; Reduce Transparency → opaque.
// ---------------------------------------------------------------------------
type GlassState = { target: React.RefObject<View | null> | null; ready: boolean; reduce: boolean };
const GlassContext = createContext<GlassState>({ target: null, ready: false, reduce: false });

export function GlassProvider({ target, children }: { target: React.RefObject<View | null>; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 400);
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((v) => mounted && setReduce(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      mounted = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return <GlassContext.Provider value={{ target, ready, reduce }}>{children}</GlassContext.Provider>;
}

export function Glass({ p, fill, radius }: { p: Palette; fill: string; radius: number }) {
  const { target, ready, reduce } = useContext(GlassContext);
  if (reduce) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.glassOpaque }]} />;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ready && (
        <Animated.View entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
          <BlurView
            intensity={50}
            tint={p.glassTint}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={3}
            blurTarget={target ?? undefined}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      <LinearGradient colors={p.glassHighlight} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0)', p.glassCaustic]}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: Math.max(0, radius - 1),
            borderWidth: 1,
            borderTopColor: p.glassRim,
            borderLeftColor: p.glassRimSoft,
            borderRightColor: p.glassRimSoft,
            borderBottomColor: 'transparent',
          },
        ]}
      />
    </View>
  );
}

/** Large soft colour fields drifting down the page, so the glass has something to refract. */
export function AmbientOrbs({ p }: { p: Palette }) {
  const { width, height } = useWindowDimensions();
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const active = useAmbientActive();
  useEffect(() => {
    if (!active) return;
    a.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.sin) }), -1, true);
    b.value = withDelay(1500, withRepeat(withTiming(1, { duration: 13000, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
    };
  }, [active]);
  const s1 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(a.value, [0, 1], [-30, 40]) }, { translateY: interpolate(b.value, [0, 1], [0, 60]) }],
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(b.value, [0, 1], [30, -50]) }, { translateY: interpolate(a.value, [0, 1], [30, -40]) }],
  }));
  const s3 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(a.value, [0, 1], [0, -30]) }, { scale: interpolate(b.value, [0, 1], [0.9, 1.1]) }],
  }));
  const orb = (size: number, color: string) => (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} opacity={p.orbOpacity} />
    </Svg>
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[{ position: 'absolute', left: -80, top: height * 0.38 }, s1]}>{orb(260, p.orbs[0])}</Animated.View>
      <Animated.View style={[{ position: 'absolute', left: width - 170, top: height * 0.58 }, s2]}>{orb(240, p.orbs[1])}</Animated.View>
      <Animated.View style={[{ position: 'absolute', left: width * 0.2, top: height * 0.82 }, s3]}>{orb(220, p.orbs[2])}</Animated.View>
    </View>
  );
}


// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
export function AvatarCircle({
  p,
  uri,
  initials,
  size,
  fontSize,
  ring,
  loading,
}: {
  p: Palette;
  uri: string | null;
  initials: string;
  size: number;
  fontSize: number;
  ring?: boolean;
  loading?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const showImage = !!uri && uri.trim() !== '' && !failed;
  const ringWidth = ring ? Math.max(2, size * 0.025) : 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        padding: ringWidth,
        borderWidth: ringWidth,
        borderColor: p.avatarRing,
        shadowColor: p.accentGradient[1],
        shadowOpacity: ring ? 0.6 : 0.25,
        shadowRadius: size * 0.12,
        shadowOffset: { width: 0, height: 4 },
        elevation: ring ? 10 : 4,
      }}
    >
      <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden' }}>
        <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.center}>
          {showImage ? (
            <Image source={{ uri: uri! }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize, fontWeight: '700', letterSpacing: 0.5 }}>{initials}</Text>
          )}
          {loading && (
            <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          )}
        </LinearGradient>
      </View>
    </View>
  );
}

export function SectionLabel({ p, text, delay }: { p: Palette; text: string; delay: number }) {
  return (
    <Animated.Text entering={FadeIn.duration(400).delay(delay)} style={[styles.section, { color: p.label }]}>
      {text.toUpperCase()}
    </Animated.Text>
  );
}

export function Divider({ p }: { p: Palette }) {
  return <View style={[styles.divider, { backgroundColor: p.divider }]} />;
}

/** Pressable that gently scales down while pressed. */
export function PressScale({
  onPress,
  style,
  children,
  disabled,
}: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => (scale.value = withTiming(0.97, { duration: 90 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 160 }))}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, fontWeight: '600', letterSpacing: 3.5, marginTop: 10, marginBottom: 10, marginLeft: 6 },
  divider: { height: 1, marginLeft: 66 },
});
