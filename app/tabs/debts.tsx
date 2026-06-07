import React, { useState, useMemo, useCallback } from 'react';
import { YStack, XStack, Text, View, ScrollView, Button, Separator } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { Pressable, Modal, TextInput, Alert, Vibration, Switch, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInRight, useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Plus, ArrowUpRight, ArrowDownLeft, Check, X, Trash2, Edit3, DollarSign, TrendingUp, TrendingDown, CircleDollarSign, Wallet } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useDebtsStore, Debt } from '@/features/debts/model/debts.store';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { formatCurrency } from '@/shared/config/currencies';

// Japanese sakura-themed color palette with dark mode support
const getColors = (isDark: boolean) => ({
  primary: isDark ? '#F48FB1' : '#E91E63',
  primaryLight: isDark ? '#FCE4EC' : '#F8BBD9',
  bg: isDark ? '#0D0D1A' : '#FFF5F7',
  card: isDark ? 'rgba(30, 30, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)',
  cardBorder: isDark ? 'rgba(244, 143, 177, 0.25)' : 'rgba(233, 30, 99, 0.15)',
  text: isDark ? '#F5F5F5' : '#1A1A2E',
  textSecondary: isDark ? '#B0B0C0' : '#666680',
  textMuted: isDark ? '#808099' : '#9999B0',
  iconBg: isDark ? 'rgba(244, 143, 177, 0.15)' : 'rgba(233, 30, 99, 0.08)',
  iconBgStrong: isDark ? 'rgba(244, 143, 177, 0.25)' : 'rgba(233, 30, 99, 0.15)',
  shadow: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(233, 30, 99, 0.15)',
  headerGradient: isDark 
    ? ['#1A1A2E', '#2D1B3D'] as const
    : ['#E91E63', '#AD1457'] as const,
  inputBg: isDark ? 'rgba(30, 30, 50, 0.8)' : 'rgba(255, 240, 245, 0.8)',
  inputText: isDark ? '#F5F5F5' : '#1A1A2E',
  danger: '#EF4444',
  dangerBg: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
  success: '#4CAF50',
  successBg: isDark ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)',
  warning: '#FF9800',
  warningBg: isDark ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 152, 0, 0.1)',
});

