import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigation, useRouter, type Href } from 'expo-router';
import {
  AccessibilityInfo,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  type SharedValue,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurTargetView, BlurView } from 'expo-blur';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { ArrowRight, ChevronLeft, ChevronRight, Eye, EyeOff } from '@tamagui/lucide-icons';

import { useAppStore } from '@/shared/lib/stores/app-store';

export const APP_TITLE = 'Receipt Splitter';


const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * Shared building blocks for the auth screens (login, register):
 * palettes, Liquid Glass surfaces, animated hero illustration, fields and buttons.
 */

// ---------------------------------------------------------------------------
// Palettes
//   login    — light: green,        dark: blue → violet  (matches the mock)
//   register — light: teal → sky,   dark: violet → pink
// ---------------------------------------------------------------------------
type Pair = readonly [string, string];

export type Palette = {
  bg: Pair;
  text: string;
  muted: string;
  placeholder: string;
  icon: string;
  link: string;
  gradient: Pair;
  gradientText: Pair;
  inputBg: string;
  inputBorder: string;
  inputFocus: string;
  divider: string;
  socialBg: string;
  socialBorder: string;
  socialText: string;
  footerBg: string;
  footerIcon: string;
  backBg: string;
  backBorder: string;
  blob: Pair;
  blobSoft: string;
  paper: Pair;
  paperLine: string;
  barcode: string;
  roll: Pair;
  arrowBg: string;
  sparkle: string;
  glassTint: 'light' | 'dark';
  glassHighlight: Pair;
  glassCaustic: string;
  glassRim: string;
  glassRimSoft: string;
  glassOpaque: string;
  topShape: Pair;
  cornerA: Pair;
  cornerB: Pair;
  cornerOpacity: number;
  orbA: string;
  orbB: string;
  orbOpacity: number;
  avatarBg: string;
  githubFill: string;
  appleFill: string;
};

export type AuthVariant = 'login' | 'register';

const LIGHT_BASE: Palette = {
  bg: ['#FFFFFF', '#FFFFFF'],
  text: '#0F172A',
  muted: '#64748B',
  placeholder: '#7C8798',
  icon: '#475569',
  link: '#16A34A',
  gradient: ['#34D27B', '#16A34A'],
  gradientText: ['#22C55E', '#15803D'],
  inputBg: 'rgba(241,245,249,0.55)',
  inputBorder: 'rgba(15,23,42,0.06)',
  inputFocus: '#22C55E',
  divider: '#E5E7EB',
  socialBg: 'rgba(255,255,255,0.45)',
  socialBorder: 'rgba(15,23,42,0.08)',
  socialText: '#1F2937',
  footerBg: 'rgba(220,252,231,0.5)',
  footerIcon: '#16A34A',
  backBg: 'rgba(255,255,255,0.45)',
  backBorder: 'rgba(15,23,42,0.08)',
  blob: ['#4ADE80', '#16A34A'],
  blobSoft: '#BBF7D0',
  paper: ['#FFFFFF', '#F1F5F9'],
  paperLine: '#CBD5E1',
  barcode: '#334155',
  roll: ['#E2E8F0', '#FFFFFF'],
  arrowBg: 'rgba(255,255,255,0.25)',
  sparkle: '#22C55E',
  glassTint: 'light',
  glassHighlight: ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)'],
  glassCaustic: 'rgba(255,255,255,0.45)',
  glassRim: 'rgba(255,255,255,1)',
  glassRimSoft: 'rgba(255,255,255,0.55)',
  glassOpaque: '#F3F5F8',
  topShape: ['#BBF7D0', '#4ADE80'],
  cornerA: ['#BBF7D0', '#4ADE80'],
  cornerB: ['#A7F3D0', '#22C55E'],
  cornerOpacity: 0.55,
  orbA: '#86EFAC',
  orbB: '#FDE68A',
  orbOpacity: 0.35,
  avatarBg: '#FFFFFF',
  githubFill: '#111827',
  appleFill: '#111827',
};

