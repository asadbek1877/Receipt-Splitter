// app/tabs/index.tsx — Home: balance, quick actions, this month, recent activity
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Home as HomeIcon,
  Moon,
  Plus,
  Receipt,
  ScanLine,
  Settings,
  Sun,
  User as UserIcon,
  UserPlus,
  Users2,
  Wallet,
  Zap,
} from '@tamagui/lucide-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { SessionHistoryEntry } from '@/features/sessions/api/history.api';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import { useDebtsStore } from '@/features/debts/model/debts.store';
import { useFriendsStore } from '@/features/friends/model/friends.store';
import { useAppStore } from '@/shared/lib/stores/app-store';
import {
  AvatarCircle,
  Glass,
  GlassScreen,
  PressScale,
  useAmbientActive,
  useGlassPalette,
  type GlassPalette,
  type Tile,
} from '@/shared/ui/glass/GlassKit';

const HOME_HISTORY_LIMIT = 30;
const DEFAULT_CURRENCY = 'UZS';
const AnimatedPath = Animated.createAnimatedComponent(Path);

type P = GlassPalette;

const TILES: Record<'light' | 'dark', Record<string, Tile>> = {
  light: {
    quick: { bg: '#FEF3E2', fg: '#F59E0B' },
    groups: { bg: '#E0F2FE', fg: '#0EA5E9' },
    debts: { bg: '#E8F8EF', fg: '#16A34A' },
    stats: { bg: '#F1ECFE', fg: '#8B5CF6' },
    receipt: { bg: '#FDECEC', fg: '#EF4444' },
    up: { bg: '#E8F8EF', fg: '#16A34A' },
    down: { bg: '#FDECEC', fg: '#EF4444' },
  },
  dark: {
    quick: { bg: 'rgba(245,158,11,0.16)', fg: '#FBBF24' },
    groups: { bg: 'rgba(79,139,255,0.18)', fg: '#60A5FA' },
    debts: { bg: 'rgba(56,189,248,0.16)', fg: '#38BDF8' },
    stats: { bg: 'rgba(139,92,246,0.20)', fg: '#A78BFA' },
    receipt: { bg: 'rgba(239,68,68,0.18)', fg: '#F87171' },
    up: { bg: 'rgba(52,211,153,0.16)', fg: '#34D399' },
    down: { bg: 'rgba(239,68,68,0.18)', fg: '#F87171' },
  },
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const sessionDate = (s: SessionHistoryEntry) => new Date(s.finalizedAt || s.createdAt || 0);

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

function formatMoney(value: number, currency: string, locale: string) {
  const rounded = Math.round(value);
  try {
    return `${rounded.toLocaleString(locale, { maximumFractionDigits: 0 })} ${currency}`;
  } catch {
    return `${rounded} ${currency}`;
  }
}

function formatShortDate(d: Date, locale: string) {
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  } catch {
    return d.toDateString();
  }
}

/** Animates a number from its previous value to `target` (JS thread, ~0.9s). */
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
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
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

