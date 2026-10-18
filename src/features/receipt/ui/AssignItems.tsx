/**
 * "Who had what?" building blocks. Every item is shown with a chip per person: tap a
 * chip to add/remove that person, "Everyone" toggles all. Several people on one item
 * share its price equally; items with quantity > 1 can also be split by units.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, SlidersHorizontal, Users2 } from '@tamagui/lucide-icons';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Glass, PressScale, type GlassPalette } from '@/shared/ui/glass/GlassKit';

export type AssignPerson = { uniqueId: string; username: string };
export type AssignItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  totalPrice?: number;
  splitMode?: 'equal' | 'count';
  assignedTo: string[];
  perPersonCount?: Record<string, number>;
};

/** Fixed colour per person (index in the participant list). Names are always shown too. */
export const PERSON_COLORS = ['#16A34A', '#2563EB', '#7C3AED', '#DB2777', '#D97706', '#0D9488', '#DC2626', '#4F46E5'];
export const personColor = (index: number) => PERSON_COLORS[index % PERSON_COLORS.length];

const initialOf = (name: string) => (name?.trim()?.[0] ?? '?').toUpperCase();

function Dot({ color, label, size = 24, light }: { color: string; label: string; size?: number; light?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: light ? 'rgba(255,255,255,0.28)' : color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.5, fontWeight: '800' }}>{initialOf(label)}</Text>
    </View>
  );
}

function Chip({
  p,
  selected,
  color,
  label,
  count,
  onPress,
  icon,
}: {
  p: GlassPalette;
  selected: boolean;
  color: string;
  label: string;
  count?: number;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <PressScale
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? color : p.cardBorder, backgroundColor: selected ? color : p.inputBg }]}
    >
      {icon ?? <Dot color={color} label={label} size={22} light={selected} />}
      <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : p.text }]} numberOfLines={1}>
        {label}
      </Text>
      {count ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>×{count}</Text>
        </View>
      ) : selected ? (
        <Check size={14} color="#FFFFFF" strokeWidth={3} />
      ) : null}
    </PressScale>
  );
}

export function AssignItemCard({
  p,
  item,
  participants,
  total,
  format,
  onToggle,
  onEveryone,
  onUnits,
}: {
  p: GlassPalette;
  item: AssignItem;
  participants: AssignPerson[];
  total: number;
  format: (n: number) => string;
  onToggle: (uid: string) => void;
  onEveryone: () => void;
  onUnits: () => void;
}) {
  const { t } = useTranslation();
  const countMode = item.splitMode === 'count';
  const counts = item.perPersonCount ?? {};
  const assigned = countMode ? Object.keys(counts).filter((u) => (counts[u] ?? 0) > 0) : item.assignedTo;
  const unitsDone = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const complete = countMode ? unitsDone >= Math.max(1, item.quantity) : assigned.length > 0;
  const allSelected = !countMode && participants.length > 0 && participants.every((x) => assigned.includes(x.uniqueId));
  const each = !countMode && assigned.length > 0 ? total / assigned.length : 0;

  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      layout={LinearTransition.duration(200)}
      style={[styles.card, { borderColor: complete ? p.cardBorder : '#F59E0B88' }]}
    >
      <Glass p={p} fill={p.card} radius={20} />

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: p.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.meta, { color: p.muted }]}>
            {item.quantity} × {format(item.price)}
          </Text>
        </View>
        <Text style={[styles.price, { color: p.text }]}>{format(total)}</Text>
      </View>

      <View style={styles.chips}>
        <Chip
          p={p}
          selected={allSelected}
          color={p.accentGradient[1]}
          label={t('split.everyone', 'Everyone')}
          onPress={onEveryone}
          icon={<Users2 size={18} color={allSelected ? '#FFFFFF' : p.accentGradient[1]} />}
        />
        {participants.map((person, i) => (
          <Chip
            key={person.uniqueId}
            p={p}
            selected={assigned.includes(person.uniqueId)}
            color={personColor(i)}
            label={person.username}
            count={countMode ? counts[person.uniqueId] : undefined}
            onPress={() => (countMode ? onUnits() : onToggle(person.uniqueId))}
          />
        ))}
      </View>

      <View style={styles.foot}>
        {complete ? (
          <Text style={[styles.footText, { color: p.sub }]} numberOfLines={1}>
            {countMode
              ? t('split.unitsAssigned', { done: unitsDone, total: item.quantity, defaultValue: `${unitsDone}/${item.quantity} units` })
              : assigned.length > 1
                ? t('split.eachPays', { amount: format(each), defaultValue: `Each pays ${format(each)}` })
                : t('split.paysAll', 'Pays the full amount')}
          </Text>
        ) : (
          <Text style={[styles.footText, { color: '#F59E0B' }]} numberOfLines={1}>
            {countMode
              ? t('split.unitsAssigned', { done: unitsDone, total: item.quantity, defaultValue: `${unitsDone}/${item.quantity} units` })
              : t('split.pickSomeone', 'Pick who had this')}
          </Text>
        )}
        {item.quantity > 1 && (
          <Pressable onPress={onUnits} hitSlop={8} style={styles.unitsBtn} accessibilityRole="button">
            <SlidersHorizontal size={14} color={p.accentGradient[1]} />
            <Text style={[styles.unitsText, { color: p.accentGradient[1] }]}>{t('orders.byUnits', 'By units')}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

/** Running "who owes what" strip (items only; tax / service are added when the bill is confirmed). */
export function PersonTotals({
  p,
  participants,
  totals,
  format,
}: {
  p: GlassPalette;
  participants: AssignPerson[];
  totals: Record<string, number>;
  format: (n: number) => string;
}) {
  return (
    <View style={styles.totals}>
      {participants.map((person, i) => (
        <View key={person.uniqueId} style={[styles.person, { borderColor: p.cardBorder }]}>
          <Dot color={personColor(i)} label={person.username} size={26} />
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.personName, { color: p.sub }]} numberOfLines={1}>
              {person.username}
            </Text>
            <Text style={[styles.personAmount, { color: p.text }]} numberOfLines={1}>
              {format(totals[person.uniqueId] ?? 0)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ConfirmButton({
  p,
  enabled,
  loading,
  label,
  onPress,
}: {
  p: GlassPalette;
  enabled: boolean;
  loading: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} disabled={!enabled || loading} style={[styles.confirmWrap, !enabled && { opacity: 0.55 }]}>
      <LinearGradient
        colors={enabled ? p.accentGradient : [p.divider, p.divider]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.confirm}
      >
        <Text style={[styles.confirmText, { color: enabled ? '#FFFFFF' : p.muted }]}>{label}</Text>
      </LinearGradient>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1.2, padding: 14, marginBottom: 12, overflow: 'hidden', gap: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 3 },
  price: { fontSize: 16, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 38, paddingHorizontal: 10, borderRadius: 19, borderWidth: 1.2, flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: 160 },
  chipText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  countBadge: { backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1 },
  countText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  footText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  unitsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  unitsText: { fontSize: 13, fontWeight: '700' },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, maxWidth: '48%' },
  personName: { fontSize: 11 },
  personAmount: { fontSize: 14, fontWeight: '800' },
  confirmWrap: { borderRadius: 18, overflow: 'hidden' },
  confirm: { height: 56, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 17, fontWeight: '800' },
});