const DARK_BASE: Palette = {
  bg: ['#0A0F1E', '#0E1430'],
  text: '#FFFFFF',
  muted: '#94A3B8',
  placeholder: '#8A93A8',
  icon: '#AAB3C5',
  link: '#A78BFA',
  gradient: ['#4F8BFF', '#A855F7'],
  gradientText: ['#60A5FA', '#A855F7'],
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.08)',
  inputFocus: '#8B5CF6',
  divider: 'rgba(255,255,255,0.10)',
  socialBg: 'rgba(255,255,255,0.05)',
  socialBorder: 'rgba(255,255,255,0.08)',
  socialText: '#E2E8F0',
  footerBg: 'rgba(124,92,246,0.16)',
  footerIcon: '#A78BFA',
  backBg: 'rgba(255,255,255,0.07)',
  backBorder: 'rgba(255,255,255,0.10)',
  blob: ['#3B82F6', '#7C3AED'],
  blobSoft: '#6366F1',
  paper: ['#3B4FD8', '#5B3FD6'],
  paperLine: 'rgba(255,255,255,0.45)',
  barcode: 'rgba(255,255,255,0.9)',
  roll: ['#2E3CB0', '#4F46E5'],
  arrowBg: 'rgba(255,255,255,0.22)',
  sparkle: '#C4B5FD',
  glassTint: 'dark',
  glassHighlight: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'],
  glassCaustic: 'rgba(167,139,250,0.14)',
  glassRim: 'rgba(255,255,255,0.38)',
  glassRimSoft: 'rgba(255,255,255,0.12)',
  glassOpaque: '#161D33',
  topShape: ['#1E2A5C', '#141B3D'],
  cornerA: ['#7C3AED', '#4338CA'],
  cornerB: ['#8B5CF6', '#5B21B6'],
  cornerOpacity: 0.85,
  orbA: '#3B82F6',
  orbB: '#8B5CF6',
  orbOpacity: 0.28,
  avatarBg: '#1B2240',
  githubFill: '#FFFFFF',
  appleFill: '#FFFFFF',
};

export const PALETTES: Record<AuthVariant, { light: Palette; dark: Palette }> = {
  login: { light: LIGHT_BASE, dark: DARK_BASE },
  register: {
    light: {
      ...LIGHT_BASE,
      bg: ['#ECFEFF', '#FFFFFF'],
      link: '#0D9488',
      gradient: ['#14B8A6', '#0EA5E9'],
      gradientText: ['#0D9488', '#0284C7'],
      inputFocus: '#14B8A6',
      inputBg: 'rgba(240,253,250,0.55)',
      footerBg: 'rgba(204,251,241,0.5)',
      footerIcon: '#0D9488',
      blob: ['#5EEAD4', '#0EA5E9'],
      blobSoft: '#A5F3FC',
      sparkle: '#0EA5E9',
      topShape: ['#A5F3FC', '#5EEAD4'],
      cornerA: ['#99F6E4', '#2DD4BF'],
      cornerB: ['#BAE6FD', '#38BDF8'],
      orbA: '#5EEAD4',
      orbB: '#7DD3FC',
    },
    dark: {
      ...DARK_BASE,
      bg: ['#12091F', '#1B0F30'],
      link: '#F0ABFC',
      gradient: ['#A855F7', '#EC4899'],
      gradientText: ['#C084FC', '#F472B6'],
      inputFocus: '#EC4899',
      footerBg: 'rgba(236,72,153,0.14)',
      footerIcon: '#F0ABFC',
      blob: ['#8B5CF6', '#EC4899'],
      blobSoft: '#D946EF',
      sparkle: '#F9A8D4',
      glassCaustic: 'rgba(244,114,182,0.14)',
      glassOpaque: '#1F1330',
      topShape: ['#3B1A5C', '#24123D'],
      cornerA: ['#DB2777', '#9D174D'],
      cornerB: ['#A855F7', '#6D28D9'],
      orbA: '#A855F7',
      orbB: '#EC4899',
      avatarBg: '#2A1840',
    },
  },
};

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------
export function useLoop(duration: number, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, []);
  return v;
}

// ---------------------------------------------------------------------------
// Liquid Glass (functional layer only: back button, fields, social, footer).
//  - real backdrop blur on iOS and Android (Android blurs the BlurTargetView
//    that holds the background, see AuthScreen)
//  - translucent fill + diagonal specular sheen + bottom caustic glow
//  - light rim that is bright on top and fades down the sides
//  - blur mounts only after the screen transition finishes, so navigation
//    stays smooth; Reduce Transparency → opaque fill, no blur
// ---------------------------------------------------------------------------
const BlurTargetContext = createContext<React.RefObject<View | null> | null>(null);
const ReduceTransparencyContext = createContext(false);
const GlassReadyContext = createContext(true);