// ---------------------------------------------------------------------------
// screen
// ---------------------------------------------------------------------------
export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'en';
  const { theme, user, setTheme } = useAppStore();
  const { p, isDark } = useGlassPalette();
  const tiles = TILES[isDark ? 'dark' : 'light'];

  const sessions = useSessionsHistoryStore((s) => s.sessions);
  const loading = useSessionsHistoryStore((s) => s.loading);
  const initialized = useSessionsHistoryStore((s) => s.initialized);
  const currentLimit = useSessionsHistoryStore((s) => s.limit);
  const fetchHistory = useSessionsHistoryStore((s) => s.fetchHistory);
  const refreshIfStale = useSessionsHistoryStore((s) => s.refreshIfStale);
  const forceRefresh = useSessionsHistoryStore((s) => s.forceRefresh);
  const debts = useDebtsStore((s) => s.debts);
  const requestsCount = useFriendsStore((s) => s.requestsRaw?.incoming?.length ?? 0);

  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (loading || hasFetchedRef.current) return;
    if (!initialized || (currentLimit ?? 0) < HOME_HISTORY_LIMIT) {
      hasFetchedRef.current = true;
      fetchHistory(HOME_HISTORY_LIMIT).catch(() => {
        hasFetchedRef.current = false;
      });
    }
  }, [initialized, loading, currentLimit]);

  useFocusEffect(
    useCallback(() => {
      refreshIfStale(15_000, HOME_HISTORY_LIMIT).catch(() => {});
    }, [refreshIfStale]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await forceRefresh(HOME_HISTORY_LIMIT).catch(() => {});
    setRefreshing(false);
  }, [forceRefresh]);

  // ---------- derived numbers ----------
  const currency = sessions[0]?.currency || debts[0]?.currency || DEFAULT_CURRENCY;

  const { balance, owedToMe, iOwe } = useMemo(() => {
    let owed = 0;
    let owe = 0;
    for (const d of debts) {
      if (d.isPaid) continue;
      if (d.type === 'owed') owed += d.amount;
      else owe += d.amount;
    }
    return { balance: owed - owe, owedToMe: owed, iOwe: owe };
  }, [debts]);

  const month = useMemo(() => {
    const now = monthKey(new Date());
    const spent = Array(6).fill(0) as number[]; // oldest → current
    const bills = Array(6).fill(0) as number[];
    for (const s of sessions) {
      const k = monthKey(sessionDate(s));
      const idx = 5 - (now - k);
      if (idx < 0 || idx > 5) continue;
      bills[idx] += 1;
      if ((s.currency || currency) === currency) spent[idx] += s.grandTotal ?? 0;
    }
    const prev = spent[4];
    const change = prev > 0 ? ((spent[5] - prev) / prev) * 100 : spent[5] > 0 ? 100 : 0;
    return { spent, bills, change };
  }, [sessions, currency]);

  const recent = useMemo(() => sessions.slice(0, 3), [sessions]);

  const balanceAnimated = useCountUp(balance);
  const spentAnimated = useCountUp(month.spent[5]);

  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? t('home.greetings.night', 'Good night,')
      : hour < 12
        ? t('home.greetings.morning', 'Good morning,')
        : hour < 18
          ? t('home.greetings.afternoon', 'Good afternoon,')
          : t('home.greetings.evening', 'Good evening,');

  const displayName = user?.username || t('home.header.friendFallback', 'friend');
  const initials = displayName.slice(0, 2).toUpperCase();
  const mask = (text: string) => (hidden ? '••••••' : text);

  // ---------- navigation ----------
  const go = (path: Parameters<typeof router.push>[0]) => () => router.push(path);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <GlassScreen p={p}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accentGradient[1]} colors={[p.accentGradient[1]]} />
        }
      >
        {/* ---------- top bar ---------- */}
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <LogoMark p={p} />
            <Text style={[styles.brandText, { color: p.text }]}>Splitter</Text>
          </View>
          <View style={styles.topActions}>
            <IconButton p={p} onPress={toggleTheme} label="Theme">
              {isDark ? <Sun size={20} color={p.text} /> : <Moon size={20} color={p.text} />}
            </IconButton>
            <IconButton p={p} onPress={go('/tabs/friends/requests')} label="Notifications">
              <Bell size={20} color={p.text} />
              {requestsCount > 0 && <View style={[styles.dot, { backgroundColor: p.accentGradient[1] }]} />}
            </IconButton>
            <PressScale onPress={go('/tabs/profile')} style={undefined}>
              <AvatarCircle p={p} uri={user?.avatarUrl ?? null} initials={initials} size={44} fontSize={16} ring={isDark} />
            </PressScale>
          </View>
        </View>

        {/* ---------- greeting + hero cards ---------- */}
        <View style={styles.hero}>
          <HeroCards p={p} />
          <Animated.View entering={FadeIn.duration(500)} style={styles.greeting}>
            <Text style={[styles.greetSmall, { color: p.sub }]}>{greeting}</Text>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Wave />
            </View>
            <Text style={[styles.tagline, { color: p.muted }]}>{t('home.tagline', "Let's split smarter today!")}</Text>
          </Animated.View>
        </View>

        <View style={styles.body}>
          {/* ---------- balance ---------- */}
          <Animated.View entering={FadeInDown.duration(450).delay(80)}>
            <View style={[styles.balanceCard, { borderColor: p.cardBorder }]}>
              <Glass p={p} fill={p.card} radius={24} />
              <LinearGradient
                colors={[`${p.accentGradient[0]}33`, `${p.accentGradient[1]}14`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.balanceHead}>
                <Text style={[styles.balanceLabel, { color: p.sub }]}>{t('home.balance.title', 'Net balance')}</Text>
                <PressScale onPress={() => setHidden((h) => !h)} style={styles.eye}>
                  {hidden ? <EyeOff size={18} color={p.sub} /> : <Eye size={18} color={p.sub} />}
                </PressScale>
              </View>
              <Text style={[styles.balance, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {mask(`${balanceAnimated >= 0 ? '' : '−'}${formatMoney(Math.abs(balanceAnimated), currency, locale)}`)}
              </Text>
              <View style={styles.balanceRow}>
                <MiniStat p={p} tile={tiles.up} icon={ArrowDownRight} label={t('home.balance.owedToYou', 'Owed to you')} value={mask(formatMoney(owedToMe, currency, locale))} />
                <MiniStat p={p} tile={tiles.down} icon={ArrowUpRight} label={t('home.balance.youOwe', 'You owe')} value={mask(formatMoney(iOwe, currency, locale))} />
              </View>
            </View>
          </Animated.View>

          {/* ---------- primary actions ---------- */}
          <Animated.View entering={FadeInDown.duration(450).delay(140)} style={styles.primaryRow}>
            <View style={{ flex: 1.35 }}>
              <PressScale onPress={go('/tabs/scan-receipt')} style={styles.scanWrap}>
                <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scan}>
                  <ScanLine size={22} color="#FFFFFF" />
                  <Text style={styles.scanText} numberOfLines={1}>{t('home.scan.receipt', 'Scan Receipt')}</Text>
                  <ChevronRight size={18} color="#FFFFFF" />
                </LinearGradient>
              </PressScale>
            </View>
            <View style={{ flex: 1 }}>
              <PressScale onPress={go('/tabs/friends')} style={[styles.secondary, { borderColor: p.cardBorder }]}>
                <Glass p={p} fill={p.card} radius={18} />
                <UserPlus size={20} color={p.text} />
                <Text style={[styles.secondaryText, { color: p.text }]} numberOfLines={1}>
                  {t('home.actions.friends', 'Friends')}
                </Text>
              </PressScale>
            </View>
          </Animated.View>

          {/* ---------- quick grid ---------- */}
          <Animated.View entering={FadeInDown.duration(450).delay(200)} style={styles.grid}>
            <GridItem p={p} tile={tiles.quick} icon={Zap} label={t('quickSplit.title', 'Quick Split')} onPress={go('/tabs/quick-split')} />
            <GridItem p={p} tile={tiles.groups} icon={Users2} label={t('home.actions.groups', 'Groups')} onPress={go('/tabs/groups')} />
            <GridItem p={p} tile={tiles.debts} icon={Wallet} label={t('debts.title', 'Debts')} onPress={go('/tabs/debts')} />
            <GridItem p={p} tile={tiles.stats} icon={BarChart3} label={t('analytics.title', 'Analytics')} onPress={go('/tabs/analytics')} />
          </Animated.View>

          {/* ---------- this month ---------- */}
          <SectionHeader p={p} title={t('home.month.title', 'This month')} action={t('home.recent.showMore', 'See all')} onAction={go('/tabs/analytics')} delay={240} />
          <Animated.View entering={FadeInDown.duration(450).delay(260)} style={styles.statsRow}>
            <StatCard
              p={p}
              tile={tiles.receipt}
              icon={Receipt}
              label={t('home.month.spent', 'Spent')}
              value={mask(formatMoney(spentAnimated, currency, locale))}
              delta={month.change}
              series={month.spent}
              color={isDark ? '#F472B6' : '#EF4444'}
            />
            <StatCard
              p={p}
              tile={tiles.up}
              icon={Clock3}
              label={t('home.month.bills', 'Bills')}
              value={String(month.bills[5])}
              series={month.bills}
              color={isDark ? '#34D399' : '#16A34A'}
            />
          </Animated.View>

          {/* ---------- recent activity ---------- */}
          <SectionHeader p={p} title={t('home.recent.title', 'Recent bills')} action={t('home.recent.showMore', 'See all')} onAction={go('/tabs/sessions/history')} delay={300} />
          <Animated.View entering={FadeInDown.duration(450).delay(320)} style={[styles.list, { borderColor: p.cardBorder }]}>
            <Glass p={p} fill={p.card} radius={20} />
            {recent.length === 0 ? (
              <View style={styles.empty}>
                <Receipt size={26} color={p.muted} />
                <Text style={[styles.emptyText, { color: p.muted }]}>
                  {loading ? t('home.recent.loading', 'Loading...') : t('home.recent.empty', 'No bills yet')}
                </Text>
              </View>
            ) : (
              recent.map((bill, i) => {
                const participants = (typeof bill.participantUniqueIds === 'string'
                  ? bill.participantUniqueIds.split(',').filter((x) => x.trim())
                  : []
                ).length;
                return (
                  <View key={bill.sessionId}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: p.divider }]} />}
                    <PressScale
                      onPress={() =>
                        router.push({ pathname: '/tabs/sessions/history/[historyId]', params: { historyId: String(bill.sessionId) } })
                      }
                      style={styles.activity}
                    >
                      <View style={[styles.tile, { backgroundColor: i % 2 ? tiles.groups.bg : tiles.receipt.bg }]}>
                        <Receipt size={22} color={i % 2 ? tiles.groups.fg : tiles.receipt.fg} />
                      </View>
                      <View style={styles.activityText}>
                        <Text style={[styles.activityTitle, { color: p.text }]} numberOfLines={1}>
                          {bill.sessionName || t('home.recent.fallbackName', 'Bill')}
                        </Text>
                        <Text style={[styles.activitySub, { color: p.muted }]} numberOfLines={1}>
                          {t('home.recent.participants', { count: participants })} · {formatShortDate(sessionDate(bill), locale)}
                        </Text>
                      </View>
                      <Text style={[styles.amount, { color: p.text }]}>
                        {mask(formatMoney(bill.grandTotal ?? 0, bill.currency || currency, locale))}
                      </Text>
                      <ChevronRight size={18} color={p.chevron} />
                    </PressScale>
                  </View>
                );
              })
            )}
          </Animated.View>

          <PressScale onPress={go('/tabs/settings')} style={[styles.settingsLink]}>
            <Settings size={16} color={p.muted} />
            <Text style={[styles.settingsText, { color: p.muted }]}>{t('navigation.tabs.settings', 'Settings')}</Text>
          </PressScale>
        </View>
      </ScrollView>

      <BottomNav
        p={p}
        bottom={insets.bottom}
        labels={{
          home: t('navigation.tabs.home', 'Home'),
          history: t('home.nav.history', 'History'),
          stats: t('analytics.title', 'Analytics'),
          profile: t('profile.title', 'Profile'),
        }}
        onHistory={go('/tabs/sessions/history')}
        onScan={go('/tabs/scan-receipt')}
        onStats={go('/tabs/analytics')}
        onProfile={go('/tabs/profile')}
      />
    </GlassScreen>
  );
}

