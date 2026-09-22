import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { YStack, XStack, Text, Button, ScrollView } from 'tamagui';
import { Check } from '@tamagui/lucide-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { FinalizeTotalsByItem, FinalizeTotalsByParticipant, ReceiptAllocation } from '@/features/receipt/api/receipt.api';
import { useReceiptSessionStore, type FinishPayload } from '@/features/receipt/model/receipt-session.store';
import { useSplitterStore } from '@/shared/store/useSplitterStore';
import type { Debt } from '@/entities/debt';
import { useAppStore } from '@/shared/lib/stores/app-store';
import UserAvatar from '@/shared/ui/UserAvatar';
import SettlementCard, {
  type PaymentMethod,
  type SettlementCardItem,
  type SettlementUser,
} from '@/features/settlements/ui/SettlementCard';

type Participant = { uniqueId: string; username: string };

type ParticipantAmount = { uniqueId: string; username: string; amount: number };
type ItemSummary = {
  itemId: string;
  name: string;
  total: number;
  allocations: ParticipantAmount[];
};

const pickFirstNumber = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
};
const fmtCurrency = (n: number, currency: string) => `${currency} ${Math.round(n).toLocaleString('en-US')}`;

const getCurrencyParts = (n: number, currency: string) => {
  const formatted = fmtCurrency(n, currency);
  const [cur, ...rest] = formatted.split(' ');
  return { currency: cur, amount: rest.join(' ') || '0' };
};

