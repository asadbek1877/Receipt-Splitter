// app/tabs/profile.tsx — Profile (inspired by image 4 - clean centered avatar + menu list)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Pressable, TextInputProps } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { YStack, XStack, Text, Spinner, View } from 'tamagui';
import { LogOut, Upload, RotateCcw, User as UserIcon, Mail, Lock, Edit3, ChevronRight, Camera, Copy, Shield, Info, Bell } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import UserAvatar from '@/shared/ui/UserAvatar';
import Input from '@/shared/ui/Input';
import PasswordInput from '@/shared/ui/PasswordInput';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { changePassword, resetAvatar, updateAvatar, updateEmail, updateUsername, uploadAvatar } from '@/features/auth/api';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
};

const getColors = (isDark: boolean) => ({
  bg: isDark ? '#0D0D0D' : '#F5F5F5',
  card: isDark ? '#1A1A1A' : '#FFFFFF',
  cardBorder: isDark ? '#2A2A2A' : '#EBEBEB',
  text: isDark ? '#FFFFFF' : '#1A1A1A',
  textSecondary: isDark ? '#8A8A8A' : '#6B6B6B',
  textMuted: isDark ? '#555555' : '#999999',
  accent: '#2ECC71',
  accentLight: isDark ? 'rgba(46,204,113,0.15)' : 'rgba(46,204,113,0.08)',
  purple: isDark ? '#A78BFA' : '#7C3AED',
  purpleLight: isDark ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.08)',
  blue: '#3B82F6',
  blueLight: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
  orange: '#F59E0B',
  orangeLight: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
  red: '#EF4444',
  redLight: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
  pink: isDark ? '#F472B6' : '#EC4899',
  pinkLight: isDark ? 'rgba(244,114,182,0.15)' : 'rgba(236,72,153,0.08)',
  chipBg: isDark ? '#252525' : '#F0F0F0',
  divider: isDark ? '#222222' : '#EEEEEE',
  inputBg: isDark ? '#111111' : '#F5F5F5',
  shadow: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
  headerGradient: isDark
    ? ['#1A1A2E', '#2D1B3D'] as const
    : ['#7C3AED', '#9333EA'] as const,
  cameraBg: isDark ? '#A78BFA' : '#7C3AED',
});

