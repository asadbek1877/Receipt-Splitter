import React, { useState, useEffect } from 'react';
import { useRouter, Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { YStack, XStack, Text, View } from 'tamagui';
import { StyleSheet, Pressable, Dimensions, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import PasswordInput from '@/shared/ui/PasswordInput';
import { getJapaneseColors, borderRadius, shadows } from '@/shared/ui/JapaneseTheme';
import { login, LoginRequest, getCurrentUser } from '../api';
import { saveToken } from '@/shared/lib/utils/token-storage';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { useThemeColors } from '@/shared/lib/stores/theme-store';
import { Mail, Lock, ChevronLeft } from '@tamagui/lucide-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

// Floating Leaf Particle
const FloatingLeaf = ({ delay, startX }: { delay: number; startX: number }) => {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(400, { duration: 8000 + Math.random() * 4000, easing: Easing.linear }),
      -1, false
    );
    translateX.value = withRepeat(
      withTiming(Math.random() * 50 - 25, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1, true
    );
    rotate.value = withRepeat(
      withTiming(360, { duration: 5000, easing: Easing.linear }),
      -1, false
    );
    opacity.value = withTiming(0.5, { duration: 600 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: startX, zIndex: 1 }, style]}>
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Ellipse cx="7" cy="7" rx="5" ry="3" fill="#86EFAC" opacity={0.7} />
      </Svg>
    </Animated.View>
  );
};

// Jade Orb
const JadeOrb = () => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.04, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
      -1, true
    );
  }, []);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ marginTop: 4 }, animated]}>
      <Svg width={70} height={70} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="jadeGradL" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#A7F3D0" />
            <Stop offset="60%" stopColor="#34D399" />
            <Stop offset="100%" stopColor="#059669" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="42" fill="url(#jadeGradL)" opacity={0.85} />
      </Svg>
    </Animated.View>
  );
};

