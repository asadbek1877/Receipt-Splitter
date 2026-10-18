// app/tabs/analytics/index.tsx — spending over time, by category, and what is owed.
// Fed by the same bill history the scanner writes to (refreshed on focus), plus debts.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bus,
  ChevronRight,
  Coffee,
  Receipt,
  ShoppingBag,
  ShoppingBasket,
  UtensilsCrossed,
  Wallet,
} from '@tamagui/lucide-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Line, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { useAppStore } from '@/shared/lib/stores/app-store';
import { refreshSplitterStoreFromBackend } from '@/features/receipt/api/receipts.api';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type { SessionHistoryEntry } from '@/features/sessions/api/history.api';
import { useSplitterStore } from '@/shared/store/useSplitterStore';
import { CATEGORIES, detectCategory, type CategoryType } from '@/shared/lib/utils/category-ai';
import { Glass, GlassScreen, PressScale, useGlassPalette, type GlassPalette } from '@/shared/ui/glass/GlassKit';
import { TAB_BAR_SPACE } from '@/shared/ui/glass/GlassTabBar';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Period = 'week' | 'month' | 'year' | 'all';
const PERIODS: Period[] = ['week', 'month', 'year', 'all'];

// ---------------------------------------------------------------------------
// Colour. Validated with the dataviz palette checker (lightness band, chroma,
// CVD + normal-vision separation, contrast) against each mode's surface.
// Categories keep a FIXED colour per category; the rest fold into grey "Other".
// ---------------------------------------------------------------------------
const SERIES = {
  light: { share: '#16A34A', paid: '#2563EB' },
  dark: { share: '#A855F7', paid: '#0F9F8F' },
};
const TRACKED: CategoryType[] = ['food', 'drinks', 'groceries', 'transport', 'shopping'];
const CATEGORY_COLORS: Record<'light' | 'dark', Record<string, string>> = {
  light: { food: '#7C3AED', drinks: '#DB2777', groceries: '#2563EB', transport: '#D97706', shopping: '#0D9488', other: '#64748B' },
  dark: { food: '#8B5CF6', drinks: '#EC4899', groceries: '#3B82F6', transport: '#D97706', shopping: '#0D9488', other: '#94A3B8' },
};
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  food: UtensilsCrossed,
  drinks: Coffee,
  groceries: ShoppingBasket,
  transport: Bus,
  shopping: ShoppingBag,
  other: Receipt,
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const billDate = (b: SessionHistoryEntry) => new Date(b.finalizedAt || b.createdAt || 0);
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function money(value: number, currency: string, locale: string) {
  const rounded = Math.round(value);
  try {
    return `${rounded.toLocaleString(locale, { maximumFractionDigits: 0 })} ${currency}`;
  } catch {
    return `${rounded} ${currency}`;
  }
}

function compact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return `${Math.round(value)}`;
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = target;
    };
  }, [target]);
  return value;
}

/** Bucket boundaries + labels for a period. */
function buildBuckets(period: Period, locale: string, firstDate: Date | null) {
  const now = new Date();
  const buckets: { start: Date; end: Date; label: string }[] = [];
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => {
    try {
      return d.toLocaleDateString(locale, o);
    } catch {
      return d.toDateString();
    }
  };
  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const s = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      buckets.push({ start: s, end: new Date(s.getTime() + 86_400_000), label: fmt(s, { weekday: 'short' }) });
    }
  } else if (period === 'month') {
    for (let d = 1; d <= now.getDate(); d++) {
      const s = new Date(now.getFullYear(), now.getMonth(), d);
      buckets.push({ start: s, end: new Date(s.getTime() + 86_400_000), label: fmt(s, { day: 'numeric', month: 'short' }) });
    }
  } else if (period === 'year') {
    for (let m = 0; m <= now.getMonth(); m++) {
      const s = new Date(now.getFullYear(), m, 1);
      buckets.push({ start: s, end: new Date(now.getFullYear(), m + 1, 1), label: fmt(s, { month: 'short' }) });
    }
  } else {
    const from = firstDate ?? now;
    let y = from.getFullYear();
    let m = from.getMonth();
    const months: { y: number; m: number }[] = [];
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
      months.push({ y, m });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    for (const { y: yy, m: mm } of months.slice(-24)) {
      const s = new Date(yy, mm, 1);
      buckets.push({ start: s, end: new Date(yy, mm + 1, 1), label: fmt(s, { month: 'short', year: '2-digit' }) });
    }
  }
  if (buckets.length === 1) {
    // a single point can't draw a line — prepend an empty bucket before it
    const first = buckets[0];
    const span = first.end.getTime() - first.start.getTime();
    buckets.unshift({ start: new Date(first.start.getTime() - span), end: first.start, label: '' });
  }
  return buckets;
}

