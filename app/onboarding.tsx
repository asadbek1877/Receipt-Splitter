// app/onboarding.tsx — Japanese Zen Liquid-Glass Onboarding
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'tamagui';
import Svg, { Path, Circle, Rect, G, Ellipse, Defs, LinearGradient as SvgGradient, Stop, ClipPath } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = 320;

// Japanese Bamboo & Mountain Scene with green/teal palette
const BambooIllustration = () => (
  <Svg width={CARD_WIDTH} height={CARD_HEIGHT} viewBox="0 0 340 320">
    <Defs>
      <SvgGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#D1FAE5" />
        <Stop offset="40%" stopColor="#A7F3D0" />
        <Stop offset="100%" stopColor="#6EE7B7" />
      </SvgGradient>
      <SvgGradient id="mtnGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#059669" />
        <Stop offset="100%" stopColor="#047857" />
      </SvgGradient>
      <SvgGradient id="mtnGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#10B981" />
        <Stop offset="100%" stopColor="#059669" />
      </SvgGradient>
      <SvgGradient id="bambooGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#34D399" />
        <Stop offset="100%" stopColor="#059669" />
      </SvgGradient>
      <SvgGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#6EE7B7" />
        <Stop offset="100%" stopColor="#34D399" />
      </SvgGradient>
    </Defs>

    {/* Sky */}
    <Rect x="0" y="0" width="340" height="320" fill="url(#skyGrad)" />

    {/* Sun — Jade orb */}
    <Circle cx="270" cy="65" r="32" fill="#ECFDF5" opacity={0.85} />
    <Circle cx="270" cy="65" r="26" fill="#D1FAE5" opacity={0.6} />

    {/* Clouds */}
    <G opacity={0.75}>
      <Ellipse cx="60" cy="52" rx="26" ry="11" fill="#FFFFFF" />
      <Ellipse cx="85" cy="50" rx="20" ry="9" fill="#FFFFFF" />
      <Ellipse cx="40" cy="54" rx="18" ry="9" fill="#FFFFFF" />
    </G>
    <G opacity={0.6}>
      <Ellipse cx="200" cy="72" rx="22" ry="9" fill="#ECFDF5" />
      <Ellipse cx="222" cy="70" rx="18" ry="8" fill="#ECFDF5" />
    </G>

    {/* Far Mountains */}
    <Path d="M-20 250 Q50 160 110 210 Q160 150 220 190 Q280 130 360 190 L360 320 L-20 320 Z" fill="url(#mtnGrad1)" opacity={0.45} />

    {/* Mid Mountains — richer green */}
    <Path d="M-20 270 Q70 200 150 240 Q210 180 280 220 L360 320 L-20 320 Z" fill="url(#mtnGrad2)" opacity={0.55} />

    {/* Pagoda — teal */}
    <G>
      <Rect x="148" y="220" width="44" height="32" fill="#ECFDF5" />
      <Path d="M135 220 L205 220 L200 227 L140 227 Z" fill="#0D9488" />
      <Rect x="151" y="198" width="38" height="22" fill="#ECFDF5" />
      <Path d="M132 198 L208 198 L202 206 L138 206 Z" fill="#0D9488" />
      <Path d="M132 198 L170 189 L208 198 Z" fill="#14B8A6" />
      <Rect x="155" y="178" width="30" height="20" fill="#ECFDF5" />
      <Path d="M142 178 L198 178 L193 185 L147 185 Z" fill="#0D9488" />
      <Path d="M142 178 L170 170 L198 178 Z" fill="#14B8A6" />
      <Rect x="158" y="160" width="24" height="18" fill="#ECFDF5" />
      <Path d="M150 160 L190 160 L186 166 L154 166 Z" fill="#0D9488" />
      <Path d="M150 160 L170 153 L190 160 Z" fill="#14B8A6" />
      <Path d="M170 125 L170 153" stroke="#047857" strokeWidth="2" />
      <Circle cx="170" cy="123" r="4" fill="#047857" />
    </G>

    {/* Bamboo Left */}
    <G>
      <Rect x="50" y="140" width="6" height="180" rx="3" fill="url(#bambooGrad)" />
      <Rect x="50" y="175" width="6" height="2" fill="#047857" />
      <Rect x="50" y="210" width="6" height="2" fill="#047857" />
      <Rect x="50" y="245" width="6" height="2" fill="#047857" />
      {/* Leaves */}
      <Path d="M56 160 Q75 150 80 140" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Ellipse cx="83" cy="137" rx="12" ry="5" fill="url(#leafGrad)" opacity={0.85} />
      <Path d="M50 190 Q30 180 22 168" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Ellipse cx="18" cy="165" rx="11" ry="5" fill="url(#leafGrad)" opacity={0.75} />
      <Ellipse cx="65" cy="155" rx="10" ry="4" fill="url(#leafGrad)" opacity={0.7} />
    </G>

    {/* Bamboo Right */}
    <G>
      <Rect x="285" y="160" width="5" height="160" rx="2.5" fill="url(#bambooGrad)" />
      <Rect x="285" y="195" width="5" height="2" fill="#047857" />
      <Rect x="285" y="230" width="5" height="2" fill="#047857" />
      {/* Leaves */}
      <Path d="M285 180 Q265 170 258 158" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Ellipse cx="254" cy="155" rx="11" ry="5" fill="url(#leafGrad)" opacity={0.8} />
      <Path d="M290 200 Q310 190 318 178" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Ellipse cx="322" cy="175" rx="12" ry="5" fill="url(#leafGrad)" opacity={0.75} />
    </G>

    {/* Extra Bamboo far left */}
    <Rect x="20" y="200" width="4" height="120" rx="2" fill="#34D399" opacity={0.5} />
    <Ellipse cx="10" cy="195" rx="9" ry="4" fill="#6EE7B7" opacity={0.5} />

    {/* Foreground foliage blobs */}
    <Ellipse cx="30" cy="290" rx="40" ry="30" fill="#10B981" opacity={0.6} />
    <Ellipse cx="310" cy="295" rx="35" ry="25" fill="#10B981" opacity={0.5} />

    {/* Birds */}
    <Path d="M95 90 Q102 85 109 90" stroke="#047857" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <Path d="M125 80 Q130 76 135 80" stroke="#047857" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </Svg>
);

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#ECFDF5', '#D1FAE5', '#A7F3D0']} style={styles.gradient}>
        <View style={styles.content}>
          {/* Illustration Card */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.card}>
            <BambooIllustration />
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.textContainer}>
            <Text style={styles.title}>Split Bills with{'\n'}Friends Easily</Text>
            <Text style={styles.subtitle}>
              Scan receipts, track expenses and{'\n'}
              settle debts — all in one beautiful{'\n'}
              Japanese-inspired app.
            </Text>
          </Animated.View>

          {/* Button */}
          <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => router.push('/register')}
            >
              <LinearGradient
                colors={['#0D9488', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Bottom Link */}
          <Animated.View entering={FadeIn.delay(600)} style={styles.bottomLink}>
            <Text style={styles.bottomText}>Already have an account? </Text>
            <Pressable onPress={() => router.push('/login')}>
              <Text style={styles.signUpText}>Sign In</Text>
            </Pressable>
          </Animated.View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECFDF5',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#D1FAE5',
    shadowColor: '#059669',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  textContainer: {
    marginTop: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#134E4A',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 14,
  },
  buttonContainer: {
    marginTop: 28,
    alignItems: 'center',
  },
  button: {
    width: 220,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bottomLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 20,
  },
  bottomText: {
    fontSize: 13,
    color: '#6B7280',
  },
  signUpText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D9488',
  },
});