export default function DebtsScreen() {
  const { t } = useTranslation();
  const { theme, currency } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const { debts, addDebt, updateDebt, markAsPaid, markAsUnpaid, deleteDebt, getTotalOwed, getTotalOwe, getBalance } = useDebtsStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [filter, setFilter] = useState<'all' | 'owe' | 'owed' | 'paid'>('all');

  // Form state
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [debtType, setDebtType] = useState<'owe' | 'owed'>('owe');

  // Scroll animation
  const scrollY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const isScrollingDown = useSharedValue(false);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      isScrollingDown.value = currentY > lastScrollY.value && currentY > 50;
      lastScrollY.value = currentY;
      scrollY.value = currentY;
    },
  });

  const floatingButtonStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: withSpring(isScrollingDown.value ? 100 : 0, { damping: 15, stiffness: 100 }) },
      { scale: withSpring(isScrollingDown.value ? 0.8 : 1, { damping: 15, stiffness: 100 }) },
    ],
    opacity: withSpring(isScrollingDown.value ? 0 : 1),
  }));

  // Filter debts
  const filteredDebts = useMemo(() => {
    switch (filter) {
      case 'owe':
        return debts.filter(d => d.type === 'owe' && !d.isPaid);
      case 'owed':
        return debts.filter(d => d.type === 'owed' && !d.isPaid);
      case 'paid':
        return debts.filter(d => d.isPaid);
      default:
        return debts.filter(d => !d.isPaid);
    }
  }, [debts, filter]);

  const balance = getBalance();
  const totalOwed = getTotalOwed();
  const totalOwe = getTotalOwe();

  const resetForm = () => {
    setPersonName('');
    setAmount('');
    setDescription('');
    setDebtType('owe');
  };

  const handleAddDebt = () => {
    if (!personName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('debts.errors.nameRequired', 'Please enter a name'));
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(t('common.error', 'Error'), t('debts.errors.invalidAmount', 'Please enter a valid amount'));
      return;
    }

    addDebt({
      personName: personName.trim(),
      amount: numAmount,
      currency,
      type: debtType,
      description: description.trim() || undefined,
    });

    resetForm();
    setShowAddModal(false);
    Vibration.vibrate(50);
  };

  const handleEditDebt = (debt: Debt) => {
    setEditingDebt(debt);
    setPersonName(debt.personName);
    setAmount(String(debt.amount));
    setDescription(debt.description || '');
    setDebtType(debt.type);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingDebt) return;
    if (!personName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('debts.errors.nameRequired', 'Please enter a name'));
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(t('common.error', 'Error'), t('debts.errors.invalidAmount', 'Please enter a valid amount'));
      return;
    }

    updateDebt(editingDebt.id, {
      personName: personName.trim(),
      amount: numAmount,
      type: debtType,
      description: description.trim() || undefined,
    });

    resetForm();
    setEditingDebt(null);
    setShowEditModal(false);
    Vibration.vibrate(50);
  };

  const handleDeleteDebt = (debt: Debt) => {
    Alert.alert(
      t('debts.delete.title', 'Delete Debt'),
      t('debts.delete.confirm', `Are you sure you want to delete this debt?`),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: () => {
            deleteDebt(debt.id);
            Vibration.vibrate(50);
          },
        },
      ]
    );
  };

  const togglePaid = (debt: Debt) => {
    if (debt.isPaid) {
      markAsUnpaid(debt.id);
    } else {
      markAsPaid(debt.id);
    }
    Vibration.vibrate(30);
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
          color={filter === type ? 'white' : colors.text}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );

  const DebtCard = ({ debt, index }: { debt: Debt; index: number }) => {
    const isOwe = debt.type === 'owe';
    const statusBg = debt.isPaid ? colors.iconBg : isOwe ? colors.dangerBg : colors.successBg;
    const statusColor = debt.isPaid ? colors.textMuted : isOwe ? colors.danger : colors.success;
    const Icon = isOwe ? ArrowUpRight : ArrowDownLeft;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
        <Pressable onLongPress={() => handleEditDebt(debt)} delayLongPress={500}>
          <YStack
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: debt.isPaid ? colors.cardBorder : isOwe ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
              padding: 16,
              opacity: debt.isPaid ? 0.7 : 1,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <XStack ai="center" jc="space-between" mb="$2">
              <XStack ai="center" gap="$3">
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: statusBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: statusBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={24} color={statusColor} />
                  </View>
                </View>
                <YStack>
                  <Text fontSize={17} fontWeight="700" color={colors.text} textDecorationLine={debt.isPaid ? 'line-through' : 'none'}>
                    {debt.personName}
                  </Text>
                  <Text fontSize={12} color={colors.textSecondary}>
                    {isOwe ? t('debts.youOwe', 'You owe') : t('debts.owesYou', 'Owes you')}
                  </Text>
                </YStack>
              </XStack>
              <YStack ai="flex-end">
                <Text
                  fontSize={18}
                  fontWeight="800"
                  color={debt.isPaid ? colors.textMuted : isOwe ? colors.danger : colors.success}
                  textDecorationLine={debt.isPaid ? 'line-through' : 'none'}
                >
                  {isOwe ? '-' : '+'}{formatCurrency(debt.amount, currency)}
                </Text>
                {debt.isPaid && (
                  <Text fontSize={11} color={colors.success} fontWeight="600">
                    ✓ {t('debts.paid', 'Paid')}
                  </Text>
                )}
              </YStack>
            </XStack>

            {debt.description && (
              <Text fontSize={13} color={colors.textSecondary} mb="$2" ml={56}>
                {debt.description}
              </Text>
            )}

            <XStack ai="center" jc="flex-end" gap="$2" mt="$2">
              <Pressable onPress={() => togglePaid(debt)}>
                <View
                  px="$3"
                  py="$2"
                  br={10}
                  style={{ backgroundColor: debt.isPaid ? colors.iconBg : colors.successBg }}
                >
                  <XStack ai="center" gap="$1">
                    <Check size={14} color={debt.isPaid ? colors.textMuted : colors.success} />
                    <Text fontSize={12} fontWeight="600" color={debt.isPaid ? colors.textMuted : colors.success}>
                      {debt.isPaid ? t('debts.markUnpaid', 'Undo') : t('debts.markPaid', 'Mark Paid')}
                    </Text>
                  </XStack>
                </View>
              </Pressable>
              <Pressable onPress={() => handleEditDebt(debt)}>
                <View p="$2" br={10} style={{ backgroundColor: colors.iconBg }}>
                  <Edit3 size={16} color={colors.primary} />
                </View>
              </Pressable>
              <Pressable onPress={() => handleDeleteDebt(debt)}>
                <View p="$2" br={10} style={{ backgroundColor: colors.dangerBg }}>
                  <Trash2 size={16} color={colors.danger} />
                </View>
              </Pressable>
            </XStack>
          </YStack>
        </Pressable>
      </Animated.View>
    );
  };

  const DebtFormModal = ({ visible, onClose, onSave, title }: { visible: boolean; onClose: () => void; onSave: () => void; title: string }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View entering={FadeInDown.springify()}>
            <View 
              style={{
                backgroundColor: colors.card,
                padding: 24,
                borderRadius: 28,
                width: 360,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              <XStack ai="center" gap="$3" mb="$4">
                <View 
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: colors.successBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CircleDollarSign size={24} color={colors.success} />
                </View>
                <Text fontSize={20} fontWeight="700" color={colors.text}>{title}</Text>
              </XStack>

            {/* Debt Type Toggle */}
            <XStack gap="$2" mb="$4">
              <Pressable onPress={() => setDebtType('owe')} style={{ flex: 1 }}>
                <View
                  py="$3"
                  br={14}
                  style={{
                    backgroundColor: debtType === 'owe' ? colors.danger : colors.iconBg,
                  }}
                  ai="center"
                >
                  <XStack ai="center" gap="$2">
                    <ArrowUpRight size={18} color={debtType === 'owe' ? 'white' : colors.textMuted} />
                    <Text fontWeight="600" color={debtType === 'owe' ? 'white' : colors.text}>
                      {t('debts.iOwe', 'I Owe')}
                    </Text>
                  </XStack>
                </View>
              </Pressable>
              <Pressable onPress={() => setDebtType('owed')} style={{ flex: 1 }}>
                <View
                  py="$3"
                  br={14}
                  style={{
                    backgroundColor: debtType === 'owed' ? colors.success : colors.iconBg,
                  }}
                  ai="center"
                >
                  <XStack ai="center" gap="$2">
                    <ArrowDownLeft size={18} color={debtType === 'owed' ? 'white' : colors.textMuted} />
                    <Text fontWeight="600" color={debtType === 'owed' ? 'white' : colors.text}>
                      {t('debts.owedMe', 'Owed Me')}
                    </Text>
                  </XStack>
                </View>
              </Pressable>
            </XStack>

            <TextInput
              value={personName}
              onChangeText={setPersonName}
              placeholder={t('debts.form.namePlaceholder', 'Person name')}
              style={{
                fontSize: 16,
                padding: 16,
                borderRadius: 14,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
              placeholderTextColor={colors.textMuted}
            />

            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={t('debts.form.amountPlaceholder', 'Amount')}
              keyboardType="numeric"
              style={{
                fontSize: 16,
                padding: 16,
                borderRadius: 14,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
              placeholderTextColor={colors.textMuted}
            />

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('debts.form.descriptionPlaceholder', 'Description (optional)')}
              multiline
              style={{
                fontSize: 16,
                padding: 16,
                borderRadius: 14,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                marginBottom: 20,
                minHeight: 70,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
              placeholderTextColor={colors.textMuted}
            />

            <XStack gap="$3">
              <Pressable onPress={onClose} style={{ flex: 1 }}>
                <View py="$3" br={14} style={{ backgroundColor: colors.iconBg }} ai="center">
                  <Text fontSize={15} fontWeight="600" color={colors.textSecondary}>
                    {t('common.cancel', 'Cancel')}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={onSave} style={{ flex: 1 }}>
                <View py="$3" br={14} style={{ backgroundColor: colors.success }} ai="center">
                  <Text fontSize={15} fontWeight="600" color="white">
                    {t('common.save', 'Save')}
                  </Text>
                </View>
              </Pressable>
            </XStack>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <YStack f={1} style={{ backgroundColor: colors.bg }}>
        <YStack p="$4" gap="$4">
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
                  <Wallet size={28} color="#ffffff" />
                </View>
                <YStack f={1}>
                  <Text fontSize={26} fontWeight="800" color="#ffffff">
                    {t('debts.title', 'Debt Tracker')}
                  </Text>
                  <Text fontSize={14} color="rgba(255,255,255,0.8)">
                    {t('debts.subtitle', 'Track who owes what')}
                  </Text>
                </YStack>
              </XStack>
            </LinearGradient>
          </Animated.View>

          {/* Balance Summary Cards */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <XStack gap="$3">
              <YStack
                f={1}
                style={{
                  backgroundColor: colors.successBg,
                  borderRadius: 20,
                  padding: 16,
                  borderWidth: 1.5,
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                }}
              >
                <XStack ai="center" gap="$2" mb="$1">
                  <TrendingUp size={16} color={colors.success} />
                  <Text fontSize={12} color={colors.success}>{t('debts.ownedToYou', 'Owed to you')}</Text>
                </XStack>
                <Text fontSize={20} fontWeight="800" color={colors.success}>
                  +{formatCurrency(totalOwed, currency)}
                </Text>
              </YStack>
              <YStack
                f={1}
                style={{
                  backgroundColor: colors.dangerBg,
                  borderRadius: 20,
                  padding: 16,
                  borderWidth: 1.5,
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                }}
              >
                <XStack ai="center" gap="$2" mb="$1">
                  <TrendingDown size={16} color={colors.danger} />
                  <Text fontSize={12} color={colors.danger}>{t('debts.youOweTotal', 'You owe')}</Text>
                </XStack>
                <Text fontSize={20} fontWeight="800" color={colors.danger}>
                  -{formatCurrency(totalOwe, currency)}
                </Text>
              </YStack>
            </XStack>
          </Animated.View>

          {/* Net Balance */}
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <YStack
              style={{
                backgroundColor: balance >= 0 ? colors.successBg : colors.dangerBg,
                borderRadius: 20,
                padding: 20,
                borderWidth: 1.5,
                borderColor: balance >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                alignItems: 'center',
              }}
            >
              <Text fontSize={12} color={balance >= 0 ? colors.success : colors.danger} mb="$1">
                {t('debts.netBalance', 'Net Balance')}
              </Text>
              <Text fontSize={30} fontWeight="800" color={balance >= 0 ? colors.success : colors.danger}>
                {balance >= 0 ? '+' : ''}{formatCurrency(Math.abs(balance), currency)}
              </Text>
              <Text fontSize={11} color={balance >= 0 ? colors.success : colors.danger} opacity={0.8}>
                {balance >= 0 
                  ? t('debts.inProfit', "You're in profit!") 
                  : t('debts.inDebt', "You're in debt")
                }
              </Text>
            </YStack>
          </Animated.View>

          {/* Filter Tabs */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2">
                <FilterButton type="all" label={t('debts.filters.active', 'Active')} />
                <FilterButton type="owe" label={t('debts.filters.iOwe', 'I Owe')} />
                <FilterButton type="owed" label={t('debts.filters.owedMe', 'Owed Me')} />
                <FilterButton type="paid" label={t('debts.filters.paid', 'Paid')} />
              </XStack>
            </ScrollView>
          </Animated.View>
        </YStack>

        {/* Debts List */}
        <Animated.ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {filteredDebts.length > 0 ? (
            <YStack gap="$3">
              {filteredDebts.map((debt, index) => (
                <DebtCard key={debt.id} debt={debt} index={index} />
              ))}
            </YStack>
          ) : (
            <Animated.View entering={FadeIn.delay(200)}>
              <YStack ai="center" jc="center" py="$8">
                <View 
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: colors.iconBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <View 
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: colors.iconBgStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CircleDollarSign size={36} color={colors.textMuted} />
                  </View>
                </View>
                <Text fontSize={17} fontWeight="600" color={colors.text} mb="$2">
                  {t('debts.empty.title', 'No debts yet')}
                </Text>
                <Text fontSize={14} color={colors.textSecondary} textAlign="center" px="$4">
                  {t('debts.empty.description', 'Track money you owe or are owed')}
                </Text>
              </YStack>
            </Animated.View>
          )}
        </Animated.ScrollView>

        {/* Floating Add Button with pulse */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 24,
              right: 24,
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 10,
            },
            floatingButtonStyle,
          ]}
        >
          <Pressable
            onPress={() => { resetForm(); setShowAddModal(true); }}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Plus size={26} color="white" />
          </Pressable>
        </Animated.View>

        {/* Modals */}
        <DebtFormModal
          visible={showAddModal}
          onClose={() => { resetForm(); setShowAddModal(false); }}
          onSave={handleAddDebt}
          title={t('debts.add.title', 'Add Debt')}
        />
        <DebtFormModal
          visible={showEditModal}
          onClose={() => { resetForm(); setEditingDebt(null); setShowEditModal(false); }}
          onSave={handleSaveEdit}
          title={t('debts.edit.title', 'Edit Debt')}
        />
      </YStack>
    </SafeAreaView>
  );
}