/** Same-length window right before the period (for "vs previous"). */
function previousRange(period: Period): { start: Date; end: Date } | null {
  const now = new Date();
  if (period === 'week') {
    const end = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    return { start: new Date(end.getTime() - 7 * 86_400_000), end };
  }
  if (period === 'month') return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) };
  if (period === 'year') return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear(), 0, 1) };
  return null;
}

/** Smooth path through points (monotone-ish Catmull-Rom → cubic Bézier, clamped to the plot). */
function smoothPath(pts: [number, number][], minY: number, maxY: number) {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = Math.min(maxY, Math.max(minY, p1[1] + (p2[1] - p0[1]) / 6));
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = Math.min(maxY, Math.max(minY, p2[1] - (p3[1] - p1[1]) / 6));
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// screen
// ---------------------------------------------------------------------------
export default function AnalyticsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'en';
  const { p, isDark } = useGlassPalette();
  const mode = isDark ? 'dark' : 'light';
  const appCurrency = useAppStore((s) => s.currency);
  const me = useAppStore((s) => s.user);

  const sessions = useSessionsHistoryStore((s) => s.sessions);
  const forceRefresh = useSessionsHistoryStore((s) => s.forceRefresh);
  const debts = useSplitterStore((s) => s.debts);

  const [period, setPeriod] = useState<Period>('month');
  const [catMode, setCatMode] = useState<'amount' | 'percent'>('amount');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      await Promise.all([refreshSplitterStoreFromBackend(), forceRefresh(50, true)]);
    } catch (error) {
      console.warn('[Analytics] refresh failed', error);
    }
  }, [forceRefresh]);

  // New scans land in the bill history; pull it every time Analytics is opened.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ---------- one currency at a time ----------
  const currency = useMemo(() => {
    if (sessions.some((s) => (s.currency || '') === appCurrency)) return appCurrency;
    return sessions[0]?.currency || appCurrency || 'UZS';
  }, [sessions, appCurrency]);
  const bills = useMemo(() => sessions.filter((s) => (s.currency || currency) === currency), [sessions, currency]);
  const otherCurrencyCount = sessions.length - bills.length;

  // ---------- per-bill: my share and what I paid ----------
  const perBill = useMemo(
    () =>
      bills.map((b) => {
        const total = b.grandTotal ?? 0;
        const parts = b.totals?.byParticipant ?? b.payload?.totals?.byParticipant ?? [];
        let share = 0;
        const mine = me?.uniqueId ? parts.find((x) => x.uniqueId === me.uniqueId) : undefined;
        if (mine) share = Number(mine.amountOwed || 0);
        else if (me?.uniqueId && (b.allocations ?? []).length)
          share = (b.allocations ?? []).filter((a) => a.participantId === me.uniqueId).reduce((acc, a) => acc + (a.shareAmount || 0), 0);
        else share = parts.length ? total / parts.length : total;
        const payer = b.payer ?? b.payload?.payer;
        const paidByMe = !!payer && ((me?.uniqueId && payer.uniqueId === me.uniqueId) || (me?.id != null && payer.id === me.id));
        return { bill: b, date: billDate(b), share, paid: paidByMe ? total : 0, total };
      }),
    [bills, me?.uniqueId, me?.id],
  );

  const firstDate = useMemo(() => {
    const times = perBill.map((x) => x.date.getTime()).filter((n) => !Number.isNaN(n) && n > 0);
    return times.length ? new Date(Math.min(...times)) : null;
  }, [perBill]);

  const buckets = useMemo(() => buildBuckets(period, locale, firstDate), [period, locale, firstDate]);
  const rangeStart = buckets[0]?.start ?? new Date();
  const inPeriod = useMemo(
    () => (period === 'all' ? perBill : perBill.filter((x) => x.date >= rangeStart)),
    [perBill, period, rangeStart],
  );

  const series = useMemo(() => {
    const share = buckets.map(() => 0);
    const paid = buckets.map(() => 0);
    for (const x of perBill) {
      const i = buckets.findIndex((b) => x.date >= b.start && x.date < b.end);
      if (i < 0) continue;
      share[i] += x.share;
      paid[i] += x.paid;
    }
    return { share, paid };
  }, [perBill, buckets]);

  const totals = useMemo(() => {
    const share = inPeriod.reduce((a, x) => a + x.share, 0);
    const paid = inPeriod.reduce((a, x) => a + x.paid, 0);
    const prev = previousRange(period);
    let shareDelta: number | undefined;
    let paidDelta: number | undefined;
    if (prev) {
      const before = perBill.filter((x) => x.date >= prev.start && x.date < prev.end);
      const ps = before.reduce((a, x) => a + x.share, 0);
      const pp = before.reduce((a, x) => a + x.paid, 0);
      shareDelta = ps > 0 ? ((share - ps) / ps) * 100 : share > 0 ? 100 : 0;
      paidDelta = pp > 0 ? ((paid - pp) / pp) * 100 : paid > 0 ? 100 : 0;
    }
    return { share, paid, shareDelta, paidDelta, count: inPeriod.length };
  }, [inPeriod, perBill, period]);

  // ---------- my share by category ----------
  const categories = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const x of inPeriod) {
      const items = x.bill.totals?.byItem ?? [];
      const ratio = x.total > 0 ? x.share / x.total : 0;
      if (!items.length) {
        sums.other = (sums.other || 0) + x.share;
        continue;
      }
      for (const item of items) {
        const amount = Number((item as any).total ?? (item as any).totalAmount ?? 0) * ratio;
        const id = detectCategory(item.name || '').id;
        const key = TRACKED.includes(id) ? id : 'other';
        sums[key] = (sums[key] || 0) + amount;
      }
    }
    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    const rows = Object.entries(sums)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ key, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => (a.key === 'other' ? 1 : b.key === 'other' ? -1 : b.value - a.value));
    return { rows, total };
  }, [inPeriod]);

  // ---------- debts (what is owed) ----------
  const owed = useMemo(() => {
    const ds = debts.filter((d: any) => (d.currency ?? currency) === currency);
    const toMe = me?.uniqueId ? ds.filter((d: any) => d.toUserId === me.uniqueId).reduce((a: number, d: any) => a + Number(d.amount || 0), 0) : 0;
    const fromMe = me?.uniqueId ? ds.filter((d: any) => d.fromUserId === me.uniqueId).reduce((a: number, d: any) => a + Number(d.amount || 0), 0) : 0;
    return { toMe, fromMe, net: toMe - fromMe };
  }, [debts, currency, me?.uniqueId]);

  const recent = useMemo(() => [...inPeriod].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 4), [inPeriod]);

  const shareAnim = useCountUp(totals.share);
  const paidAnim = useCountUp(totals.paid);
  const netAnim = useCountUp(owed.net);

  const colors = SERIES[mode];
  const catColors = CATEGORY_COLORS[mode];
  const catName = (key: string) => {
    const info = CATEGORIES[key as CategoryType] ?? CATEGORIES.other;
    return locale.startsWith('uz') ? info.nameUz : info.name;
  };
  const periodLabel: Record<Period, string> = {
    week: t('analytics.periods.week', 'Week'),
    month: t('analytics.periods.month', 'Month'),
    year: t('analytics.periods.year', 'Year'),
    all: t('analytics.periods.all', 'All'),
  };

  const chartWidth = Math.min(width, 520) - 36 - 32;

  return (
    <GlassScreen p={p}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + TAB_BAR_SPACE + 16, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accentGradient[1]} colors={[p.accentGradient[1]]} />}
      >
        {/* ---------- title ---------- */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.titleRow}>
          <View style={[styles.titleIcon, { borderColor: p.cardBorder }]}>
            <Glass p={p} fill={p.card} radius={16} />
            <BarChart3 size={22} color={p.accentGradient[1]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: p.text }]}>{t('analytics.title', 'Analytics')}</Text>
            <Text style={[styles.subtitle, { color: p.muted }]}>{t('analytics.subtitle2', 'Your spending, what you paid and what is owed')}</Text>
          </View>
        </Animated.View>

        {/* ---------- period ---------- */}
        <Animated.View entering={FadeInDown.duration(420).delay(40)}>
          <Segmented p={p} options={PERIODS} labels={periodLabel} value={period} onChange={setPeriod} />
        </Animated.View>

        {otherCurrencyCount > 0 && (
          <Text style={[styles.note, { color: p.muted }]}>
            {t('analytics.otherCurrenciesExcluded', { currency, defaultValue: `Totals are in ${currency}.` })}
          </Text>
        )}

        {/* ---------- chart ---------- */}
        <Animated.View entering={FadeInDown.duration(450).delay(80)} style={[styles.card, { borderColor: p.cardBorder }]}>
          <Glass p={p} fill={p.card} radius={24} />
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: p.text }]}>{t('analytics.chartTitle', 'Your share vs you paid')}</Text>
          </View>
          <View style={styles.legend}>
            <LegendDot color={colors.share} label={t('analytics.yourShare', 'Your share')} p={p} />
            <LegendDot color={colors.paid} label={t('analytics.youPaid', 'You paid')} p={p} />
          </View>
          <AreaChart
            key={`${period}-${mode}`}
            p={p}
            width={chartWidth}
            height={190}
            labels={buckets.map((b) => b.label)}
            series={[
              { key: 'share', name: t('analytics.yourShare', 'Your share'), color: colors.share, values: series.share },
              { key: 'paid', name: t('analytics.youPaid', 'You paid'), color: colors.paid, values: series.paid },
            ]}
            format={(v) => money(v, currency, locale)}
          />
        </Animated.View>

        {/* ---------- totals ---------- */}
        <Animated.View entering={FadeInDown.duration(450).delay(130)} style={styles.tiles}>
          <StatTile
            p={p}
            color={colors.share}
            icon={ArrowDownRight}
            label={t('analytics.yourShare', 'Your share')}
            value={money(shareAnim, currency, locale)}
            delta={totals.shareDelta}
            vsLabel={t('analytics.vsPrevious', 'vs previous')}
            invertGood
          />
          <StatTile
            p={p}
            color={colors.paid}
            icon={ArrowUpRight}
            label={t('analytics.youPaid', 'You paid')}
            value={money(paidAnim, currency, locale)}
            delta={totals.paidDelta}
            vsLabel={t('analytics.vsPrevious', 'vs previous')}
          />
        </Animated.View>

        {/* ---------- categories ---------- */}
        <Animated.View entering={FadeInDown.duration(450).delay(180)} style={[styles.card, { borderColor: p.cardBorder }]}>
          <Glass p={p} fill={p.card} radius={24} />
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: p.text }]}>{t('analytics.categoryBreakdown', 'Spending by category')}</Text>
          </View>
          <View style={{ marginBottom: 12 }}>
            <Segmented
              p={p}
              compact
              options={['amount', 'percent'] as const}
              labels={{ amount: t('analytics.amount', 'Amount'), percent: t('analytics.percentage', 'Percentage') }}
              value={catMode}
              onChange={setCatMode}
            />
          </View>
          {categories.rows.length === 0 ? (
            <Text style={[styles.empty, { color: p.muted }]}>{t('analytics.noTransactions', 'No transactions in this period.')}</Text>
          ) : (
            categories.rows.map((row, i) => (
              <CategoryBar
                key={`${period}-${row.key}`}
                p={p}
                color={catColors[row.key] ?? catColors.other}
                name={catName(row.key)}
                value={catMode === 'amount' ? money(row.value, currency, locale) : `${row.pct.toFixed(0)}%`}
                pct={row.pct}
                trailing={catMode === 'amount' ? `${row.pct.toFixed(0)}%` : compact(row.value)}
                delay={i * 70}
              />
            ))
          )}
        </Animated.View>

        {/* ---------- recent ---------- */}
        <Animated.View entering={FadeInDown.duration(450).delay(220)} style={[styles.card, { borderColor: p.cardBorder }]}>
          <Glass p={p} fill={p.card} radius={24} />
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: p.text }]}>{t('analytics.recent', 'Recent bills')}</Text>
            <PressScale onPress={() => router.push('/tabs/sessions/history')} style={styles.seeAll}>
              <Text style={[styles.seeAllText, { color: p.accent }]}>{t('home.recent.showMore', 'See all')}</Text>
              <ChevronRight size={16} color={p.accent} />
            </PressScale>
          </View>
          {recent.length === 0 ? (
            <Text style={[styles.empty, { color: p.muted }]}>{t('analytics.noTransactions', 'No transactions in this period.')}</Text>
          ) : (
            recent.map((x, i) => {
              const first = x.bill.totals?.byItem?.[0]?.name ?? '';
              const id = detectCategory(first).id;
              const key = TRACKED.includes(id) ? id : 'other';
              const Icon = CATEGORY_ICONS[key];
              const color = catColors[key];
              let date = '';
              try {
                date = x.date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
              } catch {
                date = x.date.toDateString();
              }
              const people = x.bill.participants?.length ?? 0;
              return (
                <View key={x.bill.sessionId}>
                  {i > 0 && <View style={[styles.divider, { backgroundColor: p.divider }]} />}
                  <PressScale
                    onPress={() => router.push({ pathname: '/tabs/sessions/history/[historyId]', params: { historyId: String(x.bill.sessionId) } })}
                    style={styles.row}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: `${color}22` }]}>
                      <Icon size={20} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
                        {x.bill.sessionName || t('home.recent.fallbackName', 'Bill')}
                      </Text>
                      <Text style={[styles.rowSub, { color: p.muted }]} numberOfLines={1}>
                        {date} · {catName(key)}
                        {people ? ` · ${t('home.recent.participants', { count: people })}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.rowAmount, { color: p.text }]}>−{money(x.share, currency, locale)}</Text>
                    <ChevronRight size={18} color={p.chevron} />
                  </PressScale>
                </View>
              );
            })
          )}
        </Animated.View>

        {/* ---------- net (what is owed) ---------- */}
        <Animated.View entering={FadeInDown.duration(450).delay(260)}>
          <PressScale onPress={() => router.push('/tabs/debts')} style={styles.netWrap}>
            <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.net}>
              <LinearGradient
                colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.7, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.netIcon}>
                <Wallet size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.netLabel}>{t('home.balance.title', 'Net balance')}</Text>
                <Text style={styles.netValue} numberOfLines={1} adjustsFontSizeToFit>
                  {netAnim < 0 ? '−' : ''}
                  {money(Math.abs(netAnim), currency, locale)}
                </Text>
                <Text style={styles.netSub} numberOfLines={1}>
                  {t('home.balance.owedToYou', 'Owed to you')} {compact(owed.toMe)} · {t('home.balance.youOwe', 'You owe')} {compact(owed.fromMe)}
                </Text>
              </View>
              <View style={styles.netArrow}>
                <ArrowRight size={20} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </PressScale>
        </Animated.View>
      </ScrollView>
    </GlassScreen>
  );
}

// ---------------------------------------------------------------------------
// components
// ---------------------------------------------------------------------------
function Segmented<T extends string>({
  p,
  options,
  labels,
  value,
  onChange,
  compact: small,
}: {
  p: GlassPalette;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  const [w, setW] = useState(0);
  const idx = options.indexOf(value);
  const x = useSharedValue(idx);
  useEffect(() => {
    x.value = withSpring(idx, { damping: 18, stiffness: 220 });
  }, [idx]);
  const slot = w > 0 ? (w - 8) / options.length : 0;
  const pill = useAnimatedStyle(() => ({ width: slot, transform: [{ translateX: 4 + x.value * slot }] }));
  const height = small ? 40 : 52;
  return (
    <View
      style={[styles.segment, { height, borderRadius: height / 2, borderColor: p.cardBorder }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      <Glass p={p} fill={p.card} radius={height / 2} />
      {slot > 0 && (
        <Animated.View style={[styles.segmentPill, { borderRadius: (height - 8) / 2 }, pill]}>
          <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      {options.map((o) => (
        <PressScale key={o} onPress={() => onChange(o)} style={[styles.segmentItem, { height }]}>
          <Text style={[styles.segmentText, { color: o === value ? '#FFFFFF' : p.sub, fontSize: small ? 13 : 15 }]}>{labels[o]}</Text>
        </PressScale>
      ))}
    </View>
  );
}

function LegendDot({ p, color, label }: { p: GlassPalette; color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: p.sub }]}>{label}</Text>
    </View>
  );
}

type Series = { key: string; name: string; color: string; values: number[] };

/**
 * Two-series area chart on ONE axis (both are money). Lines draw in, areas fade
 * in; touch-and-drag shows a crosshair with both values (dataviz: hover layer).
 */
function AreaChart({
  p,
  width,
  height,
  labels,
  series,
  format,
}: {
  p: GlassPalette;
  width: number;
  height: number;
  labels: string[];
  series: Series[];
  format: (v: number) => string;
}) {
  const axisW = 40;
  const plotW = Math.max(10, width - axisW);
  const top = 10;
  const bottom = height - 22;
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = (() => {
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / pow) * pow;
  })();
  const xAt = (i: number) => axisW + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => bottom - (v / niceMax) * (bottom - top);

  const paths = series.map((s) => {
    const pts = s.values.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
    const line = smoothPath(pts, top, bottom);
    const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${bottom} L${pts[0][0]},${bottom} Z` : '';
    return { ...s, line, area };
  });

  const draw = useSharedValue(0);
  useEffect(() => {
    draw.value = 0;
    draw.value = withDelay(150, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, []);
  const lineLen = plotW * 3;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: lineLen * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: draw.value }));

  const [active, setActive] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pick = (x: number) => {
    if (n === 0) return;
    const rel = Math.min(plotW, Math.max(0, x - axisW));
    setActive(Math.round(n <= 1 ? 0 : (rel / plotW) * (n - 1)));
  };
  const release = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(null), 1800);
  };
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const gridValues = [niceMax, niceMax / 2, 0];
  const labelEvery = Math.max(1, Math.ceil(n / 5));
  const tipX = active != null ? xAt(active) : 0;
  const tipLeft = Math.min(width - 150, Math.max(0, tipX - 75));
  const summary = series.map((s) => `${s.name}: ${format(s.values.reduce((a, b) => a + b, 0))}`).join(', ');

  return (
    <View
      style={{ width, height }}
      accessible
      accessibilityLabel={summary}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
      onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      onResponderRelease={release}
      onResponderTerminate={release}
    >
      <Svg width={width} height={height}>
        <Defs>
          {paths.map((s) => (
            <SvgLinearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </SvgLinearGradient>
          ))}
        </Defs>
        {gridValues.map((v) => (
          <Line key={v} x1={axisW} x2={width} y1={yAt(v)} y2={yAt(v)} stroke={p.divider} strokeWidth={1} strokeDasharray={v === 0 ? undefined : '3 5'} />
        ))}
        {paths.map((s) => (
          <AnimatedPath key={`a-${s.key}`} d={s.area} fill={`url(#area-${s.key})`} animatedProps={areaProps} />
        ))}
        {paths.map((s) => (
          <AnimatedPath
            key={`l-${s.key}`}
            d={s.line}
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={lineLen}
            animatedProps={lineProps}
          />
        ))}
        {active != null && <Line x1={tipX} x2={tipX} y1={top} y2={bottom} stroke={p.muted} strokeWidth={1} strokeDasharray="3 4" />}
      </Svg>

      {/* y-axis labels */}
      {gridValues.map((v) => (
        <Text key={`y-${v}`} style={[styles.axis, { color: p.muted, top: yAt(v) - 8, left: 0 }]}>
          {compact(v)}
        </Text>
      ))}
      {/* x-axis labels */}
      {labels.map((l, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <Text key={`x-${i}`} numberOfLines={1} style={[styles.axis, styles.axisX, { color: p.muted, left: xAt(i) - 24, top: bottom + 6 }]}>
            {l}
          </Text>
        ) : null,
      )}

      {/* crosshair markers + tooltip */}
      {active != null &&
        paths.map((s) => (
          <View
            key={`m-${s.key}`}
            pointerEvents="none"
            style={[styles.marker, { borderColor: s.color, left: tipX - 6, top: yAt(s.values[active] ?? 0) - 6, backgroundColor: p.bg }]}
          />
        ))}
      {active != null && (
        <View pointerEvents="none" style={[styles.tooltip, { left: tipLeft, borderColor: p.cardBorder, backgroundColor: p.glassOpaque }]}>
          <Text style={[styles.tooltipTitle, { color: p.text }]}>{labels[active]}</Text>
          {paths.map((s) => (
            <View key={`t-${s.key}`} style={styles.tooltipRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.tooltipText, { color: p.sub }]} numberOfLines={1}>
                {format(s.values[active] ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StatTile({
  p,
  color,
  icon: Icon,
  label,
  value,
  delta,
  vsLabel,
  invertGood,
}: {
  p: GlassPalette;
  color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
  delta?: number;
  vsLabel: string;
  /** spending going up is not "good" */
  invertGood?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  const good = invertGood ? !up : up;
  const deltaColor = good ? '#22C55E' : '#F43F5E';
  return (
    <View style={[styles.tile, { borderColor: p.cardBorder }]}>
      <Glass p={p} fill={p.card} radius={22} />
      <LinearGradient colors={[`${color}2E`, `${color}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.tileIcon, { backgroundColor: `${color}26` }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={[styles.tileLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.tileValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {delta !== undefined && (
        <View style={styles.tileDelta}>
          {up ? <ArrowUpRight size={14} color={deltaColor} /> : <ArrowDownRight size={14} color={deltaColor} />}
          <Text style={[styles.tileDeltaText, { color: deltaColor }]}>{Math.abs(delta).toFixed(1)}%</Text>
          <Text style={[styles.tileVs, { color: p.muted }]} numberOfLines={1}> {vsLabel}</Text>
        </View>
      )}
    </View>
  );
}

function CategoryBar({
  p,
  color,
  name,
  value,
  pct,
  trailing,
  delay,
}: {
  p: GlassPalette;
  color: string;
  name: string;
  value: string;
  pct: number;
  trailing: string;
  delay: number;
}) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(200 + delay, withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }));
  }, []);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  return (
    <View style={styles.catRow} accessible accessibilityLabel={`${name}: ${value}`}>
      <View style={styles.catHead}>
        <View style={[styles.legendDot, { backgroundColor: color, width: 10, height: 10, borderRadius: 3 }]} />
        <Text style={[styles.catName, { color: p.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.catValue, { color: p.text }]}>{value}</Text>
        <Text style={[styles.catPct, { color: p.muted }]}>{trailing}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: p.divider }]}>
        <Animated.View style={[styles.fill, { width: `${Math.max(2, pct)}%`, backgroundColor: color, transformOrigin: 'left' }, fill]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  titleIcon: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 2 },
  note: { fontSize: 12, marginTop: 10, marginLeft: 4 },
  segment: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, overflow: 'hidden' },
  segmentPill: { position: 'absolute', left: 0, top: 4, bottom: 4, overflow: 'hidden' },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontWeight: '600' },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, marginTop: 16, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 13, fontWeight: '500' },
  axis: { position: 'absolute', fontSize: 11 },
  axisX: { width: 48, textAlign: 'center' },
  marker: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2.5 },
  tooltip: { position: 'absolute', top: 0, width: 150, borderRadius: 12, borderWidth: 1, padding: 8, gap: 3 },
  tooltipTitle: { fontSize: 12, fontWeight: '700' },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipText: { fontSize: 12, flexShrink: 1 },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tile: { flex: 1, borderRadius: 22, borderWidth: 1, padding: 14, overflow: 'hidden' },
  tileIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 14, marginTop: 12 },
  tileValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  tileDelta: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  tileDeltaText: { fontSize: 13, fontWeight: '700', marginLeft: 2 },
  tileVs: { fontSize: 12, flexShrink: 1 },
  empty: { fontSize: 14, paddingVertical: 14 },
  catRow: { marginBottom: 14 },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  catName: { flex: 1, fontSize: 15, fontWeight: '500' },
  catValue: { fontSize: 14, fontWeight: '600' },
  catPct: { fontSize: 12, width: 42, textAlign: 'right' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginLeft: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700' },
  netWrap: { borderRadius: 24, overflow: 'hidden', marginTop: 16 },
  net: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  netIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  netLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  netValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 2 },
  netSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 3 },
  netArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
});
