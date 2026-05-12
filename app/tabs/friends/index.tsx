// app/tabs/friends/index.tsx — Friends (inspired by image 5 - messages-style list)
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { YStack, XStack, Text, Spinner, View } from 'tamagui';
import { useRouter } from 'expo-router';
import { Search, UserPlus, Users, QrCode, Edit3, Trash2, MessageCircle } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, Modal, TextInput, Alert, Vibration } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFriendsStore, Friend } from '@/features/friends/model/friends.store';
import { useAppStore } from '@/shared/lib/stores/app-store';

// Colorful avatar colors for friends without avatars
const AVATAR_COLORS = ['#7C3AED', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
const getAvatarColor = (id: string) => AVATAR_COLORS[Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];

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
  pink: isDark ? '#F472B6' : '#EC4899',
  pinkLight: isDark ? 'rgba(244,114,182,0.15)' : 'rgba(236,72,153,0.08)',
  blue: '#3B82F6',
  blueLight: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
  red: '#EF4444',
  redBg: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
  successBg: isDark ? 'rgba(46,204,113,0.15)' : 'rgba(46,204,113,0.08)',
  chipBg: isDark ? '#252525' : '#F0F0F0',
  chipActive: isDark ? '#A78BFA' : '#7C3AED',
  divider: isDark ? '#222222' : '#EEEEEE',
  inputBg: isDark ? '#1A1A1A' : '#F0F0F0',
  inputText: isDark ? '#FFFFFF' : '#1A1A1A',
  searchBg: isDark ? '#1A1A1A' : '#FFFFFF',
  shadow: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
  modalOverlay: 'rgba(0,0,0,0.6)',
});

type FilterTab = 'all' | 'local' | 'synced';

