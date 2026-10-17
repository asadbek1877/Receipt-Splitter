import React, { useState } from 'react';
import { useRouter, Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Lock, Mail, UserPlus } from '@tamagui/lucide-icons';

import { login, LoginRequest, getCurrentUser } from '../api';
import { saveToken } from '@/shared/lib/utils/token-storage';
import { useAppStore } from '@/shared/lib/stores/app-store';
import {
  AuthScreen,
  ErrorBanner,
  Field,
  FooterLink,
  OrDivider,
  PasswordToggle,
  PrimaryButton,
  SocialRow,
  authStyles as styles,
  useAuthError,
  useAuthTheme,
} from './AuthKit';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function LoginForm() {
  const { t } = useTranslation();
  return (
    <AuthScreen
      variant="login"
      eyebrow={t('auth.welcomeTo', 'Welcome to')}
      backFallback="/onboarding"
      subtitle={t('auth.enterCredentials', 'Enter your credentials to continue')}
    >
      <LoginBody />
    </AuthScreen>
  );
}

function LoginBody() {
  const { t } = useTranslation();
  const { p } = useAuthTheme();
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const setAuth = useAppStore((s) => s.setAuth);
  const router = useRouter();
  const error = useAuthError();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (values: LoginRequest) => {
    error.clear();
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

      await setAuth(res.token, profile);
      router.replace('/tabs');
    } catch (e: any) {
      error.show(e?.message || t('auth.loginError', 'An error occurred during login'));
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
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Field
              p={p}
              icon={<Lock size={19} color={p.icon} />}
              value={value}
              placeholder={t('auth.password', 'Password')}
              onChangeText={(v) => { onChange(v); error.clear(); }}
              secure={!showPassword}
              error={errors.password?.message}
              right={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
            />
          )}
        />
      </View>

      <View style={styles.forgot}>
        <Link href="/forgot-password" asChild>
          <Pressable hitSlop={8}>
            <Text style={[styles.forgotText, { color: p.link }]}>
              {t('auth.forgotPassword', 'Forgot Password?')}
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton
          p={p}
          loading={isLoading}
          label={isLoading ? t('common.loading', 'Loading...') : t('auth.signIn', 'Sign In')}
          onPress={handleSubmit(onSubmit)}
        />
      </View>

      <OrDivider />
      <SocialRow />

      <FooterLink
        href="/register"
        icon={UserPlus}
        text={t('auth.noAccount', "Don't have an account?")}
        linkText={t('auth.signUp', 'Sign Up')}
      />
    </>
  );
}
