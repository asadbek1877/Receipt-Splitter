// src/shared/ui/SakuraBackground.tsx
// Animated Sakura (cherry blossom) background component

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Ellipse, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { getJapaneseColors } from './JapaneseTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SakuraBackgroundProps {
  isDark?: boolean;
  showPetals?: boolean;
  showMountain?: boolean;
  showSun?: boolean;
  variant?: 'full' | 'header' | 'minimal';
}

// Single Sakura Petal Component
const SakuraPetal = ({ 
  delay, 
  startX, 
  isDark 
}: { 
  delay: number; 
  startX: number; 
  isDark: boolean;
}) => {
  const colors = getJapaneseColors(isDark);
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(SCREEN_HEIGHT + 100, { duration: 8000 + Math.random() * 4000, easing: Easing.linear }),
        -1,
        false
      )
    );
    translateX.value = withDelay(
      delay,
      withRepeat(
        withTiming(Math.random() * 100 - 50, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    rotate.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: 4000 + Math.random() * 2000, easing: Easing.linear }),
        -1,
        false
      )
    );
    opacity.value = withDelay(delay, withTiming(0.7, { duration: 1000 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.petal, { left: startX }, animatedStyle]}>
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Ellipse 
          cx="10" 
          cy="10" 
          rx="8" 
          ry="5" 
          fill={colors.sakuraPetal}
          opacity={0.8}
        />
      </Svg>
    </Animated.View>
  );
};

// Japanese Mountain Silhouette
const MountainSilhouette = ({ isDark }: { isDark: boolean }) => {
  const colors = getJapaneseColors(isDark);
  
  return (
    <Svg width={SCREEN_WIDTH} height={200} viewBox={`0 0 ${SCREEN_WIDTH} 200`} style={styles.mountain}>
      {/* Distant mountains */}
      <Path
        d={`M0 200 L0 150 Q${SCREEN_WIDTH * 0.15} 80 ${SCREEN_WIDTH * 0.3} 120 Q${SCREEN_WIDTH * 0.45} 60 ${SCREEN_WIDTH * 0.6} 100 Q${SCREEN_WIDTH * 0.75} 40 ${SCREEN_WIDTH * 0.9} 90 L${SCREEN_WIDTH} 130 L${SCREEN_WIDTH} 200 Z`}
        fill={isDark ? 'rgba(60, 60, 80, 0.4)' : 'rgba(200, 180, 200, 0.3)'}
      />
      {/* Near mountain with pagoda shape */}
      <Path
        d={`M${SCREEN_WIDTH * 0.6} 200 L${SCREEN_WIDTH * 0.6} 140 Q${SCREEN_WIDTH * 0.7} 100 ${SCREEN_WIDTH * 0.75} 80 Q${SCREEN_WIDTH * 0.8} 100 ${SCREEN_WIDTH * 0.9} 140 L${SCREEN_WIDTH * 0.9} 200 Z`}
        fill={isDark ? 'rgba(80, 60, 80, 0.5)' : 'rgba(180, 160, 180, 0.4)'}
      />
    </Svg>
  );
};

// Rising/Setting Sun
const JapaneseSun = ({ isDark }: { isDark: boolean }) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.05, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withTiming(0.5, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[styles.sunContainer, animatedStyle]}>
      {/* Glow effect */}
      <Animated.View style={[styles.sunGlow, glowStyle]}>
        <LinearGradient
          colors={isDark ? ['rgba(255, 107, 107, 0.4)', 'transparent'] : ['rgba(255, 107, 107, 0.5)', 'transparent']}
          style={styles.sunGlowGradient}
        />
      </Animated.View>
      {/* Main sun */}
      <Svg width={120} height={120} viewBox="0 0 120 120">
        <Defs>
          <RadialGradient id="sunGradient" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF6B6B" />
            <Stop offset="70%" stopColor="#E91E63" />
            <Stop offset="100%" stopColor="#C2185B" />
          </RadialGradient>
        </Defs>
        <Circle cx="60" cy="60" r="55" fill="url(#sunGradient)" />
      </Svg>
    </Animated.View>
  );
};

export const SakuraBackground: React.FC<SakuraBackgroundProps> = ({
  isDark = false,
  showPetals = true,
  showMountain = true,
  showSun = true,
  variant = 'full',
}) => {
  const colors = getJapaneseColors(isDark);

  // Generate random petal positions
  const petals = useMemo(() => {
    const count = variant === 'minimal' ? 5 : variant === 'header' ? 8 : 15;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      delay: Math.random() * 3000,
      startX: Math.random() * SCREEN_WIDTH,
    }));
  }, [variant]);

  const gradientColors = isDark 
    ? [colors.bgGradientStart, colors.bgGradientEnd] as const
    : [colors.bgGradientStart, colors.bgGradientEnd, colors.bgSakura] as const;

  const containerHeight = variant === 'header' ? 280 : variant === 'minimal' ? 150 : SCREEN_HEIGHT;

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      
      {showSun && variant !== 'minimal' && (
        <JapaneseSun isDark={isDark} />
      )}
      
      {showMountain && variant === 'full' && (
        <MountainSilhouette isDark={isDark} />
      )}
      
      {showPetals && petals.map((petal) => (
        <SakuraPetal
          key={petal.id}
          delay={petal.delay}
          startX={petal.startX}
          isDark={isDark}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  petal: {
    position: 'absolute',
    top: 0,
  },
  mountain: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  sunContainer: {
    position: 'absolute',
    top: 40,
    right: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
  },
  sunGlowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
  },
});

export default SakuraBackground;
