import React, { useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { YStack, XStack, Text, ScrollView, Button } from 'tamagui';
import { ChevronLeft, Calendar, Users as UsersIcon } from '@tamagui/lucide-icons';
import { Pressable } from 'react-native';

import UserAvatar from '@/shared/ui/UserAvatar';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type {
  SessionHistoryEntry,
  SessionHistoryAllocation,
  SessionHistoryItem,
  SessionHistoryParticipantLight,
  SessionHistoryTotalsByParticipant,
} from '@/features/sessions/api/history.api';

const DEFAULT_CURRENCY = 'UZS';
const fmtCurrency = (value: number, currency: string) => `${currency} ${value.toLocaleString()}`;
const BULLET = '\u2022';
const DETAIL_LIMIT = 50;

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

type ParticipantView = {
  participant: SessionHistoryParticipantLight;
  avatarUrl?: string | null;
  amount: number;
  items: {
    id: string;
    title: string;
    price: number;
  }[];
};

const buildParticipantsView = (bill?: SessionHistoryEntry): ParticipantView[] => {
  if (!bill) return [];

  const totalsByParticipant = new Map<string, SessionHistoryTotalsByParticipant>();
  (bill.totals?.byParticipant ?? []).forEach(item => {
    totalsByParticipant.set(item.uniqueId, item);
  });

  const itemsById = new Map<string, SessionHistoryItem>();
  (bill.totals?.byItem ?? []).forEach(item => {
    itemsById.set(item.itemId, item);
  });

  const allocationsByParticipant = new Map<string, SessionHistoryAllocation[]>();
  (bill.allocations ?? []).forEach(alloc => {
    const collection = allocationsByParticipant.get(alloc.participantId) ?? [];
    collection.push(alloc);
    allocationsByParticipant.set(alloc.participantId, collection);
  });

  return (bill.participants ?? []).map(p => {
    const totals = totalsByParticipant.get(p.uniqueId);
    const allocations = allocationsByParticipant.get(p.uniqueId) ?? [];
    const items = allocations.map((allocation, index) => {
      const itemMeta = itemsById.get(allocation.itemId);
      return {
        id: `${allocation.itemId}-${p.uniqueId}-${index}`,
        title: itemMeta?.name || 'Tovar',
        price: allocation.shareAmount,
      };
    });
    return {
      participant: {
        uniqueId: p.uniqueId,
        username: totals?.username || p.username || 'U',
        avatarUrl: p.avatarUrl ?? null,
      },
      avatarUrl: p.avatarUrl ?? null,
      amount: totals?.amountOwed ?? 0,
      items,
    };
  });
};

export default function HistoryDetailsScreen() {
  const { historyId } = useLocalSearchParams<{ historyId: string }>();
  const router = useRouter();
  const sessions = useSessionsHistoryStore(state => state.sessions);
  const loading = useSessionsHistoryStore(state => state.loading);
  const initialized = useSessionsHistoryStore(state => state.initialized);
  const currentLimit = useSessionsHistoryStore(state => state.limit);
  const error = useSessionsHistoryStore(state => state.error);
  const fetchHistory = useSessionsHistoryStore(state => state.fetchHistory);

  const bill: SessionHistoryEntry | undefined = useMemo(() => {
    if (!historyId) return undefined;
    const id = Number(historyId);
    if (Number.isNaN(id)) return undefined;
    return sessions.find(session => session.sessionId === id);
  }, [historyId, sessions]);

  useEffect(() => {
    if (loading) return;
    const hasBill = Boolean(bill);
    if (!initialized || (!hasBill && (currentLimit ?? 0) < DETAIL_LIMIT)) {
      fetchHistory(DETAIL_LIMIT).catch(() => {});
    }
  }, [initialized, loading, currentLimit, fetchHistory, bill]);

  const participants = useMemo(() => buildParticipantsView(bill), [bill]);
  const currency =
    bill?.currency ||
    DEFAULT_CURRENCY;

  if (!bill && loading) {
    return (
      <YStack f={1} bg="$background" ai="center" jc="center">
        <Text fontSize={16}>Yuklanmoqda...</Text>
      </YStack>
    );
  }

  if (!bill) {
    return (
      <YStack f={1} bg="$background" ai="center" jc="center" gap="$3">
        <Text fontSize={16} fontWeight="600">History not found</Text>
        {error && (
          <Text fontSize={14} color="$red10">
            {error}
          </Text>
        )}
        <Button onPress={() => router.back()}>Go back</Button>
      </YStack>
    );
  }

  return (
    <YStack f={1} bg="$background">
      {/* Header */}
      <YStack bg="$background" px="$4" py="$3" borderBottomWidth={1} borderBottomColor="$gray5">
        <XStack ai="center" gap="$2" mb="$3">
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={24} color="#2C3D4F" />
          </Pressable>
          <Text fontSize={18} fontWeight="700" flex={1}>
            {bill.sessionName || 'Receipt'}
          </Text>
        </XStack>
        
        <YStack gap="$2">
          <XStack ai="center" gap="$2">
            <Calendar size={14} color="$gray10" />
            <Text fontSize={12} color="$gray10">
              {formatSessionDate(bill.finalizedAt || bill.createdAt)}
            </Text>
          </XStack>
          
          <XStack ai="center" gap="$2">
            <UsersIcon size={14} color="$gray10" />
            <Text fontSize={12} color="$gray10">
              {(bill.participants ?? []).length} participant{(bill.participants ?? []).length !== 1 ? 's' : ''}
            </Text>
          </XStack>
          
          <XStack ai="center" gap="$2" mt="$2">
            <Text fontSize={14} color="$gray10">Total:</Text>
            <Text fontSize={18} fontWeight="700" color="#2ECC71">
              {fmtCurrency(bill.grandTotal ?? 0, currency)}
            </Text>
          </XStack>
        </YStack>
      </YStack>

      {/* Content */}
      <ScrollView
        f={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: '$4', paddingVertical: '$4', paddingBottom: 24 }}
      >
        <YStack gap="$3">
          {participants.length > 0 ? (
            participants.map(({ participant, avatarUrl, amount, items }) => (
              <YStack
                key={participant.uniqueId}
                borderWidth={1}
                borderColor="#2ECC7140"
                br={12}
                bg="$color1"
                px="$4"
                py="$3"
                gap="$3"
              >
                {/* Participant Header */}
                <XStack jc="space-between" ai="center">
                  <XStack ai="center" gap="$2" flex={1}>
                    <XStack
                      w={36}
                      h={36}
                      br={10}
                      bg="#2ECC7120"
                      ai="center"
                      jc="center"
                    >
                      <Text fontSize={14} fontWeight="700" color="#2ECC71">
                        {(participant.username || 'U').slice(0, 1).toUpperCase()}
                      </Text>
                    </XStack>
                    <YStack flex={1}>
                      <Text fontSize={14} fontWeight="600">{participant.username}</Text>
                      <Text fontSize={11} color="$gray10">
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </Text>
                    </YStack>
                  </XStack>
                  <YStack ai="flex-end">
                    <Text fontSize={14} fontWeight="700" color="#2ECC71">
                      {fmtCurrency(amount, currency)}
                    </Text>
                  </YStack>
                </XStack>

                {/* Items List */}
                {items.length > 0 && (
                  <YStack gap="$2" borderTopWidth={1} borderTopColor="$gray5" pt="$2">
                    {items.map((item) => (
                      <XStack key={item.id} jc="space-between" ai="center" px="$1">
                        <Text fontSize={13} color="$gray11" flex={1}>
                          {item.title}
                        </Text>
                        <Text fontSize={13} fontWeight="600" color="$gray11">
                          {fmtCurrency(item.price, currency)}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                )}
              </YStack>
            ))
          ) : (
            <YStack ai="center" py="$8" gap="$2">
              <Text fontSize={14} color="$gray10">No participant data</Text>
            </YStack>
          )}

          {/* Summary Section */}
          {bill.totals?.byItem && bill.totals.byItem.length > 0 && (
            <YStack mt="$3" gap="$2">
              <Text fontSize={12} fontWeight="600" color="$gray10" px="$0">
                ITEMS SUMMARY
              </Text>
              <YStack gap="$2">
                {bill.totals.byItem.map((item: any) => (
                  <XStack
                    key={item.itemId}
                    px="$3"
                    py="$2"
                    bg="$backgroundColor"
                    br={8}
                    jc="space-between"
                    ai="center"
                  >
                    <Text fontSize={13} fontWeight="500">{item.name}</Text>
                    <Text fontSize={13} fontWeight="600">
                      {fmtCurrency(item.total, currency)}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
