// app/tabs/profile.tsx — profile & account settings
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import {
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Info,
  Lock,
  LogOut,
  Mail,
  RotateCcw,
  Upload,
  User as UserIcon,
} from '@tamagui/lucide-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurTargetView, BlurView } from 'expo-blur';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useAppStore } from '@/shared/lib/stores/app-store';
import { useFriendsStore } from '@/features/friends/model/friends.store';
import { changePassword, resetAvatar, updateAvatar, updateEmail, updateUsername, uploadAvatar } from '@/features/auth/api';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
};

type Pair = readonly [string, string];
type Tile = { bg: string; fg: string };

// Light = green (matches the mock); dark = blue → violet (matches the auth screens).
const PALETTES = {
  light: {
    bg: '#F8FAFC',
    heroBg: ['#FFFFFF', '#F8FAFC'] as Pair,
    pageBg: ['#F1FBF5', '#F8FAFC'] as Pair,
    orbs: ['#86EFAC', '#BBF7D0', '#FDE68A'],
    orbOpacity: 0.5,
    glassTint: 'light' as 'light' | 'dark',
    glassHighlight: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0)'] as Pair,
    glassCaustic: 'rgba(255,255,255,0.5)',
    glassRim: 'rgba(255,255,255,1)',
    glassRimSoft: 'rgba(255,255,255,0.55)',
    glassOpaque: '#FFFFFF',
    particleReceipt: '#FFFFFF',
    beam: ['#BBF7D0', '#ECFDF5'] as Pair,
    beamOpacity: 0.7,
    shine: 'rgba(255,255,255,0.9)',
    text: '#0F172A',
    sub: '#334155',
    muted: '#64748B',
    label: '#475569',
    accent: '#16A34A',
    accentGradient: ['#34D27B', '#16A34A'] as Pair,
    avatarRing: 'transparent',
    card: 'rgba(255,255,255,0.55)',
    cardBorder: 'rgba(15,23,42,0.07)',
    divider: '#EEF1F4',
    chevron: '#64748B',
    inputBg: '#F3F5F8',
    inputBorder: '#E5E7EB',
    cameraBg: '#FFFFFF',
    cameraIcon: '#0F172A',
    logoutBg: 'rgba(253,226,226,0.6)',
    logoutBorder: '#F8C9C9',
    logoutText: '#DC2626',
    tiles: {
      user: { bg: '#E8F8EF', fg: '#22C55E' },
      mail: { bg: '#FEF3E2', fg: '#F59E0B' },
      lock: { bg: '#FDECEC', fg: '#EF4444' },
      upload: { bg: '#E8F8EF', fg: '#22C55E' },
      reset: { bg: '#FDEAF3', fg: '#EC4899' },
      info: { bg: '#F1ECFE', fg: '#8B5CF6' },
    } as Record<string, Tile>,
  },
  dark: {
    bg: '#0A0F1E',
    heroBg: ['#0B1022', '#0A0F1E'] as Pair,
    pageBg: ['#0A0F1E', '#0E1430'] as Pair,
    orbs: ['#3B82F6', '#8B5CF6', '#6366F1'],
    orbOpacity: 0.32,
    glassTint: 'dark' as 'light' | 'dark',
    glassHighlight: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'] as Pair,
    glassCaustic: 'rgba(167,139,250,0.12)',
    glassRim: 'rgba(255,255,255,0.32)',
    glassRimSoft: 'rgba(255,255,255,0.10)',
    glassOpaque: '#141A2E',
    particleReceipt: '#1B2240',
    beam: ['#4F8BFF', '#A855F7'] as Pair,
    beamOpacity: 0.55,
    shine: 'rgba(168,85,247,0.95)',
    text: '#FFFFFF',
    sub: '#CBD5E1',
    muted: '#94A3B8',
    label: '#94A3B8',
    accent: '#8B9CFF',
    accentGradient: ['#4F8BFF', '#A855F7'] as Pair,
    avatarRing: '#8B5CF6',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.09)',
    divider: 'rgba(255,255,255,0.07)',
    chevron: '#CBD5E1',
    inputBg: 'rgba(255,255,255,0.05)',
    inputBorder: 'rgba(255,255,255,0.10)',
    cameraBg: '#111827',
    cameraIcon: '#E2E8F0',
    logoutBg: 'rgba(127,29,29,0.30)',
    logoutBorder: 'rgba(239,68,68,0.55)',
    logoutText: '#F87171',
    tiles: {
      user: { bg: 'rgba(79,139,255,0.16)', fg: '#60A5FA' },
      mail: { bg: 'rgba(245,158,11,0.18)', fg: '#FBBF24' },
      lock: { bg: 'rgba(239,68,68,0.18)', fg: '#F87171' },
      upload: { bg: 'rgba(79,139,255,0.16)', fg: '#60A5FA' },
      reset: { bg: 'rgba(236,72,153,0.18)', fg: '#F472B6' },
      info: { bg: 'rgba(139,92,246,0.20)', fg: '#A78BFA' },
    } as Record<string, Tile>,
  },
};

