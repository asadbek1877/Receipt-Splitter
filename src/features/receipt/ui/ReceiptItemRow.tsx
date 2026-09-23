import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Pencil, ShoppingBag, Trash2, X } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';

type ReceiptItemRowValue = {
  id: string;
  name: string;
  imageUrl?: string | null;
  imageUri?: string | null;
  thumbnailUrl?: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice?: number;
  discount?: number;
  needsReview?: boolean;
  issues?: string[];
};

type ReceiptItemRowProps = {
  item: ReceiptItemRowValue;
  currency: string;
  onChange: (item: ReceiptItemRowValue) => void;
  onDelete: () => void;
};

const PRODUCT_IMAGE_SIZE = 50;

/** Accepts "12.50" and "12,50"; returns NaN for anything else. */
const parseDecimal = (value: string) => {
  const compact = value.replace(/\s+/g, '');
  return /^\d+([.,]\d+)?$/.test(compact) ? Number(compact.replace(',', '.')) : NaN;
};

const formatMoney = (currency: string, value: number) =>
  `${currency} ${Math.round(value).toLocaleString('en-US')}`;

const getImageSource = (item: ReceiptItemRowValue) => {
  const uri = item.imageUrl || item.imageUri || item.thumbnailUrl;
  return uri && uri.trim().length > 0 ? { uri } : null;
};

export function ReceiptItemSkeletonRow() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1250,
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 260],
  });

  const SkeletonBlock = ({ style }: { style: object }) => (
    <View style={[styles.skeletonBlock, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonBlock style={styles.skeletonImage} />
        <View style={styles.copy}>
          <SkeletonBlock style={styles.skeletonTitle} />
          <SkeletonBlock style={styles.skeletonSubtitle} />
        </View>
        <SkeletonBlock style={styles.skeletonPrice} />
      </View>
    </View>
  );
}

export function ReceiptItemRow({
  item,
  currency,
  onChange,
  onDelete,
}: ReceiptItemRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [draft, setDraft] = useState({
    name: item.name,
    unitPrice: String(item.unitPrice),
    quantity: String(item.quantity),
  });

  const total = useMemo(
    () => item.totalPrice ?? item.unitPrice * item.quantity,
    [item.quantity, item.totalPrice, item.unitPrice]
  );
  const imageSource = imageFailed ? null : getImageSource(item);
  const subtitle = t('receiptReview.itemSubtitle', {
    count: item.quantity,
    amount: formatMoney(currency, item.unitPrice),
  });

  const resetDraft = () => {
    setDraft({
      name: item.name,
      unitPrice: String(item.unitPrice),
      quantity: String(item.quantity),
    });
    setEditing(false);
  };

  const saveDraft = () => {
    const name = draft.name.trim();
    const unitPrice = parseDecimal(draft.unitPrice);
    const quantity = Number(parseDecimal(draft.quantity).toFixed(3));

    if (
      !name ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 1000
    ) {
      resetDraft();
      return;
    }

    // Keep the printed line total (line discounts, weighed goods) unless price or quantity changed.
    const pricingChanged = unitPrice !== item.unitPrice || quantity !== item.quantity;
    onChange({
      ...item,
      name,
      unitPrice,
      quantity,
      totalPrice: pricingChanged
        ? unitPrice * quantity
        : item.totalPrice ?? unitPrice * quantity,
      discount: pricingChanged ? undefined : item.discount,
      needsReview: false,
      issues: undefined,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={styles.card}>
        <View style={styles.editHeader}>
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft((prev) => ({ ...prev, name }))}
            placeholder={t('receiptReview.productName')}
            placeholderTextColor="#94A3B8"
            style={[styles.input, styles.nameInput]}
          />
          <Pressable onPress={resetDraft} style={styles.iconButton}>
            <X size={18} color="#64748B" />
          </Pressable>
        </View>

        <View style={styles.editGrid}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('receiptReview.price')}</Text>
            <TextInput
              value={draft.unitPrice}
              onChangeText={(unitPrice) => setDraft((prev) => ({ ...prev, unitPrice }))}
              keyboardType="numeric"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('receiptReview.qty')}</Text>
            <TextInput
              value={draft.quantity}
              onChangeText={(quantity) => setDraft((prev) => ({ ...prev, quantity }))}
              keyboardType="numeric"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onDelete} style={[styles.actionButton, styles.deleteButton]}>
            <Trash2 size={16} color="#EF4444" />
            <Text style={styles.deleteText}>{t('common.delete')}</Text>
          </Pressable>
          <Pressable onPress={saveDraft} style={[styles.actionButton, styles.saveButton]}>
            <Check size={16} color="#FFFFFF" />
            <Text style={styles.saveText}>{t('common.save')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setEditing(true)}
      style={({ pressed }) => [styles.card, item.needsReview && { borderColor: '#FCA5A5' }, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.imageShell}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={styles.productImage}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.fallbackImage}>
              <ShoppingBag size={22} color="#0F766E" />
            </View>
          )}
        </View>

        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.meta}>{subtitle}</Text>
          {item.needsReview && (
            <Text numberOfLines={2} style={[styles.meta, { color: '#DC2626' }]}>
              {item.issues?.[0] ?? t('receiptReview.checkItem', 'Please check this item')}
            </Text>
          )}
        </View>

        <View style={styles.amountColumn}>
          <Text numberOfLines={1} style={styles.amount}>{formatMoney(currency, total)}</Text>
          <Pencil size={14} color="#A1AAB8" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pressed: {
    transform: [{ scale: 0.995 }],
    opacity: 0.94,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageShell: {
    width: PRODUCT_IMAGE_SIZE,
    height: PRODUCT_IMAGE_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ECFDF5',
  },
  productImage: {
    width: PRODUCT_IMAGE_SIZE,
    height: PRODUCT_IMAGE_SIZE,
    borderRadius: 12,
  },
  fallbackImage: {
    width: PRODUCT_IMAGE_SIZE,
    height: PRODUCT_IMAGE_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFF7EE',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  meta: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  amountColumn: {
    minWidth: 92,
    alignItems: 'flex-end',
    gap: 7,
  },
  amount: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  editGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    color: '#0F172A',
    fontSize: 15,
  },
  nameInput: {
    flex: 1,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  saveButton: {
    backgroundColor: '#22C55E',
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  skeletonBlock: {
    overflow: 'hidden',
    backgroundColor: '#EEF2F7',
  },
  skeletonImage: {
    width: PRODUCT_IMAGE_SIZE,
    height: PRODUCT_IMAGE_SIZE,
    borderRadius: 12,
  },
  skeletonTitle: {
    width: '78%',
    height: 16,
    borderRadius: 8,
  },
  skeletonSubtitle: {
    width: '55%',
    height: 11,
    borderRadius: 6,
  },
  skeletonPrice: {
    width: 82,
    height: 16,
    borderRadius: 8,
  },
  shimmer: {
    width: 90,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.62)',
    opacity: 0.9,
  },
});
