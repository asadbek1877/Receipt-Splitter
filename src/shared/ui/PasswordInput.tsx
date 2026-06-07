import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, useTheme } from 'tamagui';
import { Eye, EyeOff } from '@tamagui/lucide-icons';
import { Input } from '@/shared/ui/Input';
import { useThemeColors } from '@/shared/lib/stores/theme-store';

type Props = {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  error?: string;
  required?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  textInputProps?: any;
};

export default function PasswordInput({
  label,
  placeholder = 'Enter your password',
  value,
  onChangeText,
  error,
  required,
  autoCapitalize = 'none',
  textInputProps,
}: Props) {
  const [show, setShow] = useState(false);
  const colors = useThemeColors();

  const eye = (
    <Pressable
      onPress={() => setShow(s => !s)}
      hitSlop={6}
      android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel={show ? 'Hide password' : 'Show password'}
    >
      {show ? (
        <EyeOff size={18} color={colors.textMuted} /> 
      ) : (
        <Eye size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );

  return (
    <XStack w="100%">
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        autoCapitalize={autoCapitalize}
        error={error}
        required={required}
        rightAdornment={eye}
        textInputProps={{
          autoComplete: 'off',
          textContentType: 'none',
          importantForAutofill: 'no',
          ...textInputProps,
        }}
      />
    </XStack>
  );
}
