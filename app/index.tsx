// app/index.tsx - Entry point: redirects to tabs or onboarding
import React from 'react';
import { Redirect } from 'expo-router';

import { useAppStore } from '@/shared/lib/stores/app-store';

export default function Welcome() {
  const token = useAppStore((state) => state.token);

  // If logged in, redirect to tabs
  if (token) return <Redirect href="/tabs" />;

  // Logged out: go directly to login
  return <Redirect href="/login" />;
}
