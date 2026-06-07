import React from 'react'
import { Button as TamaguiButton, Text } from 'tamagui'
import { StyleProp, ViewStyle } from 'react-native'
import { borderRadius, shadows } from './JapaneseTheme'
import { useThemeColors } from '@/shared/lib/stores/theme-store'

interface CustomButtonProps {
  title: string
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export const Button: React.FC<CustomButtonProps> = ({ 
  title, 
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onPress,
  style,
}) => {
  const colors = useThemeColors()

  const getStyles = () => {
    const baseStyles = {
      borderRadius: borderRadius.md,
      pressStyle: { scale: 0.98, opacity: 0.85 },
    }

    const sizeStyles = {
      small: { height: 36, paddingHorizontal: 16 },
      medium: { height: 48, paddingHorizontal: 24 },
      large: { height: 56, paddingHorizontal: 32 },
    }

    const variantStyles = {
      primary: {
        backgroundColor: disabled ? colors.textMuted : colors.primary,
        color: '#FFFFFF',
        ...shadows.small,
      },
      secondary: {
        backgroundColor: colors.cardHover,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadows.small,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: disabled ? colors.textMuted : colors.primary,
        color: disabled ? colors.textMuted : colors.primary,
      }
    }

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
    }
  }

  const styles = getStyles()

  return (
    <TamaguiButton
      {...styles}
      disabled={disabled}
      onPress={onPress}
      style={style}
    >
      <Text 
        color={styles.color}
        fontWeight="500"
        fontSize="$4"
      >
        {title}
      </Text>
    </TamaguiButton>
  )
}