type Palette = (typeof PALETTES)['light'];
type EditSection = 'none' | 'username' | 'email' | 'password';

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || '?';
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, setUser, theme } = useAppStore();
  const isDark = theme === 'dark';
  const p: Palette = isDark ? PALETTES.dark : PALETTES.light;
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const bgRef = useRef<View>(null);
  const requestsCount = useFriendsStore((s) => s.requestsRaw?.incoming?.length ?? 0);

  const displayName = user?.username || t('profile.labels.guest', 'Guest');
  const initials = initialsOf(displayName);
  const userId = user?.uniqueId ?? '';
  // uniqueId already carries its '#' (e.g. "#5076..."); never prefix a second one
  const bareId = userId.replace(/^#+/, '');
  const shortId = bareId ? `#${bareId.slice(0, 4)}${bareId.length > 4 ? '...' : ''}` : '—';

  // Avatar
  const [previewUri, setPreviewUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isResettingAvatar, setIsResettingAvatar] = useState(false);
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  // Editing
  const [activeEdit, setActiveEdit] = useState<EditSection>('none');

  const [usernameDraft, setUsernameDraft] = useState(user?.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  const [emailDraft, setEmailDraft] = useState(user?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => { setPreviewUri(user?.avatarUrl ?? null); }, [user?.avatarUrl]);
  useEffect(() => { setUsernameDraft(user?.username ?? ''); }, [user?.username]);
  useEffect(() => { setEmailDraft(user?.email ?? ''); }, [user?.email]);

  const closeEditors = () => {
    setActiveEdit('none');
    setUsernameDraft(user?.username ?? '');
    setEmailDraft(user?.email ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setUsernameError(null);
    setEmailError(null);
    setPasswordError(null);
  };
  const toggleEdit = (section: EditSection) => {
    if (activeEdit === section) closeEditors();
    else {
      closeEditors();
      setActiveEdit(section);
    }
  };

  const ensureMediaPermission = useCallback(async () => {
    if (mediaPermission?.granted) return true;
    const response = await requestMediaPermission();
    if (response?.granted) return true;
    Alert.alert(t('profile.alerts.permissionTitle', 'Permission needed'), t('profile.alerts.permissionMessage', 'Allow photo library access.'));
    return false;
  }, [mediaPermission?.granted, requestMediaPermission, t]);

  const handlePickFromLibrary = useCallback(async () => {
    if (isSavingAvatar) return;
    const allowed = await ensureMediaPermission();
    if (!allowed) return;
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const previous = user?.avatarUrl ?? null;
    setPreviewUri(asset.uri); // show the picked photo right away
    try {
      setIsSavingAvatar(true);
      const rawMime = (asset.mimeType ?? 'image/jpeg').toLowerCase();
      const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
      const extension = mimeType.split('/').pop() || 'jpg';
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: asset.fileName ?? `avatar.${extension}`, type: mimeType } as any);

      const { avatarUrl: uploadedUrl } = await uploadAvatar(formData);
      const updatedUser = await updateAvatar({ avatarUrl: uploadedUrl });
      setUser(updatedUser);
      setPreviewUri(updatedUser.avatarUrl ?? uploadedUrl);
    } catch (e) {
      // Don't pretend it worked: restore the old avatar and say why.
      setPreviewUri(previous);
      Alert.alert(
        t('common.error', 'Error'),
        e instanceof Error && e.message ? e.message : t('profile.alerts.avatarUpdateFailed', 'Could not update the avatar.'),
      );
    } finally {
      setIsSavingAvatar(false);
    }
  }, [ensureMediaPermission, user, setUser, isSavingAvatar, t]);

  const handleResetAvatar = useCallback(async () => {
    if (!user || isResettingAvatar) return;
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
  }, [user, setUser, isResettingAvatar]);

  const handleSaveUsername = useCallback(async () => {
    if (!user) return;
    const trimmed = usernameDraft.trim();
    if (!trimmed || trimmed.length < 2) { setUsernameError(t('profile.validation.usernameMin')); return; }
    if (trimmed === user.username) { setActiveEdit('none'); return; }
    try {
      setIsSavingUsername(true);
      const updatedUser = await updateUsername({ username: trimmed });
      setUser(updatedUser);
      setActiveEdit('none');
      Alert.alert(t('common.success'), t('profile.alerts.usernameUpdated'));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.alerts.usernameUpdateFailed'));
    } finally { setIsSavingUsername(false); }
  }, [user, usernameDraft, setUser, t]);

  const handleSaveEmail = useCallback(async () => {
    if (!user) return;
    const trimmed = emailDraft.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailError(t('profile.validation.emailInvalid')); return; }
    if (trimmed.toLowerCase() === (user.email ?? '').toLowerCase()) { setActiveEdit('none'); return; }
    if (!currentPassword.trim()) { setEmailError(t('profile.validation.passwordCurrent')); return; }
    try {
      setIsSavingEmail(true);
      const updatedUser = await updateEmail({ email: trimmed, currentPassword });
      setUser(updatedUser);
      setCurrentPassword('');
      setActiveEdit('none');
      Alert.alert(t('common.success'), t('profile.alerts.emailUpdated'));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.alerts.emailUpdateFailed'));
    } finally { setIsSavingEmail(false); }
  }, [user, emailDraft, currentPassword, setUser, t]);

  const handleChangePassword = useCallback(async () => {
    if (!user) return;
    if (!currentPassword.trim()) { setPasswordError(t('profile.validation.passwordCurrent')); return; }
    if (newPassword.length < 6) { setPasswordError(t('profile.validation.passwordMin6')); return; }
    if (newPassword !== confirmPassword) { setPasswordError(t('profile.validation.passwordMismatch')); return; }
    if (newPassword === currentPassword) { setPasswordError(t('profile.validation.passwordDifferent')); return; }
    try {
      setIsChangingPassword(true);
      await changePassword({ currentPassword, newPassword });
      closeEditors();
      Alert.alert(t('common.success'), t('profile.alerts.passwordChanged'));
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.alerts.passwordChangeFailed'));
    } finally { setIsChangingPassword(false); }
  }, [user, currentPassword, newPassword, confirmPassword, t]);

  const handleCopy = useCallback(async (value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Alert.alert(
      t('profile.copy.successTitle', 'Copied'),
      t('profile.copy.successMessage', { field: t('profile.info.userId', 'User ID'), defaultValue: 'Copied to clipboard' }),
    );
  }, [t]);

  const handleLogout = useCallback(() => {
    Alert.alert(t('profile.logout', 'Log out'), t('profile.logoutConfirm', 'Are you sure?'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('profile.logout', 'Log out'), style: 'destructive',
        onPress: () => logout().then(() => router.replace({ pathname: '/' })).catch(() => Alert.alert(t('common.error'), t('profile.alerts.logoutFailed'))),
      },
    ]);
  }, [logout, router, t]);

  return (
    <GlassProvider target={bgRef}>
    <View style={[styles.flex, { backgroundColor: p.bg }]}>
      {/* Fixed, animated background. Everything the glass cards blur lives here. */}
      <BlurTargetView ref={bgRef} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={p.pageBg} style={StyleSheet.absoluteFill} />
        <HeroBeams p={p} />
        <AmbientOrbs p={p} />
        <HeroParticles p={p} />
      </BlurTargetView>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ---------- HERO ---------- */}
          <View style={{ paddingTop: insets.top }}>

            {/* top bar */}
            <View style={styles.topBar}>
              <Pressable onPress={() => router.replace('/tabs')} hitSlop={10} style={styles.backRow} accessibilityRole="button">
                <ChevronLeft size={22} color={p.accent} />
                <Text style={[styles.backText, { color: p.accent }]}>{t('navigation.mainMenu', 'Main menu')}</Text>
              </Pressable>
              <View style={styles.topActions}>
                <Pressable
                  onPress={() => router.push('/tabs/friends/requests')}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                >
                  <Bell size={24} color={p.text} />
                  {requestsCount > 0 && (
                    <View style={[styles.badge, { backgroundColor: p.accentGradient[1] }]}>
                      <Text style={styles.badgeText}>{requestsCount}</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} hitSlop={6}>
                  <AvatarCircle p={p} uri={previewUri} initials={initials} size={46} fontSize={17} ring={isDark} />
                </Pressable>
              </View>
            </View>

            {/* identity */}
            <Animated.View entering={FadeIn.duration(450)} style={styles.identity}>
              <View style={styles.identityText}>
                <Text style={[styles.eyebrow, { color: p.label }]}>{t('profile.title', 'Profile').toUpperCase()}</Text>
                <Text style={[styles.name, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {displayName}
                </Text>
                <Pressable onPress={() => handleCopy(userId)} style={styles.idRow} hitSlop={6} disabled={!userId}>
                  <Text style={[styles.idText, { color: p.sub }]}>ID: {shortId}</Text>
                  {userId ? <Copy size={15} color={p.sub} /> : null}
                </Pressable>
                {user?.email ? <Text style={[styles.email, { color: p.sub }]} numberOfLines={1}>{user.email}</Text> : null}
              </View>

              <Pressable onPress={handlePickFromLibrary} disabled={isSavingAvatar} accessibilityRole="button" accessibilityLabel="Change avatar">
                <AvatarCircle
                  p={p}
                  uri={previewUri}
                  initials={initials}
                  size={124}
                  fontSize={40}
                  ring={isDark}
                  loading={isSavingAvatar}
                />
                <View style={[styles.camera, { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)' }]}>
                  <Glass p={p} fill={isDark ? 'rgba(17,24,39,0.55)' : 'rgba(255,255,255,0.7)'} radius={23} />
                  <Camera size={20} color={p.cameraIcon} />
                </View>
              </Pressable>
            </Animated.View>
          </View>

          <View style={styles.body}>
            {/* ---------- ACCOUNT ---------- */}
            <SectionLabel p={p} text={t('profile.sections.account', 'Account')} delay={60} />
            <Animated.View
              entering={FadeInDown.duration(420).delay(80)}
              layout={LinearTransition.duration(240)}
              style={[styles.card, { borderColor: p.cardBorder }]}
            >
              <Glass p={p} fill={p.card} radius={18} />
              <Row
                p={p}
                tile={p.tiles.user}
                icon={UserIcon}
                title={t('profile.menu.editUsername', 'Edit Username')}
                subtitle={user?.username || '—'}
                expanded={activeEdit === 'username'}
                onPress={() => toggleEdit('username')}
              />
              {activeEdit === 'username' && (
                <EditPanel p={p}>
                  <ProfileInput p={p} value={usernameDraft} onChangeText={(v) => { setUsernameDraft(v); setUsernameError(null); }}
                    placeholder={t('profile.info.usernamePlaceholder', 'New username')} />
                  <PanelError text={usernameError} />
                  <PanelActions p={p} saving={isSavingUsername} saveLabel={t('common.save', 'Save')}
                    savingLabel={t('common.saving', 'Saving...')} cancelLabel={t('common.cancel', 'Cancel')}
                    onSave={handleSaveUsername} onCancel={closeEditors} />
                </EditPanel>
              )}
              <Divider p={p} />
              <Row
                p={p}
                tile={p.tiles.mail}
                icon={Mail}
                title={t('profile.menu.editEmail', 'Edit Email')}
                subtitle={user?.email || '—'}
                expanded={activeEdit === 'email'}
                onPress={() => toggleEdit('email')}
              />
              {activeEdit === 'email' && (
                <EditPanel p={p}>
                  <ProfileInput p={p} value={emailDraft} onChangeText={(v) => { setEmailDraft(v); setEmailError(null); }}
                    placeholder={t('profile.info.emailPlaceholder', 'New email')} keyboardType="email-address" />
                  <ProfileInput p={p} value={currentPassword} onChangeText={(v) => { setCurrentPassword(v); setEmailError(null); }}
                    placeholder={t('profile.password.currentPlaceholder', 'Current password')} secure />
                  <PanelError text={emailError} />
                  <PanelActions p={p} saving={isSavingEmail} saveLabel={t('common.save', 'Save')}
                    savingLabel={t('common.saving', 'Saving...')} cancelLabel={t('common.cancel', 'Cancel')}
                    onSave={handleSaveEmail} onCancel={closeEditors} />
                </EditPanel>
              )}
              <Divider p={p} />
              <Row
                p={p}
                tile={p.tiles.lock}
                icon={Lock}
                title={t('profile.menu.changePassword', 'Change Password')}
                subtitle={t('profile.menu.passwordHint', 'Update your security')}
                expanded={activeEdit === 'password'}
                onPress={() => toggleEdit('password')}
              />
              {activeEdit === 'password' && (
                <EditPanel p={p}>
                  <ProfileInput p={p} value={currentPassword} onChangeText={(v) => { setCurrentPassword(v); setPasswordError(null); }}
                    placeholder={t('profile.password.currentPlaceholder', 'Current password')} secure />
                  <ProfileInput p={p} value={newPassword} onChangeText={(v) => { setNewPassword(v); setPasswordError(null); }}
                    placeholder={t('profile.password.newPlaceholder', 'New password')} secure />
                  <ProfileInput p={p} value={confirmPassword} onChangeText={(v) => { setConfirmPassword(v); setPasswordError(null); }}
                    placeholder={t('profile.password.confirmPlaceholder', 'Confirm new password')} secure />
                  <Text style={[styles.hint, { color: p.muted }]}>{t('profile.password.min6', 'Min 6 characters')}</Text>
                  <PanelError text={passwordError} />
                  <PanelActions p={p} saving={isChangingPassword} saveLabel={t('profile.password.submit', 'Change password')}
                    savingLabel={t('profile.password.updating', 'Updating...')} cancelLabel={t('common.cancel', 'Cancel')}
                    onSave={handleChangePassword} onCancel={closeEditors} />
                </EditPanel>
              )}
            </Animated.View>

            {/* ---------- AVATAR ---------- */}
            <SectionLabel p={p} text={t('profile.avatar.title', 'Avatar')} delay={120} />
            <Animated.View
              entering={FadeInDown.duration(420).delay(140)}
              style={[styles.card, { borderColor: p.cardBorder }]}
            >
              <Glass p={p} fill={p.card} radius={18} />
              <Row
                p={p}
                tile={p.tiles.upload}
                icon={Upload}
                title={isSavingAvatar ? t('profile.avatar.uploading', 'Uploading...') : t('profile.avatar.upload', 'Upload from phone')}
                subtitle={t('profile.avatar.hint', 'Pick from photo library')}
                onPress={handlePickFromLibrary}
                busy={isSavingAvatar}
              />
              <Divider p={p} />
              <Row
                p={p}
                tile={p.tiles.reset}
                icon={RotateCcw}
                title={isResettingAvatar ? t('profile.avatar.resetting', 'Resetting...') : t('profile.avatar.reset', 'Reset avatar')}
                subtitle={t('profile.avatar.resetHint', 'Use default avatar')}
                onPress={handleResetAvatar}
                busy={isResettingAvatar}
              />
            </Animated.View>

            {/* ---------- INFORMATION ---------- */}
            <SectionLabel p={p} text={t('profile.sections.information', 'Information')} delay={180} />
            <Animated.View
              entering={FadeInDown.duration(420).delay(200)}
              style={[styles.card, { borderColor: p.cardBorder }]}
            >
              <Glass p={p} fill={p.card} radius={18} />
              <Row
                p={p}
                tile={p.tiles.info}
                icon={Info}
                title={t('profile.info.userId', 'User ID')}
                subtitle={bareId ? `#${bareId}` : t('profile.labels.notAvailable', 'N/A')}
                onPress={() => handleCopy(userId)}
                right={<Copy size={22} color={p.chevron} />}
              />
            </Animated.View>

            {/* ---------- LOG OUT ---------- */}
            <Animated.View entering={FadeInDown.duration(420).delay(260)}>
              <PressScale
                onPress={handleLogout}
                style={[styles.logout, { borderColor: p.logoutBorder }]}
              >
                <Glass p={p} fill={p.logoutBg} radius={16} />
                <LogOut size={24} color={p.logoutText} />
                <Text style={[styles.logoutText, { color: p.logoutText }]}>{t('profile.logout', 'Log out')}</Text>
              </PressScale>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
    </GlassProvider>
  );
}

// ---------------------------------------------------------------------------
// Hero background: diagonal light beams with a slow shine sweeping across
// ---------------------------------------------------------------------------
function HeroBeams({ p }: { p: Palette }) {
  const { width } = useWindowDimensions();
  const sweep = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }), -1, false);
    drift.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-width * 0.4, width * 0.5]) }],
  }));
  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(drift.value, [0, 1], [0, 14]) }],
  }));

  const w = width;
  const h = 320;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, beamStyle]}>
        <Svg width={w} height={h}>
          <Defs>
            <SvgLinearGradient id="beamA" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0%" stopColor={p.beam[0]} stopOpacity={0} />
              <Stop offset="55%" stopColor={p.beam[0]} stopOpacity={p.beamOpacity} />
              <Stop offset="100%" stopColor={p.beam[1]} stopOpacity={p.beamOpacity * 0.6} />
            </SvgLinearGradient>
            <SvgLinearGradient id="beamB" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0%" stopColor={p.beam[1]} stopOpacity={0} />
              <Stop offset="100%" stopColor={p.beam[1]} stopOpacity={p.beamOpacity * 0.8} />
            </SvgLinearGradient>
          </Defs>
          <Polygon points={`${w * 0.42},${h} ${w * 0.62},${h} ${w * 1.05},${h * 0.05} ${w * 0.86},${h * 0.05}`} fill="url(#beamA)" />
          <Polygon points={`${w * 0.7},${h} ${w * 0.8},${h} ${w * 1.1},${h * 0.35} ${w * 1.0},${h * 0.35}`} fill="url(#beamB)" />
          <Polygon points={`${w * 0.25},${h} ${w * 0.3},${h} ${w * 0.78},${h * -0.1} ${w * 0.73},${h * -0.1}`} fill="url(#beamB)" opacity={0.5} />
        </Svg>
      </Animated.View>
      {/* travelling shine line */}
      <Animated.View style={[StyleSheet.absoluteFill, shineStyle]}>
        <Svg width={w} height={h}>
          <Polygon points={`${w * 0.5},${h * 0.9} ${w * 0.515},${h * 0.9} ${w * 0.83},${h * 0.1} ${w * 0.815},${h * 0.1}`} fill={p.shine} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero ambience: a breathing glow plus coins, mini receipts and sparkles that
