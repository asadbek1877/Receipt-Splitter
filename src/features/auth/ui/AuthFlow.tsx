import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthScreen, useCrossfade, type AuthVariant } from './AuthKit';
import { LoginBody } from './LoginForm';
import { RegisterBody } from './RegisterForm';

/**
 * Login and registration live in ONE screen and switch in place.
 * Navigating between two routes re-mounted the whole screen (white flash,
 * dropped frames); here the background stays and only the content cross-fades.
 */
export default function AuthFlow({ initial }: { initial: AuthVariant }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthVariant>(initial);
  const fade = useCrossfade();

  // Android back from the "other" form returns to the one the screen opened with.
  useEffect(() => {
    if (mode === initial) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      fade.run(() => setMode(initial));
      return true;
    });
    return () => sub.remove();
  }, [mode, initial]);

  const toLogin = () => fade.run(() => setMode('login'));
  const toRegister = () => fade.run(() => setMode('register'));

  if (mode === 'login') {
    return (
      <AuthScreen
        variant="login"
        eyebrow={t('auth.welcomeTo', 'Welcome to')}
        subtitle={t('auth.enterCredentials', 'Enter your credentials to continue')}
        backFallback="/onboarding"
        onBack={initial === 'register' ? toRegister : undefined}
        contentStyle={fade.style}
      >
        <LoginBody onSwitch={toRegister} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      variant="register"
      eyebrow={t('auth.joinUs', 'Join us')}
      title={t('auth.newAccount', 'New account')}
      subtitle={t('auth.fillDetails', 'Fill in your details to get started')}
      backFallback="/login"
      onBack={initial === 'login' ? toLogin : undefined}
      contentStyle={fade.style}
    >
      <RegisterBody onSwitch={toLogin} />
    </AuthScreen>
  );
}
