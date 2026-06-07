// app/tabs/index.tsx - Japanese-style Home Page with liquid glass effects
import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Dimensions, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { YStack, XStack, Text, View, ScrollView } from 'tamagui';
import { 
  QrCode, 
  Users2, 
  FolderKanban, 
  RefreshCcw, 
  BarChart3,
  Receipt,
  Zap,
  Settings,
  Wallet,
  History,
  Heart,
  Brain,
  Sparkles,
  Search,
  Bell,
  ChevronRight,
  Sun,
  Moon,
  Flower2,
  Mountain,
  TreePine,
  Waves,
} from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  FadeIn,
  FadeOut,
  SlideInUp,
  useAnimatedScrollHandler, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate, 
  withRepeat, 
  withTiming, 
  Easing,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop, Path, G, Ellipse } from 'react-native-svg';

import UserAvatar from '@/shared/ui/UserAvatar';
import { getJapaneseColors, borderRadius, shadows } from '@/shared/ui/JapaneseTheme';
import type { SessionHistoryEntry } from '@/features/sessions/api/history.api';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { useThemeColors } from '@/shared/lib/stores/theme-store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HOME_HISTORY_LIMIT = 10;
const DEFAULT_CURRENCY = 'UZS';

const formatSessionDate = (value?: string, locale: string = 'en') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  };
  try {
    return date.toLocaleString(locale, options);
  } catch {
    return date.toLocaleString(undefined, options);
  }
};

// Animated Floating Leaf
const FloatingLeaf = ({ delay, startX, isDark }: { delay: number; startX: number; isDark: boolean }) => {
  const colors = useThemeColors();
  const translateY = useSharedValue(-30);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(400, { duration: 8000 + Math.random() * 4000, easing: Easing.linear }),
      -1,
      false
    );
    translateX.value = withRepeat(
      withTiming(Math.random() * 50 - 25, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    rotate.value = withRepeat(
      withTiming(360, { duration: 5000 + Math.random() * 2000, easing: Easing.linear }),
      -1,
      false
    );
    opacity.value = withTiming(0.5, { duration: 600 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.petal, { left: startX }, animatedStyle]}>
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Ellipse cx="7" cy="7" rx="5" ry="3" fill="#86EFAC" opacity={0.6} />
      </Svg>
    </Animated.View>
  );
};

// Japanese-style Category Card (like screenshot 2)
const CategoryCard = ({
  title,
  icon,
  imageColors,
  onPress,
  delay = 0,
  size = 'normal',
  isDark,
}: {
  title: string;
  icon: React.ReactNode;
  imageColors: readonly [string, string];
  onPress: () => void;
  delay?: number;
  size?: 'normal' | 'small';
  isDark: boolean;
}) => {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 150 }) }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      exiting={FadeOut.duration(350)}
      style={[size === 'small' ? styles.categoryCardSmall : styles.categoryCard]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = 0.95; }}
        onPressOut={() => { scale.value = 1; }}
        style={{ flex: 1 }}
      >
        <Animated.View style={[styles.categoryCardInner, animatedStyle]}>
          <LinearGradient
            colors={imageColors}
            style={styles.categoryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.categoryIconContainer}>
              {icon}
            </View>
          </LinearGradient>
          <Text style={[styles.categoryTitle, { color: colors.text }]}>{title}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

