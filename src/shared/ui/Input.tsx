import React, { ReactNode } from 'react';
import { TextInputProps } from 'react-native';
import { YStack, XStack, Text, Input as TInput, useTheme } from 'tamagui';
import { useThemeColors } from '@/shared/lib/stores/theme-store';
import { borderRadius } from './JapaneseTheme';

export type CustomInputProps = {
  label?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  secureTextEntry?: boolean;
  error?: string;
  required?: boolean;

  /** Иконка/кнопка справа (например, «глаз»). */
  rightAdornment?: ReactNode;

  /** Любые нативные пропсы TextInput (returnKeyType, autoComplete и т.п.). */
  textInputProps?: Partial<TextInputProps>;
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  error,
  required,
  rightAdornment,
  textInputProps,
}: CustomInputProps) {
  const colors = useThemeColors();
  
  return (
    <YStack space="$2" w="100%">
      {!!label && (
        <Text fontSize="$3" fontWeight="500" color={colors.textSecondary}>
          {label}
          {required && <Text color={colors.error}> *</Text>}
        </Text>
      )}

      <XStack position="relative" w="100%">
        <TInput
          w="100%"
          f={1}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          paddingRight={rightAdornment ? 44 : undefined}
          borderRadius={borderRadius.md}
          borderWidth={1}
          borderColor={error ? colors.error : colors.cardBorder}
          backgroundColor={colors.card}
          color={colors.text}
          height={48}
          fontSize="$4"
          paddingHorizontal={16}
          focusStyle={{ 
            borderColor: error ? colors.error : colors.primary,
            borderWidth: 1.5,
          }}
          {...textInputProps}
        />

        {rightAdornment && (
          <XStack
            position="absolute"
            right={8}
            top={0}
            bottom={0}
            ai="center"
            jc="center"
            pointerEvents="box-none"
          >
            {rightAdornment}
          </XStack>
        )}
      </XStack>

      {!!error && (
        <Text fontSize="$3" color={colors.error} fontWeight="500">
          {error}
        </Text>
      )}
    </YStack>
  );
}

export default Input;