function useReduceTransparency() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((v) => mounted && setEnabled(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

export function GlassLayers({
  p,
  fill,
  radius = 14,
  intensity = 45,
}: {
  p: Palette;
  fill: string;
  radius?: number;
  intensity?: number;
}) {
  const blurTarget = useContext(BlurTargetContext);
  const reduceTransparency = useContext(ReduceTransparencyContext);
  const ready = useContext(GlassReadyContext);

  if (reduceTransparency) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.glassOpaque }]} />;
  }

  const innerRadius = Math.max(0, radius - 1);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ready && (
        <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
          <BlurView
            intensity={intensity}
            tint={p.glassTint}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={3}
            blurTarget={blurTarget ?? undefined}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      {/* diagonal specular sheen from the top-left */}
      <LinearGradient
        colors={p.glassHighlight}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.65, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      {/* caustic glow along the bottom edge */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', p.glassCaustic]}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* rim light: bright top edge, softer sides, none at the bottom */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: innerRadius,
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

// ---------------------------------------------------------------------------
// Background decoration (lives inside the blur target, so glass refracts it)
// ---------------------------------------------------------------------------
function DriftingOrbs({ p, width, height }: { p: Palette; width: number; height: number }) {
  const a = useLoop(9000);
  const b = useLoop(11000, 1200);
  const orbA = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(a.value, [0, 1], [-20, 40]) },
      { translateY: interpolate(b.value, [0, 1], [0, 50]) },
    ],
  }));
  const orbB = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(b.value, [0, 1], [30, -40]) },
      { translateY: interpolate(a.value, [0, 1], [20, -40]) },
    ],
  }));
  return (
    <>
      <Animated.View style={[{ position: 'absolute', left: -60, top: height * 0.4 }, orbA]}>
        <Svg width={230} height={230}>
          <Circle cx={115} cy={115} r={115} fill={p.orbA} opacity={p.orbOpacity} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: width - 170, top: height * 0.52 }, orbB]}>
        <Svg width={200} height={200}>
          <Circle cx={100} cy={100} r={100} fill={p.orbB} opacity={p.orbOpacity} />
        </Svg>
      </Animated.View>
    </>
  );
}

function SolidCircle({ id, colors, size, opacity }: { id: string; colors: Pair; size: number; opacity: number }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={colors[0]} />
          <Stop offset="100%" stopColor={colors[1]} />
        </SvgLinearGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} opacity={opacity} />
    </Svg>
  );
}

function BackgroundDecor({
  variant,
  isDark,
  p,
  width,
  height,
}: {
  variant: AuthVariant;
  isDark: boolean;
  p: Palette;
  width: number;
  height: number;
}) {
  const t1 = useLoop(5200);
  const t2 = useLoop(6400, 700);

  const shapeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(t1.value, [0, 1], [0, 10]) },
      { rotate: `${interpolate(t1.value, [0, 1], [0, variant === 'login' ? 8 : -4])}deg` },
      { scale: interpolate(t1.value, [0, 1], [1, 1.04]) },
    ],
  }));
  const circleA = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(t2.value, [0, 1], [0, -14]) },
      { scale: interpolate(t2.value, [0, 1], [1, 1.06]) },
    ],
  }));
  const circleB = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(t1.value, [0, 1], [0, -12]) },
      { translateX: interpolate(t2.value, [0, 1], [0, -8]) },
    ],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <DriftingOrbs p={p} width={width} height={height} />

      {variant === 'login' ? (
        <>
          {/* top-right blob */}
          <Animated.View style={[{ position: 'absolute', top: -90, right: -110 }, shapeStyle]}>
            <Svg width={280} height={280} viewBox="0 0 280 280">
              <Defs>
                <SvgLinearGradient id="trShape" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor={p.topShape[0]} />
                  <Stop offset="100%" stopColor={p.topShape[1]} />
                </SvgLinearGradient>
              </Defs>
              <Path
                d="M196 22c44 20 76 66 70 120-6 56-50 106-108 112-54 6-104-26-120-76-16-50 6-102 48-132 38-28 70-40 110-24z"
                fill="url(#trShape)"
                opacity={isDark ? 0.9 : 0.75}
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: -70, top: height * 0.6 }, circleA]}>
            <SolidCircle id="lgA" colors={p.cornerA} size={140} opacity={p.cornerOpacity} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', right: -90, top: height * 0.76 }, circleB]}>
            <SolidCircle id="lgB" colors={p.cornerB} size={190} opacity={p.cornerOpacity} />
          </Animated.View>
        </>
      ) : (
        <>
          {/* top wave band across the whole width */}
          <Animated.View style={[{ position: 'absolute', top: -40, left: -30 }, shapeStyle]}>
            <Svg width={width + 60} height={260} viewBox="0 0 420 260" preserveAspectRatio="none">
              <Defs>
                <SvgLinearGradient id="rgWave" x1="0" y1="0" x2="1" y2="0.6">
                  <Stop offset="0%" stopColor={p.topShape[0]} />
                  <Stop offset="100%" stopColor={p.topShape[1]} />
                </SvgLinearGradient>
              </Defs>
              <Path
                d="M0 0h420v150c-50 40-110 52-170 30S120 120 60 150C30 165 12 190 0 200z"
                fill="url(#rgWave)"
                opacity={isDark ? 0.85 : 0.6}
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', right: -50, top: height * 0.46 }, circleB]}>
            <SolidCircle id="rgB" colors={p.cornerB} size={110} opacity={p.cornerOpacity} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: -80, top: height * 0.8 }, circleA]}>
            <SolidCircle id="rgA" colors={p.cornerA} size={230} opacity={p.cornerOpacity} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero illustration: big floating receipt that "prints" its lines,
