// app/tabs/quick-split.tsx — Wallet-style Quick Split (inspired by crypto wallet UI)
import React, { useState, useMemo, useCallback } from 'react';
import { ScrollView, TextInput, Alert, Vibration, Pressable, Modal, Share, StyleSheet } from 'react-native';
import { YStack, XStack, Text, View, Separator } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { 
  Calculator, Users, Zap, Plus, Minus, Check, Percent,
  DollarSign, PieChart, UserPlus, Trash2, Copy, Edit3,
  Palette, Share2, Coffee, ChevronDown, ArrowUpRight, ArrowDownLeft,
  Settings2,
} from '@tamagui/lucide-icons';

import { Button } from '@/shared/ui/Button';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { getCurrency } from '@/shared/config/currencies';

type SplitMode = 'equal' | 'percentage' | 'custom';

interface Participant {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  emoji: string;
}

const AVATAR_COLORS = [
  '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
  '#00BCD4', '#009688', '#4CAF50', '#FF9800', '#F44336',
];

const AVATAR_EMOJIS = ['👤', '👨', '👩', '🧑', '👦', '👧', '🧔', '👴', '👵', '🤴', '👸', '🦸', '🧙', '👻', '🤖'];

const formatWithCommas = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const formatCurrencyDisplay = (amount: number, currencyCode: string): string => {
  const curr = getCurrency(currencyCode);
  return `${curr.symbol} ${formatWithCommas(Math.round(amount))}`;
};

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000];

// Theme colors
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#0D0D0D' : '#F5F5F5',
  card: isDark ? '#1A1A1A' : '#FFFFFF',
  cardBorder: isDark ? '#2A2A2A' : '#EBEBEB',
  text: isDark ? '#FFFFFF' : '#1A1A1A',
  textSecondary: isDark ? '#8A8A8A' : '#6B6B6B',
  textMuted: isDark ? '#555555' : '#999999',
  accent: '#2ECC71',
  accentLight: isDark ? 'rgba(46,204,113,0.15)' : 'rgba(46,204,113,0.1)',
  accentDark: '#27AE60',
  red: '#E74C3C',
  redLight: isDark ? 'rgba(231,76,60,0.15)' : 'rgba(231,76,60,0.08)',
  orange: '#F39C12',
  orangeLight: isDark ? 'rgba(243,156,18,0.15)' : 'rgba(243,156,18,0.08)',
  purple: '#9B59B6',
  purpleLight: isDark ? 'rgba(155,89,182,0.15)' : 'rgba(155,89,182,0.08)',
  inputBg: isDark ? '#111111' : '#F0F0F0',
  divider: isDark ? '#222222' : '#EEEEEE',
  shadow: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
  balanceCardBg: isDark ? '#1E1E1E' : '#FFFFFF',
  balanceCardBorder: isDark ? '#333333' : '#E8E8E8',
  chipBg: isDark ? '#252525' : '#F0F0F0',
  chipActiveBg: isDark ? '#2ECC71' : '#2ECC71',
  modalBg: isDark ? '#1A1A1A' : '#FFFFFF',
});