// drift up behind the name — the "money being split" theme, kept subtle so the
// text stays readable.
// ---------------------------------------------------------------------------
type ParticleKind = 'coin' | 'receipt' | 'spark';
type ParticleSpec = { kind: ParticleKind; x: number; size: number; duration: number; delay: number; sway: number };

const PARTICLES: ParticleSpec[] = [
  { kind: 'coin', x: 0.82, size: 18, duration: 14000, delay: 2500, sway: 16 },
  { kind: 'receipt', x: 0.9, size: 18, duration: 16000, delay: 8000, sway: 14 },
  { kind: 'spark', x: 0.76, size: 11, duration: 12000, delay: 5500, sway: 10 },
  { kind: 'coin', x: 0.04, size: 15, duration: 15000, delay: 10000, sway: 12 },
  { kind: 'coin', x: 0.08, size: 22, duration: 9000, delay: 0, sway: 14 },
  { kind: 'receipt', x: 0.3, size: 20, duration: 11000, delay: 1800, sway: 18 },
  { kind: 'spark', x: 0.52, size: 12, duration: 7500, delay: 900, sway: 10 },
  { kind: 'coin', x: 0.42, size: 16, duration: 10000, delay: 4200, sway: 12 },
  { kind: 'spark', x: 0.18, size: 10, duration: 8200, delay: 3000, sway: 8 },
  { kind: 'receipt', x: 0.6, size: 16, duration: 12000, delay: 6000, sway: 16 },
  { kind: 'coin', x: 0.24, size: 13, duration: 9500, delay: 7200, sway: 10 },
  { kind: 'spark', x: 0.66, size: 9, duration: 7000, delay: 5200, sway: 8 },
];

