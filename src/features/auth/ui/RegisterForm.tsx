import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Lock, LogIn, Mail, User } from '@tamagui/lucide-icons';

import { register, RegisterRequest, getCurrentUser } from '../api';
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
  useAuthError,
  useAuthTheme,
} from './AuthKit';

const schema = z.object({
  username: z.string()
    .min(2, 'Username must be at least 2 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore and hyphen'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterForm() {
  const { t } = useTranslation();
  return (
    <AuthScreen
      variant="register"
      eyebrow={t('auth.joinUs', 'Join us')}
      title={t('auth.newAccount', 'New account')}
      backFallback="/login"
      subtitle={t('auth.fillDetails', 'Fill in your details to get started')}
    >
      <RegisterBody />
    </AuthScreen>
  );
}

function RegisterBody() {
  const { t } = useTranslation();
  const { p } = useAuthTheme();
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', email: '', password: '' },
  });
  const setAuth = useAppStore((s) => s.setAuth);
  const router = useRouter();
  const error = useAuthError();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Registers directly (no email verification step).
  const onSubmit = async (values: RegisterRequest) => {
    error.clear();
    try {
      setIsLoading(true);
      const res = await register(values);
      if (res.token) {
        await saveToken(res.token);

        let profile = res.user;
        try {
          profile = await getCurrentUser(res.token);
        } catch (fetchError) {
          console.warn('Registration profile refresh failed, using inline user:', fetchError);
        }

        await setAuth(res.token, profile);
        router.replace('/tabs');
      }
    } catch (e: any) {
      error.show(e?.message || t('auth.registerError', 'An error occurred during registration'));
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
          name="username"
          render={({ field: { onChange, value } }) => (
            <Field
              p={p}
              icon={<User size={19} color={p.icon} />}
              value={value}
              placeholder={t('auth.usernamePlaceholder', 'Enter your username')}
              onChangeText={(v) => { onChange(v); error.clear(); }}
              error={errors.username?.message}
            />
          )}
        />
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

      <View style={{ marginTop: 22 }}>
        <PrimaryButton
          p={p}
          loading={isLoading}
          label={isLoading ? t('common.loading', 'Loading...') : t('auth.createAccount', 'Create Account')}
          onPress={handleSubmit(onSubmit)}
        />
      </View>

      <OrDivider />
      <SocialRow />

      <FooterLink
        href="/login"
        icon={LogIn}
        text={t('auth.haveAccount', 'Already have an account?')}
        linkText={t('auth.signIn', 'Sign In')}
      />
    </>
  );
}
