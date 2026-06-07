// src/shared/ui/Card.tsx
import React from 'react'
import { YStack } from 'tamagui'
import { borderRadius, shadows } from './JapaneseTheme'
import { useThemeColors } from '@/shared/lib/stores/theme-store'

interface CardProps {
  children: React.ReactNode
  padding?: string | number
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 16
}) => {
  const colors = useThemeColors()

  return (
    <YStack
      backgroundColor={colors.card}
      borderRadius={borderRadius.md}
      borderWidth={1}
      borderColor={colors.cardBorder}
      padding={padding}
      {...shadows.small}
    >
      {children}
    </YStack>
  )
}
