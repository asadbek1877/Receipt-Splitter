// app/tabs/settings.tsx — Settings with full theme customization
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, Pressable } from 'react-native';
import { YStack, Text, XStack, View, Spinner } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Moon, Sun, Globe, DollarSign, Lock, User as UserIcon,
  RefreshCcw, Wifi, ChevronRight, Wallet, Palette, Paintbrush,
  ChevronDown, ChevronUp,
} from '@tamagui/lucide-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '@/shared/ui/Button';
import { ScreenContainer } from '@/shared/ui/ScreenContainer';
import Input from '@/shared/ui/Input';
import PasswordInput from '@/shared/ui/PasswordInput';
import { ColorPicker } from '@/shared/ui/ColorPicker';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { useCurrencyStore, formatLastUpdated } from '@/shared/lib/stores/currency-store';
import {
  useThemeStore,
  useThemeColors,
  COLOR_PRESETS,
} from '@/shared/lib/stores/theme-store';
import { changePassword, updateUsername } from '@/features/auth/api';
import { LANGUAGE_OPTIONS, type LanguageCode } from '@/shared/config/languages';
import { CURRENCIES, getCurrency } from '@/shared/config/currencies';

// Helper
function hexToRgbStr(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  } catch {
    return '100,100,100';
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, setUser, language, setLanguage, theme, setTheme, currency, setCurrency } = useAppStore();
  const { t } = useTranslation();
  const isLoggedIn = !!user;
  const isDark = theme === 'dark';
  const themeColors = useThemeColors();

  // Theme store
  const { presetId, customPrimaryColor, setPreset, setCustomPrimaryColor } = useThemeStore();

  // Derived settings-specific colors
  const colors = {
    bg: isDark ? '#0D0D0D' : '#F5F5F5',
    card: isDark ? '#1A1A1A' : '#FFFFFF',
    cardBorder: isDark ? '#2A2A2A' : '#EBEBEB',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    textSecondary: isDark ? '#8A8A8A' : '#6B6B6B',
    textMuted: isDark ? '#555555' : '#999999',
    accent: themeColors.primary,
    accentLight: isDark ? `rgba(${hexToRgbStr(themeColors.primary)},0.15)` : `rgba(${hexToRgbStr(themeColors.primary)},0.08)`,
    purple: isDark ? '#A78BFA' : '#7C3AED',
    purpleLight: isDark ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.08)',
    pink: isDark ? '#F472B6' : '#EC4899',
    pinkLight: isDark ? 'rgba(244,114,182,0.15)' : 'rgba(236,72,153,0.08)',
    blue: '#3B82F6',
    blueLight: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
    orange: '#F59E0B',
    orangeLight: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
    red: '#EF4444',
    redLight: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
    chipBg: isDark ? '#252525' : '#F0F0F0',
    divider: isDark ? '#222222' : '#EEEEEE',
    inputBg: isDark ? '#111111' : '#F5F5F5',
    shadow: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
    headerGradient: themeColors.headerGradient,
    success: '#10B981',
    successLight: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
  } as const;

  const [usernameValue, setUsernameValue] = useState(user?.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [adminTapCount, setAdminTapCount] = useState(0);

  useEffect(() => { setUsernameValue(user?.username ?? ''); }, [user?.username]);

  const usernameDirty = useMemo(() => {
    const trimmed = usernameValue.trim();
    return trimmed.length > 0 && trimmed !== (user?.username ?? '').trim();
  }, [usernameValue, user?.username]);

  const validateUsername = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 'Username cannot be empty';
    if (trimmed.length < 2) return 'At least 2 characters';
    return null;
  };

  const validatePasswordForm = () => {
    if (!currentPassword.trim()) return 'Enter current password';
    if (newPassword.length < 8) return 'Min 8 characters';
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9\s]/.test(newPassword))
      return 'Need uppercase, lowercase, number, symbol';
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    if (newPassword === currentPassword) return 'Choose different password';
    return null;
  };

  const handleLanguageChange = (code: LanguageCode) => { if (code !== language) setLanguage(code); };
  const handleThemeToggle = () => setTheme(isDark ? 'light' : 'dark');
  const handleCurrencyChange = (code: string) => { if (code !== currency) setCurrency(code); };

  const handleAdminSecretTap = () => {
    setAdminTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        Alert.alert('Admin Mode', 'Admin password screen is opening');
        router.push('/admin-panel' as any);
        return 0;
      }
      return next;
    });
  };

  const handleSaveUsername = async () => {
    if (!isLoggedIn) { Alert.alert('Unavailable', 'Sign in first.'); return; }
    const error = validateUsername(usernameValue);
    if (error) { setUsernameError(error); return; }
    setUsernameError(null);
    try {
      setIsUpdatingUsername(true);
      const updatedUser = await updateUsername({ username: usernameValue.trim() });
      setUser(updatedUser);
      Alert.alert('Success', 'Username updated.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed');
    } finally { setIsUpdatingUsername(false); }
  };

  const handleChangePassword = async () => {
    if (!isLoggedIn) { Alert.alert('Unavailable', 'Sign in first.'); return; }
    const error = validatePasswordForm();
    if (error) { setPasswordError(error); return; }
    setPasswordError(null);
    try {
      setIsChangingPassword(true);
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      Alert.alert('Success', 'Password changed.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed');
    } finally { setIsChangingPassword(false); }
  };

  useEffect(() => { if (usernameError && usernameValue.trim().length >= 2) setUsernameError(null); }, [usernameError, usernameValue]);
  useEffect(() => { if (passwordError) { const err = validatePasswordForm(); if (!err) setPasswordError(null); } }, [currentPassword, newPassword, confirmPassword, passwordError]);
  useEffect(() => {
    if (adminTapCount === 0) return;
    const timer = setTimeout(() => setAdminTapCount(0), 1400);
    return () => clearTimeout(timer);
  }, [adminTapCount]);

  const selectedCurrency = getCurrency(currency);
  const { rates, lastUpdated, source, loading: ratesLoading, fetchRates } = useCurrencyStore();
  useEffect(() => { fetchRates(); }, []);
  const liveRate = rates[currency] || selectedCurrency.rate;

  // Setting Row component
  const SettingRow = ({ icon, iconBg, label, value, onPress, rightElement }: {
    icon: React.ReactNode; iconBg: string; label: string; value?: string;
    onPress?: () => void; rightElement?: React.ReactNode;
  }) => (
    <Pressable onPress={onPress}>
      <XStack ai="center" py="$3" gap="$3">
        <View w={40} h={40} br={12} ai="center" jc="center" style={{ backgroundColor: iconBg }}>
          {icon}
        </View>
        <YStack f={1}>
          <Text fontSize={15} fontWeight="500" style={{ color: colors.text }}>{label}</Text>
          {value && <Text fontSize={12} style={{ color: colors.textSecondary }}>{value}</Text>}
        </YStack>
        {rightElement || <ChevronRight size={18} color={colors.textMuted} />}
      </XStack>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* --- GRADIENT HEADER --- */}
          <Animated.View entering={FadeIn.duration(400)}>
            <LinearGradient
              colors={colors.headerGradient}
              style={{ paddingTop: 20, paddingBottom: 32, paddingHorizontal: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
            >
              <YStack
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 20, padding: 20, marginTop: 8,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <XStack ai="center" gap="$2" mb="$2">
                  <Wallet size={18} color="rgba(255,255,255,0.8)" />
                  <Text fontSize={14} style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {t('settings.title', 'Settings')}
                  </Text>
                </XStack>
                <Text fontSize={14} fontWeight="500" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <Text onPress={handleAdminSecretTap}>
                    {t('settings.subtitle', 'Customize your experience')}
                  </Text>
                </Text>
              </YStack>

              {/* Quick action buttons */}
              <XStack gap="$4" mt="$4" jc="space-around">
                {[
                  { icon: <Moon size={20} color="#FFF" />, label: isDark ? t('settings.theme.dark', 'Dark') : t('settings.theme.light', 'Light'), onPress: handleThemeToggle },
                  { icon: <Globe size={20} color="#FFF" />, label: t('settings.language.title', 'Language'), onPress: () => {} },
                  { icon: <DollarSign size={20} color="#FFF" />, label: t('settings.currency.title', 'Currency'), onPress: () => {} },
                  { icon: <Palette size={20} color="#FFF" />, label: t('settings.colors', 'Colors'), onPress: () => setShowColorPicker(!showColorPicker) },
                ].map((item, idx) => (
                  <Pressable key={idx} onPress={item.onPress}>
                    <YStack ai="center" gap="$1">
                      <View w={44} h={44} br={14} ai="center" jc="center"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        {item.icon}
                      </View>
                      <Text fontSize={11} style={{ color: 'rgba(255,255,255,0.8)' }}>{item.label}</Text>
                    </YStack>
                  </Pressable>
                ))}
              </XStack>
            </LinearGradient>
          </Animated.View>

          <YStack p="$4" gap="$4">
            {/* --- THEME MODE --- */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
                <SettingRow
                  icon={isDark ? <Moon size={20} color={colors.purple} /> : <Sun size={20} color="#F59E0B" />}
                  iconBg={isDark ? colors.purpleLight : colors.orangeLight}
                  label={isDark ? t('settings.theme.dark', 'Dark Mode') : t('settings.theme.light', 'Light Mode')}
                  value={isDark ? t('settings.theme.darkDesc', 'Easy on the eyes') : t('settings.theme.lightDesc', 'Bright look')}
                  rightElement={
                    <Switch value={isDark} onValueChange={handleThemeToggle}
                      trackColor={{ false: '#E5E5E5', true: colors.purple }}
                      thumbColor="#FFFFFF" ios_backgroundColor="#E5E5E5" />
                  }
                />
              </YStack>
            </Animated.View>

            {/* --- COLOR THEME PRESETS --- */}
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
                <XStack ai="center" gap="$2" mb="$3">
                  <View w={36} h={36} br={10} ai="center" jc="center"
                    style={{ backgroundColor: isDark ? 'rgba(236,72,153,0.15)' : 'rgba(236,72,153,0.08)' }}>
                    <Paintbrush size={18} color="#EC4899" />
                  </View>
                  <YStack f={1}>
                    <Text fontSize={15} fontWeight="600" style={{ color: colors.text }}>
                      {t('settings.colorTheme', 'Color Theme')}
                    </Text>
                    <Text fontSize={12} style={{ color: colors.textSecondary }}>
                      {t('settings.colorThemeDesc', 'Choose your style')}
                    </Text>
                  </YStack>
                </XStack>

                {/* Preset grid */}
                <XStack flexWrap="wrap" gap={8}>
                  {COLOR_PRESETS.map((preset) => {
                    const isActive = preset.id === presetId && !customPrimaryColor;
                    return (
                      <Pressable key={preset.id} onPress={() => setPreset(preset.id)}>
                        <YStack
                          ai="center" gap={4}
                          p="$2" br={14}
                          style={{
                            backgroundColor: isActive ? `rgba(${hexToRgbStr(preset.primary)},0.12)` : 'transparent',
                            borderWidth: isActive ? 2 : 1,
                            borderColor: isActive ? preset.primary : colors.cardBorder,
                            minWidth: 72,
                          }}
                        >
                          <LinearGradient
                            colors={[preset.gradientStart, preset.gradientEnd]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Text fontSize={16}>{preset.emoji}</Text>
                          </LinearGradient>
                          <Text fontSize={11} fontWeight={isActive ? '700' : '500'} style={{ color: isActive ? preset.primary : colors.text }} numberOfLines={1}>
                            {preset.name}
                          </Text>
                        </YStack>
                      </Pressable>
                    );
                  })}
                </XStack>

                {/* Custom color toggle */}
                <Pressable onPress={() => setShowColorPicker(!showColorPicker)} style={{ marginTop: 12 }}>
                  <XStack ai="center" jc="space-between" py="$2" px="$3" br={12}
                    style={{ backgroundColor: colors.chipBg }}>
                    <XStack ai="center" gap="$2">
                      <View w={24} h={24} br={12}
                        style={{ backgroundColor: customPrimaryColor || themeColors.primary, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }} />
                      <Text fontSize={13} fontWeight="500" style={{ color: colors.text }}>
                        {t('settings.customColor', 'Custom Color')}
                      </Text>
                    </XStack>
                    {showColorPicker ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
                  </XStack>
                </Pressable>

                {/* Color Picker (expanded) */}
                {showColorPicker && (
                  <View mt="$3">
                    <ColorPicker
                      selectedColor={customPrimaryColor || themeColors.primary}
                      onColorSelected={(color) => setCustomPrimaryColor(color)}
                      isDark={isDark}
                    />
                  </View>
                )}
              </YStack>
            </Animated.View>

            {/* --- LANGUAGE --- */}
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
                <Text fontSize={12} fontWeight="500" style={{ color: colors.textMuted }} mb="$3">
                  {t('settings.language.title', 'LANGUAGE')}
                </Text>
                <XStack flexWrap="wrap" gap="$2">
                  {LANGUAGE_OPTIONS.map((option) => {
                    const isActive = option.code === language;
                    return (
                      <Pressable key={option.code} onPress={() => handleLanguageChange(option.code)}>
                        <XStack px="$3" py="$2" br={12} ai="center" gap="$2"
                          style={{
                            backgroundColor: isActive ? themeColors.primary : colors.chipBg,
                            borderWidth: 1.5, borderColor: isActive ? themeColors.primary : 'transparent',
                          }}>
                          <Text fontSize={16}>{option.flag}</Text>
                          <Text fontSize={13} fontWeight={isActive ? '700' : '500'}
                            style={{ color: isActive ? '#FFFFFF' : colors.text }}>
                            {t(`settings.language.options.${option.code}`, option.shortLabel)}
                          </Text>
                        </XStack>
                      </Pressable>
                    );
                  })}
                </XStack>
              </YStack>
            </Animated.View>

            {/* --- CURRENCY --- */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
                <Text fontSize={12} fontWeight="500" style={{ color: colors.textMuted }} mb="$3">
                  {t('settings.currency.title', 'CURRENCY')}
                </Text>
                <XStack flexWrap="wrap" gap="$2">
                  {CURRENCIES.map((curr) => {
                    const isActive = curr.code === currency;
                    return (
                      <Pressable key={curr.code} onPress={() => handleCurrencyChange(curr.code)}>
                        <XStack px="$3" py="$2" br={12} ai="center" gap="$2"
                          style={{
                            backgroundColor: isActive ? themeColors.primary : colors.chipBg,
                            borderWidth: 1.5, borderColor: isActive ? themeColors.primary : 'transparent',
                          }}>
                          <Text fontSize={16}>{curr.flag}</Text>
                          <Text fontSize={13} fontWeight={isActive ? '700' : '500'}
                            style={{ color: isActive ? '#FFFFFF' : colors.text }}>
                            {curr.code}
                          </Text>
                        </XStack>
                      </Pressable>
                    );
                  })}
                </XStack>

                {/* Selected currency info */}
                <XStack mt="$3" p="$3" br={14} ai="center" gap="$2"
                  style={{ backgroundColor: colors.chipBg }}>
                  <Text fontSize={22}>{selectedCurrency.flag}</Text>
                  <YStack f={1}>
                    <Text fontSize={14} fontWeight="600" style={{ color: colors.text }}>{selectedCurrency.name}</Text>
                    <Text fontSize={12} style={{ color: colors.textSecondary }}>1 USD = {liveRate.toLocaleString()} {selectedCurrency.symbol}</Text>
                  </YStack>
                </XStack>

                {/* Live rates */}
                <XStack mt="$2" p="$3" br={14} ai="center" jc="space-between"
                  style={{ backgroundColor: colors.successLight }}>
                  <XStack ai="center" gap="$2">
                    <Wifi size={14} color={colors.success} />
                    <YStack>
                      <Text fontSize={11} fontWeight="600" style={{ color: colors.success }}>{source}</Text>
                      <Text fontSize={10} style={{ color: colors.success, opacity: 0.7 }}>{formatLastUpdated(lastUpdated)}</Text>
                    </YStack>
                  </XStack>
                  <Pressable onPress={() => fetchRates()} disabled={ratesLoading}>
                    <View w={32} h={32} br={16} ai="center" jc="center"
                      style={{ backgroundColor: colors.successLight, opacity: ratesLoading ? 0.5 : 1 }}>
                      {ratesLoading ? <Spinner size="small" color={colors.success} /> : <RefreshCcw size={14} color={colors.success} />}
                    </View>
                  </Pressable>
                </XStack>
              </YStack>
            </Animated.View>

            {/* --- USERNAME --- */}
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
                <XStack ai="center" gap="$2" mb="$3">
                  <View w={36} h={36} br={10} ai="center" jc="center" style={{ backgroundColor: colors.blueLight }}>
                    <UserIcon size={18} color={colors.blue} />
                  </View>
                  <Text fontSize={15} fontWeight="600" style={{ color: colors.text }}>
                    {t('settings.username.title', 'Username')}
                  </Text>
                </XStack>
                <Input
                  value={usernameValue} onChangeText={setUsernameValue}
                  placeholder={t('settings.username.placeholder', 'New username')}
                  textInputProps={{ autoCapitalize: 'none', autoCorrect: false }}
                  error={usernameError || undefined}
                />
                <XStack gap="$2" mt="$3">
                  <Pressable style={{ flex: 1 }} onPress={handleSaveUsername} disabled={!usernameDirty || isUpdatingUsername}>
                    <View py="$3" br={12} ai="center"
                      style={{ backgroundColor: usernameDirty ? themeColors.primary : colors.chipBg, opacity: usernameDirty ? 1 : 0.5 }}>
                      <Text fontSize={14} fontWeight="600" style={{ color: usernameDirty ? '#FFFFFF' : colors.textMuted }}>
                        {isUpdatingUsername ? t('common.saving', 'Saving...') : t('settings.username.save', 'Save')}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => setUsernameValue(user?.username ?? '')} disabled={!usernameDirty}>
                    <View py="$3" px="$4" br={12} ai="center" style={{ backgroundColor: colors.chipBg }}>
                      <Text fontSize={14} fontWeight="600" style={{ color: colors.textSecondary }}>
                        {t('common.reset', 'Reset')}
                      </Text>
                    </View>
                  </Pressable>
                </XStack>
              </YStack>
            </Animated.View>

            {/* --- PASSWORD --- */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
                <XStack ai="center" gap="$2" mb="$3">
                  <View w={36} h={36} br={10} ai="center" jc="center" style={{ backgroundColor: colors.redLight }}>
                    <Lock size={18} color={colors.red} />
                  </View>
                  <Text fontSize={15} fontWeight="600" style={{ color: colors.text }}>
                    {t('settings.password.title', 'Password')}
                  </Text>
                </XStack>
                <YStack gap="$3">
                  <PasswordInput value={currentPassword} onChangeText={setCurrentPassword}
                    placeholder={t('settings.password.currentPlaceholder', 'Current password')} />
                  <PasswordInput value={newPassword} onChangeText={setNewPassword}
                    placeholder={t('settings.password.newPlaceholder', 'New password')} />
                  <Text fontSize={11} style={{ color: colors.textMuted }}>
                    {t('settings.password.hint', 'Min 8 chars with uppercase, lowercase, number, symbol')}
                  </Text>
                  <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword}
                    placeholder={t('settings.password.confirmPlaceholder', 'Confirm')}
                    error={passwordError || undefined} />
                  <Pressable onPress={handleChangePassword} disabled={isChangingPassword}>
                    <View py="$3" br={12} ai="center"
                      style={{ backgroundColor: themeColors.primary, opacity: isChangingPassword ? 0.5 : 1 }}>
                      <Text fontSize={14} fontWeight="600" style={{ color: '#FFFFFF' }}>
                        {isChangingPassword ? t('common.updating', 'Updating...') : t('settings.password.change', 'Change password')}
                      </Text>
                    </View>
                  </Pressable>
                </YStack>
              </YStack>
            </Animated.View>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
