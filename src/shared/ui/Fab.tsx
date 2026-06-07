// src/shared/ui/Fab.tsx
import { Button } from 'tamagui';
import { Plus } from '@tamagui/lucide-icons';
import { useThemeColors } from '@/shared/lib/stores/theme-store';

type Props = { onPress: () => void };

export default function Fab({ onPress }: Props) {
  const colors = useThemeColors();

  return (
    <Button
      onPress={onPress}
      w={60}
      h={60}
      borderRadius={30}
      backgroundColor={colors.primary}
      pressStyle={{ opacity: 0.85, scale: 0.95 }}
      icon={<Plus size={28} color="white" />}
      position="absolute"
      bottom={24}
      right={20}
      elevationAndroid={8}
      elevation={8}
      shadowColor={colors.primary}
      shadowOpacity={0.5}
      shadowRadius={16}
      shadowOffset={{ width: 0, height: 8 }}
      aria-label="Add"
      borderWidth={2}
      borderColor="rgba(255,255,255,0.3)"
    />
  );
}