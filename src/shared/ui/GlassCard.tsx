// src/shared/ui/GlassCard.tsx
// Liquid Glass Card Component with Japanese styling

import React from 'react';
import { StyleSheet, Pressable, ViewStyle } from 'react-native';
import { View, Text } from 'tamagui';
import Animated, { 
  FadeInDown, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { borderRadius, shadows } from './JapaneseTheme';
import { useThemeColors } from '@/shared/lib/stores/theme-store';

interface GlassCardProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  delay?: number;
  size?: 'small' | 'normal' | 'wide' | 'full';
  variant?: 'default' | 'elevated' | 'flat';
  isDark?: boolean;
  style?: ViewStyle;
  glassIntensity?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  onPress,
  delay = 0,
  size = 'normal',
  variant = 'default',
  isDark = false,
  style,
  glassIntensity = 60,
}) => {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 150 }) }],
      opacity: interpolate(pressed.value, [0, 1], [1, 0.9]),
    };
  });

  const handlePressIn = () => {
    scale.value = 0.96;
    pressed.value = 1;
  };

  const handlePressOut = () => {
    scale.value = 1;
    pressed.value = 0;
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'small':
        return { width: '30%', minWidth: 100, minHeight: 100 };
      case 'normal':
        return { width: '45%', minWidth: 150, minHeight: 130 };
      case 'wide':
        return { width: '95%', minHeight: 100 };
      case 'full':
        return { width: '100%', minHeight: 120 };
      default:
        return { width: '45%', minWidth: 150, minHeight: 130 };
    }
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          ...shadows.large,
          shadowColor: colors.shadow,
        };
      case 'flat':
        return {
          shadowOpacity: 0,
          elevation: 0,
        };
      default:
        return {
          ...shadows.medium,
          shadowColor: colors.shadow,
        };
    }
  };

  const cardContent = (
    <>
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
          <View style={[styles.iconInner, { backgroundColor: colors.iconBgStrong }]}>
            {icon}
          </View>
        </View>
      )}
      {title && (
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
      )}
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      )}
      {children}
    </>
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      style={[getSizeStyle(), style]}
    >
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        style={[{ flex: 1 }, animatedStyle]}
      >
        <View
          style={[
            styles.card,
            getVariantStyle(),
            {
              backgroundColor: colors.card,
              borderColor: colors.glassBorder,
            },
          ]}
        >
          {cardContent}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default GlassCard;
