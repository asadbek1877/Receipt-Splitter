// src/application/providers/TamaguiProvider.tsx
import React from 'react'
import { TamaguiProvider as Provider } from '@tamagui/core'
import { PortalProvider } from '@tamagui/portal'
import { useFonts } from 'expo-font'
import { useColorScheme } from 'react-native'
import config from '../../../tamagui.config'
import { useAppStore } from '@/shared/lib/stores/app-store'

interface TamaguiProviderProps {
  children: React.ReactNode
}

export const TamaguiProvider: React.FC<TamaguiProviderProps> = ({ children }) => {
  const [fontsLoaded] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  })
  
  // Get theme from store
  const theme = useAppStore((state) => state.theme)
  
  // Use the theme from store ('light' or 'dark')
  const tamaguiTheme = theme === 'dark' ? 'dark' : 'light'

  if (!fontsLoaded) {
    return null
  }

  return (
    <Provider config={config} defaultTheme={tamaguiTheme}>
      <PortalProvider>
        {children}
      </PortalProvider>
    </Provider>
  )
}