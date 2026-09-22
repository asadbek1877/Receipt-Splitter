import React, { useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { YStack, XStack, Text, ScrollView, Button } from 'tamagui';
import {
  Calendar,
  ChevronLeft,
  CreditCard,
  ListChecks,
  Package,
  ReceiptText,
  Users as UsersIcon,
} from '@tamagui/lucide-icons';
import { Pressable } from 'react-native';

import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type {
  SessionHistoryAllocation,
  SessionHistoryEntry,
  SessionHistoryItem,
  SessionHistoryParticipantLight,
  SessionHistoryTotalsByParticipant,
} from '@/features/sessions/api/history.api';

const DEFAULT_CURRENCY = 'UZS';
const DETAIL_LIMIT = 50;
const BULLET = '\u2022';

const fmtCurrency = (value: number, currency: string) =>
  `${currency} ${Math.round(value || 0).toLocaleString()}`;

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
  amount: number;
  items: Array<{
    id: string;
    title: string;
    price: number;
    units?: number | null;
    ratio?: number;
  }>;
};

const formatShareDetail = (units?: number | null, ratio?: number) => {
  if (units) return `${units} dona`;
  if (ratio) return `${Math.round(ratio * 100)}% ulush`;
  return 'ulush';
};

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <XStack ai="center" gap="$2" mb="$2">
      <XStack w={30} h={30} br={8} bg="#2ECC7118" ai="center" jc="center">
        {icon}
      </XStack>
      <YStack flex={1}>
        <Text fontSize={14} fontWeight="700">
          {title}
        </Text>
        {subtitle && (
          <Text fontSize={11} color="$gray10">
            {subtitle}
          </Text>
        )}
      </YStack>
    </XStack>
  );
}

function Section({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <YStack borderWidth={1} borderColor="$gray5" br={14} bg="$color1" px="$3" py="$3">
      {children}
    </YStack>
  );
}

const buildParticipantsView = (bill?: SessionHistoryEntry): ParticipantView[] => {
  if (!bill) return [];

  const totalsByParticipant = new Map<string, SessionHistoryTotalsByParticipant>();
  (bill.totals?.byParticipant ?? []).forEach((item) => {
    totalsByParticipant.set(item.uniqueId, item);
  });

  const itemsById = new Map<string, SessionHistoryItem>();
  (bill.totals?.byItem ?? []).forEach((item) => {
    itemsById.set(item.itemId, item);
  });

  const allocationsByParticipant = new Map<string, SessionHistoryAllocation[]>();
  (bill.allocations ?? []).forEach((alloc) => {
    const collection = allocationsByParticipant.get(alloc.participantId) ?? [];
    collection.push(alloc);
    allocationsByParticipant.set(alloc.participantId, collection);
  });

  return (bill.participants ?? []).map((participant) => {
    const totals = totalsByParticipant.get(participant.uniqueId);
    const allocations = allocationsByParticipant.get(participant.uniqueId) ?? [];
    const items = allocations.map((allocation, index) => {
      const itemMeta = itemsById.get(allocation.itemId);
      return {
        id: `${allocation.itemId}-${participant.uniqueId}-${index}`,
        title: itemMeta?.name || 'Tovar',
        price: allocation.shareAmount,
        units: allocation.shareUnits,
        ratio: allocation.shareRatio,
      };
    });

    return {
      participant: {
        uniqueId: participant.uniqueId,
        username: totals?.username || participant.username || 'U',
        avatarUrl: participant.avatarUrl ?? null,
      },
      amount: totals?.amountOwed ?? 0,
      items,
    };
  });
};