// ---------------------------------------------------------------------------
// pieces
// ---------------------------------------------------------------------------
function LogoMark({ p }: { p: P }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Defs>
        <SvgLinearGradient id="logo" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={p.accentGradient[0]} />
          <Stop offset="100%" stopColor={p.accentGradient[1]} />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M22 6.5C20.3 5 17.9 4 15 4c-5 0-8.5 2.6-8.5 6.3 0 7.6 16 4.7 16 10.4 0 2.3-2.6 4.3-7 4.3-3.1 0-5.6-1.1-7.5-3"
        stroke="url(#logo)"
        strokeWidth={4.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function IconButton({ p, onPress, label, children }: { p: P; onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <PressScale onPress={onPress} style={[styles.iconBtn, { borderColor: p.cardBorder }]}>
      <Glass p={p} fill={p.card} radius={22} />
      <View accessibilityLabel={label}>{children}</View>
    </PressScale>
  );
}

function Wave() {
  const active = useAmbientActive();
  const r = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    r.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 180 }),
        withTiming(-1, { duration: 180 }),
        withTiming(1, { duration: 180 }),
        withTiming(0, { duration: 180 }),
        withDelay(2200, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(r);
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 18}deg` }] }));
  return <Animated.Text style={[styles.wave, style]}>👋</Animated.Text>;
}

/** Floating stack of glassy cards (top-right of the hero). */
function HeroCards({ p }: { p: P }) {
  const active = useAmbientActive();
  const f = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    f.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(f);
  }, [active]);
  const back = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(f.value, [0, 1], [-4, 6]) }, { rotate: '-18deg' }],
  }));
  const front = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(f.value, [0, 1], [6, -6]) }, { rotate: '-10deg' }],
  }));
  const badge = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(f.value, [0, 1], [-3, 3]) }, { scale: interpolate(f.value, [0, 1], [0.96, 1.04]) }],
  }));

  const card = (id: string, opacity: number) => (
    <Svg width={150} height={96} viewBox="0 0 150 96">
      <Defs>
        <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={p.accentGradient[0]} stopOpacity={opacity} />
          <Stop offset="100%" stopColor={p.accentGradient[1]} stopOpacity={opacity} />
        </SvgLinearGradient>
      </Defs>
      <Rect x={1} y={1} width={148} height={94} rx={16} fill={`url(#${id})`} stroke="#FFFFFF" strokeOpacity={0.35} />
      <Rect x={16} y={18} width={24} height={18} rx={4} fill="#FFFFFF" opacity={0.55} />
      <Rect x={16} y={60} width={56} height={6} rx={3} fill="#FFFFFF" opacity={0.6} />
      <Rect x={16} y={72} width={36} height={6} rx={3} fill="#FFFFFF" opacity={0.4} />
      <Rect x={110} y={58} width={8} height={20} rx={3} fill="#FFFFFF" opacity={0.55} />
      <Rect x={122} y={50} width={8} height={28} rx={3} fill="#FFFFFF" opacity={0.75} />
    </Svg>
  );

  return (
    <View pointerEvents="none" style={styles.heroCards}>
      <Animated.View style={[{ position: 'absolute', right: 10, top: 6 }, back]}>{card('hcBack', 0.55)}</Animated.View>
      <Animated.View style={[{ position: 'absolute', right: 34, top: 40 }, front]}>{card('hcFront', 0.95)}</Animated.View>
      <Animated.View style={[{ position: 'absolute', right: 16, top: 0 }, badge]}>
        <View style={[styles.heroBadge, { borderColor: p.cardBorder }]}>
          <Glass p={p} fill={p.card} radius={12} />
          <BarChart3 size={16} color={p.accentGradient[1]} />
        </View>
      </Animated.View>
    </View>
  );
}

