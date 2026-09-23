import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { YStack, XStack, Text, View } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { Pressable, Alert, FlatList, Modal, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Check, DollarSign, Pencil, RotateCcw, Wallet } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import { useSplitterStore } from '@/shared/store/useSplitterStore';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { useThemeColors } from '@/shared/lib/stores/theme-store';
import { formatCurrency } from '@/shared/config/currencies';
import type { Debt as SplitterDebt } from '@/entities/debt';
import {
  refreshSplitterStoreFromBackend,
  setDebtPaidStatus,
  updateDebtOnServer,
} from '@/features/receipt/api/receipts.api';

const withOpacity = (hex: string, alpha: number) => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Debts Screen - Display debts from the splitter store
 * Debts are automatically generated when receipts are processed
 */
export default function DebtsScreen() {
  const { t } = useTranslation();
  const currency = useAppStore((s) => s.currency);
  const me = useAppStore((s) => s.user);
  const debts = useSplitterStore((s) => s.debts);
  const colors = useThemeColors();
  const successBg = withOpacity(colors.success, colors.isDark ? 0.15 : 0.1);

  const [filter, setFilter] = useState<'all' | 'owe' | 'owed' | 'history'>('all');
  const [loading, setLoading] = useState(false);
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null);
  const [editingDebt, setEditingDebt] = useState<SplitterDebt | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const getDebtStatus = (debt: SplitterDebt) => debt.status ?? 'ACTIVE';
  const isServerDebt = (debt: SplitterDebt) => /^\d+$/.test(String(debt.id));
  const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  useEffect(() => {
    if (!snackbar) return;
    const timeout = setTimeout(() => setSnackbar(null), 3600);
    return () => clearTimeout(timeout);
  }, [snackbar]);

  const filteredDebts = useMemo(() => {
    const accountDebts = me?.uniqueId
      ? debts.filter((debt) => !debt.ownerUserId || debt.ownerUserId === me.uniqueId)
      : debts;
    const visibleDebts = filter === 'history'
      ? accountDebts.filter((debt) => getDebtStatus(debt) === 'PAID')
      : accountDebts.filter((debt) => getDebtStatus(debt) === 'ACTIVE');

    switch (filter) {
      case 'owe':
        return me?.uniqueId ? visibleDebts.filter(d => d.fromUserId === me.uniqueId) : visibleDebts;
      case 'owed':
        return me?.uniqueId ? visibleDebts.filter(d => d.toUserId === me.uniqueId) : visibleDebts;
      default:
        return visibleDebts;
    }
  }, [debts, filter, me?.uniqueId]);

  // Debts keep the currency of the receipt they came from; totals are grouped per
  // currency instead of adding different currencies together.
  const debtCurrency = (d: SplitterDebt) => d.currency ?? currency;
  const formatTotals = (list: SplitterDebt[]) => {
    const byCurrency = new Map<string, number>();
    list.forEach((d) => byCurrency.set(debtCurrency(d), (byCurrency.get(debtCurrency(d)) ?? 0) + d.amount));
    if (byCurrency.size === 0) return formatCurrency(0, currency);
    return Array.from(byCurrency, ([code, amount]) => formatCurrency(amount, code)).join(' · ');
  };

  const totalOwedMe = useMemo(
    () => formatTotals(
      debts
        .filter((d) => !me?.uniqueId || !d.ownerUserId || d.ownerUserId === me.uniqueId)
        .filter((d) => getDebtStatus(d) === 'ACTIVE')
        .filter((d) => !me?.uniqueId || d.toUserId === me.uniqueId)
    ),
    [debts, me?.uniqueId, currency]
  );
  const totalIOwe = useMemo(
    () => formatTotals(
      me?.uniqueId
        ? debts
          .filter((d) => !d.ownerUserId || d.ownerUserId === me.uniqueId)
          .filter((d) => getDebtStatus(d) === 'ACTIVE')
          .filter((d) => d.fromUserId === me.uniqueId)
        : []
    ),
    [debts, me?.uniqueId, currency]
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          setLoading(true);
          await refreshSplitterStoreFromBackend();
        } catch (err) {
          console.warn('[Debts] failed to refresh from backend', err);
        } finally {
          if (mounted) setLoading(false);
        }
      })();

      return () => { mounted = false; };
    }, [])
  );

  const handleTogglePaid = async (debt: SplitterDebt) => {
    if (payingDebtId) return;

    const nextPaid = getDebtStatus(debt) !== 'PAID';
    const previousDebts = useSplitterStore.getState().debts;
    setPayingDebtId(debt.id);
    useSplitterStore.setState({
      debts: previousDebts.map((item) =>
        item.id === debt.id
          ? {
              ...item,
              status: nextPaid ? 'PAID' : 'ACTIVE',
              paidAt: nextPaid ? new Date() : null,
            }
          : item
      ),
    });

    try {
      if (isServerDebt(debt)) {
        await setDebtPaidStatus(debt.id, nextPaid);
        await refreshSplitterStoreFromBackend();
      }
      setSnackbar(nextPaid ? t('debts.paid', 'Paid') : t('debts.markUnpaid', 'Marked unpaid'));
    } catch (err) {
      useSplitterStore.setState({ debts: previousDebts });
      setSnackbar(errorMessage(err, t('debts.markPaidError', 'Failed to update debt status.')));
    } finally {
      setPayingDebtId(null);
    }
  };

  const openEditDebt = (debt: SplitterDebt) => {
    setEditingDebt(debt);
    setEditAmount(String(Math.round(debt.amount)));
  };

  const closeEditDebt = () => {
    if (savingEdit) return;
    setEditingDebt(null);
    setEditAmount('');
  };

  const handleSaveEdit = async () => {
    if (!editingDebt || savingEdit) return;

    const nextAmount = Number(editAmount.replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setSnackbar(t('debts.errors.invalidAmount', 'Please enter a valid amount'));
      return;
    }

    const previousDebts = useSplitterStore.getState().debts;
    setSavingEdit(true);
    useSplitterStore.setState({
      debts: previousDebts.map((item) =>
        item.id === editingDebt.id ? { ...item, amount: nextAmount } : item
      ),
    });

    try {
      if (isServerDebt(editingDebt)) {
        await updateDebtOnServer(editingDebt.id, {
          amount: nextAmount,
          description: editingDebt.description ?? null,
        });
        await refreshSplitterStoreFromBackend();
      }
      setSnackbar(t('common.saved', 'Saved'));
      setEditingDebt(null);
      setEditAmount('');
    } catch (err) {
      useSplitterStore.setState({ debts: previousDebts });
      setSnackbar(errorMessage(err, t('debts.editError', 'Failed to update debt.')));
    } finally {
      setSavingEdit(false);
    }
  };

  const FilterButton = ({ type, label }: { type: typeof filter; label: string }) => (
    <Pressable onPress={() => setFilter(type)}>
      <View
        px="$3"
        py="$2"
        br={14}
        style={{
          backgroundColor: filter === type ? colors.primary : colors.iconBg,
          borderWidth: 1.5,
          borderColor: filter === type ? colors.primary : colors.cardBorder,
        }}
      >
        <Text
          fontSize={13}
          fontWeight="600"
          color={filter === type ? colors.textLight : colors.text}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );

  const DebtCard = ({ debt, index }: { debt: SplitterDebt; index: number }) => {
    const isMine = me?.uniqueId && debt.fromUserId === me.uniqueId;
    const isPaid = getDebtStatus(debt) === 'PAID';
    const title = isMine ? t('debts.youOwe') : t('debts.owedToYou');
    const subtitle = isMine
      ? t('debts.toPerson', { name: debt.toUserId || t('common.unknown') })
      : t('debts.fromPerson', { name: debt.fromUserId || t('common.unknown') });
    return (
      <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
        <YStack
          style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.cardBorder,
            padding: 16,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <XStack ai="center" jc="space-between" gap="$3">
            <YStack flex={1}>
              <Text fontSize={16} fontWeight="700" color={colors.text}>
                {title}
              </Text>
              <Text fontSize={12} color={colors.textSecondary}>
                {subtitle}
              </Text>
              <Text fontSize={11} color={colors.textMuted}>
                {new Date(isPaid && debt.paidAt ? debt.paidAt : debt.date).toLocaleDateString()}
              </Text>
            </YStack>
            <YStack ai="flex-end" gap="$2">
              <Text fontSize={18} fontWeight="800" color={isMine ? colors.error : colors.success}>
                {formatCurrency(debt.amount, debtCurrency(debt))}
              </Text>
              <XStack ai="center" gap="$2">
                <Pressable onPress={() => openEditDebt(debt)}>
                  <View p="$2" br={12} style={{ backgroundColor: colors.iconBg }}>
                    <Pencil size={15} color={colors.primary} />
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (isPaid) {
                      Alert.alert(
                        t('debts.undoTitle', 'Undo payment?'),
                        t('debts.undoMessage', 'This debt will become active again.'),
                        [
                          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
                          { text: t('common.undo', 'Undo'), onPress: () => handleTogglePaid(debt) },
                        ]
                      );
                      return;
                    }
                    handleTogglePaid(debt);
                  }}
                  disabled={payingDebtId === debt.id}
                >
                  <View
                    px="$3"
                    py="$2"
                    br={12}
                    style={{ backgroundColor: isPaid ? successBg : colors.iconBgStrong }}
                  >
                    <XStack ai="center" gap="$1">
                      {isPaid ? (
                        <RotateCcw size={14} color={colors.success} />
                      ) : (
                        <Check size={14} color={colors.primary} />
                      )}
                      <Text
                        fontSize={12}
                        fontWeight="700"
                        color={isPaid ? colors.success : colors.primary}
                      >
                        {payingDebtId === debt.id
                          ? t('common.loading', 'Loading...')
                          : isPaid
                          ? t('common.undo', 'Undo')
                          : t('debts.markPaid', 'Mark Paid')}
                      </Text>
                    </XStack>
                  </View>
                </Pressable>
              </XStack>
            </YStack>
          </XStack>
        </YStack>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <YStack f={1} style={{ backgroundColor: colors.background }}>
        <YStack p="$4" gap="$4">
          {loading && <Text>{t('common.loading')}</Text>}

          {/* Header with gradient */}
          <Animated.View entering={FadeIn.duration(400)}>
            <LinearGradient
              colors={colors.headerGradient}
              style={{
                borderRadius: 24,
                padding: 20,
                marginBottom: 8,
              }}
            >
              <XStack ai="center" gap="$3">
                <View 
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Wallet size={28} color={colors.textLight} />
                </View>
                <YStack f={1}>
                  <Text fontSize={26} fontWeight="800" color={colors.textLight}>
                    {t('debts.title', 'Debt Tracker')}
                  </Text>
                  <Text fontSize={14} color="rgba(255,255,255,0.8)">
                    {t('debts.subtitle', 'Track who owes what')}
                  </Text>
                </YStack>
              </XStack>
            </LinearGradient>
          </Animated.View>

          {/* Summary Card */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <YStack
              style={{
                backgroundColor: successBg,
                borderRadius: 20,
                padding: 16,
                borderWidth: 1.5,
                borderColor: withOpacity(colors.success, 0.3),
              }}
            >
              <XStack ai="center" gap="$2" mb="$2">
                <DollarSign size={20} color={colors.success} />
                <Text fontSize={14} fontWeight="600" color={colors.success}>
                  {t('debts.totalDebts', 'Debt balance')}
                </Text>
              </XStack>
              <XStack jc="space-between">
                <YStack>
                  <Text fontSize={11} color={colors.textSecondary}>{t('debts.owedMe')}</Text>
                  <Text fontSize={20} fontWeight="800" color={colors.success}>
                    {totalOwedMe}
                  </Text>
                </YStack>
                <YStack ai="flex-end">
                  <Text fontSize={11} color={colors.textSecondary}>{t('debts.iOwe')}</Text>
                  <Text fontSize={20} fontWeight="800" color={colors.error}>
                    {totalIOwe}
                  </Text>
                </YStack>
              </XStack>
            </YStack>
          </Animated.View>

          {/* Filter Buttons */}
          <XStack gap="$2" jc="space-between">
            <FilterButton type="all" label={t('common.all', 'All')} />
            <FilterButton type="owe" label={t('debts.owe', 'I Owe')} />
            <FilterButton type="owed" label={t('debts.owed', 'Owed Me')} />
            <FilterButton type="history" label={t('common.history', 'History')} />
          </XStack>
        </YStack>

        <FlatList
          data={filteredDebts}
          keyExtractor={(debt) => debt.id}
          renderItem={({ item, index }) => <DebtCard debt={item} index={index} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
          ListEmptyComponent={
            <YStack ai="center" jc="center" py="$8" gap="$2">
              <DollarSign size={48} color={colors.textMuted} />
              <Text fontSize={16} fontWeight="600" color={colors.text}>
                {t('debts.noDebts', 'No debts found')}
              </Text>
              <Text fontSize={14} color={colors.textSecondary}>
                {filter === 'history'
                  ? t('debts.noHistory', 'No paid debts yet')
                  : t('debts.startByAdding', 'Process a receipt to create debts')}
              </Text>
            </YStack>
          }
        />

        {snackbar && (
          <YStack
            position="absolute"
            left={16}
            right={16}
            bottom={20}
            px="$4"
            py="$3"
            br={14}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.18,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            <Text fontSize={13} fontWeight="700" color={colors.text}>
              {snackbar}
            </Text>
          </YStack>
        )}
      </YStack>

      <Modal visible={!!editingDebt} transparent animationType="fade" onRequestClose={closeEditDebt}>
        <Pressable style={styles.modalOverlay} onPress={closeEditDebt}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.editSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <Text fontSize={18} fontWeight="800" color={colors.text}>
              {t('debts.edit.title', 'Edit Debt')}
            </Text>
            <Text mt="$1" fontSize={13} color={colors.textSecondary}>
              {t('debts.edit.amountHint', 'Update the amount for this debt.')}
            </Text>

            <YStack mt="$4" gap="$2">
              <Text fontSize={12} fontWeight="700" color={colors.textSecondary}>
                {t('debts.amount', 'Amount')}
              </Text>
              <TextInput
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.amountInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.iconBg,
                    borderColor: colors.cardBorder,
                  },
                ]}
              />
            </YStack>

            <XStack mt="$5" gap="$2">
              <Pressable
                onPress={closeEditDebt}
                disabled={savingEdit}
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: colors.cardBorder },
                ]}
              >
                <Text fontSize={14} fontWeight="800" color={colors.text}>
                  {t('common.cancel', 'Cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEdit}
                disabled={savingEdit}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colors.success,
                    opacity: savingEdit ? 0.72 : 1,
                  },
                ]}
              >
                <Text fontSize={14} fontWeight="900" color={colors.textLight}>
                  {savingEdit ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
                </Text>
              </Pressable>
            </XStack>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.36)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  editSheet: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
  },
  amountInput: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
  },
  modalButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