function ParticleGlyph({ kind, size, p }: { kind: ParticleKind; size: number; p: Palette }) {
  const [a, b] = p.accentGradient;
  if (kind === 'coin') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <SvgLinearGradient id="pcoin" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={a} />
            <Stop offset="100%" stopColor={b} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={12} cy={12} r={11} fill="url(#pcoin)" />
        <Circle cx={12} cy={12} r={7.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.4} />
        {/* ÷ */}
        <Circle cx={12} cy={8.6} r={1.3} fill="#FFFFFF" />
        <Rect x={8} y={11.2} width={8} height={1.6} rx={0.8} fill="#FFFFFF" />
        <Circle cx={12} cy={15.4} r={1.3} fill="#FFFFFF" />
      </Svg>
    );
  }
  if (kind === 'receipt') {
    return (
      <Svg width={size} height={size * 1.25} viewBox="0 0 20 25">
        <Path d="M2 1h16v21l-2.7-1.8-2.6 1.8-2.7-1.8-2.6 1.8-2.7-1.8L2 22z" fill={p.particleReceipt} stroke={a} strokeWidth={1.3} />
        <Rect x={5} y={6} width={10} height={1.6} rx={0.8} fill={a} opacity={0.8} />
        <Rect x={5} y={10} width={7} height={1.6} rx={0.8} fill={a} opacity={0.6} />
        <Rect x={5} y={14} width={9} height={1.6} rx={0.8} fill={b} opacity={0.6} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill={b} />
    </Svg>
  );
}