function MiniStat({
  p,
  tile,
  icon: Icon,
  label,
  value,
}: {
  p: P;
  tile: Tile;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.miniStat}>
      <View style={[styles.miniIcon, { backgroundColor: tile.bg }]}>
        <Icon size={14} color={tile.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.miniLabel, { color: p.muted }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.miniValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
    </View>
  );
}

function GridItem({
  p,
  tile,
  icon: Icon,
  label,
  onPress,
}: {
  p: P;
  tile: Tile;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <PressScale onPress={onPress} style={[styles.gridItem, { borderColor: p.cardBorder }]}>
        <Glass p={p} fill={p.card} radius={18} />
        <View style={[styles.gridIcon, { backgroundColor: tile.bg }]}>
          <Icon size={22} color={tile.fg} />
        </View>
        <Text style={[styles.gridLabel, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
      </PressScale>
    </View>
  );
}

function SectionHeader({
  p,
  title,
  action,
  onAction,
  delay,
}: {
  p: P;
  title: string;
  action: string;
  onAction: () => void;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400).delay(delay)} style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: p.text }]}>{title}</Text>
      <PressScale onPress={onAction} style={styles.sectionAction}>
        <Text style={[styles.sectionActionText, { color: p.accent }]}>{action}</Text>
        <ChevronRight size={16} color={p.accent} />
      </PressScale>
    </Animated.View>
  );
}

