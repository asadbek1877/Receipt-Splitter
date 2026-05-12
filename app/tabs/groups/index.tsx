import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Scan, Flower2 } from '@tamagui/lucide-icons';
import {
  YStack,
  Paragraph,
  Card,
  XStack,
  Spinner,
  Separator,
  View,
  Button,
  Text,
} from 'tamagui';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useGroupsStore } from '@/features/groups/model/groups.store';
import type { GroupMember } from '@/features/groups/api/groups.api';
import UserAvatar from '@/shared/ui/UserAvatar';
import Fab from '@/shared/ui/Fab';
import { useThemeColors } from '@/shared/lib/stores/theme-store';

function AvatarStack({
  members,
  totalCount,
  max = 5,
}: {
  members?: GroupMember[];
  totalCount?: number;
  max?: number;
}) {
  const list = Array.isArray(members) ? members : [];
  const total = typeof totalCount === 'number' ? totalCount : list.length;
  const shownMembers = list.slice(0, Math.min(max, list.length));
  const hasMembers = shownMembers.length > 0;
  const placeholderCount = hasMembers ? 0 : Math.min(total, max);
  const extra = Math.max(0, total - (hasMembers ? shownMembers.length : placeholderCount));

  if (!hasMembers && placeholderCount === 0) {
    return null;
  }

  const labelFor = (member: GroupMember) => {
    const source = member.displayName || member.username || member.uniqueId || '';
    return source.trim().charAt(0).toUpperCase() || 'U';
  };

  return (
    <XStack ai="center">
      {shownMembers.map((member, index) => (
        <View key={`${member.uniqueId ?? 'member'}-${index}`} ml={index === 0 ? 0 : -10}>
          <UserAvatar
            uri={member.avatarUrl ?? member.user?.avatarUrl ?? undefined}
            label={labelFor(member)}
            size={34}
            textSize={14}
            backgroundColor="$gray5"
          />
        </View>
      ))}
      {!hasMembers &&
        Array.from({ length: placeholderCount }).map((_, index) => (
          <View key={`placeholder-${index}`} w={34} h={34} br={17} bg="$gray5" ml={index === 0 ? 0 : -10} />
        ))}
      {extra > 0 && (
        <View
          w={28}
          h={28}
          br={14}
          bg="$gray8"
          ai="center"
          jc="center"
          ml={hasMembers || placeholderCount > 0 ? -10 : 0}
        >
          <Paragraph size="$1" col="white">
            +{extra}
          </Paragraph>
        </View>
      )}
    </XStack>
  );
}

export default function GroupsListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { groups, counts, loading, error, fetchGroups } = useGroupsStore();
  const colors = useThemeColors();

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const hasNoGroups = groups.length === 0;

  const cards = useMemo(
    () =>
      groups.map((group, index) => {
        const members = Array.isArray(group.members) ? group.members : [];
        const storedCount = counts?.[group.id];
        const apiCount = typeof group.counts?.members === 'number' ? group.counts.members : undefined;
        const memberCount =
          typeof storedCount === 'number'
            ? storedCount
            : typeof apiCount === 'number'
            ? apiCount
            : members.length;

        const countLabel = t('groups.list.members', { count: memberCount });
        const groupName = group.name ?? t('groups.common.untitled', 'Group');
        const emptyMembersLabel = t('groups.list.members_zero', 'No members yet');

        return (
          <Animated.View key={group.id} entering={FadeInDown.delay(index * 100).springify()}>
            <Card
              pressStyle={{ scale: 0.98 }}
              onPress={() =>
                router.push({
                  pathname: '/tabs/groups/[groupId]',
                  params: { groupId: String(group.id) },
                } as never)
              }
              h={72}
              br={16}
              bw={1.5}
              bc={colors.glassBorder}
              px="$4"
              ai="center"
              jc="center"
              backgroundColor={colors.glass}
              style={{
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              <XStack w="100%" jc="space-between" ai="center">
                <YStack>
                  <Text fontWeight="700" fontSize={16} color={colors.text}>
                    {groupName}
                  </Text>
                  <Text fontSize={12} color={colors.textSecondary}>
                    {memberCount === 0 ? emptyMembersLabel : countLabel}
                  </Text>
                </YStack>
                <AvatarStack members={members} totalCount={memberCount} />
              </XStack>
            </Card>
          </Animated.View>
        );
      }),
    [counts, groups, router, t, colors]
  );

  if (loading && hasNoGroups) {
    return (
      <YStack f={1} ai="center" jc="center" backgroundColor={colors.background}>
        <Spinner color={colors.primary} />
      </YStack>
    );
  }

  return (
    <YStack f={1} p="$4" gap="$4" backgroundColor={colors.background}>
      <Animated.View entering={FadeIn.duration(400)}>
        <XStack ai="center" gap="$2">
          <Flower2 size={24} color={colors.primary} />
          <Text fontWeight="700" fontSize={24} color={colors.text}>
            {t('groups.title', 'Groups')}
          </Text>
        </XStack>
      </Animated.View>
      
      <Separator backgroundColor={colors.glassBorder} />

      <XStack jc="flex-end" ai="center">
        <Button
          onPress={() =>
            router.push({ pathname: '/tabs/scan-invite', params: { from: 'groups-index' } } as never)
          }
          size="$3"
          borderRadius={12}
          backgroundColor={colors.primary}
          color="white"
          icon={<Scan size={18} color="white" />}
          pressStyle={{ opacity: 0.8 }}
        >
          {t('groups.actions.scanInvite', 'Scan invite')}
        </Button>
      </XStack>

      {error && <Text color="#EF4444">{error}</Text>}

      {hasNoGroups ? (
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <YStack 
            ai="center" 
            jc="center" 
            py="$8" 
            px="$4"
            backgroundColor={colors.glass}
            borderRadius={16}
            borderWidth={1}
            borderColor={colors.glassBorder}
          >
            <Flower2 size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text color={colors.textSecondary} textAlign="center">
              {t('groups.empty', 'No groups yet. Tap + to create.')}
            </Text>
          </YStack>
        </Animated.View>
      ) : (
        <YStack gap="$3">{cards}</YStack>
      )}

      <Fab onPress={() => router.push('/tabs/groups/create' as never)} />
    </YStack>
  );
}
