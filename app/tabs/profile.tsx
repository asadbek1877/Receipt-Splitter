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
import {
  AvatarCircle,
  Divider,
  GLASS_PALETTES as PALETTES,
  Glass,
  GlassScreen,
  PressScale,
  SectionLabel,
  type GlassPalette,
  type Tile,
} from '@/shared/ui/glass/GlassKit';
import { useFriendsStore } from '@/features/friends/model/friends.store';
import { changePassword, resetAvatar, updateAvatar, updateEmail, updateUsername, uploadAvatar } from '@/features/auth/api';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
};

type Palette = GlassPalette;
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
    <GlassScreen p={p}>
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
    </GlassScreen>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
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