// Glass Menu Card with Icon
const GlassMenuCard = ({
  title,
  subtitle,
  icon,
  onPress,
  delay = 0,
  isDark,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
  delay?: number;
  isDark: boolean;
}) => {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 150 }) }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      exiting={FadeOut.duration(350)}
      style={styles.glassMenuWrapper}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = 0.96; }}
        onPressOut={() => { scale.value = 1; }}
        style={{ flex: 1 }}
      >
        <Animated.View 
          style={[
            styles.glassMenuCard,
            { 
              backgroundColor: colors.glass,
              borderColor: colors.glassBorder,
              ...shadows.medium,
              shadowColor: colors.shadow,
            },
            animatedStyle,
          ]}
        >
          <View style={[styles.glassMenuIcon, { backgroundColor: colors.iconBg }]}>
            <View style={[styles.glassMenuIconInner, { backgroundColor: colors.iconBgStrong }]}>
              {icon}
            </View>
          </View>
          <Text style={[styles.glassMenuTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.glassMenuSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

// Breathing Scan Button
const BreathingScanButton = ({ onPress, isDark }: { onPress: () => void; isDark: boolean }) => {
  const colors = useThemeColors();
  const breathScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  
  useEffect(() => {
    breathScale.value = withRepeat(
      withTiming(1.08, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Pressable onPress={onPress}>
      <YStack ai="center" gap="$3">
        <View style={styles.scanButtonWrapper}>
          <Animated.View style={[styles.scanButtonGlow, glowStyle]}>
            <LinearGradient
              colors={[colors.primary + '50', 'transparent']}
              style={styles.scanGlowGradient}
            />
          </Animated.View>
          <View style={[styles.scanButtonOuter, { borderColor: colors.primaryLight }]}>
            <Animated.View style={[
              styles.scanButtonMiddle, 
              { borderColor: colors.primary, backgroundColor: colors.iconBg },
              animatedStyle
            ]}>
              <View style={[styles.scanButtonInner, { 
                backgroundColor: colors.card,
                shadowColor: colors.primary,
              }]}>
                <Receipt size={36} color={colors.primary} strokeWidth={1.5} />
              </View>
            </Animated.View>
          </View>
        </View>
        <Text style={[styles.scanLabel, { color: colors.text }]}>Scan Receipt</Text>
        <Text style={[styles.scanSubLabel, { color: colors.textSecondary }]}>Tap to start</Text>
      </YStack>
    </Pressable>
  );
};

// Recent Bill Card
function BillCard({
  title,
  sub,
  amountLabel,
  participantIds,
  onPress,
  index = 0,
  isDark,
}: {
  title: string;
  sub: string;
  amountLabel: string;
  participantIds: string[];
  onPress?: () => void;
  index?: number;
  isDark: boolean;
}) {
  const colors = useThemeColors();
  
  return (
    <Animated.View
      entering={FadeInDown.delay(300 + index * 80).springify()}
      exiting={FadeOut.duration(350)}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => ({
          width: '100%',
          opacity: onPress && pressed ? 0.9 : 1,
        })}
      >
        <View
          style={[
            styles.billCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              ...shadows.medium,
              shadowColor: colors.shadow,
            }
          ]}
        >
          <XStack jc="space-between" ai="center">
            <YStack f={1}>
              <Text style={[styles.billTitle, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.billSub, { color: colors.textSecondary }]}>{sub}</Text>
            </YStack>
            <View style={[styles.billAmount, { backgroundColor: colors.iconBg }]}>
              <Text style={[styles.billAmountText, { color: colors.primary }]}>{amountLabel}</Text>
            </View>
          </XStack>
          
          <XStack ai="center" jc="space-between" mt="$3">
            <XStack ai="center">
              {participantIds.slice(0, 3).map((id, i) => (
                <View 
                  key={id || i} 
                  style={[
                    styles.avatarStack,
                    { marginLeft: i === 0 ? 0 : -8, borderColor: colors.card },
                  ]}
                >
                  <UserAvatar
                    uri={undefined}
                    label={(id || 'U').slice(0, 1).toUpperCase()}
                    size={28}
                    textSize={11}
                    backgroundColor={colors.iconBgStrong}
                  />
                </View>
              ))}
              {participantIds.length > 3 && (
                <View
                  style={[
                    styles.avatarExtra,
                    { backgroundColor: colors.iconBg, marginLeft: -8, borderColor: colors.card },
                  ]}
                >
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    +{participantIds.length - 3}
                  </Text>
                </View>
              )}
            </XStack>
            <ChevronRight size={18} color={colors.textMuted} />
          </XStack>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { theme, user, setTheme } = useAppStore();
  const isDark = theme === 'dark';
  const colors = useThemeColors();
  
  const sessions = useSessionsHistoryStore(state => state.sessions);
  const loading = useSessionsHistoryStore(state => state.loading);
  const initialized = useSessionsHistoryStore(state => state.initialized);
  const currentLimit = useSessionsHistoryStore(state => state.limit);
  const error = useSessionsHistoryStore(state => state.error);
  const fetchHistory = useSessionsHistoryStore(state => state.fetchHistory);
  const refreshIfStale = useSessionsHistoryStore(state => state.refreshIfStale);
  const forceRefresh = useSessionsHistoryStore(state => state.forceRefresh);

  const hasFetchedRef = useRef(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [transitionColor, setTransitionColor] = useState('rgba(0,0,0,0)');
  const themeTransition = useSharedValue(0);
  
  // Scroll animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  
  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 100], [1, 0.8], 'clamp');
    return { opacity };
  });

  const transitionStyle = useAnimatedStyle(() => ({
    opacity: themeTransition.value,
  }));

  useEffect(() => {
    if (loading) return;
    if (hasFetchedRef.current) return;
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
    }, [refreshIfStale])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await forceRefresh(HOME_HISTORY_LIMIT).catch(() => {});
    setRefreshing(false);
  }, [forceRefresh]);

  // Navigation handlers
  const openFriends = () => router.push('/tabs/friends');
  const openGroups = () => router.push('/tabs/groups');
  const onScan = () => router.push('/tabs/scan-receipt');
  const openAllSessions = () => router.push('/tabs/sessions/history');
  const openAnalytics = () => router.push('/tabs/analytics');
  const openQuickSplit = () => router.push('/tabs/quick-split');
  const openDebts = () => router.push('/tabs/debts');
  const openSettings = () => router.push('/tabs/settings');

  const handleToggleTheme = useCallback(() => {
    const nextIsDark = theme !== 'dark';
    setTransitionColor(nextIsDark ? 'rgba(15,20,25,0.45)' : 'rgba(255,255,255,0.55)');
    themeTransition.value = 1;
    setTheme(nextIsDark ? 'dark' : 'light');
    themeTransition.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [setTheme, theme, themeTransition]);

  const recent = useMemo<SessionHistoryEntry[]>(() => sessions.slice(0, 3), [sessions]);

  // Generate floating leaves
  const petals = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      delay: Math.random() * 2000,
      startX: Math.random() * SCREEN_WIDTH,
    })), []
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgGradientEnd }]}>
      {/* Background Gradient */}
      <LinearGradient
        colors={isDark 
          ? [colors.bgGradientStart, colors.bgGradientEnd] 
          : [colors.bgGradientStart, colors.bgGradientEnd, colors.bgSakura]
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Theme transition overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: transitionColor }, transitionStyle]}
      />
      
      {/* Floating Leaves */}
      {petals.map(petal => (
        <FloatingLeaf key={petal.id} delay={petal.delay} startX={petal.startX} isDark={isDark} />
      ))}

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <LinearGradient
            colors={isDark 
              ? [colors.primaryDark, colors.primary] as const
              : [colors.primary, colors.primaryLight] as const
            }
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.View entering={SlideInUp.delay(100).springify()}>
              <XStack ai="center" jc="space-between" mb="$2">
                <XStack ai="center" gap="$2">
                  <TreePine size={24} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.headerTitle}>Splitter</Text>
                </XStack>
                <XStack ai="center" gap="$3">
                  <Pressable onPress={handleToggleTheme} hitSlop={10}>
                    {isDark ? (
                      <Sun size={22} color="rgba(255,255,255,0.9)" />
                    ) : (
                      <Moon size={22} color="rgba(255,255,255,0.9)" />
                    )}
                  </Pressable>
                  <Pressable onPress={openSettings} hitSlop={10}>
                    <Settings size={22} color="rgba(255,255,255,0.8)" />
                  </Pressable>
                </XStack>
              </XStack>
              <Text style={styles.headerSubtitle}>
                {t('home.greeting', { name: user?.username || 'Friend' })}
              </Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.searchSection}>
          <View style={[styles.searchBar, { 
            backgroundColor: colors.glass, 
            borderColor: colors.glassBorder 
          }]}>
            <Search size={18} color={colors.textMuted} />
            <Text style={[styles.searchPlaceholder, { color: colors.textMuted }]}>
              {t('home.search', 'Search destination...')}
            </Text>
          </View>
        </Animated.View>

        {/* Categories Section (like screenshot 2) */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.categoriesSection}>
          <XStack jc="space-between" ai="center" px="$4" mb="$3">
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('home.categories', 'Categories')}
            </Text>
            <Pressable>
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                {t('home.seeAll', 'See all')}
              </Text>
            </Pressable>
          </XStack>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            <CategoryCard
              title={t('quickSplit.title', 'Quick')}
              icon={<Zap size={28} color="#FFFFFF" />}
              imageColors={['#0D9488', '#059669'] as const}
              onPress={openQuickSplit}
              delay={350}
              size="small"
              isDark={isDark}
            />
            <CategoryCard
              title={t('home.actions.groups', 'Groups')}
              icon={<FolderKanban size={28} color="#FFFFFF" />}
              imageColors={['#0891B2', '#0E7490'] as const}
              onPress={openGroups}
              delay={400}
              size="small"
              isDark={isDark}
            />
            <CategoryCard
              title={t('debts.title', 'Debts')}
              icon={<Wallet size={28} color="#FFFFFF" />}
              imageColors={['#10B981', '#047857'] as const}
              onPress={openDebts}
              delay={450}
              size="small"
              isDark={isDark}
            />
            <CategoryCard
              title={t('analytics.title', 'Stats')}
              icon={<BarChart3 size={28} color="#FFFFFF" />}
              imageColors={['#14B8A6', '#0D9488'] as const}
              onPress={openAnalytics}
              delay={500}
              size="small"
              isDark={isDark}
            />
          </ScrollView>
        </Animated.View>

        {/* Main Scan Button */}
        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.scanSection}>
          <BreathingScanButton onPress={onScan} isDark={isDark} />
        </Animated.View>

        {/* Action Grid */}
        <View style={styles.gridSection}>
          <XStack jc="space-between" ai="center" px="$4" mb="$3">
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('home.popular', 'Popular')}
            </Text>
          </XStack>
          
          <View style={styles.gridContainer}>
            <GlassMenuCard
              title={t('home.actions.friends', 'Friends')}
              icon={<Heart size={24} color={colors.primary} />}
              onPress={openFriends}
              delay={550}
              isDark={isDark}
            />
            <GlassMenuCard
              title={t('home.actions.groups', 'Groups')}
              icon={<Users2 size={24} color={colors.primary} />}
              onPress={openGroups}
              delay={600}
              isDark={isDark}
            />
            <GlassMenuCard
              title={t('analytics.title', 'Analytics')}
              icon={<Brain size={24} color={colors.primary} />}
              onPress={openAnalytics}
              delay={650}
              isDark={isDark}
            />
            <GlassMenuCard
              title={t('navigation.tabs.settings', 'Settings')}
              icon={<Settings size={24} color={colors.primary} />}
              onPress={openSettings}
              delay={700}
              isDark={isDark}
            />
          </View>
        </View>

        {/* Recent Bills Section */}
        <View style={styles.recentSection}>
          <XStack jc="space-between" ai="center" px="$4" mb="$3">
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('home.recent.title', 'Recent bills')}
            </Text>
            <Pressable onPress={openAllSessions}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                {t('home.recent.showMore', 'Show more')}
              </Text>
            </Pressable>
          </XStack>

          <YStack gap="$3" px="$4" pb="$6">
            {loading && (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                {t('home.recent.loading', 'Loading...')}
              </Text>
            )}
            {error && (
              <Text style={{ color: colors.error, fontSize: 14 }}>{error}</Text>
            )}
            {!loading && !error && !recent.length && (
              <Animated.View entering={FadeInDown.delay(300)} exiting={FadeOut.duration(350)}>
                <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.iconBg }]}>
                    <Receipt size={32} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {t('home.recent.empty', 'No bills yet')}
                  </Text>
                </View>
              </Animated.View>
            )}
            {recent.map((bill, index) => {
              const participantIds = (typeof bill.participantUniqueIds === 'string') 
                ? bill.participantUniqueIds.split(',').map(id => id.trim()).filter(Boolean)
                : bill.participantUniqueIds ?? [];
              const dateForSummary = bill.finalizedAt || bill.createdAt;
              const summary = formatSessionDate(dateForSummary, i18n.language);
              const totalAmount = bill.grandTotal ?? 0;
              const currency = bill.currency || DEFAULT_CURRENCY;
              const amountLabel = `${totalAmount.toLocaleString(i18n.language ?? 'en', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })} ${currency}`;

              return (
                <BillCard
                  key={bill.sessionId}
                  title={bill.sessionName || t('home.recent.fallbackName', 'Bill')}
                  sub={summary}
                  amountLabel={amountLabel}
                  participantIds={participantIds}
                  index={index}
                  isDark={isDark}
                  onPress={() =>
                    router.push({
                      pathname: '/tabs/sessions/history/[historyId]',
                      params: { historyId: String(bill.sessionId) },
                    })
                  }
                />
              );
            })}
          </YStack>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  petal: {
    position: 'absolute',
    top: 0,
    zIndex: 1,
  },
  header: {
    marginBottom: 20,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  searchPlaceholder: {
    fontSize: 14,
  },
  categoriesSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryCard: {
    width: 100,
  },
  categoryCardSmall: {
    width: 80,
  },
  categoryCardInner: {
    alignItems: 'center',
  },
  categoryGradient: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  scanButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
  },
  scanGlowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
  },
  scanButtonOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonMiddle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  scanLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  scanSubLabel: {
    fontSize: 13,
  },
  gridSection: {
    marginBottom: 28,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
    justifyContent: 'center',
  },
  glassMenuWrapper: {
    width: '45%',
    minWidth: 150,
  },
  glassMenuCard: {
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    borderWidth: 1.5,
  },
  glassMenuIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  glassMenuIconInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassMenuTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  glassMenuSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  recentSection: {
    marginTop: 8,
  },
  billCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  billSub: {
    fontSize: 12,
    marginTop: 4,
  },
  billAmount: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  billAmountText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatarStack: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 14,
  },
  avatarExtra: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
