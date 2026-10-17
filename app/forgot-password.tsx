import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Lock, LogIn, Mail } from '@tamagui/lucide-icons';

import { forgotPassword, verifyResetCode, resetPassword } from '@/features/auth/api';
import {
  AuthScreen,
  ErrorBanner,
  Field,
  FooterLink,
  GlassLayers,
  PasswordToggle,
  PrimaryButton,
  authStyles,
  useAuthError,
  useAuthTheme,
  useCrossfade,
} from '@/features/auth/ui/AuthKit';

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
type Step = 'email' | 'code' | 'newPassword' | 'success';

const EMPTY_CODE = ['', '', '', '', '', ''];

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fade = useCrossfade();
  const [step, setStep] = useState<Step>('email');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  const goTo = (next: Step) => fade.run(() => setStep(next));
  const toLogin = () => router.replace('/login');

  const copy: Record<Step, { title: string; subtitle: string }> = {
    email: {
      title: t('auth.resetPassword', 'Reset Password'),
      subtitle: t('auth.resetPasswordDesc', "Enter your email address and we'll send you a code to reset your password."),
    },
    code: {
      title: t('auth.enterCode', 'Enter Reset Code'),
      subtitle: `${t('auth.codeSentTo', 'We sent a 6-digit code to')} ${pendingEmail}`,
    },
    newPassword: {
      title: t('auth.newPassword', 'Set New Password'),
      subtitle: t('auth.newPasswordDesc', 'Create a strong password for your account.'),
    },
    success: {
      title: t('auth.passwordReset', 'Password Reset!'),
      subtitle: t(
        'auth.passwordResetSuccess',
        'Your password has been reset successfully. You can now sign in with your new password.',
      ),
    },
  };

  // Back steps through the flow first, then leaves the screen.
  const onBack =
    step === 'code' ? () => goTo('email') : step === 'newPassword' ? () => goTo('code') : undefined;

  return (
    <AuthScreen
      variant="forgot"
      eyebrow={t('auth.forgotPassword', 'Forgot Password?')}
      title={copy[step].title}
      subtitle={copy[step].subtitle}
      backFallback="/login"
      onBack={onBack}
      contentStyle={fade.style}
    >
      {step === 'email' && (
        <EmailStep
          onSent={(email) => {
            setPendingEmail(email);
            goTo('code');
          }}
          onLogin={toLogin}
        />
      )}
      {step === 'code' && (
        <CodeStep
          email={pendingEmail}
          onVerified={(token) => {
            setResetToken(token);
            goTo('newPassword');
          }}
          onChangeEmail={() => goTo('email')}
        />
      )}
      {step === 'newPassword' && <NewPasswordStep resetToken={resetToken} onDone={() => goTo('success')} />}
      {step === 'success' && <SuccessStep onLogin={toLogin} />}
    </AuthScreen>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — email
// ---------------------------------------------------------------------------
function EmailStep({ onSent, onLogin }: { onSent: (email: string) => void; onLogin: () => void }) {
  const { t } = useTranslation();
  const { p } = useAuthTheme();
  const error = useAuthError();
  const [isLoading, setIsLoading] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: EmailFormData) => {
    error.clear();
    try {
      setIsLoading(true);
      await forgotPassword({ email: values.email });
      onSent(values.email);
    } catch (e: any) {
      error.show(e?.message || t('auth.forgotPasswordError', 'Failed to send reset code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ErrorBanner error={error} />
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <Field
            p={p}
            icon={<Mail size={19} color={p.icon} />}
            value={value}
            placeholder={t('auth.emailPlaceholder', 'Enter your email')}
            onChangeText={(v) => { onChange(v); error.clear(); }}
            keyboardType="email-address"
            error={errors.email?.message}
          />
        )}
      />
      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          p={p}
          loading={isLoading}
          label={isLoading ? t('common.loading', 'Loading...') : t('auth.sendResetCode', 'Send Reset Code')}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
      <FooterLink
        onPress={onLogin}
        icon={LogIn}
        text={t('auth.rememberPassword', 'Remember your password?')}
        linkText={t('auth.signIn', 'Sign In')}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — 6-digit code in glass cells
// ---------------------------------------------------------------------------
function CodeStep({
  email,
  onVerified,
  onChangeEmail,
}: {
  email: string;
  onVerified: (resetToken: string) => void;
  onChangeEmail: () => void;
}) {
  const { t } = useTranslation();
  const { p } = useAuthTheme();
  const error = useAuthError();
  const { width } = useWindowDimensions();
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState(EMPTY_CODE);
  const [focused, setFocused] = useState(0);
  const [resendTimer, setResendTimer] = useState(60);
  const refs = useRef<(TextInput | null)[]>([]);

  const cellGap = 8;
  const cellWidth = Math.min(52, (Math.min(width, 480) - 48 - cellGap * 5) / 6);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const onChange = (text: string, index: number) => {
    error.clear();
    const next = [...code];
    if (text.length > 1) {
      // pasted the whole code
      const digits = text.replace(/\D/g, '').slice(0, 6);
      for (let i = 0; i < 6; i++) next[i] = digits[i] || '';
      setCode(next);
      refs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    next[index] = text.replace(/\D/g, '');
    setCode(next);
    if (next[index] && index < 5) refs.current[index + 1]?.focus();
  };

  const onKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) refs.current[index - 1]?.focus();
  };

  const onVerify = async () => {
    error.clear();
    const joined = code.join('');
    if (joined.length < 6) {
      error.show(t('auth.codeRequired', 'Please enter the full 6-digit code'));
      return;
    }
    try {
      setIsLoading(true);
      const res = await verifyResetCode({ email, code: joined });
      onVerified(res.resetToken);
    } catch (e: any) {
      error.show(e?.message || 'Invalid reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const onResend = async () => {
    if (resendTimer > 0) return;
    error.clear();
    try {
      setIsLoading(true);
      await forgotPassword({ email });
      setResendTimer(60);
      setCode(EMPTY_CODE);
      refs.current[0]?.focus();
    } catch (e: any) {
      error.show(e?.message || 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ErrorBanner error={error} />
      <View style={[styles.codeRow, { gap: cellGap }]}>
        {code.map((digit, i) => (
          <Pressable
            key={i}
            onPress={() => refs.current[i]?.focus()}
            style={StyleSheet.flatten([
              styles.codeCell,
              authStyles.glass,
              { width: cellWidth, borderColor: focused === i || digit ? p.inputFocus : p.inputBorder },
            ])}
          >
            <GlassLayers p={p} fill={p.inputBg} />
            <TextInput
              ref={(r) => { refs.current[i] = r; }}
              value={digit}
              onChangeText={(text) => onChange(text, i)}
              onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key, i)}
              onFocus={() => setFocused(i)}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={i === 0 ? 6 : 1}
              selectTextOnFocus
              selectionColor={p.inputFocus}
              cursorColor={p.inputFocus}
              underlineColorAndroid="transparent"
              style={[styles.codeInput, { color: p.text }]}
            />
          </Pressable>
        ))}
      </View>

      <PrimaryButton
        p={p}
        loading={isLoading}
        label={isLoading ? t('common.loading', 'Loading...') : t('auth.verifyCode', 'Verify Code')}
        onPress={onVerify}
      />

      <View style={styles.links}>
        {resendTimer > 0 ? (
          <Text style={[styles.linkMuted, { color: p.muted }]}>
            {t('auth.resendIn', 'Resend code in')} {resendTimer}s
          </Text>
        ) : (
          <Pressable onPress={onResend} disabled={isLoading} hitSlop={8}>
            <Text style={[styles.link, { color: p.link }]}>{t('auth.resendCode', 'Resend code')}</Text>
          </Pressable>
        )}
        <Pressable onPress={onChangeEmail} hitSlop={8}>
          <Text style={[styles.linkMuted, { color: p.muted }]}>← {t('auth.changeEmail', 'Change email')}</Text>
        </Pressable>
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — new password
// ---------------------------------------------------------------------------
function NewPasswordStep({ resetToken, onDone }: { resetToken: string; onDone: () => void }) {
  const { t } = useTranslation();
  const { p } = useAuthTheme();
  const error = useAuthError();
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: PasswordFormData) => {
    error.clear();
    try {
      setIsLoading(true);
      await resetPassword({ resetToken, newPassword: values.newPassword });
      onDone();
    } catch (e: any) {
      error.show(e?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ErrorBanner error={error} />
      <View style={{ gap: 14 }}>
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onChange, value } }) => (
            <Field
              p={p}
              icon={<Lock size={19} color={p.icon} />}
              value={value}
              placeholder={t('auth.newPassword', 'New Password')}
              onChangeText={(v) => { onChange(v); error.clear(); }}
              secure={!show}
              error={errors.newPassword?.message}
              right={<PasswordToggle visible={show} onToggle={() => setShow((s) => !s)} />}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, value } }) => (
            <Field
              p={p}
              icon={<Lock size={19} color={p.icon} />}
              value={value}
              placeholder={t('auth.confirmPassword', 'Confirm Password')}
              onChangeText={(v) => { onChange(v); error.clear(); }}
              secure={!show}
              error={errors.confirmPassword?.message}
            />
          )}
        />
      </View>
      <View style={{ marginTop: 22 }}>
        <PrimaryButton
          p={p}
          loading={isLoading}
          label={isLoading ? t('common.loading', 'Loading...') : t('auth.resetPassword', 'Reset Password')}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — success
// ---------------------------------------------------------------------------
function SuccessStep({ onLogin }: { onLogin: () => void }) {
  const { t } = useTranslation();
  const { p } = useAuthTheme();
  return (
    <>
      <View style={StyleSheet.flatten([styles.successCard, authStyles.glass, { borderColor: p.inputBorder }])}>
        <GlassLayers p={p} fill={p.footerBg} radius={18} />
        <CheckCircle size={40} color={p.footerIcon} />
      </View>
      <PrimaryButton p={p} loading={false} label={t('auth.backToLogin', 'Back to Sign In')} onPress={onLogin} />
    </>
  );
}

const styles = StyleSheet.create({
  codeRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 22 },
  codeCell: {
    height: 58,
    borderRadius: 14,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 0,
  },
  links: { alignItems: 'center', gap: 14, marginTop: 20 },
  link: { fontSize: 13, fontWeight: '600' },
  linkMuted: { fontSize: 13 },
  successCard: {
    height: 96,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
});