export default function LoginForm() {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const setAuth = useAppStore((s) => s.setAuth);
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Shake animation for error
  const shakeX = useSharedValue(0);
  const errorOpacity = useSharedValue(0);

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    errorOpacity.value = withTiming(1, { duration: 300 });
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  const clearError = () => {
    if (errorMessage) {
      errorOpacity.value = withTiming(0, { duration: 200 });
      setTimeout(() => setErrorMessage(null), 200);
    }
  };

  const errorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.value,
    transform: [{ translateX: shakeX.value }],
  }));

  const onSubmit = async (values: LoginRequest) => {
    clearError();
    try {
      setIsLoading(true);
      const res = await login(values);
      await saveToken(res.token);

      let profile = res.user;
      try {
        profile = await getCurrentUser(res.token);
      } catch (fetchError) {
        console.warn('Login profile refresh failed:', fetchError);
      }

      setAuth(res.token, profile);
      router.replace('/tabs');
    } catch (error: any) {
      const msg = error?.message || t('auth.loginError', 'An error occurred during login');
      triggerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={isDark
          ? [colors.bgGradientStart, colors.bgGradientEnd]
          : ['#ECFDF5', '#D1FAE5', '#F0FDFA']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Floating Leaves */}
      {[60, 160, 280, 120, 220].map((x, i) => (
        <FloatingLeaf key={i} delay={i * 500} startX={x} />
      ))}

      {/* Header */}
      <Animated.View entering={FadeIn.delay(100)} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Link href="/" asChild>
          <Pressable style={[styles.backButton, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
        </Link>
        <View style={styles.headerContent}>
          <Text fontSize={24} fontWeight="600" color={colors.text} letterSpacing={-0.3}>
            {t('auth.welcomeTo', 'Welcome')}
          </Text>
          <Text fontSize={24} fontWeight="700" color={colors.primary} letterSpacing={-0.3}>
            {t('app.name', 'Splitter')}
          </Text>
        </View>
        <JadeOrb />
      </Animated.View>

      {/* Form */}
      <KeyboardAvoidingView style={styles.formWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={SlideInDown.delay(300).springify()}
            style={[styles.formCard, {
              backgroundColor: colors.card,
              borderColor: colors.glassBorder,
              shadowColor: colors.shadow,
            }]}
          >
            {/* Form Header */}
            <View style={styles.formHeader}>
              <Text fontSize={20} fontWeight="600" color={colors.text}>
                {t('auth.signIn', 'Sign In')}
              </Text>
              <Text fontSize={13} color={colors.textMuted} marginTop={6}>
                {t('auth.enterCredentials', 'Enter your credentials to continue')}
              </Text>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <Animated.View style={[{
                backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }, errorAnimatedStyle]}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text fontSize={16}>⚠️</Text>
                </View>
                <Text fontSize={13} color={isDark ? '#FCA5A5' : '#DC2626'} flex={1} lineHeight={18}>
                  {errorMessage}
                </Text>
              </Animated.View>
            )}

            {/* Email */}
            <Animated.View entering={FadeInUp.delay(400)}>
              <Controller control={control} name="email"
                render={({ field: { onChange, value } }) => (
                  <Input label={t('auth.email', 'Email')} placeholder={t('auth.emailPlaceholder', 'your@email.com')}
                    value={value} onChangeText={(v: string) => { onChange(v); clearError(); }} keyboardType="email-address" autoCapitalize="none"
                    error={errors.email?.message} />
                )} />
            </Animated.View>

            {/* Password */}
            <Animated.View entering={FadeInUp.delay(500)} style={{ marginTop: 16 }}>
              <Controller control={control} name="password"
                render={({ field: { onChange, value } }) => (
                  <PasswordInput label={t('auth.password', 'Password')} placeholder="••••••••"
                    value={value} onChangeText={(v: string) => { onChange(v); clearError(); }} error={errors.password?.message} />
                )} />
            </Animated.View>

            {/* Forgot Password */}
            <Animated.View entering={FadeIn.delay(550)} style={styles.forgotPasswordLink}>
              <Link href="/forgot-password">
                <Text fontSize={13} fontWeight="500" color={colors.primary}>
                  {t('auth.forgotPassword', 'Forgot Password?')}
                </Text>
              </Link>
            </Animated.View>

            {/* Submit */}
            <Animated.View entering={FadeInUp.delay(600)} style={{ marginTop: 20 }}>
              <Pressable
                style={styles.submitWrapper}
                onPress={handleSubmit(onSubmit)}
                disabled={isLoading}
                android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
              >
                <LinearGradient
                  colors={['#0D9488', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitGradient}
                >
                  <Text color="#FFFFFF" fontWeight="700" fontSize={16}>
                    {isLoading ? t('common.loading', 'Loading...') : t('auth.signIn', 'Sign In')}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Divider */}
            <Animated.View entering={FadeIn.delay(700)} style={styles.dividerContainer}>
              <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
              <Text fontSize={12} color={colors.textMuted} marginHorizontal={12}>
                {t('auth.orContinueWith', 'or')}
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
            </Animated.View>

            {/* Social */}
            <Animated.View entering={FadeIn.delay(750)} style={styles.socialSection}>
              <XStack justifyContent="space-between" gap={12}>
                {['Google', 'GitHub', 'Apple'].map((label, i) => (
                  <Pressable key={i} style={[styles.socialButton, {
                    backgroundColor: colors.glass,
                    borderColor: colors.glassBorder,
                  }]}>
                    <Text color={colors.textSecondary} fontWeight="500" fontSize={12}>{label}</Text>
                  </Pressable>
                ))}
              </XStack>
            </Animated.View>

            {/* Footer */}
            <Animated.View entering={FadeIn.delay(800)} style={styles.footerLink}>
              <Text fontSize={13} color={colors.textSecondary}>
                {t('auth.noAccount', "Don't have an account?")}{' '}
              </Text>
              <Link href="/register">
                <Text fontSize={13} fontWeight="600" color={colors.primary}>
                  {t('auth.signUp', 'Sign Up')}
                </Text>
              </Link>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 10,
    gap: 8,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerContent: { flex: 1, paddingTop: 8, paddingLeft: 4 },
  formWrapper: { flex: 1 },
  scrollContent: {
    flexGrow: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40,
  },
  formCard: {
    borderRadius: 24, padding: 24, borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  formHeader: { marginBottom: 28 },
  forgotPasswordLink: { alignItems: 'flex-end', marginTop: 12 },
  submitWrapper: {
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  submitGradient: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, borderRadius: 14,
  },
  dividerContainer: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 24,
  },
  divider: { flex: 1, height: 1 },
  socialSection: { marginBottom: 24 },
  socialButton: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  footerLink: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 8,
  },
});