/** Sparkline that draws itself in. */
function Sparkline({ series, color, width, height }: { series: number[]; color: string; width: number; height: number }) {
  const max = Math.max(...series, 1);
  const step = width / Math.max(1, series.length - 1);
  const pts = series.map((v, i) => [i * step, height - 4 - (v / max) * (height - 8)] as const);
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const length = pts.reduce((acc, [x, y], i) => (i === 0 ? 0 : acc + Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1])), 0) + 1;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(300, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [d]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));

  return (
    <Svg width={width} height={height}>
      <AnimatedPath
        d={d}
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={length}
        animatedProps={props}
      />
    </Svg>
  );
}

function StatCard({
  p,
  tile,
  icon: Icon,
  label,
  value,
  delta,
  series,
  color,
}: {
  p: P;
  tile: Tile;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
  delta?: number;
  series: number[];
  color: string;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = (Math.min(width, 520) - 36 - 12) / 2;
  const up = (delta ?? 0) >= 0;
  return (
    <View style={[styles.statCard, { borderColor: p.cardBorder }]}>
      <Glass p={p} fill={p.card} radius={20} />
      <LinearGradient
        colors={[`${color}22`, `${color}00`]}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: tile.bg }]}>
          <Icon size={18} color={tile.fg} />
        </View>
        <Text style={[styles.statLabel, { color: p.sub }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <View style={styles.statBottom}>
        {delta !== undefined ? (
          <View style={styles.delta}>
            {up ? <ArrowUpRight size={14} color={color} /> : <ArrowDownRight size={14} color={color} />}
            <Text style={[styles.deltaText, { color }]}>{Math.abs(delta).toFixed(1)}%</Text>
          </View>
        ) : (
          <View />
        )}
        <Sparkline series={series} color={color} width={Math.max(60, cardWidth * 0.45)} height={34} />
      </View>
    </View>
  );
}