export default function HistoryDetailsScreen() {
  const { historyId } = useLocalSearchParams<{ historyId: string }>();
  const router = useRouter();
  const sessions = useSessionsHistoryStore((state) => state.sessions);
  const loading = useSessionsHistoryStore((state) => state.loading);
  const initialized = useSessionsHistoryStore((state) => state.initialized);
  const currentLimit = useSessionsHistoryStore((state) => state.limit);
  const error = useSessionsHistoryStore((state) => state.error);
  const fetchHistory = useSessionsHistoryStore((state) => state.fetchHistory);

  const bill = useMemo(() => {
    if (!historyId) return undefined;
    const id = Number(historyId);
    if (Number.isNaN(id)) return undefined;
    return sessions.find((session) => session.sessionId === id);
  }, [historyId, sessions]);

  useEffect(() => {
    if (loading) return;
    const hasBill = Boolean(bill);
    if (!initialized || (!hasBill && (currentLimit ?? 0) < DETAIL_LIMIT)) {
      fetchHistory(DETAIL_LIMIT).catch(() => {});
    }
  }, [initialized, loading, currentLimit, fetchHistory, bill]);

  const participants = useMemo(() => buildParticipantsView(bill), [bill]);
  const currency = bill?.currency || DEFAULT_CURRENCY;
  const payerName = bill?.payer?.username || bill?.payload?.payer?.username || 'Siz';
  const itemCount = bill?.totals?.byItem?.length ?? 0;

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
        {error && <Text fontSize={14} color="$red10">{error}</Text>}
        <Button onPress={() => router.back()}>Go back</Button>
      </YStack>
    );
  }

  return (
    <YStack f={1} bg="$background">
      <YStack bg="$background" px="$4" py="$3" borderBottomWidth={1} borderBottomColor="$gray5">
        <XStack ai="center" gap="$2" mb="$3">
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={24} color="#2C3D4F" />
          </Pressable>
          <Text fontSize={18} fontWeight="700" flex={1} numberOfLines={1}>
            {bill.sessionName || 'Receipt'}
          </Text>
        </XStack>

        <Section>
          <XStack ai="center" jc="space-between">
            <XStack ai="center" gap="$2" flex={1}>
              <Calendar size={14} color="$gray10" />
              <Text fontSize={12} color="$gray10">
                {formatSessionDate(bill.finalizedAt || bill.createdAt)}
              </Text>
            </XStack>
            <XStack ai="center" gap="$1">
              <ReceiptText size={14} color="#2ECC71" />
              <Text fontSize={12} color="$gray10">{itemCount} mahsulot</Text>
            </XStack>
          </XStack>

          <XStack ai="center" jc="space-between" mt="$2">
            <XStack ai="center" gap="$2" flex={1}>
              <CreditCard size={14} color="$gray10" />
              <Text fontSize={12} color="$gray10" numberOfLines={1}>
                To'lovchi: {payerName}
              </Text>
            </XStack>
            <XStack ai="center" gap="$1">
              <UsersIcon size={14} color="$gray10" />
              <Text fontSize={12} color="$gray10">
                {(bill.participants ?? []).length} ishtirokchi
              </Text>
            </XStack>
          </XStack>

          <XStack ai="center" jc="space-between" mt="$2" pt="$2" borderTopWidth={1} borderTopColor="$gray5">
            <Text fontSize={12} color="$gray10">Umumiy summa</Text>
            <Text fontSize={20} fontWeight="800" color="#2ECC71">
              {fmtCurrency(bill.grandTotal ?? 0, currency)}
            </Text>
          </XStack>
        </Section>
      </YStack>

      <ScrollView
        f={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: '$4', paddingVertical: '$4', paddingBottom: 24 }}
      >
        <YStack gap="$3">
          <Section>
            <SectionHeader
              icon={<UsersIcon size={17} color="#2ECC71" />}
              title="Ishtirokchilar ulushi"
              subtitle="Har bir odam bo'yicha summa va mahsulot ulushlari"
            />
            {participants.length > 0 ? (
              <YStack gap="$2">
                {participants.map(({ participant, amount, items }) => (
                  <YStack
                    key={participant.uniqueId}
                    borderWidth={1}
                    borderColor="$gray5"
                    br={10}
                    bg="$background"
                    px="$3"
                    py="$3"
                    gap="$3"
                  >
                    <XStack jc="space-between" ai="center" gap="$2">
                      <XStack ai="center" gap="$2" flex={1}>
                        <XStack w={36} h={36} br={10} bg="#2ECC7118" ai="center" jc="center">
                          <Text fontSize={14} fontWeight="700" color="#2ECC71">
                            {(participant.username || 'U').slice(0, 1).toUpperCase()}
                          </Text>
                        </XStack>
                        <YStack flex={1}>
                          <Text fontSize={14} fontWeight="600" numberOfLines={1}>
                            {participant.username}
                          </Text>
                          <Text fontSize={11} color="$gray10">
                            {items.length} mahsulot bo'yicha ulush
                          </Text>
                        </YStack>
                      </XStack>
                      <YStack ai="flex-end">
                        <Text fontSize={14} fontWeight="700" color="#2ECC71">
                          {fmtCurrency(amount, currency)}
                        </Text>
                        <Text fontSize={10} color="$gray10">to'lashi kerak</Text>
                      </YStack>
                    </XStack>

                    {items.length > 0 && (
                      <YStack gap="$2" borderTopWidth={1} borderTopColor="$gray5" pt="$2">
                        {items.map((item) => (
                          <XStack key={item.id} jc="space-between" ai="center" gap="$2">
                            <YStack flex={1}>
                              <Text fontSize={13} color="$gray11" numberOfLines={1}>
                                {item.title}
                              </Text>
                              <Text fontSize={10} color="$gray10">
                                {formatShareDetail(item.units, item.ratio)}
                              </Text>
                            </YStack>
                            <Text fontSize={13} fontWeight="600" color="$gray11">
                              {fmtCurrency(item.price, currency)}
                            </Text>
                          </XStack>
                        ))}
                      </YStack>
                    )}
                  </YStack>
                ))}
              </YStack>
            ) : (
              <YStack ai="center" py="$6">
                <Text fontSize={14} color="$gray10">No participant data</Text>
              </YStack>
            )}
          </Section>

          {bill.totals?.byItem && bill.totals.byItem.length > 0 && (
            <Section>
              <SectionHeader
                icon={<Package size={17} color="#2ECC71" />}
                title="Mahsulotlar to'liq ro'yxati"
                subtitle="Chekdagi mahsulotlar boshqa ma'lumotlardan alohida"
              />
              <YStack gap="$2">
                {bill.totals.byItem.map((item: any, index: number) => (
                  <XStack
                    key={item.itemId}
                    px="$3"
                    py="$3"
                    bg="$background"
                    br={10}
                    borderWidth={1}
                    borderColor="$gray5"
                    jc="space-between"
                    ai="center"
                    gap="$2"
                  >
                    <XStack w={28} h={28} br={8} bg="#2ECC7118" ai="center" jc="center">
                      <Text fontSize={12} fontWeight="700" color="#2ECC71">
                        {index + 1}
                      </Text>
                    </XStack>
                    <YStack flex={1} pr="$2">
                      <Text fontSize={13} fontWeight="600" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text fontSize={10} color="$gray10">
                        {item.quantity ? `${item.quantity} dona` : '1 dona'}
                        {item.splitMode
                          ? ` ${BULLET} ${item.splitMode === 'count' ? "dona bo'yicha" : "teng bo'lingan"}`
                          : ''}
                      </Text>
                    </YStack>
                    <YStack ai="flex-end">
                      <Text fontSize={13} fontWeight="700">
                        {fmtCurrency(Number(item.total ?? item.totalAmount ?? 0), currency)}
                      </Text>
                      {(item.unitPrice || item.price) && (
                        <Text fontSize={10} color="$gray10">
                          birlik: {fmtCurrency(Number(item.unitPrice ?? item.price ?? 0), currency)}
                        </Text>
                      )}
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            </Section>
          )}

          {bill.allocations && bill.allocations.length > 0 && (
            <Section>
              <SectionHeader
                icon={<ListChecks size={17} color="#2ECC71" />}
                title="Taqsimot jurnali"
                subtitle="Kim, qaysi mahsulotdan, qancha ulush olgani"
              />
              <YStack gap="$2">
                {bill.allocations.map((allocation, index) => {
                  const participant = (bill.participants ?? []).find(
                    (p) => p.uniqueId === allocation.participantId
                  );
                  const item = (bill.totals?.byItem ?? []).find(
                    (i) => i.itemId === allocation.itemId
                  );
                  return (
                    <XStack
                      key={`${allocation.itemId}-${allocation.participantId}-${index}`}
                      px="$3"
                      py="$2"
                      bg="$background"
                      br={10}
                      borderWidth={1}
                      borderColor="$gray5"
                      jc="space-between"
                      ai="center"
                      gap="$2"
                    >
                      <YStack flex={1}>
                        <Text fontSize={12} fontWeight="600" numberOfLines={1}>
                          {participant?.username || allocation.participantId}
                        </Text>
                        <Text fontSize={10} color="$gray10" numberOfLines={1}>
                          {item?.name || allocation.itemId} {BULLET}{' '}
                          {formatShareDetail(allocation.shareUnits, allocation.shareRatio)}
                        </Text>
                      </YStack>
                      <Text fontSize={12} fontWeight="700" color="#2ECC71">
                        {fmtCurrency(allocation.shareAmount, currency)}
                      </Text>
                    </XStack>
                  );
                })}
              </YStack>
            </Section>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
