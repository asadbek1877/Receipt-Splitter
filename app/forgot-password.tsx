import React, { useState, useEffect, useRef } from 'react';
import { useRouter, Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { YStack, XStack, Text, View } from 'tamagui';
import { StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInUp,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

import { Input } from '@/shared/ui/Input';
import PasswordInput from '@/shared/ui/PasswordInput';
import { getJapaneseColors, shadows } from '@/shared/ui/JapaneseTheme';
import SakuraBackground from '@/shared/ui/SakuraBackground';
import { forgotPassword, verifyResetCode, resetPassword } from '@/features/auth/api';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { useThemeColors } from '@/shared/lib/stores/theme-store';
import { Mail, ChevronLeft, Send, ShieldCheck, CheckCircle } from '@tamagui/lucide-icons';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type EmailFormData = z.infer<typeof emailSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { control: emailControl, handleSubmit: handleEmailSubmit, formState: { errors: emailErrors } } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });
  const { control: passwordControl, handleSubmit: handlePasswordSubmit, formState: { errors: passwordErrors } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code' | 'newPassword' | 'success'>('email');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const codeInputRefs = useRef<(TextInput | null)[]>([]);

  // Shake animation
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

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Step 1: Send reset code
  const onSendCode = async (values: EmailFormData) => {
    clearError();
    try {
      setIsLoading(true);
      const res = await forgotPassword({ email: values.email });
      setPendingEmail(values.email);
      setStep('code');
      setResendTimer(60);
      applyDebugCode(res.debugCode);
    } catch (error: any) {
      triggerError(error?.message || t('auth.forgotPasswordError', 'Failed to send reset code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle code input
  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...verificationCode];
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, 6);
      for (let i = 0; i < 6; i++) newCode[i] = digits[i] || '';
      setVerificationCode(newCode);
      codeInputRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    newCode[index] = text;
    setVerificationCode(newCode);
    if (text && index < 5) codeInputRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify code
  const onVerifyCode = async () => {
    clearError();
    const code = verificationCode.join('');
    if (code.length < 6) {
      triggerError(t('auth.codeRequired', 'Please enter the full 6-digit code'));
      return;
    }
    try {
      setIsLoading(true);
      const res = await verifyResetCode({ email: pendingEmail, code });
      setResetToken(res.resetToken);
      setStep('newPassword');
    } catch (error: any) {
      triggerError(error?.message || 'Invalid reset code');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Set new password
  const onResetPassword = async (values: PasswordFormData) => {
    clearError();
    try {
      setIsLoading(true);
      await resetPassword({ resetToken, newPassword: values.newPassword });
      setStep('success');
    } catch (error: any) {
      triggerError(error?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend code
  const handleResend = async () => {
    if (resendTimer > 0) return;
    clearError();
    try {
      setIsLoading(true);
      const res = await forgotPassword({ email: pendingEmail });
      setResendTimer(60);
      setVerificationCode(['', '', '', '', '', '']);
      applyDebugCode(res.debugCode);
    } catch (error: any) {
      triggerError(error?.message || 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SakuraBackground 
        isDark={isDark} 
        variant="header" 
        showPetals={true}
        showMountain={false}
        showSun={false}
      />

      {/* Header */}
      <Animated.View 
        entering={FadeIn.delay(100)}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Pressable 
          style={[styles.backButton, { backgroundColor: colors.cardHover }]}
          onPress={() => router.back()}
        >
          <ChevronLeft size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text 
            fontSize={24} 
            fontWeight="600" 
            color={colors.text}
            letterSpacing={-0.3}
          >
            {t('auth.forgotPassword', 'Forgot Password?')}
          </Text>
        </View>
      </Animated.View>

      {/* Form */}
      <KeyboardAvoidingView 
        style={styles.formWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            entering={SlideInDown.delay(300).springify()}
            style={[styles.formCard, { 
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              ...shadows.small,
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

            {step === 'success' ? (
              /* ========== SUCCESS ========== */
              <Animated.View entering={FadeIn.duration(500)}>
                <View style={styles.successContainer}>
                  <View style={[styles.successIcon, { backgroundColor: colors.primary + '20' }]}>
                    <CheckCircle size={32} color={colors.primary} />
                  </View>
                  <Text fontSize={20} fontWeight="600" color={colors.text} textAlign="center" marginTop={20}>
                    {t('auth.passwordReset', 'Password Reset!')}
                  </Text>
                  <Text fontSize={14} color={colors.textMuted} textAlign="center" marginTop={12} lineHeight={22}>
                    {t('auth.passwordResetSuccess', 'Your password has been reset successfully. You can now sign in with your new password.')}
                  </Text>
                  <Pressable 
                    style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 28 }]}
                    onPress={() => router.replace('/login')}
                  >
                    <Text color={colors.textLight} fontWeight="600" fontSize={16}>
                      {t('auth.backToLogin', 'Back to Sign In')}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>

            ) : step === 'newPassword' ? (
              /* ========== NEW PASSWORD ========== */
              <Animated.View entering={FadeIn.duration(400)}>
                <View style={styles.formHeader}>
                  <Text fontSize={20} fontWeight="600" color={colors.text}>
                    {t('auth.newPassword', 'Set New Password')}
                  </Text>
                  <Text fontSize={13} color={colors.textMuted} marginTop={6} lineHeight={20}>
                    {t('auth.newPasswordDesc', 'Create a strong password for your account.')}
                  </Text>
                </View>

                <Controller control={passwordControl} name="newPassword"
                  render={({ field: { onChange, value } }) => (
                    <PasswordInput label={t('auth.newPassword', 'New Password')} placeholder="••••••••"
                      value={value} onChangeText={(v: string) => { onChange(v); clearError(); }}
                      error={passwordErrors.newPassword?.message} />
                  )} />

                <View style={{ marginTop: 16 }}>
                  <Controller control={passwordControl} name="confirmPassword"
                    render={({ field: { onChange, value } }) => (
                      <PasswordInput label={t('auth.confirmPassword', 'Confirm Password')} placeholder="••••••••"
                        value={value} onChangeText={(v: string) => { onChange(v); clearError(); }}
                        error={passwordErrors.confirmPassword?.message} />
                    )} />
                </View>

                <Pressable 
                  style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 28 }]}
                  onPress={handlePasswordSubmit(onResetPassword)}
                  disabled={isLoading}
                >
                  <Text color={colors.textLight} fontWeight="600" fontSize={16}>
                    {isLoading ? t('common.loading', 'Loading...') : t('auth.resetPassword', 'Reset Password')}
                  </Text>
                </Pressable>
              </Animated.View>

            ) : step === 'code' ? (
              /* ========== CODE VERIFICATION ========== */
              <Animated.View entering={FadeIn.duration(400)}>
                <View style={styles.formHeader}>
                  <View style={{ alignItems: 'center', marginBottom: 8 }}>
                    <View style={{
                      width: 56, height: 56, borderRadius: 28,
                      backgroundColor: '#D97706' + '20',
                      alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                    }}>
                      <ShieldCheck size={28} color="#D97706" />
                    </View>
                  </View>
                  <Text fontSize={20} fontWeight="600" color={colors.text} textAlign="center">
                    {t('auth.enterCode', 'Enter Reset Code')}
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
                        borderColor: digit ? '#D97706' : colors.glassBorder,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFBEB',
                        textAlign: 'center',
                        fontSize: 22,
                        fontWeight: '700',
                        color: colors.text,
                      }}
                      value={digit}
                      onChangeText={(text) => handleCodeChange(text, i)}
                      onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, i)}
                      keyboardType="number-pad"
                      maxLength={i === 0 ? 6 : 1}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <Pressable 
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={onVerifyCode}
                  disabled={isLoading}
                >
                  <Text color={colors.textLight} fontWeight="600" fontSize={16}>
                    {isLoading ? t('common.loading', 'Loading...') : t('auth.verifyCode', 'Verify Code')}
                  </Text>
                </Pressable>

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

                <View style={{ alignItems: 'center', marginTop: 16 }}>
                  <Pressable onPress={() => { setStep('email'); clearError(); }}>
                    <Text fontSize={13} color={colors.textSecondary}>
                      ← {t('auth.changeEmail', 'Change email')}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            ) : (
              /* ========== EMAIL FORM ========== */
              <>
                <View style={styles.formHeader}>
                  <Text fontSize={20} fontWeight="600" color={colors.text}>
                    {t('auth.resetPassword', 'Reset Password')}
                  </Text>
                  <Text fontSize={13} color={colors.textMuted} marginTop={6} lineHeight={20}>
                    {t('auth.resetPasswordDesc', 'Enter your email address and we\'ll send you a code to reset your password.')}
                  </Text>
                </View>

                <Animated.View entering={FadeInUp.delay(400)}>
                  <Controller control={emailControl} name="email"
                    render={({ field: { onChange, value } }) => (
                      <Input label={t('auth.email', 'Email')} placeholder={t('auth.emailPlaceholder', 'your@email.com')}
                        value={value} onChangeText={(v: string) => { onChange(v); clearError(); }}
                        keyboardType="email-address" autoCapitalize="none"
                        error={emailErrors.email?.message} />
                    )} />
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(500)} style={{ marginTop: 28 }}>
                  <Pressable 
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={handleEmailSubmit(onSendCode)}
                    disabled={isLoading}
                    android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                  >
                    <Text color={colors.textLight} fontWeight="600" fontSize={16}>
                      {isLoading ? t('common.loading', 'Loading...') : t('auth.sendResetCode', 'Send Reset Code')}
                    </Text>
                  </Pressable>
                </Animated.View>

                <Animated.View entering={FadeIn.delay(600)} style={styles.footerLink}>
                  <Text fontSize={13} color={colors.textSecondary}>
                    {t('auth.rememberPassword', 'Remember your password?')}{' '}
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
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 10,
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    paddingTop: 8,
    paddingLeft: 4,
  },
  formWrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  formCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  formHeader: {
    marginBottom: 28,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
  },
  footerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
  },
});
