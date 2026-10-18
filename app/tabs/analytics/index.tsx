// app/tabs/analytics/index.tsx — spending over time, by category, and what is owed.
// Fed by the same bill history the scanner writes to (+ debts), refreshed when stale.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bus,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Coffee,
  Receipt,
  ScanLine,
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
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useAppStore } from '@/shared/lib/stores/app-store';
import { refreshSplitterStoreFromBackend } from '@/features/receipt/api/receipts.api';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type { SessionHistoryEntry } from '@/features/sessions/api/history.api';
import { useSplitterStore } from '@/shared/store/useSplitterStore';
import { CATEGORIES, detectCategory, type CategoryType } from '@/shared/lib/utils/category-ai';
import { Glass, GlassScreen, PressScale, useAmbientActive, useGlassPalette, type GlassPalette } from '@/shared/ui/glass/GlassKit';
import { TAB_BAR_SPACE } from '@/shared/ui/glass/GlassTabBar';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Period = 'day' | 'week' | 'month' | 'all';
const PERIODS: Period[] = ['day', 'week', 'month', 'all'];

// ---------------------------------------------------------------------------
// Colour — validated with the dataviz palette checker (lightness band, chroma,
// CVD + normal-vision separation, contrast) against each mode's surface.
// Categories keep a FIXED colour; anything else folds into grey "Other".
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
const STALE_MS = 20_000;

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
  if (abs >= 1e9) return `${+(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${+(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${+(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
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

const fmtDate = (d: Date, locale: string, o: Intl.DateTimeFormatOptions) => {
  try {
    return d.toLocaleDateString(locale, o);
  } catch {
    return d.toDateString();
  }
};

/** Bucket boundaries + axis labels for a period. */
function buildBuckets(period: Period, locale: string, firstDate: Date | null) {
  const now = new Date();
  const buckets: { start: Date; end: Date; label: string }[] = [];
  if (period === 'day') {
    const base = dayStart(now);
    for (let h = 0; h < 24; h += 2) {
      const s = new Date(base.getTime() + h * 3_600_000);
      buckets.push({ start: s, end: new Date(s.getTime() + 2 * 3_600_000), label: `${String(h).padStart(2, '0')}:00` });
    }
  } else if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const s = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      buckets.push({ start: s, end: new Date(s.getTime() + 86_400_000), label: fmtDate(s, locale, { weekday: 'short' }) });
    }
  } else if (period === 'month') {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const s = new Date(now.getFullYear(), now.getMonth(), d);
      buckets.push({ start: s, end: new Date(s.getTime() + 86_400_000), label: fmtDate(s, locale, { day: 'numeric', month: 'short' }) });
    }
  } else {
    const from = firstDate ?? new Date(now.getFullYear(), now.getMonth() - 5, 1);
    let y = from.getFullYear();
    let m = from.getMonth();
    const months: { y: number; m: number }[] = [];
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
      months.push({ y, m });
      if (++m > 11) {
        m = 0;
        y++;
      }
    }
    const shown = months.slice(-12);
    while (shown.length < 6) {
      const f = shown[0];
      shown.unshift(f.m === 0 ? { y: f.y - 1, m: 11 } : { y: f.y, m: f.m - 1 });
    }
    for (const { y: yy, m: mm } of shown) {
      const s = new Date(yy, mm, 1);
      buckets.push({ start: s, end: new Date(yy, mm + 1, 1), label: fmtDate(s, locale, { month: 'short' }) });
    }
  }
  return buckets;
}

/** Same-length window right before the period (for "vs previous"). */
function previousRange(period: Period): { start: Date; end: Date } | null {
  const now = new Date();
  if (period === 'day') {
    const end = dayStart(now);
    return { start: new Date(end.getTime() - 86_400_000), end };
  }
  if (period === 'week') {
    const end = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    return { start: new Date(end.getTime() - 7 * 86_400_000), end };
  }
  if (period === 'month') return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) };
  return null;
}

/** Smooth path through points (Catmull-Rom → cubic Bézier, clamped to the plot). */
function smoothPath(pts: [number, number][], minY: number, maxY: number) {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1y = Math.min(maxY, Math.max(minY, p1[1] + (p2[1] - p0[1]) / 6));
    const c2y = Math.min(maxY, Math.max(minY, p2[1] - (p3[1] - p1[1]) / 6));
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c1y} ${p2[0] - (p3[0] - p1[0]) / 6},${c2y} ${p2[0]},${p2[1]}`;
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
  const refreshIfStale = useSessionsHistoryStore((s) => s.refreshIfStale);
  const forceRefresh = useSessionsHistoryStore((s) => s.forceRefresh);
  const debts = useSplitterStore((s) => s.debts);

  const [period, setPeriod] = useState<Period>('month');
  const [catMode, setCatMode] = useState<'amount' | 'percent'>('amount');
  const [refreshing, setRefreshing] = useState(false);
  const lastDebtSync = useRef(0);

  // New scans land in the bill history. Pull it when Analytics is opened — but
  // only if stale, and only after the tab switch has painted (no jank on entry).
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        refreshIfStale(STALE_MS, 50).catch(() => {});
        if (Date.now() - lastDebtSync.current > STALE_MS) {
          lastDebtSync.current = Date.now();
          refreshSplitterStoreFromBackend().catch(() => {});
        }
      }, 450);
      return () => clearTimeout(timer);
    }, [refreshIfStale]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    lastDebtSync.current = Date.now();
    await Promise.all([forceRefresh(50, true), refreshSplitterStoreFromBackend()]).catch(() => {});
    setRefreshing(false);
  }, [forceRefresh]);

  // ---------- one currency at a time ----------
  const currency = useMemo(() => {
    if (sessions.some((s) => (s.currency || '') === appCurrency)) return appCurrency;
    return sessions[0]?.currency || appCurrency || 'UZS';
  }, [sessions, appCurrency]);
  const bills = useMemo(() => sessions.filter((s) => (s.currency || currency) === currency), [sessions, currency]);

  // ---------- per bill: my share and what I paid ----------
  const perBill = useMemo(
    () =>
      bills.map((b) => {
        const total = b.grandTotal ?? 0;
        const parts = b.totals?.byParticipant ?? b.payload?.totals?.byParticipant ?? [];
        let share: number;
        const mine = me?.uniqueId ? parts.find((x) => x.uniqueId === me.uniqueId) : undefined;
        if (mine) share = Number(mine.amountOwed || 0);
        else if (me?.uniqueId && (b.allocations ?? []).length)
          share = (b.allocations ?? []).filter((a) => a.participantId === me.uniqueId).reduce((acc, a) => acc + (a.shareAmount || 0), 0);
        else share = parts.length ? total / parts.length : total;
        const payer = b.payer ?? b.payload?.payer;
        const paidByMe = !!payer && ((!!me?.uniqueId && payer.uniqueId === me.uniqueId) || (me?.id != null && payer.id === me.id));
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
  const inPeriod = useMemo(() => perBill.filter((x) => x.date >= rangeStart), [perBill, rangeStart]);

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
    return { share, paid, shareDelta, paidDelta };
  }, [inPeriod, perBill, period]);

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
    return Object.entries(sums)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ key, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => (a.key === 'other' ? 1 : b.key === 'other' ? -1 : b.value - a.value));
  }, [inPeriod]);

  const owed = useMemo(() => {
    const ds = debts.filter((d: any) => (d.currency ?? currency) === currency);
    const sum = (pred: (d: any) => boolean) => ds.filter(pred).reduce((a: number, d: any) => a + Number(d.amount || 0), 0);
    const toMe = me?.uniqueId ? sum((d) => d.toUserId === me.uniqueId) : 0;
    const fromMe = me?.uniqueId ? sum((d) => d.fromUserId === me.uniqueId) : 0;
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
    day: t('analytics.periods.day', 'Day'),
    week: t('analytics.periods.week', 'Week'),
    month: t('analytics.periods.month', 'Month'),
    all: t('analytics.periods.all', 'All'),
  };
  const rangeLabel =
    period === 'day'
      ? t('analytics.range.today', 'Today')
      : period === 'week'
        ? t('analytics.range.week', 'This week')
        : period === 'month'
          ? fmtDate(new Date(), locale, { month: 'long', year: 'numeric' })
          : t('analytics.range.all', 'All time');
  const cyclePeriod = () => setPeriod(PERIODS[(PERIODS.indexOf(period) + 1) % PERIODS.length]);

  const contentWidth = Math.min(width, 520) - 36;
  const chartWidth = contentWidth - 32;
  const deltaLabel = period === 'day' ? t('analytics.vsYesterday', 'vs yesterday') : t('analytics.vsLast', 'vs last period');

  return (
    <GlassScreen p={p} ambient="calm">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + TAB_BAR_SPACE + 16, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accentGradient[1]} colors={[p.accentGradient[1]]} />}
      >
        {/* ---------- header ---------- */}
        <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
          <PressScale onPress={() => router.navigate('/tabs')} style={[styles.back, { borderColor: p.cardBorder }]}>
            <Glass p={p} fill={p.card} radius={22} />
            <ArrowLeft size={20} color={p.text} />
          </PressScale>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <BarsMark p={p} />
              <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>{t('analytics.title', 'Analytics')}</Text>
            </View>
            <Text style={[styles.subtitle, { color: p.muted }]} numberOfLines={1}>
              {t('analytics.subtitle3', 'Track your spending and debts')}
            </Text>
          </View>
          <PressScale onPress={cyclePeriod} style={[styles.rangeChip, { borderColor: p.cardBorder }]}>
            <Glass p={p} fill={p.card} radius={18} />
            <CalendarDays size={16} color={p.text} />
            <Text style={[styles.rangeText, { color: p.text }]} numberOfLines={1}>{rangeLabel}</Text>
            <ChevronDown size={14} color={p.sub} />
          </PressScale>
        </Animated.View>

        {/* ---------- period ---------- */}
        <Animated.View entering={FadeInDown.duration(380).delay(40)}>
          <Segmented p={p} options={PERIODS} labels={periodLabel} value={period} onChange={setPeriod} />
        </Animated.View>

        {/* ---------- chart ---------- */}
        <Animated.View entering={FadeInDown.duration(420).delay(80)} style={[styles.card, styles.chartCard, { borderColor: p.cardBorder }]}>
          <Glass p={p} fill={p.card} radius={24} />
          <LinearGradient
            colors={[`${colors.share}1F`, `${colors.share}00`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.8 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: p.text }]} numberOfLines={1}>{t('analytics.chartTitle2', 'Share vs Paid')}</Text>
            <View style={styles.legend}>
              <LegendDot p={p} color={colors.share} label={t('analytics.yourShare', 'Your share')} />
              <LegendDot p={p} color={colors.paid} label={t('analytics.youPaid', 'You paid')} />
            </View>
          </View>
          <AreaChart
            key={`${period}-${mode}-${buckets.length}`}
            p={p}
            width={chartWidth}
            height={210}
            labels={buckets.map((b) => b.label)}
            series={[
              { key: 'share', name: t('analytics.yourShare', 'Your share'), color: colors.share, values: series.share },
              { key: 'paid', name: t('analytics.youPaid', 'You paid'), color: colors.paid, values: series.paid },
            ]}
            format={(v) => money(v, currency, locale)}
            emptyText={t('analytics.emptyChart', 'No bills in this period yet')}
            onScan={() => router.navigate('/tabs/scan-receipt')}
            scanLabel={t('home.scan.receipt', 'Scan Receipt')}
          />
        </Animated.View>

        {/* ---------- totals ---------- */}
        <Animated.View entering={FadeInDown.duration(420).delay(120)} style={styles.tiles}>
          <StatTile
            p={p}
            color={isDark ? '#EC4899' : '#DB2777'}
            icon={ArrowDownRight}
            label={t('analytics.yourShare', 'Your share')}
            value={money(shareAnim, currency, locale)}
            delta={totals.shareDelta}
            vsLabel={deltaLabel}
            invertGood
          />
          <StatTile
            p={p}
            color={isDark ? '#3B82F6' : '#2563EB'}
            icon={ArrowUpRight}
            label={t('analytics.youPaid', 'You paid')}
            value={money(paidAnim, currency, locale)}
            delta={totals.paidDelta}
            vsLabel={deltaLabel}
          />
        </Animated.View>

        {/* ---------- categories ---------- */}
        <Animated.View entering={FadeInDown.duration(420).delay(160)} style={[styles.card, { borderColor: p.cardBorder }]}>
          <Glass p={p} fill={p.card} radius={24} />
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: p.text, flex: 1 }]} numberOfLines={1}>
              {t('analytics.byCategory', 'By category')}
            </Text>
            <View style={{ width: 196 }}>
              <Segmented
                p={p}
                small
                options={['amount', 'percent'] as const}
                labels={{ amount: t('analytics.amount', 'Amount'), percent: t('analytics.percentage', 'Percentage') }}
                value={catMode}
                onChange={setCatMode}
              />
            </View>
          </View>
          {categories.length === 0 ? (
            <Text style={[styles.empty, { color: p.muted }]}>{t('analytics.noTransactions', 'No transactions in this period.')}</Text>
          ) : (
            categories.map((row, i) => (
              <CategoryRow
                key={`${period}-${row.key}`}
                p={p}
                color={catColors[row.key] ?? catColors.other}
                name={catName(row.key)}
                value={catMode === 'amount' ? compact(row.value) : `${row.pct.toFixed(0)}%`}
                pct={row.pct}
                trailing={catMode === 'amount' ? `${row.pct.toFixed(0)}%` : compact(row.value)}
                delay={i * 70}
              />
            ))
          )}
        </Animated.View>

        {/* ---------- recent ---------- */}
        <Animated.View entering={FadeInDown.duration(420).delay(200)} style={[styles.card, { borderColor: p.cardBorder }]}>
          <Glass p={p} fill={p.card} radius={24} />
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: p.text }]}>{t('analytics.recent', 'Recent bills')}</Text>
            <PressScale onPress={() => router.navigate('/tabs/sessions/history')} style={styles.seeAll}>
              <Text style={[styles.seeAllText, { color: p.accent }]}>{t('home.recent.showMore', 'See all')}</Text>
              <ChevronRight size={16} color={p.accent} />
            </PressScale>
          </View>
          {recent.length === 0 ? (
            <Text style={[styles.empty, { color: p.muted }]}>{t('analytics.noTransactions', 'No transactions in this period.')}</Text>
          ) : (
            recent.map((x, i) => {
              const id = detectCategory(x.bill.totals?.byItem?.[0]?.name ?? x.bill.sessionName ?? '').id;
              const key = TRACKED.includes(id) ? id : 'other';
              const Icon = CATEGORY_ICONS[key];
              const color = catColors[key];
              const people = x.bill.participants?.length ?? 0;
              return (
                <View key={x.bill.sessionId}>
                  {i > 0 && <View style={[styles.divider, { backgroundColor: p.divider }]} />}
                  <PressScale
                    onPress={() => router.push({ pathname: '/tabs/sessions/history/[historyId]', params: { historyId: String(x.bill.sessionId) } })}
                    style={styles.row}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: `${color}26` }]}>
                      <Icon size={20} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
                        {x.bill.sessionName || t('home.recent.fallbackName', 'Bill')}
                      </Text>
                      <Text style={[styles.rowSub, { color: p.muted }]} numberOfLines={1}>
                        {fmtDate(x.date, locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                        {people ? `  •  ${t('home.recent.participants', { count: people })}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.rowAmount, { color: p.text }]}>−{compact(x.share)}</Text>
                    <ChevronRight size={18} color={p.chevron} />
                  </PressScale>
                </View>
              );
            })
          )}
        </Animated.View>

        {/* ---------- net balance ---------- */}
        <Animated.View entering={FadeInDown.duration(420).delay(240)}>
          <PressScale onPress={() => router.navigate('/tabs/debts')} style={styles.netWrap}>
            <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.net}>
              <NetWave width={contentWidth} />
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
                  ↓ {compact(owed.toMe)} {t('analytics.toYou', 'to you')}   ↑ {compact(owed.fromMe)} {t('analytics.byYou', 'by you')}
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
function BarsMark({ p }: { p: GlassPalette }) {
  return (
    <Svg width={26} height={24} viewBox="0 0 26 24">
      <Defs>
        <SvgLinearGradient id="bars" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor={p.accentGradient[0]} />
          <Stop offset="100%" stopColor={p.accentGradient[1]} />
        </SvgLinearGradient>
      </Defs>
      <Rect x={1} y={13} width={6} height={10} rx={3} fill="url(#bars)" />
      <Rect x={10} y={6} width={6} height={17} rx={3} fill="url(#bars)" />
      <Rect x={19} y={1} width={6} height={22} rx={3} fill="url(#bars)" />
    </Svg>
  );
}

/** Segmented control with a sliding gradient pill (UI-thread spring). */
function Segmented<T extends string>({
  p,
  options,
  labels,
  value,
  onChange,
  small,
}: {
  p: GlassPalette;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.indexOf(value));
  const x = useSharedValue(idx);
  useEffect(() => {
    x.value = withSpring(idx, { damping: 18, stiffness: 240 });
  }, [idx]);
  const height = small ? 38 : 54;
  const pad = 4;
  const slot = w > 0 ? (w - pad * 2) / options.length : 0;
  const pill = useAnimatedStyle(() => ({ width: slot, transform: [{ translateX: pad + x.value * slot }] }));
  return (
    <View
      style={[styles.segment, { height, borderRadius: height / 2, borderColor: p.cardBorder }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      <Glass p={p} fill={p.card} radius={height / 2} />
      {slot > 0 && (
        <Animated.View style={[styles.segmentPill, { top: pad, bottom: pad, borderRadius: (height - pad * 2) / 2 }, pill]}>
          <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onChange(o)}
          style={styles.segmentItem}
          accessibilityRole="tab"
          accessibilityState={{ selected: o === value }}
        >
          <Text style={[styles.segmentText, { color: o === value ? '#FFFFFF' : p.sub, fontSize: small ? 13 : 16 }]} numberOfLines={1}>
            {labels[o]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function LegendDot({ p, color, label }: { p: GlassPalette; color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: p.sub }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

type Series = { key: string; name: string; color: string; values: number[] };

/**
 * Two money series on ONE axis. Lines (with a soft glow) draw in, areas fade in.
 * The peak is pinned with a tooltip; touch-and-drag moves the crosshair.
 */
function AreaChart({
  p,
  width,
  height,
  labels,
  series,
  format,
  emptyText,
  onScan,
  scanLabel,
}: {
  p: GlassPalette;
  width: number;
  height: number;
  labels: string[];
  series: Series[];
  format: (v: number) => string;
  emptyText: string;
  onScan: () => void;
  scanLabel: string;
}) {
  const ambient = useAmbientActive();
  const axisW = 42;
  const plotW = Math.max(10, width - axisW - 6);
  const top = 46;
  const bottom = height - 24;
  const n = labels.length;
  const rawMax = Math.max(0, ...series.flatMap((s) => s.values));
  const empty = rawMax <= 0;
  const niceMax = (() => {
    if (empty) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const steps = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
    return (steps.find((s) => s * pow >= rawMax) ?? 10) * pow;
  })();
  const xAt = (i: number) => axisW + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => bottom - (v / niceMax) * (bottom - top);

  const paths = series.map((s) => {
    const pts = s.values.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
    const line = smoothPath(pts, top, bottom);
    const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${bottom} L${pts[0][0]},${bottom} Z` : '';
    return { ...s, line, area };
  });

  // pinned point: the highest value of the first series (like a "peak" callout)
  const peak = useMemo(() => {
    if (empty) return null;
    const vals = series[0].values;
    let best = 0;
    vals.forEach((v, i) => {
      if (v > vals[best]) best = i;
    });
    return vals[best] > 0 ? best : null;
  }, [series, empty]);

  const draw = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    draw.value = withDelay(120, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, []);
  useEffect(() => {
    if (!ambient) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [ambient]);
  const lineLen = plotW * 3;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: lineLen * (1 - draw.value) }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: draw.value }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 1.4 }] }));

  const [touch, setTouch] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pick = (x: number) => {
    if (n === 0 || empty) return;
    const rel = Math.min(plotW, Math.max(0, x - axisW));
    setTouch(Math.round(n <= 1 ? 0 : (rel / plotW) * (n - 1)));
  };
  const release = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTouch(null), 2000);
  };
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const active = touch ?? peak;
  const gridValues = [niceMax, (niceMax * 2) / 3, niceMax / 3, 0];
  // ~5 evenly spaced x labels; never two labels that would collide
  const labelIdx = useMemo(() => {
    if (n <= 1) return [0];
    const count = Math.min(5, n);
    const set = new Set<number>();
    for (let k = 0; k < count; k++) set.add(Math.round((k * (n - 1)) / (count - 1)));
    return Array.from(set);
  }, [n]);
  const tipX = active != null ? xAt(active) : 0;
  const tipW = 132;
  const tipLeft = Math.min(width - tipW, Math.max(0, tipX - tipW / 2));
  const primaryY = active != null ? yAt(series[0].values[active] ?? 0) : 0;

  return (
    <View
      style={{ width, height }}
      accessible
      accessibilityLabel={series.map((s) => `${s.name}: ${format(s.values.reduce((a, b) => a + b, 0))}`).join(', ')}
      onStartShouldSetResponder={() => !empty}
      onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
      onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      onResponderRelease={release}
      onResponderTerminate={release}
    >
      <Svg width={width} height={height}>
        <Defs>
          {paths.map((s) => (
            <SvgLinearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={s.color} stopOpacity={0.42} />
              <Stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </SvgLinearGradient>
          ))}
        </Defs>
        {gridValues.map((v, i) => (
          <Line key={i} x1={axisW} x2={width} y1={yAt(v)} y2={yAt(v)} stroke={p.divider} strokeWidth={1} strokeDasharray={v === 0 ? undefined : '2 6'} />
        ))}
        <Line x1={axisW} x2={axisW} y1={top} y2={bottom} stroke={p.divider} strokeWidth={1} />
        {!empty &&
          paths.map((s) => <AnimatedPath key={`a-${s.key}`} d={s.area} fill={`url(#area-${s.key})`} animatedProps={areaProps} />)}
        {!empty &&
          paths.map((s) => (
            <AnimatedPath
              key={`g-${s.key}`}
              d={s.line}
              stroke={s.color}
              strokeOpacity={0.25}
              strokeWidth={9}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={lineLen}
              animatedProps={lineProps}
            />
          ))}
        {!empty &&
          paths.map((s) => (
            <AnimatedPath
              key={`l-${s.key}`}
              d={s.line}
              stroke={s.color}
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={lineLen}
              animatedProps={lineProps}
            />
          ))}
        {active != null && <Line x1={tipX} x2={tipX} y1={top} y2={bottom} stroke={p.muted} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 4" />}
        {active != null &&
          paths.slice(1).map((s) => (
            <Circle key={`d-${s.key}`} cx={tipX} cy={yAt(s.values[active] ?? 0)} r={4.5} fill={s.color} stroke={p.glassOpaque} strokeWidth={2} />
          ))}
      </Svg>

      {/* y axis */}
      {gridValues.map((v, i) => (
        <Text key={`y-${i}`} style={[styles.axis, { color: p.muted, top: yAt(v) - 8, left: 0, width: axisW - 6, textAlign: 'right' }]}>
          {empty && v !== 0 ? '' : compact(v)}
        </Text>
      ))}
      {/* x axis */}
      {labelIdx.map((i) => (
        <Text
          key={`x-${i}`}
          numberOfLines={1}
          style={[styles.axis, styles.axisX, { color: p.muted, left: Math.min(width - 54, Math.max(axisW - 20, xAt(i) - 27)), top: bottom + 7 }]}
        >
          {labels[i]}
        </Text>
      ))}

      {/* pinned / touched point */}
      {active != null && (
        <>
          <Animated.View pointerEvents="none" style={[styles.ring, { left: tipX - 9, top: primaryY - 9, borderColor: series[0].color }, ringStyle]} />
          <View pointerEvents="none" style={[styles.point, { left: tipX - 8, top: primaryY - 8, borderColor: series[0].color, backgroundColor: '#FFFFFF' }]} />
          <View pointerEvents="none" style={[styles.tooltip, { left: tipLeft, width: tipW, borderColor: p.cardBorder, backgroundColor: p.glassOpaque }]}>
            <Text style={[styles.tooltipValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {format(series[0].values[active] ?? 0)}
            </Text>
            <Text style={[styles.tooltipSub, { color: p.muted }]} numberOfLines={1}>
              {labels[active]}
              {series[1] ? ` · ${compact(series[1].values[active] ?? 0)} ${series[1].name.toLowerCase()}` : ''}
            </Text>
          </View>
        </>
      )}

      {empty && (
        <View pointerEvents="box-none" style={[styles.emptyOverlay, { top, height: bottom - top }]}>
          <Text style={[styles.emptyChart, { color: p.muted }]}>{emptyText}</Text>
          <Pressable onPress={onScan} style={[styles.emptyCta, { borderColor: p.cardBorder }]}>
            <ScanLine size={16} color={p.accentGradient[1]} />
            <Text style={[styles.emptyCtaText, { color: p.accentGradient[1] }]}>{scanLabel}</Text>
          </Pressable>
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
  const deltaColor = delta === 0 ? p.muted : good ? '#22C55E' : '#F43F5E';
  return (
    <View style={[styles.tile, { borderColor: p.cardBorder }]}>
      <Glass p={p} fill={p.card} radius={22} />
      <LinearGradient colors={[`${color}33`, `${color}05`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.tileIcon, { backgroundColor: `${color}2E`, borderColor: `${color}55` }]}>
        <Icon size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tileLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.tileValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {delta !== undefined && (
          <View style={styles.tileDelta}>
            {up ? <ArrowUpRight size={13} color={deltaColor} /> : <ArrowDownRight size={13} color={deltaColor} />}
            <Text style={[styles.tileDeltaText, { color: deltaColor }]}>{Math.abs(delta).toFixed(1)}%</Text>
            <Text style={[styles.tileVs, { color: p.muted }]} numberOfLines={1}> {vsLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function CategoryRow({
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
    grow.value = withDelay(180 + delay, withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }));
  }, []);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  return (
    <View style={styles.catRow} accessible accessibilityLabel={`${name}: ${value}, ${trailing}`}>
      <View style={[styles.catDot, { backgroundColor: color }]} />
      <Text style={[styles.catName, { color: p.text }]} numberOfLines={1}>{name}</Text>
      <Text style={[styles.catValue, { color: p.sub }]} numberOfLines={1}>{value}</Text>
      <View style={[styles.track, { backgroundColor: p.divider }]}>
        <Animated.View style={[styles.fill, { width: `${Math.max(3, pct)}%`, backgroundColor: color, transformOrigin: 'left' }, fill]} />
      </View>
      <Text style={[styles.catPct, { color: p.muted }]} numberOfLines={1}>{trailing}</Text>
    </View>
  );
}

/** Decorative glowing wave on the net-balance card. */
function NetWave({ width }: { width: number }) {
  return (
    <Svg pointerEvents="none" width={width} height={96} style={StyleSheet.absoluteFill}>
      <Path
        d={`M${width * 0.35},92 C${width * 0.55},88 ${width * 0.6},40 ${width * 0.75},34 S${width * 0.9},6 ${width},2`}
        stroke="#FFFFFF"
        strokeOpacity={0.35}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d={`M${width * 0.35},92 C${width * 0.55},88 ${width * 0.6},40 ${width * 0.75},34 S${width * 0.9},6 ${width},2 L${width},96 L${width * 0.35},96 Z`}
        fill="#FFFFFF"
        fillOpacity={0.08}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  subtitle: { fontSize: 13, marginTop: 2 },
  rangeChip: {
    height: 40,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    maxWidth: 150,
  },
  rangeText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  segment: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  segmentPill: { position: 'absolute', left: 0, overflow: 'hidden' },
  segmentItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontWeight: '600' },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, marginTop: 16, overflow: 'hidden' },
  chartCard: { paddingBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  cardTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, fontWeight: '500' },
  axis: { position: 'absolute', fontSize: 11 },
  axisX: { width: 54, textAlign: 'center' },
  ring: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  point: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 4 },
  tooltip: { position: 'absolute', top: 0, borderRadius: 12, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  tooltipValue: { fontSize: 14, fontWeight: '700' },
  tooltipSub: { fontSize: 11, marginTop: 1 },
  emptyOverlay: { position: 'absolute', left: 42, right: 0, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyChart: { fontSize: 14, fontWeight: '500' },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  emptyCtaText: { fontSize: 13, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tile: { flex: 1, borderRadius: 22, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  tileIcon: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 13 },
  tileValue: { fontSize: 19, fontWeight: '800', marginTop: 3 },
  tileDelta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  tileDeltaText: { fontSize: 12, fontWeight: '700', marginLeft: 2 },
  tileVs: { fontSize: 11, flexShrink: 1 },
  empty: { fontSize: 14, paddingVertical: 14 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  catDot: { width: 14, height: 14, borderRadius: 4 },
  catName: { width: 92, fontSize: 14, fontWeight: '500' },
  catValue: { width: 58, fontSize: 13, textAlign: 'right' },
  track: { flex: 1, height: 9, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 9, borderRadius: 5 },
  catPct: { width: 40, fontSize: 12, textAlign: 'right' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginLeft: 58 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 3 },
  rowAmount: { fontSize: 15, fontWeight: '700' },
  netWrap: { borderRadius: 24, overflow: 'hidden', marginTop: 16 },
  net: { borderRadius: 24, padding: 18, minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  netIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  netLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  netValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 2 },
  netSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 3 },
  netArrow: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
});
