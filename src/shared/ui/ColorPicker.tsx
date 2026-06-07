// src/shared/ui/ColorPicker.tsx
// Simple grid color picker + custom hex input
import React, { useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { YStack, XStack, Text, View } from 'tamagui';
import { Check, Palette } from '@tamagui/lucide-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const QUICK_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#78716C', '#0D9488', '#E91E63',
];

interface ColorPickerProps {
  selectedColor: string;
  onColorSelected: (color: string) => void;
  isDark: boolean;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onColorSelected,
  isDark,
}) => {
  const [hexInput, setHexInput] = useState(selectedColor);
  const [showHexInput, setShowHexInput] = useState(false);

  const bgCard = isDark ? '#1E293B' : '#FFFFFF';
  const borderCard = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? '#F8FAFC' : '#1A1A2E';
  const textMuted = isDark ? '#94A3B8' : '#9CA3AF';
  const inputBg = isDark ? '#0F172A' : '#F3F4F6';

  const handleHexSubmit = () => {
    const cleaned = hexInput.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      onColorSelected(cleaned);
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(50).springify()}>
      <YStack
        gap="$3"
        p="$4"
        br={20}
        style={{ backgroundColor: bgCard, borderWidth: 1, borderColor: borderCard }}
      >
        {/* Title */}
        <XStack ai="center" gap="$2">
          <View w={36} h={36} br={10} ai="center" jc="center"
            style={{ backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)' }}>
            <Palette size={18} color="#8B5CF6" />
          </View>
          <YStack>
            <Text fontSize={15} fontWeight="600" style={{ color: textColor }}>
              Custom Color
            </Text>
            <Text fontSize={12} style={{ color: textMuted }}>
              Pick or type a color
            </Text>
          </YStack>
        </XStack>

        {/* Color Grid */}
        <XStack flexWrap="wrap" gap={8} jc="flex-start">
          {QUICK_COLORS.map((color) => {
            const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
            return (
              <Pressable key={color} onPress={() => onColorSelected(color)}>
                <View
                  w={40} h={40}
                  br={12}
                  ai="center" jc="center"
                  style={{
                    backgroundColor: color,
                    borderWidth: isSelected ? 3 : 1,
                    borderColor: isSelected ? (isDark ? '#FFF' : '#000') : 'rgba(0,0,0,0.1)',
                    transform: [{ scale: isSelected ? 1.1 : 1 }],
                  }}
                >
                  {isSelected && <Check size={18} color="#FFF" strokeWidth={3} />}
                </View>
              </Pressable>
            );
          })}
        </XStack>

        {/* Hex Input Toggle */}
        <Pressable onPress={() => setShowHexInput(!showHexInput)}>
          <XStack ai="center" gap="$2" py="$1">
            <Text fontSize={13} fontWeight="500" style={{ color: '#8B5CF6' }}>
              {showHexInput ? 'Hide hex input' : 'Enter hex color'}
            </Text>
          </XStack>
        </Pressable>

        {showHexInput && (
          <Animated.View entering={FadeIn.duration(200)}>
            <XStack gap="$2" ai="center">
              <TextInput
                value={hexInput}
                onChangeText={setHexInput}
                placeholder="#FF5733"
                placeholderTextColor={textMuted}
                autoCapitalize="characters"
                maxLength={7}
                style={{
                  flex: 1,
                  height: 44,
                  backgroundColor: inputBg,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  fontSize: 15,
                  fontWeight: '600',
                  color: textColor,
                  borderWidth: 1,
                  borderColor: borderCard,
                }}
                onSubmitEditing={handleHexSubmit}
              />
              {/* Preview swatch */}
              <View
                w={44} h={44}
                br={12}
                style={{
                  backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexInput.trim()) ? hexInput.trim() : '#CCC',
                  borderWidth: 1,
                  borderColor: borderCard,
                }}
              />
              <Pressable onPress={handleHexSubmit}>
                <View
                  w={44} h={44} br={12}
                  ai="center" jc="center"
                  style={{ backgroundColor: '#8B5CF6' }}
                >
                  <Check size={20} color="#FFF" />
                </View>
              </Pressable>
            </XStack>
          </Animated.View>
        )}

        {/* Current Color Display */}
        <XStack ai="center" gap="$3" p="$3" br={14}
          style={{ backgroundColor: inputBg }}>
          <View w={32} h={32} br={16}
            style={{ backgroundColor: selectedColor, borderWidth: 1, borderColor: borderCard }} />
          <Text fontSize={14} fontWeight="600" style={{ color: textColor }}>
            Current: {selectedColor.toUpperCase()}
          </Text>
        </XStack>
      </YStack>
    </Animated.View>
  );
};