export default function QuickSplitScreen() {
  const { t } = useTranslation();
  const { currency, theme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  
  const [totalAmount, setTotalAmount] = useState(100000);
  const [displayAmount, setDisplayAmount] = useState(formatWithCommas(100000));
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: t('quickSplit.person', 'Person') + ' 1', amount: 50000, percentage: 50, color: AVATAR_COLORS[0], emoji: '👤' },
    { id: '2', name: t('quickSplit.person', 'Person') + ' 2', amount: 50000, percentage: 50, color: AVATAR_COLORS[1], emoji: '👤' },
  ]);
  const [showResult, setShowResult] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [tipPercentage, setTipPercentage] = useState(0);
  const [includeTip, setIncludeTip] = useState(false);

  const curr = getCurrency(currency);
  const TIP_PRESETS = [0, 5, 10, 15, 20];

  const tipAmount = useMemo(() => (totalAmount * tipPercentage) / 100, [totalAmount, tipPercentage]);
  const totalWithTip = useMemo(() => includeTip ? totalAmount + tipAmount : totalAmount, [totalAmount, tipAmount, includeTip]);

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10) || 0;
    setTotalAmount(num);
    setDisplayAmount(formatWithCommas(num));
    recalculateAmounts(num, splitMode, participants);
  };

  const perPersonAmount = useMemo(() => {
    if (participants.length === 0) return 0;
    return totalWithTip / participants.length;
  }, [totalWithTip, participants.length]);

  const recalculateAmounts = useCallback((total: number, mode: SplitMode, parts: Participant[]) => {
    if (mode === 'equal' && parts.length > 0) {
      const actualTotal = includeTip ? total + (total * tipPercentage / 100) : total;
      const equalAmount = actualTotal / parts.length;
      const equalPercentage = 100 / parts.length;
      setParticipants(parts.map(p => ({ ...p, amount: equalAmount, percentage: equalPercentage })));
    }
  }, [includeTip, tipPercentage]);

  const addParticipant = () => {
    const newId = Date.now().toString();
    const colorIndex = participants.length % AVATAR_COLORS.length;
    const newParticipant: Participant = {
      id: newId, name: `${t('quickSplit.person', 'Person')} ${participants.length + 1}`,
      amount: 0, percentage: 0, color: AVATAR_COLORS[colorIndex], emoji: '👤'
    };
    const newList = [...participants, newParticipant];
    setParticipants(newList);
    recalculateAmounts(totalAmount, splitMode, newList);
    Vibration.vibrate(50);
  };

  const removeParticipant = (id: string) => {
    if (participants.length <= 2) {
      Alert.alert(t('quickSplit.minAlert.title', 'Minimum 2 people'), t('quickSplit.minAlert.message', 'You need at least 2 people to split!'));
      return;
    }
    const newList = participants.filter(p => p.id !== id);
    setParticipants(newList);
    recalculateAmounts(totalAmount, splitMode, newList);
    Vibration.vibrate(50);
  };

  const startEditName = (p: Participant) => { setEditingParticipant(p.id); setEditName(p.name); };
  const saveEditName = () => {
    if (editingParticipant && editName.trim()) {
      setParticipants(prev => prev.map(p => p.id === editingParticipant ? { ...p, name: editName.trim() } : p));
    }
    setEditingParticipant(null); setEditName('');
  };

  const changeColor = (id: string, color: string) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, color } : p));
    setShowColorPicker(null); Vibration.vibrate(30);
  };

  const changeEmoji = (id: string, emoji: string) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, emoji } : p));
    setShowEmojiPicker(null); Vibration.vibrate(30);
  };

  const setQuickPeopleCount = (count: number) => {
    const equalAmount = totalAmount / count;
    const equalPercentage = 100 / count;
    const newParticipants: Participant[] = Array.from({ length: count }, (_, i) => ({
      id: (i + 1).toString(), name: `${t('quickSplit.person', 'Person')} ${i + 1}`,
      amount: equalAmount, percentage: equalPercentage,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length], emoji: '👤'
    }));
    setParticipants(newParticipants);
    Vibration.vibrate(50);
  };

  const handleCalculate = () => {
    const actualTotal = includeTip ? totalWithTip : totalAmount;
    if (splitMode === 'equal') {
      const equalAmount = actualTotal / participants.length;
      setParticipants(prev => prev.map(p => ({ ...p, amount: equalAmount, percentage: 100 / participants.length })));
    } else if (splitMode === 'percentage') {
      setParticipants(prev => prev.map(p => ({ ...p, amount: (actualTotal * p.percentage) / 100 })));
    }
    setShowResult(true);
    Vibration.vibrate([0, 50, 50, 50]);
  };

  const handleShareResult = async () => {
    const lines = [
      `💰 ${t('quickSplit.title', 'Quick Split')}`, '',
      `📊 ${t('quickSplit.total', 'Total')}: ${formatCurrencyDisplay(totalAmount, currency)}`,
    ];
    if (includeTip && tipPercentage > 0) {
      lines.push(`☕ ${t('quickSplit.tip', 'Tip')} (${tipPercentage}%): ${formatCurrencyDisplay(tipAmount, currency)}`);
      lines.push(`💵 ${t('quickSplit.grandTotal', 'Grand Total')}: ${formatCurrencyDisplay(totalWithTip, currency)}`);
    }
    lines.push('', `👥 ${t('quickSplit.participants', 'Participants')}:`);
    participants.forEach(p => lines.push(`  ${p.emoji} ${p.name}: ${formatCurrencyDisplay(p.amount, currency)}`));
    lines.push('', `📱 Receipt Splitter App`);
    try { await Share.share({ message: lines.join('\n') }); } catch {}
  };

  const totalPercentage = useMemo(() => participants.reduce((sum, p) => sum + p.percentage, 0), [participants]);
  const totalCustom = useMemo(() => participants.reduce((sum, p) => sum + p.amount, 0), [participants]);

  // Percentage change display
  const splitSavings = useMemo(() => {
    if (participants.length <= 1) return 0;
    return ((participants.length - 1) / participants.length) * 100;
  }, [participants.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <YStack p="$4" gap="$4">
          {/* --- HEADER: Wallet style --- */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <XStack ai="center" jc="space-between" mb="$2">
              <XStack ai="center" gap="$3">
                <View
                  w={44} h={44} br={22} ai="center" jc="center"
                  style={{ backgroundColor: colors.accentLight }}
                >
                  <Zap size={22} color={colors.accent} />
                </View>
                <Text fontSize={20} fontWeight="700" style={{ color: colors.text }}>
                  {t('quickSplit.title', 'Quick Split')}
                </Text>
              </XStack>
              <Pressable onPress={() => { /* settings */ }}>
                <Settings2 size={22} color={colors.textSecondary} />
              </Pressable>
            </XStack>
          </Animated.View>

          {/* --- TOTAL BALANCE CARD (like wallet) --- */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <YStack
              style={{
                backgroundColor: colors.balanceCardBg,
                borderRadius: 24,
                padding: 24,
                borderWidth: 1,
                borderColor: colors.balanceCardBorder,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 1,
                shadowRadius: 24,
                elevation: 4,
              }}
            >
              <Text fontSize={14} style={{ color: colors.textSecondary }} mb="$2">
                {t('quickSplit.totalAmount', 'Total Amount')}
              </Text>

              <XStack ai="center" gap="$2" mb="$3">
                <Text fontSize={14} fontWeight="600" style={{ color: colors.textSecondary }}>
                  {curr.symbol}
                </Text>
                <TextInput
                  value={displayAmount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  style={{
                    fontSize: 36, fontWeight: '800',
                    color: colors.text, minWidth: 160,
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </XStack>

              {/* Savings badge */}
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: colors.accentLight,
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Text fontSize={12} fontWeight="600" style={{ color: colors.accent }}>
                  {splitSavings > 0 ? `−${splitSavings.toFixed(0)}%` : '0%'} {t('quickSplit.perPerson', 'per person')}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 16 }} />

              {/* Preset amounts - scrollable chips */}
              <Text fontSize={12} style={{ color: colors.textMuted }} mb="$2">
                {t('quickSplit.shortBy', 'Quick amounts')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {PRESET_AMOUNTS.map((amount) => (
                  <Pressable
                    key={amount}
                    onPress={() => {
                      setTotalAmount(amount); setDisplayAmount(formatWithCommas(amount));
                      recalculateAmounts(amount, splitMode, participants); Vibration.vibrate(30);
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                        backgroundColor: totalAmount === amount ? colors.chipActiveBg : colors.chipBg,
                      }}
                    >
                      <Text fontSize={13} fontWeight="600"
                        style={{ color: totalAmount === amount ? '#FFFFFF' : colors.textSecondary }}>
                        {formatWithCommas(amount)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </YStack>
          </Animated.View>

          {/* --- TIP SECTION --- */}
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <YStack
              style={{
                backgroundColor: colors.card, borderRadius: 20, padding: 20,
                borderWidth: 1, borderColor: colors.cardBorder,
              }}
            >
              <XStack ai="center" jc="space-between" mb="$3">
                <XStack ai="center" gap="$3">
                  <View w={36} h={36} br={10} ai="center" jc="center"
                    style={{ backgroundColor: colors.orangeLight }}>
                    <Coffee size={18} color={colors.orange} />
                  </View>
                  <Text fontSize={15} fontWeight="600" style={{ color: colors.text }}>
                    {t('quickSplit.tip', 'Tip')}
                  </Text>
                </XStack>
                <Pressable onPress={() => { setIncludeTip(!includeTip); Vibration.vibrate(30); }}>
                  <View w={48} h={26} br={13}
                    style={{ backgroundColor: includeTip ? colors.accent : colors.chipBg, justifyContent: 'center', paddingHorizontal: 2 }}>
                    <View w={22} h={22} br={11}
                      style={{ backgroundColor: '#FFFFFF', marginLeft: includeTip ? 'auto' : 0, elevation: 2 }} />
                  </View>
                </Pressable>
              </XStack>

              {includeTip && (
                <>
                  <XStack gap="$2" mb="$3">
                    {TIP_PRESETS.map((percent) => (
                      <Pressable key={percent} onPress={() => { setTipPercentage(percent); Vibration.vibrate(30); }} style={{ flex: 1 }}>
                        <View py="$2" br={10} ai="center"
                          style={{
                            backgroundColor: tipPercentage === percent ? colors.orange : colors.chipBg,
                          }}>
                          <Text fontSize={13} fontWeight="700"
                            style={{ color: tipPercentage === percent ? '#FFFFFF' : colors.textSecondary }}>
                            {percent}%
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </XStack>
                  <YStack p="$3" br={14} style={{ backgroundColor: colors.orangeLight }} ai="center">
                    <Text fontSize={13} style={{ color: colors.orange }}>
                      {t('quickSplit.tipAmount', 'Tip')}: {formatCurrencyDisplay(tipAmount, currency)}
                    </Text>
                    <Text fontSize={16} fontWeight="700" mt="$1" style={{ color: colors.text }}>
                      {t('quickSplit.grandTotal', 'Grand Total')}: {formatCurrencyDisplay(totalWithTip, currency)}
                    </Text>
                  </YStack>
                </>
              )}
            </YStack>
          </Animated.View>

          {/* --- SPLIT MODE --- */}
          <Animated.View entering={FadeInDown.delay(350).springify()}>
            <YStack
              style={{
                backgroundColor: colors.card, borderRadius: 20, padding: 20,
                borderWidth: 1, borderColor: colors.cardBorder,
              }}
            >
              <Text fontSize={12} fontWeight="500" style={{ color: colors.textMuted }} mb="$3">
                {t('quickSplit.splitMode', 'SPLIT MODE')}
              </Text>
              <XStack gap="$2">
                {[
                  { mode: 'equal' as SplitMode, label: t('quickSplit.equal', 'Equal'), icon: Users },
                  { mode: 'percentage' as SplitMode, label: t('quickSplit.percentage', 'Percent'), icon: Percent },
                  { mode: 'custom' as SplitMode, label: t('quickSplit.custom', 'Custom'), icon: DollarSign },
                ].map(({ mode, label, icon: Icon }) => (
                  <Pressable key={mode} onPress={() => setSplitMode(mode)} style={{ flex: 1 }}>
                    <YStack ai="center" py="$3" br={14}
                      style={{
                        backgroundColor: splitMode === mode ? colors.accent : colors.chipBg,
                      }}>
                      <Icon size={20} color={splitMode === mode ? '#FFFFFF' : colors.textSecondary} />
                      <Text fontSize={11} fontWeight="600" mt="$1"
                        style={{ color: splitMode === mode ? '#FFFFFF' : colors.textSecondary }}>
                        {label}
                      </Text>
                    </YStack>
                  </Pressable>
                ))}
              </XStack>
            </YStack>
          </Animated.View>

          {/* --- PEOPLE COUNT (Equal mode) --- */}
          {splitMode === 'equal' && (
            <Animated.View entering={FadeInDown.delay(400).springify()}>
              <YStack
                style={{
                  backgroundColor: colors.card, borderRadius: 20, padding: 20,
                  borderWidth: 1, borderColor: colors.cardBorder,
                }}
              >
                <Text fontSize={12} fontWeight="500" style={{ color: colors.textMuted }} mb="$3">
                  {t('quickSplit.howManyPeople', 'HOW MANY PEOPLE?')}
                </Text>
                <XStack gap="$2" jc="center" flexWrap="wrap">
                  {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                    <Pressable key={count} onPress={() => setQuickPeopleCount(count)}>
                      <View
                        w={48} h={48} br={24} ai="center" jc="center"
                        style={{
                          backgroundColor: participants.length === count ? colors.accent : colors.chipBg,
                        }}
                      >
                        <Text fontSize={17} fontWeight="700"
                          style={{ color: participants.length === count ? '#FFFFFF' : colors.textSecondary }}>
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </XStack>

                {/* Per person result */}
                <YStack mt="$4" py="$4" br={16} ai="center"
                  style={{ backgroundColor: colors.accentLight }}>
                  <Text fontSize={13} style={{ color: colors.accent }}>
                    {t('quickSplit.eachPays', 'Each person pays')}
                  </Text>
                  <Text fontSize={32} fontWeight="800" mt="$1" style={{ color: colors.accent }}>
                    {formatCurrencyDisplay(perPersonAmount, currency)}
                  </Text>
                  <Text fontSize={11} mt="$1" style={{ color: colors.textMuted }}>
                    {formatCurrencyDisplay(totalAmount, currency)} ÷ {participants.length}
                  </Text>
                </YStack>
              </YStack>
            </Animated.View>
          )}

          {/* --- PARTICIPANTS LIST (Percentage & Custom) --- */}
          {(splitMode === 'percentage' || splitMode === 'custom') && (
            <Animated.View entering={FadeInDown.delay(400).springify()}>
              <YStack
                style={{
                  backgroundColor: colors.card, borderRadius: 20, padding: 20,
                  borderWidth: 1, borderColor: colors.cardBorder,
                }}
              >
                <XStack ai="center" jc="space-between" mb="$4">
                  <Text fontSize={12} fontWeight="500" style={{ color: colors.textMuted }}>
                    {t('quickSplit.participants', 'PARTICIPANTS')} ({participants.length})
                  </Text>
                  <Pressable onPress={addParticipant}>
                    <View w={36} h={36} br={18} ai="center" jc="center"
                      style={{ backgroundColor: colors.accentLight }}>
                      <UserPlus size={18} color={colors.accent} />
                    </View>
                  </Pressable>
                </XStack>

                <YStack gap="$3">
                  {participants.map((p) => (
                    <YStack key={p.id} p="$3" br={16}
                      style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.divider }}>
                      <XStack ai="center" gap="$3">
                        <Pressable onPress={() => setShowEmojiPicker(p.id)}>
                          <View w={44} h={44} br={22} ai="center" jc="center"
                            style={{ backgroundColor: p.color }}>
                            <Text fontSize={22}>{p.emoji}</Text>
                          </View>
                        </Pressable>

                        <YStack f={1}>
                          {editingParticipant === p.id ? (
                            <XStack ai="center" gap="$2">
                              <TextInput
                                value={editName} onChangeText={setEditName} autoFocus
                                onBlur={saveEditName} onSubmitEditing={saveEditName}
                                style={{ fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.accent }}
                              />
                              <Pressable onPress={saveEditName}><Check size={18} color={colors.accent} /></Pressable>
                            </XStack>
                          ) : (
                            <Pressable onPress={() => startEditName(p)}>
                              <Text fontSize={15} fontWeight="600" style={{ color: colors.text }}>{p.name}</Text>
                            </Pressable>
                          )}
                          <Text fontSize={12} mt="$1" style={{ color: colors.textSecondary }}>
                            {splitMode === 'percentage' ? `${p.percentage.toFixed(0)}%` : formatCurrencyDisplay(p.amount, currency)}
                          </Text>
                        </YStack>

                        <XStack gap="$1">
                          <Pressable onPress={() => setShowColorPicker(p.id)}>
                            <View w={30} h={30} br={8} ai="center" jc="center" style={{ backgroundColor: colors.chipBg }}>
                              <Palette size={14} color={colors.textSecondary} />
                            </View>
                          </Pressable>
                          <Pressable onPress={() => removeParticipant(p.id)}>
                            <View w={30} h={30} br={8} ai="center" jc="center" style={{ backgroundColor: colors.redLight }}>
                              <Trash2 size={14} color={colors.red} />
                            </View>
                          </Pressable>
                        </XStack>
                      </XStack>

                      {splitMode === 'custom' && (
                        <XStack ai="center" jc="center" gap="$3" mt="$3">
                          <Pressable onPress={() => setParticipants(prev => prev.map(part => part.id === p.id ? { ...part, amount: Math.max(0, part.amount - 10000) } : part))}>
                            <View w={36} h={36} br={18} ai="center" jc="center" style={{ backgroundColor: colors.chipBg }}>
                              <Minus size={16} color={colors.textSecondary} />
                            </View>
                          </Pressable>
                          <Text fontSize={17} fontWeight="700" style={{ color: colors.text, minWidth: 100, textAlign: 'center' }}>
                            {formatCurrencyDisplay(p.amount, currency)}
                          </Text>
                          <Pressable onPress={() => setParticipants(prev => prev.map(part => part.id === p.id ? { ...part, amount: part.amount + 10000 } : part))}>
                            <View w={36} h={36} br={18} ai="center" jc="center" style={{ backgroundColor: colors.accentLight }}>
                              <Plus size={16} color={colors.accent} />
                            </View>
                          </Pressable>
                        </XStack>
                      )}

                      {splitMode === 'percentage' && (
                        <XStack ai="center" jc="center" gap="$3" mt="$3">
                          <Pressable onPress={() => setParticipants(prev => prev.map(part => part.id === p.id ? { ...part, percentage: Math.max(0, part.percentage - 5) } : part))}>
                            <View w={36} h={36} br={18} ai="center" jc="center" style={{ backgroundColor: colors.chipBg }}>
                              <Minus size={16} color={colors.textSecondary} />
                            </View>
                          </Pressable>
                          <Text fontSize={22} fontWeight="800" style={{ color: colors.purple, minWidth: 60, textAlign: 'center' }}>
                            {p.percentage.toFixed(0)}%
                          </Text>
                          <Pressable onPress={() => setParticipants(prev => prev.map(part => part.id === p.id ? { ...part, percentage: Math.min(100, part.percentage + 5) } : part))}>
                            <View w={36} h={36} br={18} ai="center" jc="center" style={{ backgroundColor: colors.purpleLight }}>
                              <Plus size={16} color={colors.purple} />
                            </View>
                          </Pressable>
                        </XStack>
                      )}
                    </YStack>
                  ))}
                </YStack>

                {splitMode === 'percentage' && Math.abs(totalPercentage - 100) > 0.1 && (
                  <XStack mt="$3" p="$3" br={12} style={{ backgroundColor: colors.orangeLight }} ai="center" gap="$2">
                    <Text fontSize={13} style={{ color: colors.orange }}>
                      ⚠️ {t('quickSplit.percentageWarning', 'Total')}: {totalPercentage.toFixed(0)}% ({t('quickSplit.shouldBe', 'should be')} 100%)
                    </Text>
                  </XStack>
                )}

                {splitMode === 'custom' && Math.abs(totalCustom - totalAmount) > 1 && (
                  <XStack mt="$3" p="$3" br={12} style={{ backgroundColor: colors.orangeLight }} ai="center" gap="$2">
                    <Text fontSize={13} style={{ color: colors.orange }}>
                      ⚠️ {formatCurrencyDisplay(totalCustom, currency)} / {formatCurrencyDisplay(totalAmount, currency)}
                    </Text>
                  </XStack>
                )}
              </YStack>
            </Animated.View>
          )}

          {/* --- CALCULATE BUTTON --- */}
          <Animated.View entering={FadeInDown.delay(500).springify()}>
            <Pressable onPress={handleCalculate}>
              <View
                style={{
                  backgroundColor: colors.accent, borderRadius: 16,
                  paddingVertical: 18, alignItems: 'center',
                  shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
                }}
              >
                <Text fontSize={17} fontWeight="700" style={{ color: '#FFFFFF' }}>
                  {t('quickSplit.calculate', 'Calculate')} ⚡
                </Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* --- RESULT CARD (Wallet transaction style) --- */}
          {showResult && (
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <YStack
                style={{
                  backgroundColor: colors.card, borderRadius: 20, padding: 20,
                  borderWidth: 1, borderColor: colors.accentLight,
                }}
              >
                <XStack ai="center" gap="$3" mb="$4">
                  <View w={40} h={40} br={20} ai="center" jc="center"
                    style={{ backgroundColor: colors.accentLight }}>
                    <Check size={22} color={colors.accent} />
                  </View>
                  <Text fontSize={18} fontWeight="700" style={{ color: colors.text }}>
                    {t('quickSplit.result', 'Split Result')}
                  </Text>
                </XStack>

                {/* Per-person breakdown — wallet transactions style */}
                <YStack gap="$3" mb="$4">
                  {participants.map((p, idx) => {
                    const widthPercent = totalAmount > 0 ? (p.amount / totalAmount) * 100 : 0;
                    const isPositive = idx % 2 === 0;
                    return (
                      <XStack key={p.id} ai="center" gap="$3">
                        <View w={44} h={44} br={22} ai="center" jc="center"
                          style={{ backgroundColor: p.color }}>
                          <Text fontSize={22}>{p.emoji}</Text>
                        </View>
                        <YStack f={1}>
                          <Text fontSize={14} fontWeight="600" style={{ color: colors.text }}>{p.name}</Text>
                          <Text fontSize={12} style={{ color: colors.textMuted }}>{widthPercent.toFixed(0)}%</Text>
                        </YStack>
                        <YStack ai="flex-end">
                          <Text fontSize={16} fontWeight="700" style={{ color: colors.text }}>
                            {formatCurrencyDisplay(p.amount, currency)}
                          </Text>
                        </YStack>
                      </XStack>
                    );
                  })}
                </YStack>

                <View style={{ height: 1, backgroundColor: colors.divider }} />

                {includeTip && tipPercentage > 0 && (
                  <>
                    <XStack jc="space-between" ai="center" mt="$3">
                      <Text fontSize={13} style={{ color: colors.textSecondary }}>{t('quickSplit.subtotal', 'Subtotal')}</Text>
                      <Text fontSize={15} fontWeight="600" style={{ color: colors.textSecondary }}>{formatCurrencyDisplay(totalAmount, currency)}</Text>
                    </XStack>
                    <XStack jc="space-between" ai="center" mt="$2">
                      <Text fontSize={13} style={{ color: colors.orange }}>☕ {t('quickSplit.tip', 'Tip')} ({tipPercentage}%)</Text>
                      <Text fontSize={15} fontWeight="600" style={{ color: colors.orange }}>{formatCurrencyDisplay(tipAmount, currency)}</Text>
                    </XStack>
                    <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 12 }} />
                  </>
                )}

                <XStack jc="space-between" ai="center" mt="$2">
                  <Text fontSize={15} fontWeight="600" style={{ color: colors.text }}>
                    {t('quickSplit.total', 'Total')}
                  </Text>
                  <Text fontSize={20} fontWeight="800" style={{ color: colors.accent }}>
                    {formatCurrencyDisplay(includeTip ? totalWithTip : totalAmount, currency)}
                  </Text>
                </XStack>

                {/* Share button */}
                <Pressable onPress={handleShareResult}>
                  <XStack mt="$4" p="$3" br={12}
                    style={{ backgroundColor: colors.accentLight }} ai="center" jc="center" gap="$2">
                    <Share2 size={16} color={colors.accent} />
                    <Text fontSize={14} fontWeight="600" style={{ color: colors.accent }}>
                      {t('quickSplit.shareResult', 'Share Result')}
                    </Text>
                  </XStack>
                </Pressable>
              </YStack>
            </Animated.View>
          )}
        </YStack>
      </ScrollView>

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker !== null} transparent animationType="fade" onRequestClose={() => setShowColorPicker(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowColorPicker(null)}>
          <View style={{ backgroundColor: colors.modalBg, padding: 24, borderRadius: 20, width: 280 }}>
            <Text fontSize={16} fontWeight="700" style={{ color: colors.text }} mb="$4" textAlign="center">
              {t('quickSplit.chooseColor', 'Choose Color')}
            </Text>
            <XStack flexWrap="wrap" gap="$3" jc="center">
              {AVATAR_COLORS.map((color) => (
                <Pressable key={color} onPress={() => showColorPicker && changeColor(showColorPicker, color)}>
                  <View w={44} h={44} br={22} style={{ backgroundColor: color, borderWidth: 2, borderColor: colors.divider }} />
                </Pressable>
              ))}
            </XStack>
            <Pressable onPress={() => setShowColorPicker(null)}>
              <XStack mt="$4" p="$3" br={12} style={{ backgroundColor: colors.chipBg }} ai="center" jc="center">
                <Text fontSize={14} fontWeight="600" style={{ color: colors.textSecondary }}>
                  {t('common.cancel', 'Cancel')}
                </Text>
              </XStack>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Emoji Picker Modal */}
      <Modal visible={showEmojiPicker !== null} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowEmojiPicker(null)}>
          <View style={{ backgroundColor: colors.modalBg, padding: 24, borderRadius: 20, width: 300 }}>
            <Text fontSize={16} fontWeight="700" style={{ color: colors.text }} mb="$4" textAlign="center">
              {t('quickSplit.chooseEmoji', 'Choose Avatar')}
            </Text>
            <XStack flexWrap="wrap" gap="$2" jc="center">
              {AVATAR_EMOJIS.map((emoji) => (
                <Pressable key={emoji} onPress={() => showEmojiPicker && changeEmoji(showEmojiPicker, emoji)}>
                  <View w={44} h={44} br={12} ai="center" jc="center" style={{ backgroundColor: colors.chipBg }}>
                    <Text fontSize={24}>{emoji}</Text>
                  </View>
                </Pressable>
              ))}
            </XStack>
            <Pressable onPress={() => setShowEmojiPicker(null)}>
              <XStack mt="$4" p="$3" br={12} style={{ backgroundColor: colors.chipBg }} ai="center" jc="center">
                <Text fontSize={14} fontWeight="600" style={{ color: colors.textSecondary }}>
                  {t('common.cancel', 'Cancel')}
                </Text>
              </XStack>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