function Particle({ spec, p, width, height }: { spec: ParticleSpec; p: Palette; width: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(spec.delay, withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, []);
  const style = useAnimatedStyle(() => {
    const v = t.value;
    return {
      opacity: interpolate(v, [0, 0.12, 0.75, 1], [0, 0.85, 0.85, 0]),
      transform: [
        { translateY: interpolate(v, [0, 1], [height, -spec.size * 2]) },
        { translateX: Math.sin(v * Math.PI * 2) * spec.sway },
        { rotate: `${interpolate(v, [0, 1], [-25, 25])}deg` },
        { scale: interpolate(v, [0, 0.2, 1], [0.6, 1, 0.9]) },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: spec.x * width, top: 0 }, style]}>
      <ParticleGlyph kind={spec.kind} size={spec.size} p={p} />
    </Animated.View>
  );
}

function HeroParticles({ p }: { p: Palette }) {
  const { width, height } = useWindowDimensions();
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breathe);
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.35, 0.7]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.9, 1.12]) }],
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {/* breathing glow behind the name */}
      <Animated.View style={[{ position: 'absolute', left: -70, top: 40 }, glowStyle]}>
        <Svg width={280} height={280}>
          <Defs>
            <RadialGradient id="pglow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={p.accentGradient[0]} stopOpacity={0.45} />
              <Stop offset="60%" stopColor={p.accentGradient[1]} stopOpacity={0.12} />
              <Stop offset="100%" stopColor={p.accentGradient[1]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={140} cy={140} r={140} fill="url(#pglow)" />
        </Svg>
      </Animated.View>

      {PARTICLES.map((spec, i) => (
        <Particle key={i} spec={spec} p={p} width={width} height={height} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Liquid Glass for the cards: real backdrop blur of the fixed background
// (Android blurs the BlurTargetView), translucent fill, specular sheen and a
// rim light. Blur mounts after the screen settles; Reduce Transparency → opaque.
// ---------------------------------------------------------------------------
type GlassState = { target: React.RefObject<View | null> | null; ready: boolean; reduce: boolean };
const GlassContext = createContext<GlassState>({ target: null, ready: false, reduce: false });

function GlassProvider({ target, children }: { target: React.RefObject<View | null>; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 400);
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((v) => mounted && setReduce(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      mounted = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return <GlassContext.Provider value={{ target, ready, reduce }}>{children}</GlassContext.Provider>;
}

function Glass({ p, fill, radius }: { p: Palette; fill: string; radius: number }) {
  const { target, ready, reduce } = useContext(GlassContext);
  if (reduce) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.glassOpaque }]} />;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ready && (
        <Animated.View entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
          <BlurView
            intensity={50}
            tint={p.glassTint}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurReductionFactor={3}
            blurTarget={target ?? undefined}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      <LinearGradient colors={p.glassHighlight} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.9 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0)', p.glassCaustic]}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: Math.max(0, radius - 1),
            borderWidth: 1,
            borderTopColor: p.glassRim,
            borderLeftColor: p.glassRimSoft,
            borderRightColor: p.glassRimSoft,
            borderBottomColor: 'transparent',
          },
        ]}
      />
    </View>
  );
}

