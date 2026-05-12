// src/shared/ui/ScreenContainer.tsx
import React from 'react'
import { YStack } from 'tamagui'
import { useThemeColors } from '@/shared/lib/stores/theme-store'

interface ScreenContainerProps {
  children: React.ReactNode
  noPadding?: boolean
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  noPadding = false,
}) => {
  const colors = useThemeColors()

  return (
    <YStack
      flex={1}
      backgroundColor={colors.background}
      paddingHorizontal={noPadding ? 0 : 16}
      paddingTop={noPadding ? 0 : 16}
      paddingBottom={12}
    >
      {children}
    </YStack>
  )
}