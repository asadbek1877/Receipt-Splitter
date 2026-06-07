import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  YStack, XStack, Button, Spinner, Text, Input, ScrollView, Dialog, Adapt, Sheet
} from 'tamagui';
import { Users as UsersIcon, Check, Plus, ChevronLeft, Search, Trash2 } from '@tamagui/lucide-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet } from 'react-native';
import { useFriendsStore } from '@/features/friends/model/friends.store';
import UserAvatar from '@/shared/ui/UserAvatar';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { useGroupsStore } from '@/features/groups/model/groups.store';
import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';

type LiteUser = { uniqueId: string; username: string; avatarUrl?: string | null };

export default function SessionParticipantsScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // stores
  const me = useAppStore(s => s.user);
  const { friends, loading: friendsLoading, error: friendsError, fetchAll: fetchFriends } = useFriendsStore();
  const { groups, counts, fetchGroups, openGroup } = useGroupsStore();

  const session = useReceiptSessionStore((s) => s.session);
  const setReceiptParticipants = useReceiptSessionStore((s) => s.setParticipants);

  // -------- state --------
  const [q, setQ] = useState('');
  // Инициализируем пусто: «меня» добавим эффектом, когда будет доступен user
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<number, LiteUser[]>>({});
  const [groupLoading, setGroupLoading] = useState<Record<number, boolean>>({});
  // авто-добавленные из активной группы (чтобы корректно снимать при переключениях)
  const [autoFromGroup, setAutoFromGroup] = useState<Record<string, number | undefined>>({});
  const autoRef = useRef(autoFromGroup);
  useEffect(() => { autoRef.current = autoFromGroup; }, [autoFromGroup]);

  // New participant creation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [customParticipants, setCustomParticipants] = useState<LiteUser[]>([]);

  const addCustomParticipant = () => {
    if (!newParticipantName.trim()) return;
    const newId = `custom#${Date.now()}`;
    const newUser: LiteUser = {
      uniqueId: newId,
      username: newParticipantName.trim(),
    };
    setCustomParticipants(prev => [...prev, newUser]);
    setSelected(prev => ({ ...prev, [newId]: true }));
    setNewParticipantName('');
    setShowAddModal(false);
  };

  const removeCustomParticipant = (uid: string) => {
    setCustomParticipants(prev => prev.filter(p => p.uniqueId !== uid));
    setSelected(prev => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  };

  // -------- boot --------
  useEffect(() => { fetchFriends(); }, [fetchFriends]);
  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // robust me: берём uniqueId, иначе username, иначе id
  const meUid = useMemo(() => {
    return (me?.uniqueId || me?.username || (typeof me?.id === 'number' ? `id:${me.id}` : '')) as string;
  }, [me?.uniqueId, me?.username, me?.id]);
  const meName = useMemo(() => (me?.username || 'You') as string, [me?.username]);

  // гарантируем, что «я» всегда в selected = true при появлении user
  useEffect(() => {
    if (!meUid) return;
    setSelected(prev => ({ ...prev, [meUid]: true }));
  }, [meUid]);

  // helpers
  const dedupByUniqueId = (arr: LiteUser[]) => {
    const seen = new Set<string>();
    const out: LiteUser[] = [];
    for (const u of arr) {
      if (!u.uniqueId || seen.has(u.uniqueId)) continue;
      seen.add(u.uniqueId);
      out.push(u);
    }
    return out;
  };

  // Me FIRST + Friends («я» всегда есть в кандидатах)
  const basePeople: LiteUser[] = useMemo(() => {
    const res: LiteUser[] = [];
    if (meUid) res.push({ uniqueId: meUid, username: meName });
    (friends ?? []).forEach((f: any) => {
      const uid = f?.user?.uniqueId ?? f?.uniqueId;
      if (!uid) return;
      const uname = f?.user?.username ?? f?.username ?? uid;
      res.push({ uniqueId: uid, username: uname });
    });
    return res;
  }, [friends, meUid, meName]);

  // Combine all sources: me + friends + group members + custom
  const allSources = useMemo(() => {
    const currentGroupMembers = activeGroupId ? (groupMembers?.[activeGroupId] || []) : [];
    return dedupByUniqueId([...basePeople, ...currentGroupMembers, ...customParticipants]);
  }, [basePeople, activeGroupId, groupMembers, customParticipants]);

  // cache group members
  async function loadGroupMembers(gid: number): Promise<LiteUser[]> {
    if (groupMembers[gid]) return groupMembers[gid];
    setGroupLoading(m => ({ ...m, [gid]: true }));
    try {
      await openGroup(gid);
      const st = (useGroupsStore as any)?.getState?.();
      const raw = st?.current?.members ?? [];
      const mapped: LiteUser[] = raw
        .map((m: any) => ({
          uniqueId: m?.uniqueId ?? '',
          username: m?.username ?? (m?.uniqueId ?? ''),
        }))
        .filter((m: LiteUser) => !!m.uniqueId);
      setGroupMembers(mm => ({ ...mm, [gid]: mapped }));
      return mapped;
    } finally {
      setGroupLoading(m => ({ ...m, [gid]: false }));
    }
  }

  // снять авто-выбор конкретной группы из selected
  function stripAutoOfGroup(next: Record<string, boolean>, gid: number) {
    const auto = autoRef.current;
    Object.entries(auto).forEach(([uid, g]) => {
      if (g === gid) delete next[uid];
    });
  }

  // deactivate current group (toggle off)
  function deactivateGroup(gid: number) {
    setActiveGroupId(null);
    setSelected(prev => {
      const next = { ...prev };
      stripAutoOfGroup(next, gid);
      if (meUid) next[meUid] = true; // гарантируем «я»
      return next;
    });
    setAutoFromGroup(prev => {
      const cp: Record<string, number | undefined> = {};
      Object.entries(prev).forEach(([uid, g]) => { if (g !== gid) cp[uid] = g; });
      return cp;
    });
  }

  // activate / toggle group
  async function activateGroup(gid: number) {
    if (activeGroupId === gid) { deactivateGroup(gid); return; }

    // убираем авто-добавления предыдущей группы
    if (typeof activeGroupId === 'number') {
      setSelected(prev => {
        const next = { ...prev };
        stripAutoOfGroup(next, activeGroupId);
        if (meUid) next[meUid] = true;
        return next;
      });
      setAutoFromGroup(prev => {
        const cp: Record<string, number | undefined> = {};
        Object.entries(prev).forEach(([uid, g]) => { if (g !== activeGroupId) cp[uid] = g; });
        return cp;
      });
    }

    setActiveGroupId(gid);

    // если есть кэш — сразу применяем; иначе покажем «меня», потом дополним
    if (groupMembers[gid]) {
      const members = groupMembers[gid]!;
      setSelected(prev => {
        const next = { ...prev };
        const added: Record<string, number> = {};
        members.forEach(m => {
          if (!next[m.uniqueId]) { next[m.uniqueId] = true; added[m.uniqueId] = gid; }
        });
        if (meUid) next[meUid] = true;
        setAutoFromGroup(prevAuto => ({ ...prevAuto, ...added }));
        return next;
      });
      return;
    }

    setSelected(prev => {
      const next = { ...prev };
      if (meUid) next[meUid] = true;
      return next;
    });

    const members = await loadGroupMembers(gid);
    setSelected(prev => {
      const next = { ...prev };
      const added: Record<string, number> = {};
      members.forEach(m => {
        if (!next[m.uniqueId]) { next[m.uniqueId] = true; added[m.uniqueId] = gid; }
      });
      if (meUid) next[meUid] = true;
      setAutoFromGroup(prevAuto => ({ ...prevAuto, ...added }));
      return next;
    });
  }

  // candidates = Me + Friends + active group members (if any) + custom
  const unionPeople: LiteUser[] = useMemo(() => {
    const fromGroup = activeGroupId ? (groupMembers[activeGroupId] || []) : [];
    return dedupByUniqueId([...basePeople, ...fromGroup, ...customParticipants]);
  }, [basePeople, activeGroupId, groupMembers, customParticipants]);

  const filtered = useMemo(() => {
    if (!q) return unionPeople;
    const qq = q.toLowerCase();
    return unionPeople.filter(p =>
      p.username.toLowerCase().includes(qq) || p.uniqueId.toLowerCase().includes(qq)
    );
  }, [unionPeople, q]);

  // manual toggle: если юзера авто-добавила группа — снимаем метку, чтобы он остался при снятии группы
  const toggleUser = (uid: string) => {
    setSelected(s => ({ ...s, [uid]: !s[uid] }));
    setAutoFromGroup(prev => {
      if (prev[uid] !== undefined) {
        const cp = { ...prev };
        delete cp[uid];
        return cp;
      }
      return prev;
    });
  };

  const selectedList = Object.keys(selected).filter(k => selected[k]);
  const canNext = selectedList.length >= 1;

  const fmtUid = (uid: string) => `@${uid.toLowerCase().replace('user#', 'user')}`;
  const goNext = () => {
    const participants = unionPeople
      .filter(p => selected[p.uniqueId])
      .map(p => ({ uniqueId: p.uniqueId, username: p.username }));

    setReceiptParticipants(participants);

    const sessionId = session?.sessionId ? String(session.sessionId) : undefined;
    const params = new URLSearchParams();
    const effectiveReceiptId = receiptId ?? sessionId;
    if (effectiveReceiptId) params.set('receiptId', effectiveReceiptId);
    if (participants.length > 0) {
      params.set('participants', encodeURIComponent(JSON.stringify(participants)));
    }
    const qs = params.toString();
    const target = qs ? `/tabs/sessions/items-split?${qs}` : '/tabs/sessions/items-split';
    router.push(target as any);
  };

  // UI: Select pill (84×29)
  const SelectPill = ({ on, onPress }: { on: boolean; onPress: () => void }) => (
    <Button
      unstyled
      onPress={onPress}
      animation="bouncy"
      pressStyle={{ transform: [{ scale: 0.98 }] }}
      width={84}
      height={29}
      borderRadius={10}
      borderWidth={1}
      borderColor="#D9D9D9"
      backgroundColor={on ? '#2ECC71' : 'transparent'}
      ai="center"
      jc="center"
    >
      <Text fontSize={14} fontWeight="500" color={on ? '#FFFFFF' : '#2C3D4FCC'}>
        {on ? 'Selected' : 'Select'}
      </Text>
    </Button>
  );

  // group chip
  const GroupChip = ({
    id, name, count, active, loading, onPress,
  }: { id: number; name: string; count?: number; active?: boolean; loading?: boolean; onPress: () => void }) => (
    <Button
      unstyled
      onPress={onPress}
      animation="bouncy"
      pressStyle={{ transform: [{ scale: 0.98 }] }}
      h={32}
      px={12}
      borderRadius={18}
      borderWidth={1}
      borderColor={active ? '#2ECC71' : '#D9D9D9'}
      backgroundColor={active ? '#2ECC71' : 'transparent'}
      ai="center"
      jc="center"
    >
      <XStack ai="center" gap="$1">
        <UsersIcon size={14} color={active ? '#FFFFFF' : '#2C3D4FCC'} />
        <Text fontSize={14} fontWeight="500" color={active ? '#FFFFFF' : '#2C3D4FCC'}>
          {name}
        </Text>
        <Text fontSize={12} color={active ? '#FFFFFF' : '#2C3D4FCC'}>
          · {typeof count === 'number' ? count : (loading ? '…' : '—')}
        </Text>
        {loading && <Spinner size="small" color={active ? 'white' : '$gray10'} />}
        {active && !loading && <Check size={14} color="#FFFFFF" />}
      </XStack>
    </Button>
  );

  const groupCount = (id: number) =>
    (typeof counts?.[id] === 'number' ? counts![id] : (groupMembers[id]?.length));

  // space for fixed Next
  const bottomPad = (insets?.bottom ?? 0) + 72;

  return (
    <YStack f={1} bg="$background">

      {/* Header */}
      <YStack bg="$background" px="$4" py="$3" borderBottomWidth={1} borderBottomColor="$gray5">
        <XStack ai="center" jc="space-between" mb="$2">
          <XStack ai="center" gap="$2" flex={1}>
            <Pressable onPress={() => router.back()}>
              <ChevronLeft size={24} color="#2C3D4F" />
            </Pressable>
            <Text fontSize={18} fontWeight="700">
              Add Participants
            </Text>
          </XStack>
          <Button
            unstyled
            onPress={() => setShowAddModal(true)}
            width={36}
            height={36}
            borderRadius={12}
            backgroundColor="#2ECC7120"
            ai="center"
            jc="center"
          >
            <Plus size={18} color="#2ECC71" />
          </Button>
        </XStack>
        <Text fontSize={12} color="$gray10">
          {selectedList.length > 0 ? `${selectedList.length} selected` : 'Select at least 1 person'}
        </Text>
      </YStack>

      {/* Content */}
      <ScrollView
        f={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: '$4' }}
      >
        {/* Groups */}
        {(groups ?? []).length > 0 && (
          <YStack mt="$4" mb="$3">
            <Text fontSize={12} fontWeight="600" color="$gray10" mb="$2" px="$0">
              GROUPS
            </Text>
            <XStack flexWrap="wrap" gap="$2">
              {(groups ?? []).map((g: any) => (
                <GroupChip
                  key={g.id}
                  id={g.id}
                  name={g.name ?? `Group #${g.id}`}
                  count={groupCount(g.id)}
                  active={activeGroupId === g.id}
                  loading={!!groupLoading[g.id]}
                  onPress={() => activateGroup(g.id)}
                />
              ))}
            </XStack>
          </YStack>
        )}

        {/* Search */}
        <YStack mt="$4" mb="$3">
          <XStack
            h={44}
            px="$4"
            borderRadius={10}
            bg="$backgroundPress"
            borderWidth={1}
            borderColor="$gray5"
            ai="center"
            gap="$2"
          >
            <Search size={16} color="$gray10" />
            <Input
              flex={1}
              placeholder="Search by name…"
              value={q}
              onChangeText={setQ}
              fontSize={14}
              bg="transparent"
              borderWidth={0}
              padding={0}
            />
          </XStack>
        </YStack>

        {/* Custom Participants */}
        {customParticipants.length > 0 && (
          <YStack mb="$3">
            <Text fontSize={12} fontWeight="600" color="$gray10" mb="$2" px="$0">
              CUSTOM PARTICIPANTS
            </Text>
            <YStack gap="$2">
              {customParticipants.map((p) => {
                const on = !!selected[p.uniqueId];
                return (
                  <XStack
                    key={p.uniqueId}
                    h={48}
                    px="$3"
                    py="$2"
                    borderRadius={10}
                    bg={on ? '#2ECC7115' : '$color1'}
                    borderWidth={1}
                    borderColor={on ? '#2ECC71' : '$gray5'}
                    ai="center"
                    jc="space-between"
                  >
                    <XStack ai="center" gap="$2" flex={1}>
                      <XStack
                        w={32}
                        h={32}
                        borderRadius={10}
                        bg="#F59E0B30"
                        ai="center"
                        jc="center"
                      >
                        <Text fontSize={14} fontWeight="700" color="#F59E0B">
                          {p.username?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </XStack>
                      <YStack flex={1}>
                        <Text fontSize={14} fontWeight="600">{p.username}</Text>
                        <Text fontSize={11} color="$gray10">Custom</Text>
                      </YStack>
                    </XStack>
                    <XStack ai="center" gap="$2">
                      <Pressable
                        onPress={() => toggleUser(p.uniqueId)}
                        style={[s.selectBtn, on && s.selectBtnActive]}
                      >
                        <Text fontSize={12} fontWeight="600" color={on ? 'white' : '#2C3D4FCC'}>
                          {on ? 'Selected' : 'Select'}
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => removeCustomParticipant(p.uniqueId)}>
                        <Trash2 size={16} color="#EF4444" />
                      </Pressable>
                    </XStack>
                  </XStack>
                );
              })}
            </YStack>
          </YStack>
        )}

        {/* Friends + Group Members */}
        {filtered.length > 0 && (
          <YStack mt={customParticipants.length > 0 ? '$3' : '$0'} mb="$3">
            {(basePeople.length > 0 || customParticipants.length > 0) && (
              <Text fontSize={12} fontWeight="600" color="$gray10" mb="$2" px="$0">
                {activeGroupId ? 'GROUP MEMBERS' : 'FRIENDS & CONTACTS'}
              </Text>
            )}
            <YStack gap="$2">
              {dedupByUniqueId(filtered).map((p) => {
                const on = !!selected[p.uniqueId];
                const isCustom = p.uniqueId.startsWith('custom#');
                const avatarUrl = p.avatarUrl ?? null;
                return (
                  <XStack
                    key={p.uniqueId}
                    h={48}
                    px="$3"
                    py="$2"
                    borderRadius={10}
                    bg={on ? '#2ECC7115' : '$color1'}
                    borderWidth={1}
                    borderColor={on ? '#2ECC71' : '$gray5'}
                    ai="center"
                    jc="space-between"
                  >
                    <XStack ai="center" gap="$2" flex={1}>
                      {avatarUrl ? (
                        <YStack
                          w={32}
                          h={32}
                          borderRadius={10}
                          bg="$gray5"
                          ai="center"
                          jc="center"
                        />
                      ) : (
                        <XStack
                          w={32}
                          h={32}
                          borderRadius={10}
                          bg={p.uniqueId === meUid ? '#3B82F630' : '$gray5'}
                          ai="center"
                          jc="center"
                        >
                          <Text fontSize={14} fontWeight="700" color={p.uniqueId === meUid ? '#3B82F6' : '$gray10'}>
                            {p.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </XStack>
                      )}
                      <YStack flex={1}>
                        <Text fontSize={14} fontWeight="600">
                          {p.username} {p.uniqueId === meUid ? '(You)' : ''}
                        </Text>
                        <Text fontSize={11} color="$gray10">
                          @{p.uniqueId.toLowerCase().replace('user#', 'user').replace('custom#', '')}
                        </Text>
                      </YStack>
                    </XStack>
                    <Pressable
                      onPress={() => toggleUser(p.uniqueId)}
                      style={[s.selectBtn, on && s.selectBtnActive]}
                    >
                      <Text fontSize={12} fontWeight="600" color={on ? 'white' : '#2C3D4FCC'}>
                        {on ? 'Selected' : 'Select'}
                      </Text>
                    </Pressable>
                  </XStack>
                );
              })}
            </YStack>
          </YStack>
        )}

        {/* Empty State */}
        {!friendsLoading && filtered.length === 0 && (
          <YStack mt="$8" ai="center" gap="$2">
            <Text fontSize={14} color="$gray10" textAlign="center">
              No friends found
            </Text>
            <Text fontSize={12} color="$gray10" textAlign="center">
              Tap the + button to add custom participants
            </Text>
          </YStack>
        )}

        {/* Loading */}
        {friendsLoading && (
          <YStack mt="$8" ai="center">
            <Spinner />
          </YStack>
        )}
      </ScrollView>

      {/* Fixed Next button */}
      <YStack
        position="absolute"
        left={0}
        right={0}
        bottom={(insets?.bottom ?? 0) + 8}
        ai="center"
        pointerEvents="box-none"
      >
        <Button
          unstyled
          onPress={goNext}
          disabled={!canNext}
          width={358}
          height={48}
          borderRadius={12}
          backgroundColor="#2ECC71"
          ai="center"
          jc="center"
          opacity={canNext ? 1 : 0.5}
        >
          <XStack ai="center" gap="$2">
            <Check size={20} color="white" />
            <Text fontSize={16} fontWeight="600" color="white">
              Continue
            </Text>
          </XStack>
        </Button>
      </YStack>

      {/* Add Participant Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content
            p="$4"
            borderRadius={16}
            w="90%"
            maxWidth={380}
            gap="$4"
          >
            <Dialog.Title fontSize={18} fontWeight="700" mb="$2">
              Add Participant
            </Dialog.Title>
            <YStack gap="$3">
              <Input
                placeholder="Enter name…"
                value={newParticipantName}
                onChangeText={setNewParticipantName}
                h={44}
                px="$4"
                borderRadius={10}
                bg="$backgroundPress"
                borderWidth={1}
                borderColor="$gray5"
                fontSize={14}
              />
              <XStack gap="$2">
                <Button
                  flex={1}
                  h={44}
                  borderRadius={10}
                  bg="$backgroundPress"
                  onPress={() => {
                    setShowAddModal(false);
                    setNewParticipantName('');
                  }}
                >
                  <Text fontWeight="600">Cancel</Text>
                </Button>
                <Button
                  flex={1}
                  h={44}
                  borderRadius={10}
                  bg="#2ECC71"
                  onPress={addCustomParticipant}
                  disabled={!newParticipantName.trim()}
                  opacity={newParticipantName.trim() ? 1 : 0.5}
                >
                  <Text fontWeight="600" color="white">Add</Text>
                </Button>
              </XStack>
            </YStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </YStack>
  );
}

const s = StyleSheet.create({
  selectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },
  selectBtnActive: {
    backgroundColor: '#2ECC71',
    borderColor: '#2ECC71',
  },
});