function BottomNav({
  p,
  bottom,
  labels,
  onHistory,
  onScan,
  onStats,
  onProfile,
}: {
  p: P;
  bottom: number;
  labels: { home: string; history: string; stats: string; profile: string };
  onHistory: () => void;
  onScan: () => void;
  onStats: () => void;
  onProfile: () => void;
}) {
  const active = useAmbientActive();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [active]);
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.5, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.5]) }],
  }));

  const Item = ({
    icon: Icon,
    label,
    onPress,
    current,
  }: {
    icon: React.ComponentType<{ size?: number; color?: string }>;
    label: string;
    onPress?: () => void;
    current?: boolean;
  }) => (
    <View style={{ flex: 1 }}>
      <PressScale onPress={onPress ?? (() => {})} style={[styles.navItem, current && { backgroundColor: `${p.accentGradient[1]}22` }]}>
        <Icon size={22} color={current ? p.accentGradient[1] : p.muted} />
        <Text style={[styles.navLabel, { color: current ? p.accentGradient[1] : p.muted }]} numberOfLines={1}>
          {label}
        </Text>
      </PressScale>
    </View>
  );

  return (
    <View pointerEvents="box-none" style={[styles.navWrap, { bottom: Math.max(bottom, 10) + 6 }]}>
      <View style={[styles.nav, { borderColor: p.cardBorder }]}>
        <Glass p={p} fill={p.card} radius={26} />
        <Item icon={HomeIcon} label={labels.home} current />
        <Item icon={Clock3} label={labels.history} onPress={onHistory} />
        <View style={styles.navCenterSlot} />
        <Item icon={BarChart3} label={labels.stats} onPress={onStats} />
        <Item icon={UserIcon} label={labels.profile} onPress={onProfile} />
      </View>
      <View pointerEvents="box-none" style={styles.fabWrap}>
        <Animated.View pointerEvents="none" style={[styles.fabRing, { borderColor: p.accentGradient[1] }, ring]} />
        <PressScale onPress={onScan} style={styles.fabPress}>
          <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Plus size={28} color="#FFFFFF" />
          </LinearGradient>
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 60, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dot: { position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 5 },
  hero: { minHeight: 150, paddingHorizontal: 20, paddingTop: 10, justifyContent: 'center' },
  heroCards: { position: 'absolute', right: 0, top: 0, width: 200, height: 150 },
  heroBadge: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  greeting: { maxWidth: '68%' },
  greetSmall: { fontSize: 17, fontWeight: '500' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  name: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 },
  wave: { fontSize: 28 },
  tagline: { fontSize: 15, marginTop: 6 },
  body: { paddingHorizontal: 18, paddingTop: 8 },
  balanceCard: { borderRadius: 24, borderWidth: 1, padding: 20, overflow: 'hidden' },
  balanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { fontSize: 15, fontWeight: '500' },
  eye: { padding: 6 },
  balance: { fontSize: 36, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 },
  balanceRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  miniStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  miniLabel: { fontSize: 12 },
  miniValue: { fontSize: 14, fontWeight: '700', marginTop: 1 },
  primaryRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  scanWrap: { borderRadius: 18, overflow: 'hidden' },
  scan: { height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 },
  scanText: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondary: { height: 60, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', paddingHorizontal: 12 },
  secondaryText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  grid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  gridItem: { height: 100, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', paddingHorizontal: 6 },
  gridIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: 13, fontWeight: '600' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  sectionActionText: { fontSize: 14, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 14, overflow: 'hidden' },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 14, fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 12 },
  statBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 4 },
  deltaText: { fontSize: 13, fontWeight: '700' },
  list: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, overflow: 'hidden' },
  divider: { height: 1, marginLeft: 60 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  tile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activityText: { flex: 1 },
  activityTitle: { fontSize: 16, fontWeight: '600' },
  activitySub: { fontSize: 13, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 14 },
  settingsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, paddingVertical: 8 },
  settingsText: { fontSize: 14 },
  navWrap: { position: 'absolute', left: 14, right: 14 },
  nav: { height: 72, borderRadius: 26, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, overflow: 'hidden' },
  navItem: { height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4, marginHorizontal: 2 },
  navLabel: { fontSize: 11, fontWeight: '600' },
  navCenterSlot: { width: 74 },
  fabWrap: { position: 'absolute', top: -24, left: 0, right: 0, alignItems: 'center' },
  fabRing: { position: 'absolute', width: 66, height: 66, borderRadius: 33, borderWidth: 2 },
  fabPress: { borderRadius: 33, overflow: 'hidden' },
  fab: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
});