type EditSection = 'none' | 'username' | 'email' | 'password';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, setUser, theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const { t } = useTranslation();

  const displayName = user?.username || t('profile.labels.guest', 'Guest');
  const userId = user?.uniqueId ?? '';

  // Avatar
  const [previewUri, setPreviewUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isResettingAvatar, setIsResettingAvatar] = useState(false);
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  // Editing
  const [activeEdit, setActiveEdit] = useState<EditSection>('none');

  // Username
  const [usernameDraft, setUsernameDraft] = useState(user?.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Email
  const [emailDraft, setEmailDraft] = useState(user?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => { setPreviewUri(user?.avatarUrl ?? null); }, [user?.avatarUrl]);
  useEffect(() => { setUsernameDraft(user?.username ?? ''); }, [user?.username]);
  useEffect(() => { setEmailDraft(user?.email ?? ''); }, [user?.email]);

  // Avatar handlers
  const ensureMediaPermission = useCallback(async () => {
    if (mediaPermission?.granted) return true;
    const response = await requestMediaPermission();
    if (response?.granted) return true;
    Alert.alert(t('profile.alerts.permissionTitle', 'Permission needed'), t('profile.alerts.permissionMessage', 'Allow photo library access.'));
    return false;
  }, [mediaPermission?.granted, requestMediaPermission, t]);

  const handlePickFromLibrary = useCallback(async () => {
    const allowed = await ensureMediaPermission();
    if (!allowed) return;
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const localUri = asset.uri;
      setPreviewUri(localUri);
      try {
        setIsSavingAvatar(true);
        const formData = new FormData();
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const extension = mimeType.split('/').pop() || 'jpg';
        const fileName = asset.fileName ?? `avatar.${extension}`;
        if (Platform.OS === 'web') {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          formData.append('file', blob, fileName);
        } else {
          formData.append('file', { uri: asset.uri, name: fileName, type: mimeType } as any);
        }
        try {
          const { avatarUrl: uploadedUrl } = await uploadAvatar(formData);
          const updatedUser = await updateAvatar({ avatarUrl: uploadedUrl });
          setUser(updatedUser);
          if (updatedUser.avatarUrl) setPreviewUri(updatedUser.avatarUrl);
        } catch {
          setUser({ ...user!, avatarUrl: localUri });
        }
      } catch {
        setUser({ ...user!, avatarUrl: localUri });
      } finally { setIsSavingAvatar(false); }
    }
  }, [ensureMediaPermission, user, setUser]);

  const handleResetAvatar = useCallback(async () => {
    if (!user) return;
    try {
      setIsResettingAvatar(true);
      try {
        const updatedUser = await resetAvatar();
        setUser(updatedUser);
        setPreviewUri(updatedUser.avatarUrl ?? null);
      } catch {
        setUser({ ...user, avatarUrl: null });
        setPreviewUri(null);
      }
    } finally { setIsResettingAvatar(false); }
  }, [user, setUser]);

  // Username handler
  const handleSaveUsername = useCallback(async () => {
    if (!user) return;
    const trimmed = usernameDraft.trim();
    if (!trimmed || trimmed.length < 2) { setUsernameError('Min 2 characters'); return; }
    if (trimmed === user.username) { setActiveEdit('none'); return; }
    try {
      setIsSavingUsername(true);
      const updatedUser = await updateUsername({ username: trimmed });
      setUser(updatedUser);
      setActiveEdit('none');
      Alert.alert('Success', 'Username updated');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally { setIsSavingUsername(false); }
  }, [user, usernameDraft, setUser]);

  // Email handler
  const handleSaveEmail = useCallback(async () => {
    if (!user) return;
    const trimmed = emailDraft.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailError('Invalid email'); return; }
    if (trimmed.toLowerCase() === (user.email ?? '').toLowerCase()) { setActiveEdit('none'); return; }
    try {
      setIsSavingEmail(true);
      const updatedUser = await updateEmail({ email: trimmed });
      setUser(updatedUser);
      setActiveEdit('none');
      Alert.alert('Success', 'Email updated');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally { setIsSavingEmail(false); }
  }, [user, emailDraft, setUser]);

  // Password handler
  const handleChangePassword = useCallback(async () => {
    if (!user) return;
    if (!currentPassword.trim()) { setPasswordError('Enter current password'); return; }
    if (newPassword.length < 6) { setPasswordError('Min 6 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords don\'t match'); return; }
    if (newPassword === currentPassword) { setPasswordError('Choose different password'); return; }
    try {
      setIsChangingPassword(true);
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setActiveEdit('none');
      Alert.alert('Success', 'Password changed');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed');
    } finally { setIsChangingPassword(false); }
  }, [user, currentPassword, newPassword, confirmPassword]);

  const handleCopy = useCallback(async (value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert(t('profile.copy.successTitle', 'Copied'), t('profile.copy.successMessage', 'Copied to clipboard'));
  }, [t]);

  const handleLogout = useCallback(() => {
    Alert.alert(t('profile.logout', 'Log out'), t('profile.logoutConfirm', 'Are you sure?'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('profile.logout', 'Log out'), style: 'destructive',
        onPress: () => logout().then(() => router.replace({ pathname: '/' })).catch(() => Alert.alert('Error', 'Could not log out')),
      },
    ]);
  }, [logout, router, t]);

  // Menu item component (like Image 4 list style)
  const MenuItem = ({ icon, iconBg, label, subtitle, onPress, danger, rightElement }: {
    icon: React.ReactNode; iconBg: string; label: string; subtitle?: string;
    onPress?: () => void; danger?: boolean; rightElement?: React.ReactNode;
  }) => (
    <Pressable onPress={onPress}>
      <XStack ai="center" py="$3" gap="$3">
        <View w={42} h={42} br={13} ai="center" jc="center" style={{ backgroundColor: iconBg }}>
          {icon}
        </View>
        <YStack f={1}>
          <Text fontSize={15} fontWeight="500" style={{ color: danger ? colors.red : colors.text }}>{label}</Text>
          {subtitle && <Text fontSize={12} style={{ color: colors.textSecondary }}>{subtitle}</Text>}
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

          {/* --- HEADER: Centered Avatar + Name (like Image 4) --- */}
          <Animated.View entering={FadeIn.duration(400)}>
            <LinearGradient colors={colors.headerGradient}
              style={{ paddingTop: 24, paddingBottom: 40, alignItems: 'center', borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}>

              {/* Avatar with camera overlay */}
              <Pressable onPress={handlePickFromLibrary} disabled={isSavingAvatar}>
                <View style={{ position: 'relative' }}>
                  <View style={{
                    width: 100, height: 100, borderRadius: 50,
                    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
                    overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)',
                  }}>
                    {isSavingAvatar ? (
                      <View w="100%" h="100%" ai="center" jc="center">
                        <Spinner size="large" color="#FFFFFF" />
                      </View>
                    ) : (
                      <UserAvatar
                        uri={previewUri ?? undefined}
                        label={displayName.slice(0, 1).toUpperCase()}
                        size={94}
                        textSize={34}
                      />
                    )}
                  </View>
                  {/* Camera badge */}
                  <View style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: colors.cameraBg, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: '#FFFFFF',
                  }}>
                    <Camera size={14} color="#FFFFFF" />
                  </View>
                </View>
              </Pressable>

              {/* Name & ID */}
              <Text fontSize={22} fontWeight="700" style={{ color: '#FFFFFF' }} mt="$3">
                {displayName}
              </Text>
              {userId ? (
                <Pressable onPress={() => handleCopy(userId)}>
                  <XStack ai="center" gap="$1" mt="$1">
                    <Text fontSize={13} style={{ color: 'rgba(255,255,255,0.7)' }}>
                      ID: {userId.slice(0, 12)}...
                    </Text>
                    <Copy size={12} color="rgba(255,255,255,0.5)" />
                  </XStack>
                </Pressable>
              ) : null}
              {user?.email ? (
                <Text fontSize={13} style={{ color: 'rgba(255,255,255,0.6)' }} mt="$0.5">
                  {user.email}
                </Text>
              ) : null}
            </LinearGradient>
          </Animated.View>

          <YStack p="$4" gap="$3" mt={-16}>
            {/* --- PROFILE MENU CARD --- */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.cardBorder }}>
                <MenuItem
                  icon={<UserIcon size={18} color={colors.blue} />}
                  iconBg={colors.blueLight}
                  label={t('profile.menu.editUsername', 'Edit Username')}
                  subtitle={user?.username || '—'}
                  onPress={() => setActiveEdit(activeEdit === 'username' ? 'none' : 'username')}
                />

                {/* Expanded username editor */}
                {activeEdit === 'username' && (
                  <Animated.View entering={FadeInDown.duration(200)}>
                    <YStack gap="$2" pl={54} pr="$1" pb="$2">
                      <Input value={usernameDraft} onChangeText={setUsernameDraft}
                        placeholder={t('profile.info.usernamePlaceholder', 'New username')}
                        error={usernameError || undefined}
                        textInputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
                      <XStack gap="$2">
                        <Pressable style={{ flex: 1 }} onPress={handleSaveUsername} disabled={isSavingUsername}>
                          <View py="$2.5" br={12} ai="center" style={{ backgroundColor: colors.accent }}>
                            <Text fontSize={13} fontWeight="600" style={{ color: '#FFF' }}>
                              {isSavingUsername ? 'Saving...' : t('common.save', 'Save')}
                            </Text>
                          </View>
                        </Pressable>
                        <Pressable onPress={() => { setActiveEdit('none'); setUsernameDraft(user?.username ?? ''); setUsernameError(null); }}>
                          <View py="$2.5" px="$4" br={12} ai="center" style={{ backgroundColor: colors.chipBg }}>
                            <Text fontSize={13} fontWeight="600" style={{ color: colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                          </View>
                        </Pressable>
                      </XStack>
                    </YStack>
                  </Animated.View>
                )}

                <View h={1} style={{ backgroundColor: colors.divider }} />

                <MenuItem
                  icon={<Mail size={18} color={colors.orange} />}
                  iconBg={colors.orangeLight}
                  label={t('profile.menu.editEmail', 'Edit Email')}
                  subtitle={user?.email || '—'}
                  onPress={() => setActiveEdit(activeEdit === 'email' ? 'none' : 'email')}
                />

                {/* Expanded email editor */}
                {activeEdit === 'email' && (
                  <Animated.View entering={FadeInDown.duration(200)}>
                    <YStack gap="$2" pl={54} pr="$1" pb="$2">
                      <Input value={emailDraft} onChangeText={setEmailDraft}
                        placeholder={t('profile.info.emailPlaceholder', 'New email')}
                        error={emailError || undefined}
                        textInputProps={{ keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false }} />
                      <XStack gap="$2">
                        <Pressable style={{ flex: 1 }} onPress={handleSaveEmail} disabled={isSavingEmail}>
                          <View py="$2.5" br={12} ai="center" style={{ backgroundColor: colors.accent }}>
                            <Text fontSize={13} fontWeight="600" style={{ color: '#FFF' }}>
                              {isSavingEmail ? 'Saving...' : t('common.save', 'Save')}
                            </Text>
                          </View>
                        </Pressable>
                        <Pressable onPress={() => { setActiveEdit('none'); setEmailDraft(user?.email ?? ''); setEmailError(null); }}>
                          <View py="$2.5" px="$4" br={12} ai="center" style={{ backgroundColor: colors.chipBg }}>
                            <Text fontSize={13} fontWeight="600" style={{ color: colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                          </View>
                        </Pressable>
                      </XStack>
                    </YStack>
                  </Animated.View>
                )}

                <View h={1} style={{ backgroundColor: colors.divider }} />

                <MenuItem
                  icon={<Lock size={18} color={colors.red} />}
                  iconBg={colors.redLight}
                  label={t('profile.menu.changePassword', 'Change Password')}
                  subtitle={t('profile.menu.passwordHint', 'Update your security')}
                  onPress={() => setActiveEdit(activeEdit === 'password' ? 'none' : 'password')}
                />

                {/* Expanded password editor */}
                {activeEdit === 'password' && (
                  <Animated.View entering={FadeInDown.duration(200)}>
                    <YStack gap="$3" pl={54} pr="$1" pb="$2">
                      <PasswordInput value={currentPassword} onChangeText={setCurrentPassword}
                        placeholder={t('profile.password.currentPlaceholder', 'Current password')} />
                      <PasswordInput value={newPassword} onChangeText={setNewPassword}
                        placeholder={t('profile.password.newPlaceholder', 'New password')} />
                      <Text fontSize={11} style={{ color: colors.textMuted }}>Min 6 characters</Text>
                      <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword}
                        placeholder={t('profile.password.confirmPlaceholder', 'Confirm')}
                        error={passwordError || undefined} />
                      <XStack gap="$2">
                        <Pressable style={{ flex: 1 }} onPress={handleChangePassword} disabled={isChangingPassword}>
                          <View py="$2.5" br={12} ai="center" style={{ backgroundColor: colors.purple }}>
                            <Text fontSize={13} fontWeight="600" style={{ color: '#FFF' }}>
                              {isChangingPassword ? 'Updating...' : t('profile.password.submit', 'Change')}
                            </Text>
                          </View>
                        </Pressable>
                        <Pressable onPress={() => { setActiveEdit('none'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(null); }}>
                          <View py="$2.5" px="$4" br={12} ai="center" style={{ backgroundColor: colors.chipBg }}>
                            <Text fontSize={13} fontWeight="600" style={{ color: colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                          </View>
                        </Pressable>
                      </XStack>
                    </YStack>
                  </Animated.View>
                )}
              </YStack>
            </Animated.View>

            {/* --- AVATAR MANAGEMENT CARD --- */}
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.cardBorder }}>
                <MenuItem
                  icon={<Upload size={18} color={colors.accent} />}
                  iconBg={colors.accentLight}
                  label={t('profile.avatar.upload', 'Upload Avatar')}
                  subtitle={t('profile.avatar.hint', 'Pick from photo library')}
                  onPress={handlePickFromLibrary}
                />
                <View h={1} style={{ backgroundColor: colors.divider }} />
                <MenuItem
                  icon={<RotateCcw size={18} color={colors.pink} />}
                  iconBg={colors.pinkLight}
                  label={t('profile.avatar.reset', 'Reset Avatar')}
                  subtitle={t('profile.avatar.resetHint', 'Use default avatar')}
                  onPress={handleResetAvatar}
                  rightElement={isResettingAvatar ? <Spinner size="small" color={colors.pink} /> : undefined}
                />
              </YStack>
            </Animated.View>

            {/* --- INFO CARD --- */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.cardBorder }}>
                <MenuItem
                  icon={<Info size={18} color={colors.purple} />}
                  iconBg={colors.purpleLight}
                  label={t('profile.info.userId', 'User ID')}
                  subtitle={userId || 'N/A'}
                  onPress={() => userId && handleCopy(userId)}
                  rightElement={<Copy size={16} color={colors.textMuted} />}
                />
              </YStack>
            </Animated.View>

            {/* --- LOGOUT --- */}
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <Pressable onPress={handleLogout}>
                <YStack style={{
                  backgroundColor: colors.redLight, borderRadius: 20, padding: 16,
                  borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)',
                }}>
                  <XStack ai="center" gap="$3" jc="center">
                    <LogOut size={20} color={colors.red} />
                    <Text fontSize={16} fontWeight="600" style={{ color: colors.red }}>
                      {t('profile.logout', 'Log out')}
                    </Text>
                  </XStack>
                </YStack>
              </Pressable>
            </Animated.View>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