/** Large soft colour fields drifting down the page, so the glass has something to refract. */
function AmbientOrbs({ p }: { p: Palette }) {
  const { width, height } = useWindowDimensions();
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    a.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.sin) }), -1, true);
    b.value = withDelay(1500, withRepeat(withTiming(1, { duration: 13000, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
    };
  }, []);
  const s1 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(a.value, [0, 1], [-30, 40]) }, { translateY: interpolate(b.value, [0, 1], [0, 60]) }],
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(b.value, [0, 1], [30, -50]) }, { translateY: interpolate(a.value, [0, 1], [30, -40]) }],
  }));
  const s3 = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(a.value, [0, 1], [0, -30]) }, { scale: interpolate(b.value, [0, 1], [0.9, 1.1]) }],
  }));
  const orb = (size: number, color: string) => (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} opacity={p.orbOpacity} />
    </Svg>
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[{ position: 'absolute', left: -80, top: height * 0.38 }, s1]}>{orb(260, p.orbs[0])}</Animated.View>
      <Animated.View style={[{ position: 'absolute', left: width - 170, top: height * 0.58 }, s2]}>{orb(240, p.orbs[1])}</Animated.View>
      <Animated.View style={[{ position: 'absolute', left: width * 0.2, top: height * 0.82 }, s3]}>{orb(220, p.orbs[2])}</Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