export default function FinishScreen() {
  const { t } = useTranslation();
  const { data } = useLocalSearchParams<{ data?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lastFinishPayload = useReceiptSessionStore((s) => s.lastFinishPayload);
  const currentUser = useAppStore((s) => s.user);
  const currentUserId = currentUser?.uniqueId ?? null;
  const currentUserName = currentUser?.username ?? null;
  const setSplitterState = useSplitterStore.setState;

  const payload = useMemo<FinishPayload | null>(() => {
    if (data) {
      try {
        return data ? (JSON.parse(decodeURIComponent(data)) as FinishPayload) : null;
      } catch (error) {
        console.warn('[Finish] Failed to parse data param', {
          error: error instanceof Error ? error.message : String(error),
          sample: typeof data === 'string' ? data.slice(0, 200) : data,
        });
        try {
          return JSON.parse(data) as FinishPayload;
        } catch {
          // ignore and fallback to store
        }
      }
    }
    return lastFinishPayload ?? null;
  }, [data, lastFinishPayload]);

  const participants: Participant[] = payload?.participants ?? [];
  const totals: Record<string, number> = payload?.totals ?? {};
  const totalsByParticipantList: FinalizeTotalsByParticipant[] = payload?.totalsByParticipant ?? [];
  const totalsByItemList: FinalizeTotalsByItem[] = payload?.totalsByItem ?? [];
  const allocationsList: ReceiptAllocation[] = payload?.allocations ?? [];
  const knownGrandTotal = payload?.grandTotal;
  const sessionName = payload?.sessionName;
  const status = payload?.status;
  const receiptId = payload?.receiptId;
  const currency = payload?.currency || 'UZS';

  const { participantSummaries, itemSummaries, effectiveGrandTotal } = useMemo(() => {
    type RawParticipantTotal = FinalizeTotalsByParticipant & {
      participantId?: string;
      userId?: string;
      id?: string | number;
      amount?: number;
      total?: number;
      shareAmount?: number;
      balance?: number;
      value?: number;
      owed?: number;
      participantName?: string;
      displayName?: string;
      participant?: {
        id?: string | number;
        uniqueId?: string;
        userId?: string;
        username?: string;
        name?: string;
        displayName?: string;
      };
      user?: {
        id?: string | number;
        uniqueId?: string;
        username?: string;
        name?: string;
      };
      amountDetails?: {
        value?: number;
        total?: number;
      };
      totals?: {
        amount?: number;
        total?: number;
      };
      meta?: {
        amount?: number;
      };
    };

    const normalizeId = (value?: string | null): string | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      if (trimmed.length === 0) return undefined;
      if (trimmed === 'undefined' || trimmed === 'null') return undefined;
      return trimmed;
    };

    const toMaybeNumber = (value: unknown): number | undefined => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim().replace(/\s+/g, '');
        if (trimmed.length === 0) return undefined;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    };

    const pickFromArray = <T,>(value: unknown, index: number): T | undefined => {
      if (!Array.isArray(value)) return undefined;
      return value[index] as T | undefined;
    };

    const normalizeName = (value?: string | null) =>
      (value ?? '')
        .trim()
        .replace(/\s*\((you|me)\)\s*$/i, '')
        .trim();

    const currentUserAliases = new Set(
      [currentUserId, currentUserName, 'You']
        .map((value) => normalizeName(normalizeId(value) ?? value ?? '').toLowerCase())
        .filter(Boolean)
    );

    const isCurrentUserValue = (value?: string | null) => {
      if (!currentUserId) return false;
      const normalized = normalizeName(normalizeId(value) ?? value ?? '').toLowerCase();
      return normalized.length > 0 && currentUserAliases.has(normalized);
    };

    const canonicalizeParticipantId = (value?: string | null, name?: string | null) => {
      const id = normalizeId(value);
      if (currentUserId && (isCurrentUserValue(id) || isCurrentUserValue(name))) {
        return currentUserId;
      }
      return id;
    };

    const displayNameFor = (id: string, name?: string | null) => {
      if (currentUserId && id === currentUserId) {
        return currentUserName ?? t('common.you');
      }
      return normalizeName(name) || id;
    };

    const totalsAccumulator = new Map<string, number>();
    Object.entries(totals ?? {}).forEach(([rawId, value]) => {
      const id = canonicalizeParticipantId(rawId);
      if (!id) return;
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      totalsAccumulator.set(id, (totalsAccumulator.get(id) ?? 0) + value);
    });
    const totalsEntries = Array.from(totalsAccumulator.entries());
    const totalsMap = new Map<string, number>(totalsEntries);

    const normalizedParticipantTotals = (totalsByParticipantList as unknown[]).reduce<
      Array<{ uniqueId: string; username: string; amountOwed: number }>
    >((acc, rawEntry) => {
      const raw = rawEntry as RawParticipantTotal;
      if (!raw) return acc;
      const candidate = raw as RawParticipantTotal;

      const candidateId =
        normalizeId(candidate.uniqueId) ??
        normalizeId(candidate.participantId) ??
        normalizeId(candidate.userId) ??
        normalizeId(
          typeof candidate.id === 'number' ? String(candidate.id) : (candidate.id as string | undefined)
        ) ??
        normalizeId(candidate.participant?.uniqueId) ??
        normalizeId(
          typeof candidate.participant?.id === 'number'
            ? String(candidate.participant?.id)
            : (candidate.participant?.id as string | undefined)
        ) ??
        normalizeId(candidate.participant?.userId) ??
        normalizeId(candidate.user?.uniqueId) ??
        normalizeId(
          typeof candidate.user?.id === 'number'
            ? String(candidate.user?.id)
            : (candidate.user?.id as string | undefined)
        ) ??
        normalizeId(candidate.user?.name) ??
        normalizeId(pickFromArray<string>(rawEntry, 0));

      const username =
        candidate.username ??
        candidate.participant?.username ??
        candidate.participant?.name ??
        candidate.participantName ??
        candidate.displayName ??
        candidate.user?.username ??
        candidate.user?.name ??
        participants.find(
          (participant) => normalizeId(participant.uniqueId) === candidateId
        )?.username ??
        candidateId ??
        t('common.unknown');

      const rawId = canonicalizeParticipantId(candidateId, username);
      if (!rawId) return acc;

      const amount = pickFirstNumber(
        toMaybeNumber(candidate.amountOwed),
        toMaybeNumber(candidate.amount),
        toMaybeNumber(candidate.total),
        toMaybeNumber(candidate.shareAmount),
        toMaybeNumber(candidate.balance),
        toMaybeNumber(candidate.value),
        toMaybeNumber(candidate.owed),
        toMaybeNumber(candidate.amountDetails?.value),
        toMaybeNumber(candidate.amountDetails?.total),
        toMaybeNumber(candidate.totals?.amount),
        toMaybeNumber(candidate.totals?.total),
        toMaybeNumber(candidate.meta?.amount),
        toMaybeNumber(pickFromArray(rawEntry, 1))
      );

      acc.push({ uniqueId: rawId, username: displayNameFor(rawId, username), amountOwed: amount });
      return acc;
    }, []);

    const totalsFromList = new Map<string, number>();
    const nameMap = new Map<string, string>();

    const pushName = (value?: string, username?: string) => {
      const id = canonicalizeParticipantId(value, username);
      if (!id) return;
      const safeName = displayNameFor(id, username);
      if (!nameMap.has(id)) {
        nameMap.set(id, safeName);
      }
    };

    participants.forEach((participant) =>
      pushName(participant.uniqueId, participant.username)
    );
    normalizedParticipantTotals.forEach((entry) => {
      pushName(entry.uniqueId, entry.username);
      totalsFromList.set(entry.uniqueId, (totalsFromList.get(entry.uniqueId) ?? 0) + entry.amountOwed);
    });
    totalsEntries.forEach(([id]) => {
      const candidateName =
        normalizedParticipantTotals.find((entry) => entry.uniqueId === id)?.username ??
        participants.find(
          (participant) => normalizeId(participant.uniqueId) === id
        )?.username;
      pushName(id, candidateName);
    });

    const participantOrder: string[] = [];
    const seenParticipants = new Set<string>();
    const pushParticipant = (value?: string) => {
      const participantName = participants.find((participant) => participant.uniqueId === value)?.username;
      const id = canonicalizeParticipantId(value, participantName);
      if (!id || seenParticipants.has(id)) return;
      seenParticipants.add(id);
      participantOrder.push(id);
    };

    participants.forEach((participant) => pushParticipant(participant.uniqueId));
    normalizedParticipantTotals.forEach((entry) => pushParticipant(entry.uniqueId));
    totalsEntries.forEach(([id]) => pushParticipant(id));

    const allocationsByItem = new Map<
      string,
      { total: number; allocations: Map<string, ParticipantAmount> }
    >();
    const allocationTotalsByParticipant = new Map<string, number>();

    const ensureName = (value: string) => {
      const id = canonicalizeParticipantId(value);
      if (!id) return value;
      if (!nameMap.has(id)) {
        const fallback =
          normalizedParticipantTotals.find((entry) => entry.uniqueId === id)?.username ??
          participants.find(
            (participant) => normalizeId(participant.uniqueId) === id
          )?.username ??
          id;
        nameMap.set(id, displayNameFor(id, fallback));
      }
      return nameMap.get(id) ?? id;
    };

    allocationsList.forEach((allocation) => {
      if (!allocation) return;
      const { participantId, itemId, shareAmount } = allocation;
      if (!participantId || !itemId || typeof shareAmount !== 'number') return;

      const normalizedParticipantId = canonicalizeParticipantId(participantId);
      if (!normalizedParticipantId) return;

      pushParticipant(normalizedParticipantId);
      const username = ensureName(normalizedParticipantId);

      allocationTotalsByParticipant.set(
        normalizedParticipantId,
        (allocationTotalsByParticipant.get(normalizedParticipantId) ?? 0) + shareAmount
      );

      const itemEntry =
        allocationsByItem.get(itemId) ??
        { total: 0, allocations: new Map<string, ParticipantAmount>() };

      itemEntry.total += shareAmount;

      const existing = itemEntry.allocations.get(normalizedParticipantId);
      if (existing) {
        existing.amount += shareAmount;
      } else {
        itemEntry.allocations.set(normalizedParticipantId, {
          uniqueId: normalizedParticipantId,
          username,
          amount: shareAmount,
        });
      }

      allocationsByItem.set(itemId, itemEntry);
    });

    const resolveAmount = (value: string) => {
      const id = canonicalizeParticipantId(value);
      if (!id) return 0;
      if (totalsMap.has(id)) return totalsMap.get(id)!;
      if (totalsFromList.has(id)) return totalsFromList.get(id)!;
      if (allocationTotalsByParticipant.has(id)) return allocationTotalsByParticipant.get(id)!;
      return 0;
    };

    const resolveName = (value: string) => ensureName(value);

    const summaries: ParticipantAmount[] = participantOrder.map((id) => ({
      uniqueId: id,
      username: resolveName(id),
      amount: resolveAmount(id),
    }));

    allocationTotalsByParticipant.forEach((_value, id) => {
      if (!seenParticipants.has(id)) {
        seenParticipants.add(id);
        summaries.push({
          uniqueId: id,
          username: resolveName(id),
          amount: resolveAmount(id),
        });
      }
    });

    totalsEntries.forEach(([id]) => {
      if (!seenParticipants.has(id)) {
        seenParticipants.add(id);
        summaries.push({
          uniqueId: id,
          username: resolveName(id),
          amount: resolveAmount(id),
        });
      }
    });

    const itemOrder: string[] = [];
    const seenItems = new Set<string>();
    const pushItem = (id?: string) => {
      if (!id || seenItems.has(id)) return;
      seenItems.add(id);
      itemOrder.push(id);
    };

    totalsByItemList.forEach((entry) => pushItem(entry.itemId));
    allocationsByItem.forEach((_value, key) => pushItem(key));

    const totalsByItemMap = new Map<string, FinalizeTotalsByItem>();
    totalsByItemList.forEach((entry) => {
      totalsByItemMap.set(entry.itemId, entry);
    });

    const items: ItemSummary[] = itemOrder.map((itemId) => {
      const totalsEntry = totalsByItemMap.get(itemId);
      const allocationEntry = allocationsByItem.get(itemId);
      const allocations =
        allocationEntry
          ? Array.from(allocationEntry.allocations.values()).map((entry) => ({
              uniqueId: entry.uniqueId,
              username: entry.username,
              amount: entry.amount,
            }))
          : [];
      return {
        itemId,
        name: totalsEntry?.name ?? itemId,
        total: totalsEntry?.total ?? allocationEntry?.total ?? 0,
        allocations,
      };
    });

    const allocationsSum = Array.from(allocationsByItem.values()).reduce(
      (acc, entry) => acc + entry.total,
      0
    );
    const participantsSum = summaries.reduce((acc, entry) => acc + entry.amount, 0);
    const itemsSum = totalsByItemList.reduce((acc, entry) => acc + entry.total, 0);

    const effectiveGrandTotal = pickFirstNumber(
      knownGrandTotal,
      totalsByItemList.length > 0 ? itemsSum : undefined,
      summaries.length > 0 ? participantsSum : undefined,
      allocationsByItem.size > 0 ? allocationsSum : undefined
    );

    return {
      participantSummaries: summaries,
      itemSummaries: items,
      effectiveGrandTotal,
    };
  }, [
    participants,
    totals,
    totalsByParticipantList,
    totalsByItemList,
    allocationsList,
    knownGrandTotal,
    currentUserId,
    currentUserName,
    t,
  ]);

  const showGrandTotal = participantSummaries.length > 0 || itemSummaries.length > 0;
  const grandTotalParts = showGrandTotal ? getCurrencyParts(effectiveGrandTotal, currency) : null;
  const receiptKey = String(payload?.sessionId ?? payload?.receiptId ?? 'receipt');
  const settlementReceiver = useMemo<SettlementUser>(() => {
    const participantMatch = currentUser?.uniqueId
      ? participantSummaries.find((summary) => summary.uniqueId === currentUser.uniqueId)
      : undefined;
    const fallback = participantMatch ?? participantSummaries[0];

    return {
      id: currentUser?.uniqueId ?? fallback?.uniqueId ?? 'cashier',
      name: currentUser?.username ?? fallback?.username ?? t('billSummary.cashierFallback'),
      avatarUrl: currentUser?.avatarUrl ?? null,
    };
  }, [currentUser?.avatarUrl, currentUser?.uniqueId, currentUser?.username, participantSummaries, t]);
  const paidByName = settlementReceiver.name;

  const initialSettlements = useMemo<SettlementCardItem[]>(() => {
    return participantSummaries
      .filter((summary) => summary.uniqueId !== settlementReceiver.id)
      .filter((summary) => Number.isFinite(summary.amount) && summary.amount > 0.5)
      .map((summary) => ({
        id: `settlement-${receiptKey}-${summary.uniqueId}-${settlementReceiver.id}`,
        payer: {
          id: summary.uniqueId,
          name: summary.username,
          avatarUrl: null,
        },
        receiver: settlementReceiver,
        amount: summary.amount,
        currency,
        method: 'cash' as PaymentMethod,
        status: 'pending',
      }));
  }, [currency, participantSummaries, receiptKey, settlementReceiver]);

  const settlementSignature = useMemo(
    () =>
      initialSettlements
        .map((settlement) =>
          [
            settlement.id,
            settlement.payer.id,
            settlement.receiver.id,
            Math.round(settlement.amount),
            settlement.currency,
          ].join(':')
        )
        .join('|'),
    [initialSettlements]
  );

  const [settlements, setSettlements] = useState<SettlementCardItem[]>([]);

  useEffect(() => {
    return () => {
      setSettlements([]);
    };
  }, [currentUserId, receiptKey]);

  useEffect(() => {
    setSettlements((prev) => {
      if (initialSettlements.length === 0) {
        return prev.length === 0 ? prev : [];
      }

      return initialSettlements.map((nextSettlement) => {
        const existing = prev.find((settlement) => settlement.id === nextSettlement.id);
        return existing
          ? {
              ...nextSettlement,
              method: existing.method,
              status: existing.status,
            }
          : nextSettlement;
      });
    });
  }, [settlementSignature]);

  const handleMethodChange = (id: string, method: PaymentMethod) => {
    setSettlements((prev) =>
      prev.map((settlement) =>
        settlement.id === id ? { ...settlement, method } : settlement
      )
    );
  };

  const handleMarkPaid = (id: string) => {
    setSettlements((prev) =>
      prev.map((settlement) =>
        settlement.id === id ? { ...settlement, status: 'paid' } : settlement
      )
    );
  };

  const completeSettlement = () => {
    const ownerUserId = currentUserId ?? settlementReceiver.id;
    const createdDebts: Debt[] = settlements
      .filter((settlement) => settlement.amount > 0.5)
      .map((settlement) => ({
        id: settlement.id,
        ownerUserId,
        fromUserId: settlement.payer.id,
        toUserId: settlement.receiver.id,
        amount: settlement.amount,
        receiptId: receiptKey,
        date: new Date(),
        status: settlement.status === 'paid' ? 'PAID' : 'ACTIVE',
        paidAt: settlement.status === 'paid' ? new Date() : null,
      }));

    setSplitterState((state) => ({
      debts: [
        ...state.debts.filter((debt) => {
          const debtOwner = debt.ownerUserId ?? ownerUserId;
          return !(debt.receiptId === receiptKey && debtOwner === ownerUserId);
        }),
        ...createdDebts,
      ],
      analytics: {
        ...state.analytics,
        totalOwed: createdDebts.reduce((sum, debt) => sum + debt.amount, 0),
        totalDebt: createdDebts.reduce((sum, debt) => sum + debt.amount, 0),
      },
    }));

    router.replace('/tabs');
  };

  const Avatar = ({ name }: { name: string }) => (
    <UserAvatar
      label={name?.[0]?.toUpperCase() || '?'}
      size={32}
      textSize={14}
      backgroundColor="$gray5"
    />
  );

  return (
    <YStack f={1} bg="$background" position="relative">
      {/* Header */}
      <YStack bg="$background" p="$4" pb="$2">
        <XStack w="100%" ai="center" jc="flex-start" mb="$3">
          <YStack ai="flex-start">
            <Text fontSize={16} fontWeight="700">
              {t('billSummary.title')}
            </Text>
            {receiptId && (
              <Text fontSize={12} color="$gray10">
                {t('billSummary.receiptNumber', { id: receiptId })}
              </Text>
            )}
          </YStack>
        </XStack>

        {/* Session info */}
        {sessionName && (
          <YStack ai="flex-start" mb="$2">
            <Text fontSize={14} color="$gray11">
              {sessionName}
            </Text>
          </YStack>
        )}

        {/* Status badge */}
        {status && (
          <XStack w="100%" ai="center" jc="flex-start" mb="$3">
            <XStack
              ai="center"
              gap="$1"
              px="$3"
              py="$1"
              bg="#2ECC711A"
              borderRadius={16}
            >
              <Check size={14} color="#2ECC71" />
              <Text fontSize={12} fontWeight="600" color="#2ECC71" textTransform="capitalize">
                {status}
              </Text>
            </XStack>
          </XStack>
        )}

        {/* Grand Total */}
        {grandTotalParts && (
          <YStack
            p="$4"
            borderWidth={1}
            borderColor="#2ECC71"
            borderRadius={16}
            bg="#2ECC711A"
            mb="$3"
          >
            <Text fontSize={13} color="$gray11" mb="$1">
              {t('billSummary.totalAmount')}
            </Text>
            <XStack ai="baseline" gap="$1">
              <Text fontSize={14} color="#2ECC71">
                {grandTotalParts.currency}
              </Text>
              <Text fontSize={30} fontWeight="800" color="#2ECC71">
                {grandTotalParts.amount}
              </Text>
            </XStack>
            <Text fontSize={17} fontWeight="800" color="$gray12" mt="$2">
              {t('billSummary.paidBy', { name: paidByName })}
            </Text>
          </YStack>
        )}
      </YStack>

      {/* Content */}
      <ScrollView
        f={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: (insets?.bottom ?? 0) + 96 }}
      >
        <YStack gap="$2">
          <Text fontSize={14} fontWeight="600" color="$gray11" mb="$1">
            {t('billSummary.splitByParticipant')}
          </Text>
          {participantSummaries.length > 0 ? (
            participantSummaries.map((summary) => {
              const parts = getCurrencyParts(summary.amount, currency);

              return (
                <XStack
                  key={summary.uniqueId}
                  h={60}
                  ai="center"
                  jc="space-between"
                  w="100%"
                  px={16}
                  borderWidth={1}
                  borderColor="$gray5"
                  borderRadius={12}
                  bg="$color1"
                >
                  <XStack ai="center" gap="$3">
                    <Avatar name={summary.username} />
                    <Text fontWeight="600" fontSize={15}>
                      {summary.username}
                    </Text>
                  </XStack>
                  <XStack ai="baseline" gap="$1">
                    <Text fontSize={12} color="$gray10">
                      {parts.currency}
                    </Text>
                    <Text fontSize={18} fontWeight="700" color="#2ECC71">
                      {parts.amount}
                    </Text>
                  </XStack>
                </XStack>
              );
            })
          ) : (
            <Text fontSize={13} color="$gray10">
              {t('billSummary.noParticipantData')}
            </Text>
          )}
        </YStack>

        {itemSummaries.length > 0 && (
          <YStack gap="$2" mt="$4">
            <Text fontSize={14} fontWeight="600" color="$gray11" mb="$1">
              {t('billSummary.splitByItem')}
            </Text>
            {itemSummaries.map((item) => {
              const itemParts = getCurrencyParts(item.total, currency);
              return (
                <YStack
                  key={item.itemId}
                  p="$3"
                  borderWidth={1}
                  borderColor="$gray5"
                  borderRadius={12}
                  bg="$color1"
                  gap="$2"
                >
                  <XStack w="100%" ai="center" jc="space-between">
                    <Text fontWeight="600" fontSize={15}>
                      {item.name}
                    </Text>
                    <XStack ai="baseline" gap="$1">
                      <Text fontSize={12} color="$gray10">
                        {itemParts.currency}
                      </Text>
                      <Text fontSize={16} fontWeight="700" color="$gray11">
                        {itemParts.amount}
                      </Text>
                    </XStack>
                  </XStack>
                  {item.allocations.length > 0 ? (
                    <YStack gap="$1">
                      {item.allocations.map((allocation) => {
                        const allocationParts = getCurrencyParts(allocation.amount, currency);
                        return (
                          <XStack
                            key={`${item.itemId}-${allocation.uniqueId}`}
                            ai="center"
                            jc="space-between"
                            w="100%"
                          >
                            <Text fontSize={13} color="$gray11">
                              {allocation.username}
                            </Text>
                            <XStack ai="baseline" gap="$1">
                              <Text fontSize={11} color="$gray10">
                                {allocationParts.currency}
                              </Text>
                              <Text fontSize={14} fontWeight="600" color="$gray11">
                                {allocationParts.amount}
                              </Text>
                            </XStack>
                          </XStack>
                        );
                      })}
                    </YStack>
                  ) : (
                    <Text fontSize={12} color="$gray9">
                      {t('billSummary.noAllocationDetails')}
                    </Text>
                  )}
                </YStack>
              );
            })}
          </YStack>
        )}

        {settlements.length > 0 && (
          <YStack gap="$3" mt="$4">
            <Text fontSize={15} fontWeight="700" color="$gray11">
              {t('billSummary.whoOwesWhom')}
            </Text>
            {settlements.map((settlement) => (
              <SettlementCard
                key={settlement.id}
                settlement={settlement}
                currentUserId={currentUserId}
                onMethodChange={handleMethodChange}
                onMarkPaid={handleMarkPaid}
              />
            ))}
          </YStack>
        )}
      </ScrollView>
      {/* Fixed bottom button */}
      <YStack
        position="absolute"
        left={0}
        right={0}
        bottom={(insets?.bottom ?? 0) + 8}
        px="$4"
      >
        <Button
          unstyled
          height={41}
          borderRadius={10}
          bg="#2ECC71"
          ai="center"
          jc="center"
          onPress={completeSettlement}
          pressStyle={{ opacity: 0.9 }}
        >
          <Text fontSize={16} fontWeight="600" color="white">
            {t('billSummary.completeSettlement')}
          </Text>
        </Button>
      </YStack>
    </YStack>
  );
}
