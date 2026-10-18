import { Stack } from 'expo-router';
import AppProviders from '../src/application/providers/AppProviders';
import { useAppStore } from '@/shared/lib/stores/app-store';

export default function RootLayout() {
  const theme = useAppStore((s) => s.theme);
  // Paint every screen's container in the theme colour so a fade between
  // screens never shows the default white card behind them.
  const backgroundColor = theme === 'dark' ? '#0A0F1E' : '#FFFFFF';

  return (
    <AppProviders>
      <Stack screenOptions={{ animation: 'fade', animationDuration: 300, contentStyle: { backgroundColor } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="tabs" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="splitter-dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="receipt-confirmation" options={{ headerShown: false }} />
      </Stack>
    </AppProviders>
  );
}
