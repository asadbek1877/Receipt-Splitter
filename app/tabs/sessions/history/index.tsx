import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl } from 'react-native';
import { YStack, XStack, Text, ScrollView, View } from 'tamagui';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Flower2 } from '@tamagui/lucide-icons';

import UserAvatar from '@/shared/ui/UserAvatar';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type { SessionHistoryEntry, SessionHistoryParticipantLight } from '@/features/sessions/api/history.api';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { getJapaneseColors } from '@/shared/ui/JapaneseTheme';

const BULLET = '\u2022';
const HISTORY_LIMIT = 50;
const DEFAULT_CURRENCY = 'UZS';

const formatSessionDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('uz-UZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function AvatarGroup({ participants }: { participants: SessionHistoryParticipantLight[] }) {
  const shown = participants.slice(0, 4);
  const extra = Math.max(0, participants.length - shown.length);
  return (
    <XStack ai="center">
      {shown.map((participant, idx) => (
        <View key={participant.uniqueId ?? idx} ml={idx === 0 ? 0 : -8}>
          <UserAvatar
            uri={participant.avatarUrl ?? undefined}
            label={(participant.username || 'U').slice(0, 1).toUpperCase()}
            size={28}
            textSize={12}
            backgroundColor="$gray5"
          />
        </View>
      ))}
      {extra > 0 && (
        <View
          w={28}
          h={28}
          br={14}
          backgroundColor="#CBD5F5"
          borderWidth={2}
          borderColor="white"
          ml={shown.length === 0 ? 0 : -8}
          ai="center"
          jc="center"
        >
          <Text fontSize={10} color="$gray11">+{extra}</Text>
        </View>
      )}
    </XStack>
  );
}

function HistoryCard({
  title,
  summary,
  amountLabel,
  participants,
  status,
  isCreator,
  onPress,
  colors,
  index,
}: {
  title: string;
  summary: string;
  amountLabel: string;
  participants: SessionHistoryParticipantLight[];
  status?: string;
  isCreator?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof getJapaneseColors>;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ width: 358, opacity: pressed ? 0.9 : 1 })}
      >
        <YStack
          h={125}
          br={16}
          borderWidth={1.5}
          borderColor={colors.glassBorder}
          p="$3"
          backgroundColor={colors.glass}
          style={{
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
          }}
        >
          <XStack jc="space-between" ai="center">
            <YStack f={1} mr="$2">
              <Text fontSize={16} fontWeight="600" lineHeight={19} color={colors.text}>
                {title}
              </Text>
              <Text mt="$1" fontSize={12} lineHeight={14} color={colors.textSecondary}>
                {summary}
              </Text>
            </YStack>
            <YStack ai="flex-end">
              <Text fontSize={14} lineHeight={22} fontWeight="700" color={colors.primary}>
                {amountLabel}
              </Text>
              {status && (
                <View mt={4} px={8} py={2} br={8} backgroundColor={status === 'finalized' ? '#2ECC7120' : '#F59E0B20'}>
                  <Text fontSize={10} color={status === 'finalized' ? '#2ECC71' : '#F59E0B'} fontWeight="600">
                    {status === 'finalized' ? 'Yakunlangan' : 'Jarayonda'}
                  </Text>
                </View>
              )}
            </YStack>
          </XStack>

          <XStack mt="auto" ai="center" jc="space-between">
            <AvatarGroup participants={participants} />
            {isCreator && (
              <View px={8} py={2} br={8} backgroundColor="#E8F4FD" borderColor="#CEDDFC" borderWidth={1}>
                <Text fontSize={10} color="#2B5A9B" fontWeight="600">Siz tuzgansiz</Text>
              </View>
            )}
          </XStack>
        </YStack>
      </Pressable>
    </Animated.View>
  );
}

export default function SessionsHistoryScreen() {
  const router = useRouter();
  const sessions = useSessionsHistoryStore(state => state.sessions);
  const loading = useSessionsHistoryStore(state => state.loading);
  const initialized = useSessionsHistoryStore(state => state.initialized);
  const currentLimit = useSessionsHistoryStore(state => state.limit);
  const error = useSessionsHistoryStore(state => state.error);
  const fetchHistory = useSessionsHistoryStore(state => state.fetchHistory);
  const refreshIfStale = useSessionsHistoryStore(state => state.refreshIfStale);
  
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getJapaneseColors(isDark);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!initialized || (currentLimit ?? 0) < HISTORY_LIMIT) {
      fetchHistory(HISTORY_LIMIT).catch(() => {});
    } else {
      // если уже инициализировано — подёргаем обновление по давности
      refreshIfStale(15_000, HISTORY_LIMIT).catch(() => {});
    }
  }, [initialized, loading, currentLimit, fetchHistory, refreshIfStale]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchHistory(HISTORY_LIMIT);
    } finally {
      setRefreshing(false);
    }
  }, [fetchHistory]);

  const history = useMemo<SessionHistoryEntry[]>(() => sessions, [sessions]);

  return (
    <YStack f={1} backgroundColor={colors.background} px="$4" pt="$4">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 32, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <YStack w={358} gap="$1" mb="$2">
            <XStack ai="center" gap="$2">
              <Flower2 size={24} color={colors.primary} />
              <Text fontSize={24} fontWeight="700" color={colors.text}>Oxirgi hisoblar</Text>
            </XStack>
            <Text fontSize={12} color={colors.textSecondary}>Bosh sahifa</Text>
          </YStack>
        </Animated.View>

        {loading && (
          <Text color={colors.textSecondary} fontSize={14}>
            Yuklanmoqda...
          </Text>
        )}
        {error && (
          <Text color="#EF4444" fontSize={14}>
            {error}
          </Text>
        )}
        {!loading && !error && !history.length && (
          <YStack 
            ai="center" 
            py="$6" 
            px="$4"
            backgroundColor={colors.glass}
            borderRadius={16}
            borderWidth={1}
            borderColor={colors.glassBorder}
          >
            <Flower2 size={40} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text color={colors.textSecondary} fontSize={14}>
              Hali tarix mavjud emas
            </Text>
          </YStack>
        )}

        {history.map((bill, index) => {
          const participants = bill.participants ?? [];
          const dateForSummary = bill.finalizedAt || bill.createdAt;
          const summary = `${formatSessionDate(dateForSummary)} ${BULLET} ${participants.length} ishtirokchi`;
          const totalAmount = bill.grandTotal ?? 0;
          const currency = bill.currency || DEFAULT_CURRENCY;
          const amountLabel = `${currency} ${totalAmount.toLocaleString()}`;
          return (
            <HistoryCard
              key={bill.sessionId}
              title={bill.sessionName || 'Hisob'}
              summary={summary}
              amountLabel={amountLabel}
              participants={participants}
                status={bill.payload?.status}
                isCreator={bill.isCreator}
                colors={colors}
              index={index}
              onPress={() =>
                router.push({
                  pathname: '/tabs/sessions/history/[historyId]',
                  params: { historyId: String(bill.sessionId) },
                })
              }
            />
          );
        })}
      </ScrollView>
    </YStack>
  );
}

