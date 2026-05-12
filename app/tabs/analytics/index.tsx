// app/tabs/analytics/index.tsx — Dashboard-style Analytics (inspired by purple dashboard UI)
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { YStack, XStack, Text, View } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { BarChart, PieChart as PieChartComponent } from 'react-native-chart-kit';
import { Dimensions, TextInput, Alert, StyleSheet, Vibration, Modal, Pressable, ScrollView } from 'react-native';
import { Edit3, Check, X, TrendingUp, Users, Calendar, DollarSign, PieChart as PieChartIcon, Download, FileText, Table, Share2, Sparkles, Star, ArrowUpRight, ArrowDownRight } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Spinner, Button } from 'tamagui';

import { ScreenContainer } from '@/shared/ui/ScreenContainer';
import { useAnalyticsStore } from '@/features/analytics/model/analytics.store';
import { useCategoriesStore, Category } from '@/features/analytics/model/categories.store';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { formatCurrency } from '@/shared/config/currencies';
import { exportToCSV, exportAsText, exportToPDF, ExportData } from '@/shared/lib/utils/export';

const screenWidth = Dimensions.get('window').width;

// Theme colors — purple dashboard style
const getColors = (isDark: boolean) => ({
  bg: isDark ? '#0D0D0D' : '#F5F5F5',
  card: isDark ? '#1A1A1A' : '#FFFFFF',
  cardBorder: isDark ? '#2A2A2A' : '#EBEBEB',
  text: isDark ? '#FFFFFF' : '#1A1A1A',
  textSecondary: isDark ? '#8A8A8A' : '#6B6B6B',
  textMuted: isDark ? '#555555' : '#999999',
  // Purple accent theme (like image 2)
  primary: isDark ? '#A78BFA' : '#7C3AED',
  primaryLight: isDark ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.08)',
  primaryDark: isDark ? '#8B5CF6' : '#6D28D9',
  accent: '#2ECC71',
  accentLight: isDark ? 'rgba(46,204,113,0.15)' : 'rgba(46,204,113,0.08)',
  blue: '#3B82F6',
  blueLight: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
  red: '#EF4444',
  redLight: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
  orange: '#F59E0B',
  orangeLight: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
  chipBg: isDark ? '#252525' : '#F0F0F0',
  divider: isDark ? '#222222' : '#EEEEEE',
  shadow: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.06)',
  modalBg: isDark ? '#1A1A1A' : '#FFFFFF',
  chartBar: isDark ? '#A78BFA' : '#7C3AED',
  chartBarLight: isDark ? 'rgba(167,139,250,0.3)' : 'rgba(124,58,237,0.15)',
  serviceIconBg: isDark ? '#252525' : '#F0F0F0',
});

// Chart config  
const getChartConfig = (isDark: boolean) => {
  const colors = getColors(isDark);
  return {
    backgroundColor: 'transparent',
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => isDark ? `rgba(167, 139, 250, ${opacity})` : `rgba(124, 58, 237, ${opacity})`,
    labelColor: (opacity = 1) => isDark ? `rgba(255,255,255,${opacity * 0.6})` : `rgba(0,0,0,${opacity * 0.5})`,
    style: { borderRadius: 16 },
    propsForBackgroundLines: {
      strokeDasharray: '4 4',
      stroke: isDark ? '#333' : '#E5E5E5',
      strokeWidth: 1,
    },
    barPercentage: 0.6,
    propsForDots: { r: '5', strokeWidth: '2', stroke: isDark ? '#A78BFA' : '#7C3AED' },
  };
};