function AvatarCircle({
  p,
  uri,
  initials,
  size,
  fontSize,
  ring,
  loading,
}: {
  p: Palette;
  uri: string | null;
  initials: string;
  size: number;
  fontSize: number;
  ring?: boolean;
  loading?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const showImage = !!uri && uri.trim() !== '' && !failed;
  const ringWidth = ring ? Math.max(2, size * 0.025) : 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        padding: ringWidth,
        borderWidth: ringWidth,
        borderColor: p.avatarRing,
        shadowColor: p.accentGradient[1],
        shadowOpacity: ring ? 0.6 : 0.25,
        shadowRadius: size * 0.12,
        shadowOffset: { width: 0, height: 4 },
        elevation: ring ? 10 : 4,
      }}
    >
      <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden' }}>
        <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.center}>
          {showImage ? (
            <Image source={{ uri: uri! }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
          ) : (
            <Text style={{ color: '#FFFFFF', fontSize, fontWeight: '700', letterSpacing: 0.5 }}>{initials}</Text>
          )}
          {loading && (
            <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          )}
        </LinearGradient>
      </View>
    </View>
  );
}

function SectionLabel({ p, text, delay }: { p: Palette; text: string; delay: number }) {
  return (
    <Animated.Text entering={FadeIn.duration(400).delay(delay)} style={[styles.section, { color: p.label }]}>
      {text.toUpperCase()}
    </Animated.Text>
  );
}

