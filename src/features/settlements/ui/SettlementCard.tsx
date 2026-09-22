import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Banknote, Check, CreditCard } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';

import UserAvatar from '@/shared/ui/UserAvatar';

export type PaymentMethod = 'cash' | 'card';

export type SettlementUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type SettlementCardItem = {
  id: string;
  payer: SettlementUser;
  receiver: SettlementUser;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: 'pending' | 'paid';
};

type SettlementCardProps = {
  settlement: SettlementCardItem;
  currentUserId?: string | null;
  onMethodChange: (id: string, method: PaymentMethod) => void;
  onMarkPaid: (id: string) => void;
};

const formatAmount = (currency: string, amount: number) =>
  `${currency} ${Math.round(amount).toLocaleString('en-US')}`;

const getInitial = (name: string) => name.trim().slice(0, 1).toUpperCase() || '?';

function getStatusText(
  settlement: SettlementCardItem,
  t: (key: string, options?: Record<string, unknown>) => string,
  currentUserId?: string | null,
) {
  if (currentUserId && settlement.receiver.id === currentUserId) {
    return t('settlements.owesYou');
  }

  if (currentUserId && settlement.payer.id === currentUserId) {
    return t('settlements.youOwe');
  }

  return t('settlements.owesPerson', { name: settlement.receiver.name });
}

export function SettlementCard({
  settlement,
  currentUserId,
  onMethodChange,
  onMarkPaid,
}: SettlementCardProps) {
  const { t } = useTranslation();
  const isPaid = settlement.status === 'paid';
  const statusText = getStatusText(settlement, t, currentUserId);

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <View style={[styles.item, isPaid && styles.itemSettled]}>
        <View style={styles.summaryRow}>
          <View style={styles.personCell}>
            <UserAvatar
              uri={settlement.payer.avatarUrl}
              label={getInitial(settlement.payer.name)}
              size={44}
              textSize={15}
              backgroundColor="#E0F2FE"
            />
            <View style={styles.nameBlock}>
              <Text numberOfLines={1} style={styles.name}>
                {settlement.payer.name}
              </Text>
              <Text numberOfLines={1} style={styles.methodHint}>
                {t('settlements.transferMethod')}
              </Text>
            </View>
          </View>

          <Text numberOfLines={1} style={styles.status}>
            {statusText}
          </Text>

          <Text numberOfLines={1} style={[styles.amount, isPaid && styles.amountSettled]}>
            {formatAmount(settlement.currency, settlement.amount)}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <View style={styles.methodToggle}>
            {(['cash', 'card'] as const).map((method) => {
              const active = settlement.method === method;
              const Icon = method === 'cash' ? Banknote : CreditCard;

              return (
                <Pressable
                  key={method}
                  disabled={isPaid}
                  onPress={() => onMethodChange(settlement.id, method)}
                  style={[
                    styles.methodButton,
                    active && styles.methodButtonActive,
                    isPaid && styles.disabledControl,
                  ]}
                >
                  <Icon size={14} color={active ? '#0F172A' : '#64748B'} />
                  <Text style={[styles.methodText, active && styles.methodTextActive]}>
                    {method === 'cash' ? t('settlements.methods.cash') : t('settlements.methods.card')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            disabled={isPaid}
            onPress={() => onMarkPaid(settlement.id)}
            style={[styles.settleButton, isPaid && styles.settleButtonDone]}
          >
            <Check size={15} color={isPaid ? '#FFFFFF' : '#16A34A'} />
            <Text style={[styles.settleText, isPaid && styles.settleTextDone]}>
              {isPaid ? t('settlements.settled') : t('settlements.markAsSettled')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
    gap: 14,
  },
  itemSettled: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F8FFF9',
  },
  summaryRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personCell: {
    flex: 1.25,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  methodHint: {
    marginTop: 2,
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  status: {
    flex: 0.85,
    minWidth: 76,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  amount: {
    flex: 0.9,
    minWidth: 92,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  amountSettled: {
    color: '#16A34A',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  methodToggle: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  methodButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  methodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  disabledControl: {
    opacity: 0.65,
  },
  methodText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  methodTextActive: {
    color: '#0F172A',
  },
  settleButton: {
    minHeight: 38,
    flexShrink: 1,
    flexGrow: 1,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  settleButtonDone: {
    backgroundColor: '#16A34A',
  },
  settleText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '900',
  },
  settleTextDone: {
    color: '#FFFFFF',
  },
});

export default SettlementCard;
