import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { YStack, XStack, Text, View, ScrollView } from 'tamagui';
import { CalendarDays, TrendingDown, TrendingUp, Wallet } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/shared/lib/stores/app-store';
import { formatCurrency } from '@/shared/config/currencies';
import { refreshSplitterStoreFromBackend } from '@/features/receipt/api/receipts.api';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type { SessionHistoryEntry } from '@/features/sessions/api/history.api';
import { useSplitterStore } from '@/shared/store/useSplitterStore';

const screenWidth = Dimensions.get('window').width;
type Period = 'day' | 'week' | 'month' | 'all';

const periodOptions: Period[] = ['day', 'week', 'month', 'all'];

const getColors = (isDark: boolean) => ({
  bg: isDark ? '#0F172A' : '#F4F8F7',
  card: isDark ? '#172033' : '#FFFFFF',
  cardSoft: isDark ? '#1E293B' : '#ECFDF5',
  cardBorder: isDark ? '#263244' : '#DCE8E4',
  text: isDark ? '#F8FAFC' : '#10201B',
  textSecondary: isDark ? '#AAB7C4' : '#6B7A75',
  primary: '#10B981',
  primaryDark: '#047857',
  danger: '#E85D5D',
  warning: '#F4A261',
});

const chartConfig = (isDark: boolean) => ({
  backgroundColor: isDark ? '#172033' : '#FFFFFF',
  backgroundGradientFrom: isDark ? '#172033' : '#FFFFFF',
  backgroundGradientTo: isDark ? '#172033' : '#FFFFFF',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
  labelColor: (opacity = 1) =>
    isDark ? `rgba(248,250,252,${opacity * 0.75})` : `rgba(16,32,27,${opacity * 0.7})`,
  propsForBackgroundLines: { strokeDasharray: '4 4', stroke: isDark ? '#334155' : '#E3ECE8' },
  barPercentage: 0.6,
});

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const isWithinPeriod = (value: string | undefined, period: Period) => {
  if (period === 'all') return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMs = startOfDay(now).getTime() - startOfDay(date).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (period === 'day') return diffDays === 0;
  if (period === 'week') return diffDays >= 0 && diffDays < 7;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const inferCategory = (name: string) => {
  const text = name.toLowerCase();
  if (/(coffee|tea|cola|juice|water|mors|kapuchino|kofe|choy|suv|морс|капучино)/i.test(text)) return 'Drinks';
  if (/(taxi|bus|metro|fuel|transport|такси|транспорт)/i.test(text)) return 'Transport';
  if (/(shop|shirt|shoe|market|магазин|одежд)/i.test(text)) return 'Shopping';
  if (/(bread|meat|soup|pizza|food|телятина|чорба|хлеб|еда|мясо)/i.test(text)) return 'Food';
  return 'Other';
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const { theme, currency } = useAppStore();
  const me = useAppStore((state) => state.user);
  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const sessions = useSessionsHistoryStore((state) => state.sessions);
  const fetchHistory = useSessionsHistoryStore((state) => state.forceRefresh);
  const debts = useSplitterStore((state) => state.debts);
  const [period, setPeriod] = useState<Period>('month');
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        try {
          await Promise.all([refreshSplitterStoreFromBackend(), fetchHistory(50, true)]);
        } catch (error) {
          console.warn('[Analytics] refresh failed', error);
        } finally {
          if (mounted) setLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [fetchHistory])
  );

  const periodTransactions = useMemo(
    () => sessions.filter((entry) => isWithinPeriod(entry.finalizedAt || entry.createdAt, period)),
    [sessions, period]
  );

  const selectedTransactions = useMemo(() => {
    if (!selectedTransactionId) return periodTransactions;
    return periodTransactions.filter((entry) => entry.sessionId === selectedTransactionId);
  }, [periodTransactions, selectedTransactionId]);

  // Totals are only ever added up within one currency: the app currency when there are
  // receipts in it, otherwise the currency of the most recent receipt.
  const entryCurrency = (entry: SessionHistoryEntry) => entry.currency || 'UNKNOWN';
  const displayCurrency = useMemo(() => {
    if (selectedTransactions.some((entry) => entryCurrency(entry) === currency)) return currency;
    return selectedTransactions[0] ? entryCurrency(selectedTransactions[0]) : currency;
  }, [selectedTransactions, currency]);
  const activeTransactions = useMemo(
    () => selectedTransactions.filter((entry) => entryCurrency(entry) === displayCurrency),
    [selectedTransactions, displayCurrency]
  );
  const excludedCount = selectedTransactions.length - activeTransactions.length;

  const analytics = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    let total = 0;
    const participantTotals = new Map<string, number>();

    activeTransactions.forEach((entry: SessionHistoryEntry) => {
      const items = entry.totals?.byItem ?? [];
      if (items.length === 0) {
        const grand = Number(entry.grandTotal || 0);
        categoryTotals.Other = (categoryTotals.Other || 0) + grand;
        total += grand;
      } else {
        items.forEach((item) => {
          const amount = Number((item as any).total ?? (item as any).totalAmount ?? 0);
          const category = inferCategory(item.name || '');
          categoryTotals[category] = (categoryTotals[category] || 0) + amount;
          total += amount;
        });
      }

      (entry.totals?.byParticipant ?? []).forEach((participant) => {
        const current = participantTotals.get(participant.username) || 0;
        participantTotals.set(participant.username, current + Number(participant.amountOwed || 0));
      });
    });

    return {
      total,
      categoryTotals,
      participantTotals: Array.from(participantTotals.entries()).map(([name, amount]) => ({ name, amount })),
    };
  }, [activeTransactions]);

  const displayDebts = useMemo(
    () => debts.filter((debt) => (debt.currency ?? currency) === displayCurrency),
    [debts, currency, displayCurrency]
  );

  const moneyIn = useMemo(() => {
    if (!me?.uniqueId) return displayDebts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
    return displayDebts
      .filter((debt) => debt.toUserId === me.uniqueId)
      .reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  }, [displayDebts, me?.uniqueId]);

  const moneyOut = useMemo(() => {
    if (!me?.uniqueId) return 0;
    return displayDebts
      .filter((debt) => debt.fromUserId === me.uniqueId)
      .reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  }, [displayDebts, me?.uniqueId]);

  const barData = useMemo(() => {
    const entries = Object.entries(analytics.categoryTotals).filter(([, amount]) => amount > 0);
    return {
      labels: entries.map(([name]) => name.slice(0, 4)),
      datasets: [{ data: entries.map(([, amount]) => amount) }],
    };
  }, [analytics.categoryTotals]);

  const pieData = useMemo(() => {
    const palette = ['#10B981', '#3B82F6', '#F4A261', '#E85D5D', '#8B5CF6', '#EC4899'];
    return Object.entries(analytics.categoryTotals)
      .filter(([, amount]) => amount > 0)
      .map(([name, amount], index) => ({
        name,
        amount,
        color: palette[index % palette.length],
        legendFontColor: colors.text,
        legendFontSize: 12,
      }));
  }, [analytics.categoryTotals, colors.text]);

  const Card = ({ children }: { children: React.ReactNode }) => (
    <YStack bg={colors.card} borderWidth={1} borderColor={colors.cardBorder} br={14} p="$3">
      {children}
    </YStack>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <YStack gap="$3">
          <YStack bg={colors.cardSoft} br={16} p="$4" gap="$2" borderWidth={1} borderColor={colors.cardBorder}>
            <XStack ai="center" gap="$2">
              <Wallet size={24} color={colors.primaryDark} />
              <Text fontSize={24} fontWeight="800" color={colors.text}>
                Analytics
              </Text>
            </XStack>
            <Text fontSize={13} color={colors.textSecondary}>
              Davrni tanlang yoki pastdan bitta transactionni belgilang
            </Text>
          </YStack>

          <Card>
            <Text fontSize={13} fontWeight="700" color={colors.text} mb="$2">
              Qaysi davrdagi tranzaksiyalar?
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {periodOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    setPeriod(option);
                    setSelectedTransactionId(null);
                  }}
                >
                  <YStack
                    px="$3"
                    py="$2"
                    br={10}
                    bg={period === option ? colors.primary : colors.bg}
                    borderWidth={1}
                    borderColor={period === option ? colors.primary : colors.cardBorder}
                  >
                    <Text fontSize={12} fontWeight="700" color={period === option ? 'white' : colors.text}>
                      {t(`analytics.periods.${option}`)}
                    </Text>
                  </YStack>
                </Pressable>
              ))}
            </XStack>
          </Card>

          {loading && <Text color={colors.textSecondary}>{t('common.loading')}</Text>}

          <XStack gap="$2">
            <Card>
              <XStack ai="center" gap="$1">
                <TrendingUp size={15} color={colors.primary} />
                <Text fontSize={11} color={colors.textSecondary}>{t('analytics.expenses')}</Text>
              </XStack>
              <Text fontSize={18} fontWeight="800" color={colors.text}>
                {formatCurrency(analytics.total, displayCurrency)}
              </Text>
            </Card>
            <Card>
              <XStack ai="center" gap="$1">
                <TrendingDown size={15} color={colors.danger} />
                <Text fontSize={11} color={colors.textSecondary}>{t('analytics.debts')}</Text>
              </XStack>
              <Text fontSize={18} fontWeight="800" color={colors.text}>
                {formatCurrency(moneyIn + moneyOut, displayCurrency)}
              </Text>
            </Card>
          </XStack>
          {excludedCount > 0 && (
            <Text fontSize={11} color={colors.textSecondary}>
              {t('analytics.otherCurrenciesExcluded', {
                currency: displayCurrency,
                defaultValue: 'Totals are in {{currency}}. Receipts in other currencies are not included.',
              })}
            </Text>
          )}

          <Card>
            <Text fontSize={15} fontWeight="800" color={colors.text} mb="$2">
              {selectedTransactionId ? t('analytics.chartSingle') : t('analytics.chartByPeriod')}
            </Text>
            {analytics.total > 0 ? (
              <BarChart
                data={barData}
                width={screenWidth - 64}
                height={210}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={chartConfig(isDark)}
                style={{ borderRadius: 10 }}
              />
            ) : (
              <YStack h={132} br={12} bg={colors.cardSoft} ai="center" jc="center" px="$4">
                <Text color={colors.textSecondary} textAlign="center">
                  {t('analytics.noSelectionData')}
                </Text>
              </YStack>
            )}
          </Card>

          {pieData.length > 0 && (
            <Card>
              <Text fontSize={15} fontWeight="800" color={colors.text} mb="$2">
                {t('analytics.categoryDistribution')}
              </Text>
              <PieChart
                data={pieData}
                width={screenWidth - 64}
                height={210}
                chartConfig={chartConfig(isDark)}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="12"
              />
            </Card>
          )}

          <Card>
            <Text fontSize={15} fontWeight="800" color={colors.text} mb="$2">
              {t('analytics.cashflowDebt')}
            </Text>
            <YStack gap="$2">
              <XStack jc="space-between"><Text color={colors.textSecondary}>{t('analytics.totalExpenses')}</Text><Text color={colors.text} fontWeight="700">{formatCurrency(analytics.total, displayCurrency)}</Text></XStack>
              <XStack jc="space-between"><Text color={colors.textSecondary}>{t('analytics.moneyOwedToMe')}</Text><Text color={colors.primary} fontWeight="700">{formatCurrency(moneyIn, displayCurrency)}</Text></XStack>
              <XStack jc="space-between"><Text color={colors.textSecondary}>{t('analytics.moneyIOwe')}</Text><Text color={colors.danger} fontWeight="700">{formatCurrency(moneyOut, displayCurrency)}</Text></XStack>
            </YStack>
          </Card>

          <Card>
            <XStack ai="center" gap="$2" mb="$2">
              <CalendarDays size={16} color={colors.primary} />
              <Text fontSize={15} fontWeight="800" color={colors.text}>
                {t('analytics.chooseTransaction')}
              </Text>
            </XStack>
            <Text fontSize={11} color={colors.textSecondary} mb="$2">
              {t('analytics.chooseTransactionHint')}
            </Text>
            <YStack gap="$2">
              {periodTransactions.length > 0 ? periodTransactions.map((entry) => (
                <Pressable
                  key={entry.sessionId}
                  onPress={() => setSelectedTransactionId((current) => current === entry.sessionId ? null : entry.sessionId)}
                >
                  <YStack
                    bg={selectedTransactionId === entry.sessionId ? colors.cardSoft : colors.bg}
                    br={10}
                    p="$3"
                    gap="$2"
                    borderWidth={1}
                    borderColor={selectedTransactionId === entry.sessionId ? colors.primary : colors.cardBorder}
                  >
                    <XStack jc="space-between" ai="center" gap="$2">
                      <YStack flex={1}>
                        <XStack ai="center" gap="$2">
                          <View
                            w={18}
                            h={18}
                            br={9}
                            borderWidth={2}
                            borderColor={selectedTransactionId === entry.sessionId ? colors.primary : colors.cardBorder}
                            bg={selectedTransactionId === entry.sessionId ? colors.primary : 'transparent'}
                          />
                          <Text fontSize={14} fontWeight="800" color={colors.text} numberOfLines={1} flex={1}>
                            {entry.sessionName || t('home.recent.fallbackName')}
                          </Text>
                        </XStack>
                        <Text fontSize={11} color={colors.textSecondary} ml={26}>
                          {formatDate(entry.finalizedAt || entry.createdAt)} {'\u2022'} {t('home.recent.participants', { count: (entry.participants ?? []).length })}
                        </Text>
                      </YStack>
                      <Text fontSize={14} fontWeight="800" color={colors.primary}>
                        {formatCurrency(entry.grandTotal || entry.totals?.grandTotal || 0, entry.currency || currency)}
                      </Text>
                    </XStack>
                    {(entry.totals?.byItem ?? []).slice(0, 4).map((item) => (
                      <XStack key={item.itemId} jc="space-between" gap="$2">
                        <Text fontSize={12} color={colors.textSecondary} numberOfLines={1} flex={1}>{item.name}</Text>
                        <Text fontSize={12} color={colors.text}>{formatCurrency(item.total, entry.currency || currency)}</Text>
                      </XStack>
                    ))}
                  </YStack>
                </Pressable>
              )) : (
                <Text color={colors.textSecondary}>{t('analytics.noTransactions')}</Text>
              )}
            </YStack>
          </Card>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
