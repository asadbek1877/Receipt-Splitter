import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { getJapaneseColors } from './JapaneseTheme';

export default function ScreenFormContainer({ children }: { children: ReactNode }) {
  const appTheme = useAppStore((s) => s.theme);
  const isDark = appTheme === 'dark';
  const colors = getJapaneseColors(isDark);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ 
            paddingHorizontal: 20, 
            paddingVertical: 24, 
            paddingBottom: 32,
            flexGrow: 1, 
            justifyContent: 'center' 
          }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