function Divider({ p }: { p: Palette }) {
  return <View style={[styles.divider, { backgroundColor: p.divider }]} />;
}

/** Pressable that gently scales down while pressed. */
function PressScale({
  onPress,
  style,
  children,
  disabled,
}: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => (scale.value = withTiming(0.97, { duration: 90 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 160 }))}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function Row({
  p,
  tile,
  icon: Icon,
  title,
  subtitle,
  onPress,
  expanded,
  busy,
  right,
}: {
  p: Palette;
  tile: Tile;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle?: string;
  onPress: () => void;
  expanded?: boolean;
  busy?: boolean;
  right?: React.ReactNode;
}) {
  const rotate = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    rotate.value = withTiming(expanded ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [expanded]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value * 90}deg` }] }));

  return (
    <PressScale onPress={onPress} disabled={busy} style={styles.row}>
      <View style={[styles.tile, { backgroundColor: tile.bg }]}>
        <Icon size={24} color={tile.fg} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: p.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: p.muted }]}>{subtitle}</Text> : null}
      </View>
      {busy ? (
        <ActivityIndicator color={tile.fg} />
      ) : right ? (
        right
      ) : (
        <Animated.View style={chevronStyle}>
          <ChevronRight size={22} color={p.chevron} />
        </Animated.View>
      )}
    </PressScale>
  );
}

function EditPanel({ p, children }: { p: Palette; children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(140)}
      style={[styles.panel, { borderColor: p.divider }]}
    >
      {children}
    </Animated.View>
  );
}

function ProfileInput({
  p,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType = 'default',
}: {
  p: Palette;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address';
}) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      style={[styles.input, { backgroundColor: p.inputBg, borderColor: focused ? p.accentGradient[1] : p.inputBorder }]}
    >
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.muted}
        secureTextEntry={secure && !visible}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={p.accentGradient[1]}
        cursorColor={p.accentGradient[1]}
        underlineColorAndroid="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.inputText, { color: p.text }]}
      />
      {secure && (
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10}>
          {visible ? <EyeOff size={18} color={p.muted} /> : <Eye size={18} color={p.muted} />}
        </Pressable>
      )}
    </Pressable>
  );
}

function PanelError({ text }: { text: string | null }) {
  if (!text) return null;
  return <Text style={styles.error}>{text}</Text>;
}

function PanelActions({
  p,
  saving,
  saveLabel,
  savingLabel,
  cancelLabel,
  onSave,
  onCancel,
}: {
  p: Palette;
  saving: boolean;
  saveLabel: string;
  savingLabel: string;
  cancelLabel: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.actions}>
      <View style={styles.flex}>
        <PressScale onPress={onSave} disabled={saving} style={styles.saveWrap}>
          <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.save}>
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={styles.saveText}>{saving ? savingLabel : saveLabel}</Text>
          </LinearGradient>
        </PressScale>
      </View>
      <PressScale onPress={onCancel} style={[styles.cancel, { borderColor: p.inputBorder }]}>
        <Text style={[styles.cancelText, { color: p.muted }]}>{cancelLabel}</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    height: 64,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 17, fontWeight: '500' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 30,
  },
  identityText: { flex: 1, paddingRight: 12 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 3.5 },
  name: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, marginTop: 6 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start' },
  idText: { fontSize: 16 },
  email: { fontSize: 16, marginTop: 6 },
  camera: {
    overflow: 'hidden',
    position: 'absolute',
    right: -4,
    bottom: 2,
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  body: { paddingHorizontal: 18 },
  section: { fontSize: 12, fontWeight: '600', letterSpacing: 3.5, marginTop: 10, marginBottom: 10, marginLeft: 6 },
  card: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, marginBottom: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 16 },
  tile: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 17, fontWeight: '500' },
  rowSub: { fontSize: 14, marginTop: 3, lineHeight: 19 },
  divider: { height: 1, marginLeft: 66 },
  panel: { gap: 10, paddingBottom: 16, paddingLeft: 66 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputText: { flex: 1, fontSize: 15, paddingVertical: 0, height: '100%' },
  hint: { fontSize: 12 },
  error: { color: '#EF4444', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  saveWrap: { borderRadius: 12, overflow: 'hidden' },
  save: { height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cancel: { height: 44, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  logout: {
    overflow: 'hidden',
    height: 62,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 4,
  },
  logoutText: { fontSize: 19, fontWeight: '600' },
});
