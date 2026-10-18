// app/tabs/sessions/history/index.tsx — all finalized bills, grouped by month
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Crown, Receipt, Users2 } from '@tamagui/lucide-icons';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type { SessionHistoryEntry, SessionHistoryParticipantLight } from '@/features/sessions/api/history.api';
import {
  AvatarCircle,
  Glass,
  GlassScreen,
  PressScale,
  useGlassPalette,
  type GlassPalette,
} from '@/shared/ui/glass/GlassKit';
import { TAB_BAR_SPACE } from '@/shared/ui/glass/GlassTabBar';

const HISTORY_LIMIT = 50;
const DEFAULT_CURRENCY = 'UZS';

type Filter = 'all' | 'mine';

const billDate = (b: SessionHistoryEntry) => new Date(b.finalizedAt || b.createdAt || 0);

function money(value: number, currency: string, locale: string) {
  const rounded = Math.round(value);
  try {
    return `${rounded.toLocaleString(locale, { maximumFractionDigits: 0 })} ${currency}`;
  } catch {
    return `${rounded} ${currency}`;
  }
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

export default function SessionsHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'en';
  const { p, isDark } = useGlassPalette();

  const sessions = useSessionsHistoryStore((s) => s.sessions);
  const loading = useSessionsHistoryStore((s) => s.loading);
  const initialized = useSessionsHistoryStore((s) => s.initialized);
  const currentLimit = useSessionsHistoryStore((s) => s.limit);
  const error = useSessionsHistoryStore((s) => s.error);
  const fetchHistory = useSessionsHistoryStore((s) => s.fetchHistory);
  const refreshIfStale = useSessionsHistoryStore((s) => s.refreshIfStale);

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (loading) return;
    if (!initialized || (currentLimit ?? 0) < HISTORY_LIMIT) fetchHistory(HISTORY_LIMIT).catch(() => {});
    else refreshIfStale(15_000, HISTORY_LIMIT).catch(() => {});
  }, [initialized, loading, currentLimit, fetchHistory, refreshIfStale]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchHistory(HISTORY_LIMIT);
    } finally {
      setRefreshing(false);
    }
  }, [fetchHistory]);

  const currency = sessions[0]?.currency || DEFAULT_CURRENCY;
  const visible = useMemo(() => (filter === 'mine' ? sessions.filter((s) => s.isCreator) : sessions), [sessions, filter]);

  const summary = useMemo(() => {
    const same = visible.filter((s) => (s.currency || currency) === currency);
    const total = same.reduce((acc, s) => acc + (s.grandTotal ?? 0), 0);
    return { total, count: visible.length, avg: same.length ? total / same.length : 0 };
  }, [visible, currency]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: SessionHistoryEntry[] }>();
    for (const bill of visible) {
      const d = billDate(bill);
      const key = Number.isNaN(d.getTime()) ? 'unknown' : `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) {
        let label = '—';
        try {
          label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        } catch {
          label = d.toDateString();
        }
        map.set(key, { label, items: [] });
      }
      map.get(key)!.items.push(bill);
    }
    return Array.from(map.values());
  }, [visible, locale]);

  const totalAnimated = useCountUp(summary.total);
  const avgAnimated = useCountUp(summary.avg);

  let rowIndex = 0;

  return (
    <GlassScreen p={p}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + TAB_BAR_SPACE + 16, paddingHorizontal: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accentGradient[1]} colors={[p.accentGradient[1]]} />
        }
      >
        {/* ---------- title ---------- */}
        <Animated.View entering={FadeIn.duration(400)}>
          <Text style={[styles.eyebrow, { color: p.label }]}>{t('historyScreen.eyebrow', 'YOUR BILLS').toUpperCase()}</Text>
          <Text style={[styles.title, { color: p.text }]}>{t('home.nav.history', 'History')}</Text>
          <Text style={[styles.subtitle, { color: p.muted }]}>{t('historyScreen.subtitle', 'Every bill you have split, in one place')}</Text>
        </Animated.View>

        {/* ---------- summary ---------- */}
        <Animated.View entering={FadeInDown.duration(450).delay(60)} style={[styles.summary, { borderColor: p.cardBorder }]}>
          <Glass p={p} fill={p.card} radius={24} />
          <LinearGradient
            colors={[`${p.accentGradient[0]}33`, `${p.accentGradient[1]}12`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Text style={[styles.summaryLabel, { color: p.sub }]}>{t('historyScreen.total', 'Total split')}</Text>
          <Text style={[styles.summaryValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {money(totalAnimated, currency, locale)}
          </Text>
          <View style={styles.summaryRow}>
            <SummaryPill p={p} label={t('home.month.bills', 'Bills')} value={String(summary.count)} />
            <SummaryPill p={p} label={t('historyScreen.average', 'Average')} value={money(avgAnimated, currency, locale)} />
          </View>
        </Animated.View>

        {/* ---------- filter ---------- */}
        <Animated.View entering={FadeInDown.duration(450).delay(110)} style={styles.filters}>
          <Chip p={p} label={t('historyScreen.all', 'All')} active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip p={p} label={t('historyScreen.mine', 'Created by me')} active={filter === 'mine'} onPress={() => setFilter('mine')} />
        </Animated.View>

        {/* ---------- states ---------- */}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!visible.length && (
          <Animated.View entering={FadeIn.duration(300)} style={[styles.empty, { borderColor: p.cardBorder }]}>
            <Glass p={p} fill={p.card} radius={20} />
            <Receipt size={34} color={p.muted} />
            <Text style={[styles.emptyText, { color: p.muted }]}>
              {loading ? t('home.recent.loading', 'Loading...') : t('historyScreen.empty', 'No bills yet')}
            </Text>
          </Animated.View>
        )}

        {/* ---------- grouped list ---------- */}
        {groups.map((group) => (
          <Animated.View key={group.label} layout={LinearTransition.duration(220)}>
            <Text style={[styles.section, { color: p.label }]}>{group.label.toUpperCase()}</Text>
            <View style={[styles.card, { borderColor: p.cardBorder }]}>
              <Glass p={p} fill={p.card} radius={20} />
              {group.items.map((bill, i) => {
                const delay = Math.min(rowIndex++, 8) * 45;
                return (
                  <Animated.View key={bill.sessionId} entering={FadeInDown.duration(380).delay(160 + delay)}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: p.divider }]} />}
                    <BillRow
                      p={p}
                      isDark={isDark}
                      bill={bill}
                      locale={locale}
                      fallbackCurrency={currency}
                      t={t}
                      onPress={() =>
                        router.push({ pathname: '/tabs/sessions/history/[historyId]', params: { historyId: String(bill.sessionId) } })
                      }
                    />
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </GlassScreen>
  );
}

// ---------------------------------------------------------------------------
function SummaryPill({ p, label, value }: { p: GlassPalette; label: string; value: string }) {
  return (
    <View style={[styles.pill, { borderColor: p.cardBorder }]}>
      <Text style={[styles.pillLabel, { color: p.muted }]}>{label}</Text>
      <Text style={[styles.pillValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Chip({ p, label, active, onPress }: { p: GlassPalette; label: string; active: boolean; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} style={[styles.chip, { borderColor: p.cardBorder }]}>
      {active ? (
        <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : (
        <Glass p={p} fill={p.card} radius={20} />
      )}
      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : p.text }]}>{label}</Text>
    </PressScale>
  );
}

function Avatars({ p, people }: { p: GlassPalette; people: SessionHistoryParticipantLight[] }) {
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <View style={styles.avatars}>
      {shown.map((person, i) => (
        <View key={person.uniqueId ?? i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <AvatarCircle
            p={p}
            uri={person.avatarUrl ?? null}
            initials={(person.username || '?').slice(0, 1).toUpperCase()}
            size={24}
            fontSize={10}
          />
        </View>
      ))}
      {extra > 0 && <Text style={[styles.extra, { color: p.muted }]}>+{extra}</Text>}
    </View>
  );
}

function BillRow({
  p,
  isDark,
  bill,
  locale,
  fallbackCurrency,
  t,
  onPress,
}: {
  p: GlassPalette;
  isDark: boolean;
  bill: SessionHistoryEntry;
  locale: string;
  fallbackCurrency: string;
  t: (key: string, opts?: any) => string;
  onPress: () => void;
}) {
  const d = billDate(bill);
  let date = '';
  try {
    date = d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  } catch {
    date = d.toDateString();
  }
  const people = bill.participants ?? [];
  const payer = bill.payer?.username || bill.payload?.payer?.username;
  const finalized = (bill.payload?.status ?? 'finalized') === 'finalized';
  const tile = isDark ? { bg: 'rgba(79,139,255,0.18)', fg: '#60A5FA' } : { bg: '#E8F8EF', fg: '#16A34A' };

  return (
    <PressScale onPress={onPress} style={styles.row}>
      <View style={[styles.tile, { backgroundColor: tile.bg }]}>
        <Receipt size={22} color={tile.fg} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
          {bill.sessionName || t('home.recent.fallbackName', 'Bill')}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.rowSub, { color: p.muted }]} numberOfLines={1}>
            {date}
            {payer ? ` · ${payer}` : ''}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {people.length ? <Avatars p={p} people={people} /> : <Users2 size={14} color={p.muted} />}
          {bill.isCreator && (
            <View style={[styles.badge, { backgroundColor: `${p.accentGradient[1]}22` }]}>
              <Crown size={11} color={p.accentGradient[1]} />
              <Text style={[styles.badgeText, { color: p.accentGradient[1] }]}>{t('historyScreen.yours', 'Yours')}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.amount, { color: p.text }]} numberOfLines={1}>
          {money(bill.grandTotal ?? 0, bill.currency || fallbackCurrency, locale)}
        </Text>
        <View style={[styles.status, { backgroundColor: finalized ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)' }]}>
          <Text style={[styles.statusText, { color: finalized ? '#22C55E' : '#F59E0B' }]}>
            {finalized ? t('historyScreen.finalized', 'Settled') : t('historyScreen.inProgress', 'In progress')}
          </Text>
        </View>
      </View>
      <ChevronRight size={18} color={p.chevron} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 3.5 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  subtitle: { fontSize: 15, marginTop: 4 },
  summary: { borderRadius: 24, borderWidth: 1, padding: 20, marginTop: 20, overflow: 'hidden' },
  summaryLabel: { fontSize: 15, fontWeight: '500' },
  summaryValue: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pill: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  pillLabel: { fontSize: 12 },
  pillValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  filters: { flexDirection: 'row', gap: 10, marginTop: 16 },
  chip: { height: 40, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipText: { fontSize: 14, fontWeight: '600' },
  error: { color: '#EF4444', fontSize: 14, marginTop: 16 },
  empty: { marginTop: 18, borderRadius: 20, borderWidth: 1, paddingVertical: 36, alignItems: 'center', gap: 10, overflow: 'hidden' },
  emptyText: { fontSize: 15 },
  section: { fontSize: 12, fontWeight: '600', letterSpacing: 3, marginTop: 22, marginBottom: 10, marginLeft: 6 },
  card: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, overflow: 'hidden' },
  divider: { height: 1, marginLeft: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  tile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowSub: { fontSize: 13, flexShrink: 1 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  extra: { fontSize: 11, marginLeft: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  rowRight: { alignItems: 'flex-end', gap: 6, maxWidth: '38%' },
  amount: { fontSize: 15, fontWeight: '700' },
  status: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
});