export default function FriendsScreen() {
  const { friends, loading, fetchAll, addLocal, editFriend, remove } = useFriendsStore();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);
  const [newFriendName, setNewFriendName] = useState('');
  const [editFriendName, setEditFriendName] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const filteredFriends = useMemo(() => {
    let list = friends;
    if (activeTab === 'local') list = list.filter(f => f.uniqueId.startsWith('local#'));
    else if (activeTab === 'synced') list = list.filter(f => !f.uniqueId.startsWith('local#'));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f => (f.username || '').toLowerCase().includes(q) || (f.uniqueId || '').toLowerCase().includes(q));
    }
    return list;
  }, [friends, searchQuery, activeTab]);

  const handleAddFriend = useCallback(() => {
    if (!newFriendName.trim()) {
      Alert.alert(t('friends.add.error', 'Error'), t('friends.add.nameRequired', 'Please enter a name'));
      return;
    }
    addLocal({ uniqueId: `local#${Date.now()}`, username: newFriendName.trim(), avatarUrl: null, raw: {} });
    setNewFriendName('');
    setShowAddModal(false);
    Vibration.vibrate(50);
  }, [newFriendName, addLocal, t]);

  const handleEditFriend = useCallback((friend: Friend) => {
    setEditingFriend(friend);
    setEditFriendName(friend.username);
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editFriendName.trim()) {
      Alert.alert(t('friends.add.error', 'Error'), t('friends.add.nameRequired', 'Please enter a name'));
      return;
    }
    if (editingFriend) {
      editFriend(editingFriend.uniqueId, { username: editFriendName.trim() });
      setShowEditModal(false);
      setEditingFriend(null);
      Vibration.vibrate(50);
    }
  }, [editFriendName, editingFriend, editFriend, t]);

  const handleDeleteFriend = useCallback((friend: Friend) => {
    Alert.alert(t('friends.remove', 'Remove'), `Remove ${friend.username}?`, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      { text: t('friends.remove', 'Remove'), style: 'destructive', onPress: () => { remove(friend.uniqueId); Vibration.vibrate(50); } },
    ]);
  }, [remove, t]);

  // Friend row (messages-style like Image 5)
  const FriendRow = ({ friend, index }: { friend: Friend; index: number }) => {
    const avatarColor = getAvatarColor(friend.uniqueId);
    const isLocal = friend.uniqueId.startsWith('local#');
    const initial = (friend.username || '?').charAt(0).toUpperCase();
    return (
      <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
        <Pressable onLongPress={() => handleEditFriend(friend)} delayLongPress={500}>
          <XStack ai="center" py="$3" px="$4" gap="$3">
            {/* Colorful round avatar */}
            <View w={48} h={48} br={24} ai="center" jc="center" style={{ backgroundColor: avatarColor }}>
              <Text fontSize={20} fontWeight="700" style={{ color: '#FFFFFF' }}>{initial}</Text>
            </View>
            {/* Name + subtitle */}
            <YStack f={1}>
              <Text fontSize={15} fontWeight="600" style={{ color: colors.text }}>
                {friend.username}
              </Text>
              <Text fontSize={12} style={{ color: colors.textSecondary }}>
                {isLocal ? t('friends.status.local', 'Added locally') : t('friends.status.synced', 'Synced')}
              </Text>
            </YStack>
            {/* Action buttons */}
            <XStack gap="$2">
              <Pressable onPress={() => handleEditFriend(friend)}
                style={{ padding: 8, borderRadius: 10, backgroundColor: colors.purpleLight }}>
                <Edit3 size={16} color={colors.purple} />
              </Pressable>
              <Pressable onPress={() => handleDeleteFriend(friend)}
                style={{ padding: 8, borderRadius: 10, backgroundColor: colors.redBg }}>
                <Trash2 size={16} color={colors.red} />
              </Pressable>
            </XStack>
          </XStack>
        </Pressable>
        {/* Divider */}
        <View h={1} mx="$4" style={{ backgroundColor: colors.divider }} />
      </Animated.View>
    );
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: t('friends.tabs.all', 'All') },
    { key: 'local', label: t('friends.tabs.local', 'Local') },
    { key: 'synced', label: t('friends.tabs.synced', 'Synced') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <YStack f={1} style={{ backgroundColor: colors.bg }}>
        {/* Header area */}
        <YStack px="$4" pt="$3" pb="$2">
          <Animated.View entering={FadeIn.duration(300)}>
            <XStack ai="center" jc="space-between" mb="$3">
              <YStack>
                <Text fontSize={28} fontWeight="800" style={{ color: colors.text }}>
                  {t('home.actions.friends', 'Friends')}
                </Text>
                <Text fontSize={14} style={{ color: colors.textSecondary }}>
                  {friends.length} {t('friends.count', 'friends')}
                </Text>
              </YStack>
              <XStack gap="$2">
                <Pressable onPress={() => router.push('/tabs/scan-invite')}
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={20} color={colors.purple} />
                </Pressable>
                <Pressable onPress={() => setShowAddModal(true)}
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={20} color="#FFFFFF" />
                </Pressable>
              </XStack>
            </XStack>
          </Animated.View>

          {/* Search bar */}
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <XStack ai="center" style={{
              backgroundColor: colors.searchBg, borderRadius: 14, paddingHorizontal: 14, height: 46,
              borderWidth: 1, borderColor: colors.cardBorder,
            }}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                placeholder={t('friends.searchPlaceholder', 'Search friends...')}
                value={searchQuery} onChangeText={setSearchQuery}
                style={{ flex: 1, fontSize: 15, paddingHorizontal: 10, color: colors.inputText }}
                placeholderTextColor={colors.textMuted}
              />
            </XStack>
          </Animated.View>

          {/* Filter tabs (like Image 5's All / Read / Unread) */}
          <Animated.View entering={FadeInDown.delay(120).springify()}>
            <XStack gap="$2" mt="$3">
              {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}>
                    <View px="$4" py="$2" br={12}
                      style={{
                        backgroundColor: isActive ? colors.chipActive : colors.chipBg,
                        borderWidth: 1.5, borderColor: isActive ? colors.chipActive : 'transparent',
                      }}>
                      <Text fontSize={13} fontWeight={isActive ? '700' : '500'}
                        style={{ color: isActive ? '#FFFFFF' : colors.textSecondary }}>
                        {tab.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </XStack>
          </Animated.View>
        </YStack>

        {/* Friends list */}
        {loading && friends.length === 0 ? (
          <YStack f={1} ai="center" jc="center" gap="$3">
            <Spinner size="large" color={colors.purple} />
            <Text style={{ color: colors.textSecondary }}>{t('common.loading', 'Loading...')}</Text>
          </YStack>
        ) : (
          <Animated.ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {filteredFriends.length > 0 ? (
              <YStack style={{ backgroundColor: colors.card, borderRadius: 20, marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' }}>
                {filteredFriends.map((f, index) => (
                  <FriendRow key={f.uniqueId || index} friend={f} index={index} />
                ))}
              </YStack>
            ) : (
              <Animated.View entering={FadeIn.delay(200)}>
                <YStack ai="center" jc="center" py="$10" gap="$3">
                  <View w={72} h={72} br={36} ai="center" jc="center" style={{ backgroundColor: colors.purpleLight }}>
                    <Users size={32} color={colors.purple} />
                  </View>
                  <Text fontSize={17} fontWeight="600" style={{ color: colors.text }}>
                    {searchQuery ? t('friends.search.noResults', 'No friends found') : t('friends.empty.title', 'No friends yet')}
                  </Text>
                  <Text fontSize={14} style={{ color: colors.textSecondary }} textAlign="center" px="$6">
                    {searchQuery ? t('friends.search.tryAgain', 'Try a different search') : t('friends.empty.description', 'Add friends to start splitting!')}
                  </Text>
                  {!searchQuery && (
                    <Pressable onPress={() => setShowAddModal(true)}>
                      <XStack mt="$2" px="$5" py="$3" br={14} ai="center" gap="$2" style={{ backgroundColor: colors.purple }}>
                        <UserPlus size={18} color="#FFFFFF" />
                        <Text fontSize={14} fontWeight="600" style={{ color: '#FFFFFF' }}>{t('friends.add.title', 'Add Friend')}</Text>
                      </XStack>
                    </Pressable>
                  )}
                </YStack>
              </Animated.View>
            )}

            {/* Quick actions row below list */}
            <XStack gap="$2" px="$4" mt="$4">
              <Pressable style={{ flex: 1 }} onPress={() => setShowAddModal(true)}>
                <XStack ai="center" jc="center" gap="$2" py="$3" br={14}
                  style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
                  <UserPlus size={18} color={colors.accent} />
                  <Text fontSize={13} fontWeight="600" style={{ color: colors.text }}>{t('friends.add.title', 'Add')}</Text>
                </XStack>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => router.push('/tabs/scan-invite')}>
                <XStack ai="center" jc="center" gap="$2" py="$3" br={14}
                  style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
                  <QrCode size={18} color={colors.purple} />
                  <Text fontSize={13} fontWeight="600" style={{ color: colors.text }}>{t('friends.scanQr', 'Scan QR')}</Text>
                </XStack>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => router.push('/tabs/friends/requests')}>
                <XStack ai="center" jc="center" gap="$2" py="$3" br={14}
                  style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
                  <MessageCircle size={18} color={colors.pink} />
                  <Text fontSize={13} fontWeight="600" style={{ color: colors.text }}>{t('friends.requests', 'Requests')}</Text>
                </XStack>
              </Pressable>
            </XStack>
          </Animated.ScrollView>
        )}

        {/* Floating Add Button */}
        <Pressable
          onPress={() => setShowAddModal(true)}
          style={{
            position: 'absolute', bottom: 24, right: 24,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.purple,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: colors.purple, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
          }}
        >
          <UserPlus size={24} color="#FFFFFF" />
        </Pressable>

        {/* Add Friend Modal */}
        <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShowAddModal(false)}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Animated.View entering={FadeInDown.springify()}>
                <View style={{
                  backgroundColor: colors.card, padding: 24, borderRadius: 24, width: 340,
                  borderWidth: 1, borderColor: colors.cardBorder,
                }}>
                  <XStack ai="center" gap="$3" mb="$4">
                    <View w={48} h={48} br={24} ai="center" jc="center" style={{ backgroundColor: colors.successBg }}>
                      <UserPlus size={22} color={colors.accent} />
                    </View>
                    <Text fontSize={19} fontWeight="700" style={{ color: colors.text }}>
                      {t('friends.add.title', 'Add Friend')}
                    </Text>
                  </XStack>
                  <Text fontSize={14} style={{ color: colors.textSecondary }} mb="$3">
                    {t('friends.add.description', 'Enter their name to add.')}
                  </Text>
                  <TextInput
                    value={newFriendName} onChangeText={setNewFriendName}
                    placeholder={t('friends.add.namePlaceholder', "Friend's name")}
                    autoFocus
                    style={{
                      fontSize: 16, padding: 14, borderRadius: 12,
                      backgroundColor: colors.inputBg, color: colors.inputText,
                      marginBottom: 20, borderWidth: 1, borderColor: colors.cardBorder,
                    }}
                    placeholderTextColor={colors.textMuted}
                  />
                  <XStack gap="$3">
                    <Pressable onPress={() => setShowAddModal(false)} style={{ flex: 1 }}>
                      <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.chipBg }}>
                        <Text fontSize={15} fontWeight="600" style={{ color: colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={handleAddFriend} style={{ flex: 1 }}>
                      <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.accent }}>
                        <Text fontSize={15} fontWeight="600" style={{ color: '#FFFFFF' }}>{t('friends.add.button', 'Add')}</Text>
                      </View>
                    </Pressable>
                  </XStack>
                </View>
              </Animated.View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Edit Friend Modal */}
        <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShowEditModal(false)}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Animated.View entering={FadeInDown.springify()}>
                <View style={{
                  backgroundColor: colors.card, padding: 24, borderRadius: 24, width: 340,
                  borderWidth: 1, borderColor: colors.cardBorder,
                }}>
                  <XStack ai="center" gap="$3" mb="$4">
                    <View w={48} h={48} br={24} ai="center" jc="center" style={{ backgroundColor: colors.purpleLight }}>
                      <Edit3 size={22} color={colors.purple} />
                    </View>
                    <Text fontSize={19} fontWeight="700" style={{ color: colors.text }}>
                      {t('friends.edit.title', 'Edit Friend')}
                    </Text>
                  </XStack>
                  <TextInput
                    value={editFriendName} onChangeText={setEditFriendName}
                    placeholder={t('friends.add.namePlaceholder', "Friend's name")}
                    autoFocus
                    style={{
                      fontSize: 16, padding: 14, borderRadius: 12,
                      backgroundColor: colors.inputBg, color: colors.inputText,
                      marginBottom: 20, borderWidth: 1, borderColor: colors.cardBorder,
                    }}
                    placeholderTextColor={colors.textMuted}
                  />
                  <XStack gap="$3">
                    <Pressable onPress={() => setShowEditModal(false)} style={{ flex: 1 }}>
                      <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.chipBg }}>
                        <Text fontSize={15} fontWeight="600" style={{ color: colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={handleSaveEdit} style={{ flex: 1 }}>
                      <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.purple }}>
                        <Text fontSize={15} fontWeight="600" style={{ color: '#FFFFFF' }}>{t('common.save', 'Save')}</Text>
                      </View>
                    </Pressable>
                  </XStack>
                </View>
              </Animated.View>
            </Pressable>
          </Pressable>
        </Modal>
      </YStack>
    </SafeAreaView>
  );
}