// barcode scan beam and twinkling sparkles
// ---------------------------------------------------------------------------
const LINE_WIDTHS = [42, 34, 40, 28];

function ReceiptLine({ index, progress, color }: { index: number; progress: SharedValue<number>; color: string }) {
  const full = LINE_WIDTHS[index];
  const animatedProps = useAnimatedProps(() => {
    // each line draws in its own slice of the 0..1 cycle
    const start = index * 0.12;
    const local = Math.min(1, Math.max(0, (progress.value - start) / 0.25));
    return { width: Math.max(0.01, full * local) };
  });
  return <AnimatedRect x={34} y={36 + index * 10} height={4} rx={2} fill={color} animatedProps={animatedProps} />;
}

function Sparkle({ x, y, size, delay, color }: { x: number; y: number; size: number; delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
          withDelay(900, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: interpolate(v.value, [0, 1], [0.3, 1]) }, { rotate: `${v.value * 45}deg` }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

function ReceiptIllustration({ p, isDark }: { p: Palette; isDark: boolean }) {
  const float = useLoop(2800);
  const pulse = useLoop(4200, 300);
  const print = useSharedValue(0);
  const scan = useSharedValue(0);

  useEffect(() => {
    print.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }),
        withDelay(2400, withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) })),
      ),
      -1,
      false,
    );
    scan.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  const receiptStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [-7, 7]) },
      { rotate: `${interpolate(float.value, [0, 1], [-3, 2.5])}deg` },
    ],
  }));
  const blobStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pulse.value, [0, 1], [0.95, 1.06]) },
      { rotate: `${interpolate(pulse.value, [0, 1], [-4, 4])}deg` },
    ],
  }));
  const scanProps = useAnimatedProps(() => ({ y: 79 + scan.value * 16 }));

  const sparkleColor = isDark ? '#C4B5FD' : '#22C55E';

  return (
    <View pointerEvents="none" style={styles.illustration}>
      {/* blob behind the receipt */}
      <Animated.View style={[{ position: 'absolute', right: 0, top: 34 }, blobStyle]}>
        <Svg width={170} height={145} viewBox="0 0 130 110">
          <Defs>
            <SvgLinearGradient id="heroBlob" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={p.blob[0]} />
              <Stop offset="100%" stopColor={p.blob[1]} />
            </SvgLinearGradient>
          </Defs>
          <Path
            d="M70 6c26-4 54 12 58 40 4 26-10 52-36 60-28 8-62 2-80-18C-4 70 2 44 20 28 34 14 48 9 70 6z"
            fill="url(#heroBlob)"
            opacity={0.92}
          />
          <Circle cx={28} cy={90} r={13} fill={p.blobSoft} opacity={0.5} />
        </Svg>
      </Animated.View>

      {/* receipt */}
      <Animated.View style={[{ position: 'absolute', left: 30, top: 0 }, receiptStyle]}>
        <Svg width={156} height={182} viewBox="0 0 110 128">
          <Defs>
            <SvgLinearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={p.paper[0]} />
              <Stop offset="100%" stopColor={p.paper[1]} />
            </SvgLinearGradient>
            <SvgLinearGradient id="roll" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={p.roll[0]} />
              <Stop offset="100%" stopColor={p.roll[1]} />
            </SvgLinearGradient>
          </Defs>
          <G rotation={-14} origin="55, 64">
            <Path d="M24 22h62v84l-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6-6 6-8-6z" fill="#000" opacity={0.1} transform="translate(4 5)" />
            <Path d="M24 18h62v88l-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6-6 6-8-6z" fill="url(#paper)" />
            <Rect x={18} y={10} width={74} height={14} rx={7} fill="url(#roll)" />
            <Rect x={18} y={10} width={74} height={5} rx={2.5} fill="#FFFFFF" opacity={0.35} />
            {LINE_WIDTHS.map((_, i) => (
              <ReceiptLine key={i} index={i} progress={print} color={p.paperLine} />
            ))}
            {[0, 3, 5, 9, 11, 14, 18, 20, 23, 27, 29, 33, 36, 38].map((x, i) => (
              <Rect key={i} x={34 + x} y={80} width={i % 3 === 0 ? 2.4 : 1.4} height={16} fill={p.barcode} />
            ))}
            {/* scan beam over the barcode */}
            <AnimatedRect x={30} width={48} height={1.6} rx={0.8} fill={p.gradientText[0]} opacity={0.9} animatedProps={scanProps} />
          </G>
        </Svg>
      </Animated.View>

      <Sparkle x={18} y={30} size={16} delay={0} color={sparkleColor} />
      <Sparkle x={176} y={18} size={12} delay={900} color={sparkleColor} />
      <Sparkle x={40} y={150} size={11} delay={1700} color={sparkleColor} />
    </View>
  );
}
// ---------------------------------------------------------------------------
// Register hero: a spinning "split" donut with friends orbiting around it
// ---------------------------------------------------------------------------
const DONUT_R = 46;
const DONUT_C = 2 * Math.PI * DONUT_R;

