import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type AssignableParticipant = {
  uniqueId: string;
  username: string;
};

export type AssignableReceiptItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[];
  totalPrice?: number;
};

type AssignableItemCardProps = {
  item: AssignableReceiptItem;
  participants: AssignableParticipant[];
  currency: string;
  onToggleParticipant: (itemId: string, participantId: string) => void;
};

const avatarColors = ['#0D9488', '#2563EB', '#7C3AED', '#EA580C', '#DB2777', '#059669'];

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

const formatMoney = (currency: string, value: number) =>
  `${currency} ${Math.round(value).toLocaleString('en-US')}`;

export function AssignableItemCard({
  item,
  participants,
  currency,
  onToggleParticipant,
}: AssignableItemCardProps) {
  const total = item.totalPrice ?? item.price * item.quantity;
  const selectedCount = item.assignedTo.length;
  const splitAmount = selectedCount > 0 ? total / selectedCount : 0;

  const assignedText = useMemo(() => {
    if (selectedCount === 0) return 'Tap avatars to split';
    if (selectedCount === 1) return 'Assigned to 1 person';
    return `Split between ${selectedCount} people`;
  }, [selectedCount]);

  return (
    <View style={[styles.card, selectedCount > 0 && styles.cardActive]}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{item.name}</Text>
          <Text style={styles.meta}>
            {item.quantity}x - {assignedText}
          </Text>
        </View>

        <View style={styles.amountColumn}>
          <Text style={styles.amount}>{formatMoney(currency, total)}</Text>
          {selectedCount > 1 && (
            <Text style={styles.splitAmount}>{formatMoney(currency, splitAmount)} each</Text>
          )}
        </View>
      </View>

      <View style={styles.avatars}>
        {participants.map((participant, index) => {
          const active = item.assignedTo.includes(participant.uniqueId);
          const fallbackColor = avatarColors[index % avatarColors.length];

          return (
            <Pressable
              key={`${item.id}-${participant.uniqueId}`}
              onPress={() => onToggleParticipant(item.id, participant.uniqueId)}
              style={({ pressed }) => [
                styles.avatarWrap,
                active && styles.avatarWrapActive,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: active ? '#22C55E' : fallbackColor },
                ]}
              >
                <Text style={styles.avatarText}>{getInitials(participant.username)}</Text>
              </View>
              <Text numberOfLines={1} style={[styles.avatarLabel, active && styles.avatarLabelActive]}>
                {participant.username}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  cardActive: {
    borderColor: '#86EFAC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  title: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    color: '#64748B',
    fontSize: 12,
  },
  amountColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    color: '#16A34A',
    fontSize: 15,
    fontWeight: '900',
  },
  splitAmount: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  avatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  avatarWrap: {
    minWidth: 58,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarWrapActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  avatarLabel: {
    maxWidth: 72,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarLabelActive: {
    color: '#15803D',
  },
});