export default function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  const { data, loading, saving, error, fetchAnalytics, updateAnalytics } = useAnalyticsStore();
  const { currency, theme } = useAppStore();
  const { categories, totalBudget, updateCategoryAmount, setTotalBudget, distributeBudget, addCategory, removeCategory } = useCategoriesStore();
  const isDark = theme === 'dark';
  const isUzbek = i18n.language === 'uz';
  const colors = getColors(isDark);
  const chartConfig = getChartConfig(isDark);

  const [editingField, setEditingField] = useState<'totalSpent' | 'totalSessions' | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(String(totalBudget));
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');

  const exportData = useMemo<ExportData | null>(() => {
    if (!data) return null;
    const totalCategoryAmount = categories.reduce((sum, cat) => sum + cat.amount, 0);
    return {
      title: t('analytics.exportTitle', 'Analytics Report'),
      date: new Date().toLocaleDateString(isUzbek ? 'uz-UZ' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      summary: { totalSpent: data.totalSpent, totalSessions: data.totalSessions, averagePerSession: data.averagePerSession, currency },
      categories: categories.map(cat => ({
        name: isUzbek ? cat.nameUz : cat.name,
        amount: cat.amount,
        percentage: totalCategoryAmount > 0 ? (cat.amount / totalCategoryAmount) * 100 : 0,
      })),
    };
  }, [data, currency, t, isUzbek, categories]);

  const handleExportPDF = useCallback(async () => {
    if (!exportData) return;
    setExporting(true); Vibration.vibrate(50);
    await exportToPDF(exportData); setExporting(false);
  }, [exportData]);

  const handleExportCSV = useCallback(async () => {
    if (!exportData) return;
    setExporting(true); Vibration.vibrate(50);
    await exportToCSV(exportData); setExporting(false);
  }, [exportData]);

  const handleShareText = useCallback(async () => {
    if (!exportData) return;
    setExporting(true); Vibration.vibrate(50);
    await exportAsText(exportData); setExporting(false);
  }, [exportData]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleSaveField = useCallback(async (field: 'totalSpent' | 'totalSessions') => {
    const num = parseFloat(editDraft);
    if (isNaN(num) || num < 0) { Alert.alert(t('common.error', 'Error'), t('analytics.invalidValue', 'Invalid value')); return; }
    if (field === 'totalSpent') await updateAnalytics({ totalSpent: num });
    else await updateAnalytics({ totalSessions: Math.round(num) });
    setEditingField(null);
  }, [editDraft, updateAnalytics, t]);

  const handleDistributeBudget = useCallback(() => {
    const budget = parseFloat(budgetDraft);
    if (isNaN(budget) || budget <= 0) { Alert.alert(t('common.error', 'Error'), 'Invalid budget'); return; }
    setTotalBudget(budget); distributeBudget(budget); setShowBudgetModal(false); Vibration.vibrate(50);
  }, [budgetDraft, setTotalBudget, distributeBudget, t]);

  const saveCategoryAmount = useCallback((catId: string) => {
    const amount = parseFloat(categoryDraft);
    if (isNaN(amount) || amount < 0) return;
    updateCategoryAmount(catId, amount); setEditingCategoryId(null); Vibration.vibrate(30);
  }, [categoryDraft, updateCategoryAmount]);

  const pieData = useMemo(() => categories.map((cat) => ({
    name: cat.name, amount: cat.amount, color: cat.color,
    legendFontColor: isDark ? '#aaa' : '#555', legendFontSize: 12,
  })), [categories, isDark]);

  const totalCategoryAmount = useMemo(() => categories.reduce((sum, cat) => sum + cat.amount, 0), [categories]);

  if (loading) {
    return (<SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><YStack f={1} ai="center" jc="center"><Spinner size="large" color={colors.primary} /><Text mt="$2" style={{ color: colors.textSecondary }}>{t('analytics.loading', 'Loading...')}</Text></YStack></SafeAreaView>);
  }
  if (error) {
    return (<SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><YStack f={1} ai="center" jc="center"><Text style={{ color: colors.red }}>{error}</Text></YStack></SafeAreaView>);
  }
  if (!data) {
    return (<SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><YStack f={1} ai="center" jc="center"><Text style={{ color: colors.textSecondary }}>{t('analytics.noData', 'No data')}</Text></YStack></SafeAreaView>);
  }

  const monthlyLabels = data.monthlyChart.map((item: { month: string }) => item.month);
  const monthlyTotals = data.monthlyChart.map((item: { total: number }) => item.total);

  // Service items — category icons grid (like image 2)
  const serviceItems = categories.slice(0, 8).map((cat) => ({
    id: cat.id, icon: cat.icon, name: isUzbek ? cat.nameUz : cat.name, color: cat.color,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
        <YStack p="$4" gap="$4">

          {/* --- HEADER --- */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <YStack gap="$1">
              <Text fontSize={22} fontWeight="700" style={{ color: colors.text }}>
                {t('analytics.title', 'Dashboard')}
              </Text>
              <Text fontSize={13} style={{ color: colors.textSecondary }}>
                {t('analytics.yourBalance', 'Your Balance')}
              </Text>
            </YStack>
          </Animated.View>

          {/* --- BALANCE CARD (purple banner like image 2) --- */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <YStack
              style={{
                backgroundColor: colors.primary, borderRadius: 24, padding: 24,
                shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
              }}
            >
              <Text fontSize={32} fontWeight="800" style={{ color: '#FFFFFF' }}>
                {formatCurrency(data.totalSpent, currency)}
              </Text>
              <Text fontSize={13} mt="$1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {t('analytics.totalSpent', 'Total Spent')}
              </Text>

              {/* Quick action buttons: Transfer / Top Up style */}
              <XStack gap="$3" mt="$4">
                <Pressable style={{ flex: 1 }} onPress={() => { setEditingField('totalSpent'); setEditDraft(String(data.totalSpent)); }}>
                  <XStack ai="center" jc="center" gap="$2" py="$2" br={14}
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Edit3 size={16} color="#FFFFFF" />
                    <Text fontSize={13} fontWeight="600" style={{ color: '#FFFFFF' }}>
                      {t('analytics.edit', 'Edit')}
                    </Text>
                  </XStack>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={handleShareText}>
                  <XStack ai="center" jc="center" gap="$2" py="$2" br={14}
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Share2 size={16} color="#FFFFFF" />
                    <Text fontSize={13} fontWeight="600" style={{ color: '#FFFFFF' }}>
                      {t('analytics.share', 'Share')}
                    </Text>
                  </XStack>
                </Pressable>
              </XStack>
            </YStack>
          </Animated.View>

          {/* --- STATISTIC SECTION (Bar Chart like image 2) --- */}
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <YStack
              style={{
                backgroundColor: colors.card, borderRadius: 20, padding: 20,
                borderWidth: 1, borderColor: colors.cardBorder,
              }}
            >
              <XStack ai="center" jc="space-between" mb="$3">
                <Text fontSize={16} fontWeight="700" style={{ color: colors.text }}>
                  {t('analytics.statistic', 'Statistic')}
                </Text>
                <Text fontSize={13} style={{ color: colors.primary }}>
                  {t('analytics.seeMore', 'See More')}
                </Text>
              </XStack>

              <BarChart
                data={{
                  labels: monthlyLabels.length > 0 ? monthlyLabels : ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
                  datasets: [{ data: monthlyTotals.length > 0 ? monthlyTotals : [0, 0, 0, 0, 0, 0, 0] }],
                }}
                width={screenWidth - 72}
                height={200}
                chartConfig={chartConfig}
                style={{ borderRadius: 12, marginLeft: -8 }}
                fromZero
                showBarTops={false}
                withInnerLines
                yAxisLabel=""
                yAxisSuffix=""
              />
            </YStack>
          </Animated.View>

          {/* --- SUMMARY CARDS (2-column) --- */}
          <Animated.View entering={FadeInDown.delay(350).springify()}>
            <XStack gap="$3">
              {/* Sessions card */}
              <YStack f={1}
                style={{
                  backgroundColor: colors.card, borderRadius: 20, padding: 16,
                  borderWidth: 1, borderColor: colors.cardBorder,
                }}
              >
                <View w={36} h={36} br={10} ai="center" jc="center"
                  style={{ backgroundColor: colors.blueLight }} mb="$2">
                  <Calendar size={18} color={colors.blue} />
                </View>
                <Text fontSize={22} fontWeight="800" style={{ color: colors.text }}>
                  {data.totalSessions}
                </Text>
                <Text fontSize={12} style={{ color: colors.textSecondary }}>
                  {t('analytics.totalSessions', 'Sessions')}
                </Text>
                <Pressable onPress={() => { setEditingField('totalSessions'); setEditDraft(String(data.totalSessions)); }}>
                  <Text fontSize={11} mt="$1" style={{ color: colors.primary }}>
                    {t('analytics.edit', 'Edit')}
                  </Text>
                </Pressable>
              </YStack>
              {/* Average card */}
              <YStack f={1}
                style={{
                  backgroundColor: colors.card, borderRadius: 20, padding: 16,
                  borderWidth: 1, borderColor: colors.cardBorder,
                }}
              >
                <View w={36} h={36} br={10} ai="center" jc="center"
                  style={{ backgroundColor: colors.accentLight }} mb="$2">
                  <TrendingUp size={18} color={colors.accent} />
                </View>
                <Text fontSize={22} fontWeight="800" style={{ color: colors.text }}>
                  {formatCurrency(data.averagePerSession, currency)}
                </Text>
                <Text fontSize={12} style={{ color: colors.textSecondary }}>
                  {t('analytics.averagePerSession', 'Average')}
                </Text>
                <Text fontSize={11} mt="$1" style={{ color: colors.textMuted }}>
                  {t('analytics.autoCalculated', 'auto')}
                </Text>
              </YStack>
            </XStack>
          </Animated.View>

          {/* --- SERVICE / CATEGORY GRID (like image 2) --- */}
          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <YStack
              style={{
                backgroundColor: colors.card, borderRadius: 20, padding: 20,
                borderWidth: 1, borderColor: colors.cardBorder,
              }}
            >
              <XStack ai="center" jc="space-between" mb="$3">
                <Text fontSize={16} fontWeight="700" style={{ color: colors.text }}>
                  {t('analytics.categoryBreakdown', 'Categories')}
                </Text>
                <Pressable onPress={() => { setBudgetDraft(String(totalBudget)); setShowBudgetModal(true); }}>
                  <Text fontSize={13} style={{ color: colors.primary }}>
                    {t('analytics.distributeBudget', 'Budget')}
                  </Text>
                </Pressable>
              </XStack>

              {/* Grid of category icons (2 rows of 4, like image 2's service grid) */}
              <XStack flexWrap="wrap" gap="$3" jc="flex-start">
                {serviceItems.map((item, idx) => (
                  <Animated.View key={item.id} entering={FadeInDown.delay(idx * 60)} style={{ width: (screenWidth - 80) / 4, alignItems: 'center' }}>
                    <Pressable onPress={() => { setEditingCategoryId(item.id); setCategoryDraft(String(categories.find(c => c.id === item.id)?.amount ?? 0)); }}>
                      <View
                        w={52} h={52} br={16} ai="center" jc="center" mb="$1"
                        style={{ backgroundColor: colors.serviceIconBg }}
                      >
                        <Text fontSize={24}>{item.icon}</Text>
                      </View>
                      <Text fontSize={10} fontWeight="500" style={{ color: colors.textSecondary }} textAlign="center" numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </XStack>

              {/* Detailed category breakdown */}
              <YStack gap="$2" mt="$4">
                {categories.map((cat, idx) => {
                  const percentage = totalCategoryAmount > 0 ? ((cat.amount / totalCategoryAmount) * 100).toFixed(1) : '0.0';
                  const displayName = isUzbek ? cat.nameUz : cat.name;
                  const isEditing = editingCategoryId === cat.id;

                  return (
                    <Pressable key={cat.id} onPress={() => { if (!isEditing) { setEditingCategoryId(cat.id); setCategoryDraft(String(cat.amount)); } }}>
                      <XStack p="$3" br={14} ai="center" jc="space-between"
                        style={{
                          backgroundColor: isEditing ? colors.primaryLight : colors.chipBg,
                          borderWidth: isEditing ? 1 : 0,
                          borderColor: colors.primary,
                        }}
                      >
                        <XStack ai="center" gap="$2" f={1}>
                          <Text fontSize={16}>{cat.icon}</Text>
                          <View w={10} h={10} br={5} style={{ backgroundColor: cat.color }} />
                          <Text fontSize={13} style={{ color: colors.text }} numberOfLines={1} f={1}>
                            {displayName}
                          </Text>
                        </XStack>

                        {isEditing ? (
                          <XStack ai="center" gap="$2">
                            <TextInput
                              style={{
                                fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'right',
                                minWidth: 70, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                                backgroundColor: colors.card, borderWidth: 1, borderColor: colors.divider,
                              }}
                              value={categoryDraft} onChangeText={setCategoryDraft}
                              keyboardType="numeric" selectTextOnFocus autoFocus
                            />
                            <Pressable onPress={() => saveCategoryAmount(cat.id)}>
                              <View w={28} h={28} br={8} ai="center" jc="center" style={{ backgroundColor: colors.accentLight }}>
                                <Check size={14} color={colors.accent} />
                              </View>
                            </Pressable>
                            <Pressable onPress={() => setEditingCategoryId(null)}>
                              <View w={28} h={28} br={8} ai="center" jc="center" style={{ backgroundColor: colors.redLight }}>
                                <X size={14} color={colors.red} />
                              </View>
                            </Pressable>
                          </XStack>
                        ) : (
                          <XStack ai="center" gap="$1">
                            <Text fontSize={13} fontWeight="600" style={{ color: colors.text }}>
                              {formatCurrency(cat.amount, currency)}
                            </Text>
                            <Text fontSize={11} style={{ color: colors.textMuted }}>
                              ({percentage}%)
                            </Text>
                          </XStack>
                        )}
                      </XStack>
                    </Pressable>
                  );
                })}

                {/* Total row */}
                <XStack p="$3" br={14} ai="center" jc="space-between"
                  style={{ backgroundColor: colors.primaryLight }}>
                  <Text fontSize={13} fontWeight="700" style={{ color: colors.text }}>
                    {t('analytics.total', 'Total')}
                  </Text>
                  <Text fontSize={15} fontWeight="700" style={{ color: colors.primary }}>
                    {formatCurrency(totalCategoryAmount, currency)}
                  </Text>
                </XStack>
              </YStack>
            </YStack>
          </Animated.View>

          {/* --- EXPORT BUTTONS --- */}
          <Animated.View entering={FadeInDown.delay(450).springify()}>
            <YStack
              style={{
                backgroundColor: colors.card, borderRadius: 20, padding: 20,
                borderWidth: 1, borderColor: colors.cardBorder,
              }}
            >
              <Text fontSize={14} fontWeight="600" mb="$3" style={{ color: colors.text }}>
                {t('analytics.export', 'Export Report')}
              </Text>
              <XStack gap="$2">
                <Pressable style={{ flex: 1 }} onPress={handleExportPDF}>
                  <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.redLight }}>
                    <FileText size={18} color={colors.red} />
                    <Text fontSize={12} fontWeight="600" mt="$1" style={{ color: colors.red }}>PDF</Text>
                  </View>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={handleExportCSV}>
                  <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.accentLight }}>
                    <Table size={18} color={colors.accent} />
                    <Text fontSize={12} fontWeight="600" mt="$1" style={{ color: colors.accent }}>Excel</Text>
                  </View>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={handleShareText}>
                  <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.blueLight }}>
                    <Share2 size={18} color={colors.blue} />
                    <Text fontSize={12} fontWeight="600" mt="$1" style={{ color: colors.blue }}>{t('analytics.share', 'Share')}</Text>
                  </View>
                </Pressable>
              </XStack>
            </YStack>
          </Animated.View>

          {/* --- TOP PARTICIPANTS --- */}
          <Animated.View entering={FadeInDown.delay(500).springify()}>
            <YStack
              style={{
                backgroundColor: colors.card, borderRadius: 20, padding: 20,
                borderWidth: 1, borderColor: colors.cardBorder,
              }}
            >
              <Text fontSize={16} fontWeight="700" mb="$3" style={{ color: colors.text }}>
                {t('analytics.topParticipants', 'Top Participants')}
              </Text>
              {data.topParticipants.map((participant: { uniqueId: string; sessions: number }, index: number) => (
                <XStack key={participant.uniqueId} p="$3" br={14} ai="center" jc="space-between" mb="$2"
                  style={{ backgroundColor: colors.chipBg }}>
                  <XStack ai="center" gap="$2">
                    <View w={32} h={32} br={16} ai="center" jc="center"
                      style={{ backgroundColor: index === 0 ? colors.orangeLight : index === 1 ? colors.chipBg : colors.primaryLight }}>
                      <Text fontSize={14}>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</Text>
                    </View>
                    <Text fontSize={14} style={{ color: colors.text }}>{participant.uniqueId}</Text>
                  </XStack>
                  <View px="$2" py="$1" br={8} style={{ backgroundColor: colors.accentLight }}>
                    <Text fontSize={12} fontWeight="600" style={{ color: colors.accent }}>
                      {participant.sessions} {t('analytics.sessions', 'sessions')}
                    </Text>
                  </View>
                </XStack>
              ))}
            </YStack>
          </Animated.View>

        </YStack>
      </ScrollView>

      {/* Edit Field Modal */}
      <Modal visible={editingField !== null} transparent animationType="fade" onRequestClose={() => setEditingField(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setEditingField(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: colors.modalBg, padding: 24, borderRadius: 20, width: 320 }}>
              <Text fontSize={18} fontWeight="700" style={{ color: colors.text }} mb="$3" textAlign="center">
                {editingField === 'totalSpent' ? t('analytics.editTotal', 'Edit Total Spent') : t('analytics.editSessions', 'Edit Sessions')}
              </Text>
              <TextInput
                style={{
                  fontSize: 24, fontWeight: '700', color: colors.primary, textAlign: 'center',
                  padding: 16, borderRadius: 12, backgroundColor: colors.chipBg,
                  borderWidth: 1, borderColor: colors.divider, marginBottom: 16,
                }}
                value={editDraft} onChangeText={setEditDraft}
                keyboardType="numeric" selectTextOnFocus autoFocus
              />
              <XStack gap="$3">
                <Pressable style={{ flex: 1 }} onPress={() => setEditingField(null)}>
                  <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.chipBg }}>
                    <Text fontSize={15} fontWeight="600" style={{ color: colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                  </View>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={() => editingField && handleSaveField(editingField)}>
                  <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.primary }}>
                    <Text fontSize={15} fontWeight="600" style={{ color: '#FFFFFF' }}>{t('common.save', 'Save')}</Text>
                  </View>
                </Pressable>
              </XStack>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Budget Modal */}
      <Modal visible={showBudgetModal} transparent animationType="fade" onRequestClose={() => setShowBudgetModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowBudgetModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: colors.modalBg, padding: 24, borderRadius: 20, width: 320 }}>
              <Text fontSize={18} fontWeight="700" style={{ color: colors.text }} mb="$2" textAlign="center">
                {t('analytics.setBudget', 'Set Budget')}
              </Text>
              <Text fontSize={13} style={{ color: colors.textSecondary }} mb="$4" textAlign="center">
                {t('analytics.budgetHint', 'Distribute across categories')}
              </Text>
              <TextInput
                style={{
                  fontSize: 24, fontWeight: '700', color: colors.primary, textAlign: 'center',
                  padding: 16, borderRadius: 12, backgroundColor: colors.chipBg,
                  borderWidth: 1, borderColor: colors.divider, marginBottom: 16,
                }}
                value={budgetDraft} onChangeText={setBudgetDraft}
                keyboardType="numeric" selectTextOnFocus
              />
              <XStack gap="$3">
                <Pressable style={{ flex: 1 }} onPress={() => setShowBudgetModal(false)}>
                  <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.chipBg }}>
                    <Text fontSize={15} fontWeight="600" style={{ color: colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                  </View>
                </Pressable>
                <Pressable style={{ flex: 1 }} onPress={handleDistributeBudget}>
                  <View py="$3" br={12} ai="center" style={{ backgroundColor: colors.primary }}>
                    <Text fontSize={15} fontWeight="600" style={{ color: '#FFFFFF' }}>{t('analytics.distribute', 'Distribute')}</Text>
                  </View>
                </Pressable>
              </XStack>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