function Avatar({ x, y, color, bg, delay }: { x: number; y: number; color: string; bg: string; delay: number }) {
  const bob = useLoop(2400, delay);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bob.value, [0, 1], [-5, 5]) }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]}>
      <Svg width={40} height={40} viewBox="0 0 40 40">
        <Circle cx={20} cy={20} r={18} fill={bg} stroke={color} strokeWidth={2.5} />
        <Circle cx={20} cy={16} r={5.5} fill={color} />
        <Path d="M10.5 30c1.6-5 5.3-7.5 9.5-7.5s7.9 2.5 9.5 7.5" fill={color} />
      </Svg>
    </Animated.View>
  );
}

function SplitIllustration({ p }: { p: Palette }) {
  const spin = useSharedValue(0);
  const pulse = useLoop(3200);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false);
  }, []);

  const donutStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.94, 1.06]) }],
  }));

  const gap = 6;
  const seg = DONUT_C / 3 - gap;
  const segColors = [p.gradient[0], p.gradient[1], p.blobSoft];

  return (
    <View pointerEvents="none" style={styles.illustration}>
      <Animated.View style={[{ position: 'absolute', left: 50, top: 30 }, donutStyle]}>
        <Svg width={130} height={130} viewBox="0 0 130 130">
          <G rotation={-90} origin="65, 65">
            {segColors.map((c, i) => (
              <Circle
                key={i}
                cx={65}
                cy={65}
                r={DONUT_R}
                stroke={c}
                strokeWidth={18}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${seg} ${DONUT_C - seg}`}
                strokeDashoffset={-i * (DONUT_C / 3)}
              />
            ))}
          </G>
        </Svg>
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', left: 87, top: 67 }, coinStyle]}>
        <Svg width={56} height={56} viewBox="0 0 56 56">
          <Defs>
            <SvgLinearGradient id="coin" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={p.gradientText[0]} />
              <Stop offset="100%" stopColor={p.gradientText[1]} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={28} cy={28} r={26} fill={p.avatarBg} />
          {/* ÷ split glyph */}
          <Circle cx={28} cy={18} r={3.6} fill="url(#coin)" />
          <Rect x={15} y={25.5} width={26} height={5} rx={2.5} fill="url(#coin)" />
          <Circle cx={28} cy={38} r={3.6} fill="url(#coin)" />
        </Svg>
      </Animated.View>

      <Avatar x={22} y={18} color={p.gradient[0]} bg={p.avatarBg} delay={0} />
      <Avatar x={162} y={36} color={p.gradient[1]} bg={p.avatarBg} delay={700} />
      <Avatar x={120} y={150} color={p.blobSoft} bg={p.avatarBg} delay={1400} />

      <Sparkle x={36} y={130} size={13} delay={300} color={p.sparkle} />
      <Sparkle x={182} y={130} size={11} delay={1200} color={p.sparkle} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gradient title + animated swoosh underline
// ---------------------------------------------------------------------------
function GradientTitle({ p, text, fontSize, width }: { p: Palette; text: string; fontSize: number; width: number }) {
  const height = Math.round(fontSize * 1.3);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={p.gradientText[0]} />
          <Stop offset="100%" stopColor={p.gradientText[1]} />
        </SvgLinearGradient>
      </Defs>
      <SvgText
        x={0}
        y={fontSize}
        fill="url(#titleGrad)"
        fontSize={fontSize}
        fontWeight="800"
        letterSpacing={-0.5}
      >
        {text}
      </SvgText>
    </Svg>
  );
}

const SWOOSH_LENGTH = 70;

function Swoosh({ p }: { p: Palette }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
          withDelay(2600, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
  }, []);
  const props1 = useAnimatedProps(() => ({ strokeDashoffset: SWOOSH_LENGTH * (1 - progress.value) }));
  const props2 = useAnimatedProps(() => ({ strokeDashoffset: SWOOSH_LENGTH * (1 - progress.value) }));

  return (
    <Svg width={64} height={14} viewBox="0 0 64 14" style={{ marginTop: 2 }}>
      <Defs>
        <SvgLinearGradient id="swoosh" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={p.gradientText[0]} />
          <Stop offset="100%" stopColor={p.gradientText[1]} />
        </SvgLinearGradient>
      </Defs>
      <AnimatedPath
        d="M2 7 C 20 2, 40 2, 60 5"
        stroke="url(#swoosh)"
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={SWOOSH_LENGTH}
        animatedProps={props1}
      />
      <AnimatedPath
        d="M10 12 C 24 9, 38 9, 50 10"
        stroke="url(#swoosh)"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
        strokeDasharray={SWOOSH_LENGTH}
        animatedProps={props2}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
type FieldProps = {
  p: Palette;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: 'email-address' | 'default';
  error?: string;
  right?: React.ReactNode;
};

export function Field({ p, icon, value, placeholder, onChangeText, secure, keyboardType = 'default', error, right }: FieldProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? '#EF4444' : focused ? p.inputFocus : p.inputBorder;
  // NOTE: the style shape stays identical between focused / blurred states (only colors
  // change). Toggling elevation/shadow on focus made Android re-create the native view,
  // which dropped focus and closed the keyboard immediately.
  return (
    <View>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={StyleSheet.flatten([styles.field, styles.glass, { borderColor }])}
      >
        <GlassLayers p={p} fill={p.inputBg} />
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={p.placeholder}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={secure ? 'password' : keyboardType === 'email-address' ? 'email' : 'off'}
          textContentType={secure ? 'password' : keyboardType === 'email-address' ? 'emailAddress' : 'none'}
          selectionColor={p.inputFocus}
          cursorColor={p.inputFocus}
          underlineColorAndroid="transparent"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.fieldInput, { color: p.text }]}
        />
        {right}
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Primary button with shimmer + arrow nudge
// ---------------------------------------------------------------------------
export function PrimaryButton({ p, label, onPress, loading }: { p: Palette; label: string; onPress: () => void; loading: boolean }) {
  const shimmer = useSharedValue(0);
  const nudge = useLoop(900);
  const press = useSharedValue(1);
  const [w, setW] = useState(320);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withDelay(1600, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-120, w + 40]) }, { skewX: '-20deg' }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(nudge.value, [0, 1], [0, 3]) }],
  }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <Animated.View style={[styles.primaryShadow, { shadowColor: p.gradient[1] }, pressStyle]}>
      <Pressable
        onPress={onPress}
        disabled={loading}
        onPressIn={() => (press.value = withTiming(0.97, { duration: 90 }))}
        onPressOut={() => (press.value = withTiming(1, { duration: 140 }))}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={styles.primaryWrap}
      >
        <LinearGradient colors={p.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primary}>
          <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.55 }}
            style={[StyleSheet.absoluteFill, styles.primaryGloss]}
          />
          <Text style={styles.primaryText}>{label}</Text>
          <Animated.View style={[styles.primaryArrow, { backgroundColor: p.arrowBg }, arrowStyle]}>
            <ArrowRight size={16} color="#FFFFFF" />
          </Animated.View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Social brand icons
// ---------------------------------------------------------------------------
export function GoogleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

export function GitHubIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </Svg>
  );
}

export function AppleIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </Svg>
  );
}

export function SocialButton({ p, label, icon, onPress }: { p: Palette; label: string; icon: React.ReactNode; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => (scale.value = withTiming(0.95, { duration: 90 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 140 }))}
        style={StyleSheet.flatten([styles.social, styles.glass, { borderColor: p.socialBorder }])}
      >
        <GlassLayers p={p} fill={p.socialBg} />
        {icon}
        <Text style={[styles.socialText, { color: p.socialText }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Screen shell shared by every auth screen (login, register, ...)
//
// No entrance animations here on purpose: the stack's fade transition does the
// work, and the hero stays put instead of re-popping on every navigation.
// ---------------------------------------------------------------------------
type AuthTheme = { p: Palette; isDark: boolean };
const AuthThemeContext = createContext<AuthTheme>({ p: PALETTES.login.light, isDark: false });

/** Palette of the surrounding <AuthScreen>. */
export function useAuthTheme() {
  return useContext(AuthThemeContext);
}

/** Error message state with a shake animation for the banner. */
export function useAuthError() {
  const [message, setMessage] = useState<string | null>(null);
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const show = (msg: string) => {
    setMessage(msg);
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };
  const clear = () => {
    if (message) setMessage(null);
  };
  return { message, show, clear, shakeStyle };
}

/** True once the screen's enter transition has finished (or after a short fallback). */
function useTransitionDone() {
  const navigation = useNavigation();
  const [done, setDone] = useState(false);
  useEffect(() => {
    const fallback = setTimeout(() => setDone(true), 450);
    const unsub = navigation.addListener('transitionEnd' as any, (e: any) => {
      if (!e?.data?.closing) setDone(true);
    });
    return () => {
      clearTimeout(fallback);
      unsub?.();
    };
  }, [navigation]);
  return done;
}

export function AuthScreen({
  variant,
  eyebrow,
  title = APP_TITLE,
  subtitle,
  backFallback,
  children,
}: {
  variant: AuthVariant;
  eyebrow: string;
  title?: string;
  subtitle: string;
  /** Where the back button goes when there is no screen to go back to. */
  backFallback: Href;
  children: React.ReactNode;
}) {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';
  const p = PALETTES[variant][isDark ? 'dark' : 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const blurTargetRef = useRef<View>(null);
  const reduceTransparency = useReduceTransparency();
  const glassReady = useTransitionDone();
  const contentWidth = Math.min(width, 480) - 48;
  const titleSize = Math.min(34, Math.floor(contentWidth / 9.6));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(backFallback);
  };

  return (
    <AuthThemeContext.Provider value={{ p, isDark }}>
      <BlurTargetContext.Provider value={blurTargetRef}>
        <ReduceTransparencyContext.Provider value={reduceTransparency}>
          <GlassReadyContext.Provider value={glassReady}>
            <View style={styles.container}>
              {/* Everything the glass blurs lives inside this target (required on Android) */}
              <BlurTargetView ref={blurTargetRef} style={StyleSheet.absoluteFill}>
                <LinearGradient colors={p.bg} style={StyleSheet.absoluteFill} />
                <BackgroundDecor variant={variant} isDark={isDark} p={p} width={width} height={height} />
              </BlurTargetView>

              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                  contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.inner}>
                    {/* Hero sits behind the header/title so it can be large */}
                    <View style={styles.illustrationWrap} pointerEvents="none">
                      {variant === 'login' ? <ReceiptIllustration p={p} isDark={isDark} /> : <SplitIllustration p={p} />}
                    </View>

                    <View style={styles.headerRow}>
                      <Pressable
                        onPress={goBack}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        hitSlop={6}
                        style={StyleSheet.flatten([styles.back, styles.glass, { borderColor: p.backBorder }])}
                      >
                        <GlassLayers p={p} fill={p.backBg} radius={21} />
                        <ChevronLeft size={20} color={p.text} />
                      </Pressable>
                    </View>

                    <View style={styles.titleBlock}>
                      <Text style={[styles.welcome, { color: p.text, fontSize: titleSize * 0.82 }]}>{eyebrow}</Text>
                      <GradientTitle p={p} text={title} fontSize={titleSize} width={contentWidth} />
                      <Swoosh p={p} />
                      <Text style={[styles.subtitle, { color: p.muted }]}>{subtitle}</Text>
                    </View>

                    {children}
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </GlassReadyContext.Provider>
        </ReduceTransparencyContext.Provider>
      </BlurTargetContext.Provider>
    </AuthThemeContext.Provider>
  );
}

export function ErrorBanner({ error }: { error: ReturnType<typeof useAuthError> }) {
  const { isDark } = useAuthTheme();
  if (!error.message) return null;
  return (
    <Animated.View
      entering={FadeIn}
      style={[
        styles.errorBox,
        {
          backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
          borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
        },
        error.shakeStyle,
      ]}
    >
      <Text style={{ color: isDark ? '#FCA5A5' : '#DC2626', fontSize: 13, lineHeight: 18 }}>{error.message}</Text>
    </Animated.View>
  );
}

/** Eye icon that toggles password visibility, placed in a Field's `right` slot. */
export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const { p } = useAuthTheme();
  return (
    <Pressable
      hitSlop={10}
      onPress={onToggle}
      style={styles.eye}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    >
      {visible ? <EyeOff size={19} color={p.icon} /> : <Eye size={19} color={p.icon} />}
    </Pressable>
  );
}

export function OrDivider() {
  const { t } = useTranslation();
  const { p } = useAuthTheme();
  return (
    <View style={styles.dividerRow}>
      <View style={[styles.divider, { backgroundColor: p.divider }]} />
      <Text style={[styles.dividerText, { color: p.muted }]}>{t('auth.or', 'or')}</Text>
      <View style={[styles.divider, { backgroundColor: p.divider }]} />
    </View>
  );
}

export function SocialRow() {
  const { t } = useTranslation();
  const { p } = useAuthTheme();
  const onSocial = (provider: string) =>
    Alert.alert(provider, t('auth.socialComingSoon', 'Sign in with {{provider}} is coming soon.', { provider }));
  return (
    <View style={styles.socialRow}>
      <SocialButton p={p} label="Google" icon={<GoogleIcon />} onPress={() => onSocial('Google')} />
      <SocialButton p={p} label="GitHub" icon={<GitHubIcon color={p.githubFill} />} onPress={() => onSocial('GitHub')} />
      <SocialButton p={p} label="Apple" icon={<AppleIcon color={p.appleFill} />} onPress={() => onSocial('Apple')} />
    </View>
  );
}

/**
 * Glass pill at the bottom that switches to the sibling auth screen.
 * Uses `replace` so login ⇄ register cross-fade instead of stacking up.
 */
export function FooterLink({
  href,
  icon: Icon,
  text,
  linkText,
}: {
  href: Href;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  text: string;
  linkText: string;
}) {
  const { p } = useAuthTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace(href)}
      accessibilityRole="link"
      style={StyleSheet.flatten([styles.footer, styles.glass, { borderColor: p.backBorder }])}
    >
      <GlassLayers p={p} fill={p.footerBg} />
      <Icon size={18} color={p.footerIcon} />
      <Text style={[styles.footerText, { color: p.muted }]}>{text}</Text>
      <Text style={[styles.footerLink, { color: p.link }]}>{linkText}</Text>
      <ChevronRight size={14} color={p.link} />
    </Pressable>
  );
}

export const authStyles = StyleSheet.create({
  container: { flex: 1 },
  glass: { backgroundColor: 'transparent', overflow: 'hidden' },
  primaryGloss: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  inner: { width: '100%', maxWidth: 432, alignSelf: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    height: 128,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  illustrationWrap: { position: 'absolute', top: -14, right: -30 },
  illustration: { width: 210, height: 196 },
  titleBlock: { marginTop: 4, marginBottom: 22 },
  welcome: { fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13.5, marginTop: 10 },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  field: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  fieldIcon: { width: 28 },
  fieldInput: { flex: 1, fontSize: 15, paddingVertical: 0, marginLeft: 6, height: '100%' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 6, marginLeft: 4 },
  eye: { paddingLeft: 8 },
  forgot: { alignItems: 'flex-end', marginTop: 12 },
  forgotText: { fontSize: 13, fontWeight: '600' },
  primaryShadow: {
    borderRadius: 16,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  primaryWrap: { borderRadius: 16, overflow: 'hidden' },
  primary: { height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  primaryArrow: {
    position: 'absolute',
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 80 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 13 },
  socialRow: { flexDirection: 'row', gap: 10 },
  social: {
    height: 70,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  socialText: { fontSize: 12, fontWeight: '500' },
  footer: {
    marginTop: 22,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  footerText: { fontSize: 13, flexShrink: 1, marginLeft: 6 },
  footerLink: { fontSize: 13, fontWeight: '700' },
});

const styles = authStyles;
