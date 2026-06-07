import React, { useState, useEffect, useRef } from 'react';
import { useRouter, Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { YStack, XStack, Text, View } from 'tamagui';
import { StyleSheet, Pressable, Dimensions, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
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
import SakuraBackground from '@/shared/ui/SakuraBackground';
import { register, RegisterRequest, getCurrentUser } from '../api';
import { saveToken } from '@/shared/lib/utils/token-storage';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { useThemeColors } from '@/shared/lib/stores/theme-store';
import { User, Mail, Lock, ChevronLeft, ShieldCheck } from '@tamagui/lucide-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const schema = z.object({
  username: z.string()
    .min(2, 'Username must be at least 2 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore and hyphen'),
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
    opacity.value = withTiming(0.55, { duration: 600 });
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

// Jade Orb (replaces Japanese Sun)
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
          <RadialGradient id="jadeGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#A7F3D0" />
            <Stop offset="60%" stopColor="#34D399" />
            <Stop offset="100%" stopColor="#059669" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="42" fill="url(#jadeGrad)" opacity={0.85} />
      </Svg>
    </Animated.View>
  );
};

export default function RegisterForm() {
  const { t } = useTranslation();
  const { control, handleSubmit, formState: { errors }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '', password: '' },
  });
  const setAuth = useAppStore((s) => s.setAuth);
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verification step
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const codeInputRefs = useRef<(TextInput | null)[]>([]);

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

  const applyDebugCode = (code?: string) => {
    if (!code) return;
    const digits = code.replace(/\D/g, '').slice(0, 6).split('');
    const next = Array.from({ length: 6 }, (_, i) => digits[i] || '');
    setVerificationCode(next);
    const lastIndex = Math.min(digits.length, 5);
    setTimeout(() => codeInputRefs.current[lastIndex]?.focus(), 50);
  };

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Step 1: Register directly, bypassing email verification
  const onSubmit = async (values: RegisterRequest) => {
    clearError();
    try {
      setIsLoading(true);
      console.log('[Register] Registering straight away for:', values.email);
      const res = await register(values);
      console.log('[Register] Registration success, saving token...');
      if (res.token) {
        await saveToken(res.token);
        
        let profile = res.user;
        try {
          profile = await getCurrentUser(res.token);
        } catch (fetchError) {
          console.warn('Registration profile refresh failed, using inline user:', fetchError);
        }

        setAuth(res.token, profile);
        router.replace('/tabs');
      }
    } catch (error: any) {
      console.error('[Register] Error:', error);
      const message = error?.message || t('auth.registerError', 'An error occurred during registration');
      triggerError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle code input
  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...verificationCode];
    // Handle paste of full code
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, 6);
      const arr = digits.split('');
      for (let i = 0; i < 6; i++) {
        newCode[i] = arr[i] || '';
      }
      setVerificationCode(newCode);
      const lastFilled = Math.min(digits.length, 5);
      codeInputRefs.current[lastFilled]?.focus();
      return;
    }
    
    newCode[index] = text;
    setVerificationCode(newCode);
    if (text && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify code and complete registration
  const handleVerify = async () => {};

  // Resend code
  const handleResend = async () => {
      // Skipped: No longer using verification codes
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
      {[80, 180, 300, 50, 250].map((x, i) => (
        <FloatingLeaf key={i} delay={i * 600} startX={x} />
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
            {t('auth.joinUs', 'Join us')}
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

            {step === 'verify' ? (
              /* ========== VERIFICATION STEP ========== */
              <Animated.View entering={FadeIn.duration(400)}>
                <View style={styles.formHeader}>
                  <View style={{ alignItems: 'center', marginBottom: 8 }}>
                    <View style={{
                      width: 56, height: 56, borderRadius: 28,
                      backgroundColor: colors.primary + '20',
                      alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                    }}>
                      <ShieldCheck size={28} color={colors.primary} />
                    </View>
                  </View>
                  <Text fontSize={20} fontWeight="600" color={colors.text} textAlign="center">
                    {t('auth.verifyEmail', 'Verify your email')}
                  </Text>
                  <Text fontSize={13} color={colors.textMuted} marginTop={8} textAlign="center" lineHeight={20}>
                    {t('auth.codeSentTo', 'We sent a 6-digit code to')}{'\n'}
                    <Text fontWeight="600" color={colors.primary}>{pendingEmail}</Text>
                  </Text>
                </View>

                {/* Code Input */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                  {verificationCode.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(ref) => { codeInputRefs.current[i] = ref; }}
                      style={{
                        width: 44, height: 52,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: digit ? colors.primary : colors.glassBorder,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB',
                        textAlign: 'center',
                        fontSize: 22,
                        fontWeight: '700',
                        color: colors.text,
                      }}
                      value={digit}
                      onChangeText={(text) => handleCodeChange(text, i)}
                      onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, i)}
                      keyboardType="number-pad"
                      maxLength={i === 0 ? 6 : 1} // Allow paste on first input
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {/* Verify Button */}
                <Pressable
                  style={styles.submitWrapper}
                  onPress={handleVerify}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={['#0D9488', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitGradient}
                  >
                    <Text color="#FFFFFF" fontWeight="700" fontSize={16}>
                      {isLoading ? t('common.loading', 'Loading...') : t('auth.verify', 'Verify & Create Account')}
                    </Text>
                  </LinearGradient>
                </Pressable>

                {/* Resend */}
                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  {resendTimer > 0 ? (
                    <Text fontSize={13} color={colors.textMuted}>
                      {t('auth.resendIn', 'Resend code in')} {resendTimer}s
                    </Text>
                  ) : (
                    <Pressable onPress={handleResend} disabled={isLoading}>
                      <Text fontSize={13} fontWeight="600" color={colors.primary}>
                        {t('auth.resendCode', 'Resend code')}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Back to form */}
                <View style={{ alignItems: 'center', marginTop: 16 }}>
                  <Pressable onPress={() => { setStep('form'); clearError(); }}>
                    <Text fontSize={13} color={colors.textSecondary}>
                      ← {t('auth.changeDetails', 'Change details')}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            ) : (
            /* ========== REGISTRATION FORM ========== */
            <>
            {/* Form Header */}
            <View style={styles.formHeader}>
              <Text fontSize={20} fontWeight="600" color={colors.text}>
                {t('auth.createAccount', 'Create Account')}
              </Text>
              <Text fontSize={13} color={colors.textMuted} marginTop={6}>
                {t('auth.fillDetails', 'Fill in your details to get started')}
              </Text>
            </View>

            {/* Username */}
            <Animated.View entering={FadeInUp.delay(400)}>
              <Controller control={control} name="username"
                render={({ field: { onChange, value } }) => (
                  <Input label={t('auth.username', 'Username')} placeholder={t('auth.usernamePlaceholder', 'your_username')}
                    value={value} onChangeText={(v: string) => { onChange(v); clearError(); }} error={errors.username?.message} />
                )} />
            </Animated.View>

            {/* Email */}
            <Animated.View entering={FadeInUp.delay(500)} style={{ marginTop: 16 }}>
              <Controller control={control} name="email"
                render={({ field: { onChange, value } }) => (
                  <Input label={t('auth.email', 'Email')} placeholder={t('auth.emailPlaceholder', 'your@email.com')}
                    value={value} onChangeText={(v: string) => { onChange(v); clearError(); }} keyboardType="email-address" autoCapitalize="none"
                    error={errors.email?.message} />
                )} />
            </Animated.View>

            {/* Password */}
            <Animated.View entering={FadeInUp.delay(600)} style={{ marginTop: 16 }}>
              <Controller control={control} name="password"
                render={({ field: { onChange, value } }) => (
                  <PasswordInput label={t('auth.password', 'Password')} placeholder="••••••••"
                    value={value} onChangeText={(v: string) => { onChange(v); clearError(); }} error={errors.password?.message} />
                )} />
            </Animated.View>

            {/* Submit */}
            <Animated.View entering={FadeInUp.delay(700)} style={{ marginTop: 28 }}>
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
                    {isLoading ? t('common.loading', 'Loading...') : t('auth.createAccount', 'Create Account')}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Divider */}
            <Animated.View entering={FadeIn.delay(800)} style={styles.dividerContainer}>
              <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
              <Text fontSize={12} color={colors.textMuted} marginHorizontal={12}>
                {t('auth.or', 'or')}
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
            </Animated.View>

            {/* Social */}
            <Animated.View entering={FadeIn.delay(850)} style={styles.socialSection}>
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
            <Animated.View entering={FadeIn.delay(900)} style={styles.footerLink}>
              <Text fontSize={13} color={colors.textSecondary}>
                {t('auth.haveAccount', 'Already have an account?')}{' '}
              </Text>
              <Link href="/login">
                <Text fontSize={13} fontWeight="600" color={colors.primary}>
                  {t('auth.signIn', 'Sign In')}
                </Text>
              </Link>
            </Animated.View>
            </>
            )}
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



