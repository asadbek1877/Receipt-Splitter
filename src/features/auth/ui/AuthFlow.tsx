import React, { useEffect, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthScreen, type AuthVariant } from './AuthKit';
import { ForgotBody, useForgotFlow } from './ForgotPasswordForm';
import { LoginBody } from './LoginForm';
import { RegisterBody } from './RegisterForm';

/**
 * Login, registration and password reset live in ONE screen.
 *
 * Every form is mounted once and stays mounted; switching just cross-fades
 * opacity on the UI thread (see AuthScreen). Nothing is navigated, created or
 * laid out mid-transition, so there is no flash and no dropped frame.
 */
export default function AuthFlow({ initial }: { initial: AuthVariant }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<AuthVariant>(initial);
  const forgot = useForgotFlow();

  const show = (next: AuthVariant) => {
    Keyboard.dismiss();
    if (next === 'forgot') forgot.reset();
    setMode(next);
  };

  // There is no welcome screen: when logged out, login is the first screen of the app.
  const canLeave = router.canGoBack();
  const leave = () => router.back();

  /** Back: forgot steps first, then to the form the screen opened with, then out. */
  const goBack = () => {
    if (mode === 'forgot' && forgot.back()) return true;
    if (mode !== initial) {
      show(initial === 'forgot' ? 'login' : initial);
      return true;
    }
    return false;
  };

  const canStepBack = mode !== initial || (mode === 'forgot' && forgot.step !== 'email');
  const onBackButton = canStepBack || canLeave ? () => { if (!goBack()) leave(); } : undefined;

  // Android hardware back follows the same rules while there is somewhere to go in-screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  });

  return (
    <AuthScreen
      active={mode}
      onBack={onBackButton}
      layers={[
        {
          variant: 'login',
          eyebrow: t('auth.welcomeTo', 'Welcome to'),
          subtitle: t('auth.enterCredentials', 'Enter your credentials to continue'),
          body: <LoginBody onSwitch={() => show('register')} onForgot={() => show('forgot')} />,
        },
        {
          variant: 'register',
          eyebrow: t('auth.joinUs', 'Join us'),
          title: t('auth.newAccount', 'New account'),
          subtitle: t('auth.fillDetails', 'Fill in your details to get started'),
          body: <RegisterBody onSwitch={() => show('login')} />,
        },
        {
          variant: 'forgot',
          eyebrow: t('auth.forgotPassword', 'Forgot Password?'),
          title: forgot.copy.title,
          subtitle: forgot.copy.subtitle,
          body: <ForgotBody flow={forgot} onLogin={() => show('login')} />,
          innerStyle: forgot.style,
        },
      ]}
    />
  );
}
