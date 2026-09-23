import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Input, Button, Dialog } from 'tamagui';
import { ChevronLeft, Plus, CheckCircle2 } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';

import {
  defaultSplitMode,
  useReceiptSessionStore,
  type ReceiptSplitItem,
} from '@/features/receipt/model/receipt-session.store';
import { ReceiptItemRow, ReceiptItemSkeletonRow } from '@/features/receipt/ui/ReceiptItemRow';

type DraftItem = {
  name: string;
  unitPrice: string;
  quantity: string;
};

/** Accepts "12.50" and "12,50"; returns NaN for anything else. */
const parseDecimal = (value: string) => {
  const compact = value.replace(/\s+/g, '');
  return /^\d+([.,]\d+)?$/.test(compact) ? Number(compact.replace(',', '.')) : NaN;
};

const minorDigits = (currency: string) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};

const INITIAL_DRAFT: DraftItem = {
  name: '',
  unitPrice: '',
  quantity: '1',
};

export default function ReviewItemsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const session = useReceiptSessionStore((s) => s.session);
  const items = useReceiptSessionStore((s) => s.items);
  const setItems = useReceiptSessionStore((s) => s.setItems);
  const currency = useReceiptSessionStore((s) => s.currency || 'UZS');
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [draft, setDraft] = useState<DraftItem>(INITIAL_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setShowSkeleton(false), 700);
    return () => clearTimeout(timeout);
  }, []);

  const fmtCurrency = (n: number) => `${currency} ${Math.round(n).toLocaleString('en-US')}`;

  const summary = session?.summary;
  const adjustments = useMemo(() => summary?.adjustments ?? [], [summary]);

  // Payable total = item line totals + receipt-level adjustments (discounts subtract,
  // tax/service already included in prices are not added again).
  const itemsTotal = useMemo(
    () => items.reduce((acc, item) => acc + (item.totalPrice ?? item.unitPrice * item.quantity), 0),
    [items]
  );
  const adjustmentsTotal = useMemo(
    () =>
      adjustments.reduce((acc, adj) => {
        if (adj.includedInPrices) return acc;
        return acc + (adj.type === 'discount' ? -adj.amount : adj.amount);
      }, 0),
    [adjustments]
  );
  const grandTotal = itemsTotal + adjustmentsTotal;

  // Re-checked live, so the warning disappears once the user has corrected the items.
  const printedTotal = typeof summary?.printedTotal === 'number' ? summary.printedTotal : null;
  const totalMismatch = useMemo(() => {
    if (printedTotal === null) return false;
    const factor = 10 ** minorDigits(currency);
    const toleranceMinor = Math.max(1, Math.ceil(items.length / 2));
    return Math.abs(Math.round(grandTotal * factor) - Math.round(printedTotal * factor)) > toleranceMinor;
  }, [printedTotal, grandTotal, currency, items.length]);

  const warnings = useMemo(() => {
    const list = [...(summary?.issues ?? [])];
    if (totalMismatch && printedTotal !== null) {
      list.push(
        t('receiptReview.totalMismatch', {
          computed: fmtCurrency(grandTotal),
          printed: fmtCurrency(printedTotal),
          defaultValue: 'Items add up to {{computed}}, but the receipt total is {{printed}}.',
        })
      );
    }
    return list;
  }, [summary?.issues, totalMismatch, printedTotal, grandTotal, t]);

  const updateItem = (itemId: string, updater: (item: ReceiptSplitItem) => ReceiptSplitItem) => {
    setItems(items.map((item) => (item.id === itemId ? updater(item) : item)));
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  const addManualItem = () => {
    const name = draft.name.trim();
    const unitPrice = parseDecimal(draft.unitPrice);
    const quantity = Number(parseDecimal(draft.quantity).toFixed(3));

    if (!name) {
      setError(t('receiptReview.errNameReq'));
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setError(t('receiptReview.errPriceReq'));
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) {
      setError(t('receiptReview.errQtyReq'));
      return;
    }

    const id = `manual-${Date.now()}`;
    const item: ReceiptSplitItem = {
      id,
      name,
      unitPrice,
      quantity,
      totalPrice: unitPrice * quantity,
      splitMode: defaultSplitMode(quantity),
      assignedTo: [],
      perPersonCount: {},
      kind: 'item',
    };

    setItems([...items, item]);
    setDraft(INITIAL_DRAFT);
    setError(null);
    setShowAddDialog(false);
  };

  const goNext = () => {
    if (items.length === 0) {
      setError(t('receiptReview.errReceiptEmpty'));
      return;
    }
    // Lines the AI could not read reliably must be corrected (or deleted) first.
    if (items.some((item) => item.needsReview)) {
      setError(t('receiptReview.fixHighlighted', 'Please check and save the highlighted items first.'));
      return;
    }
    if (grandTotal < 0) {
      setError(t('receiptReview.discountTooLarge', 'Discounts are larger than the items total.'));
      return;
    }
    setError(null);

    const proceed = () => router.push('/tabs/sessions/participants' as any);
    if (warnings.length > 0) {
      Alert.alert(
        t('receiptReview.reviewTitle', 'Please double-check'),
        warnings.join('\n\n'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('receiptReview.continueAnyway', 'Continue anyway'), onPress: proceed },
        ]
      );
      return;
    }
    proceed();
  };

  const skeletonRows = useMemo(
    () => Array.from({ length: 6 }, (_, index) => ({ id: `skeleton-${index}` })),
    []
  );

  const renderItem = ({ item }: { item: ReceiptSplitItem }) => (
    <ReceiptItemRow
      item={item}
      currency={currency}
      onChange={(nextItem) =>
        updateItem(item.id, (prev) => ({
          ...prev,
          ...nextItem,
          splitMode: defaultSplitMode(nextItem.quantity),
        }))
      }
      onDelete={() => removeItem(item.id)}
    />
  );

  return (
    <YStack f={1} bg="$background">
      <YStack px="$4" pt="$4" pb="$3" borderBottomWidth={1} borderBottomColor="$gray5" gap="$2">
        <XStack ai="center" jc="space-between">
          <XStack ai="center" gap="$2">
            <Pressable onPress={() => router.back()}>
              <ChevronLeft size={22} color="#2C3D4F" />
            </Pressable>
            <Text fontSize={18} fontWeight="700">{t('receiptReview.title')}</Text>
          </XStack>
          <Pressable onPress={() => setShowAddDialog(true)}>
            <XStack ai="center" gap="$1" px="$2" py="$1.5" bg="#2ECC711A" br={10}>
              <Plus size={16} color="#2ECC71" />
              <Text color="#2ECC71" fontSize={12} fontWeight="700">{t('receiptReview.manualAdd')}</Text>
            </XStack>
          </Pressable>
        </XStack>

        <Text fontSize={12} color="$gray10">
          {session?.sessionName || t('nav.receiptDefaultName', 'Receipt')}
        </Text>
      </YStack>

      {showSkeleton ? (
        <FlatList
          data={skeletonRows}
          keyExtractor={(item) => item.id}
          renderItem={() => <ReceiptItemSkeletonRow />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <YStack h={12} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => item.id || `item-${index}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.emptyListContent,
          ]}
          ItemSeparatorComponent={() => <YStack h={12} />}
          ListHeaderComponent={
            warnings.length > 0 ? (
              <YStack mb="$3" p="$3" br={12} bg="#FEF3C7" borderWidth={1} borderColor="#FCD34D" gap="$1">
                {warnings.map((warning, index) => (
                  <Text key={index} fontSize={12} color="#92400E">
                    {warning}
                  </Text>
                ))}
              </YStack>
            ) : null
          }
          ListFooterComponent={
            adjustments.length > 0 ? (
              <YStack mt="$3" gap="$2">
                <XStack ai="center" jc="space-between">
                  <Text fontSize={13} color="$gray10">{t('receiptReview.subtotal', 'Subtotal')}</Text>
                  <Text fontSize={13} color="$gray10">{fmtCurrency(itemsTotal)}</Text>
                </XStack>
                {adjustments.map((adj) => (
                  <XStack key={adj.id} ai="center" jc="space-between">
                    <Text fontSize={13} color="$gray11">
                      {adj.label}
                      {adj.includedInPrices ? ` (${t('receiptReview.includedInPrices', 'included in prices')})` : ''}
                    </Text>
                    <Text fontSize={13} color={adj.type === 'discount' ? '#16A34A' : '$gray11'}>
                      {adj.includedInPrices ? '' : adj.type === 'discount' ? '− ' : '+ '}
                      {fmtCurrency(adj.amount)}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            ) : null
          }
          ListEmptyComponent={
            <YStack ai="center" py="$8" gap="$2">
              <Text fontSize={14} color="$gray10">{t('receiptReview.noProductsTitle')}</Text>
              <Text fontSize={12} color="$gray10">{t('receiptReview.noProductsDesc')}</Text>
            </YStack>
          }
        />
      )}

      <YStack
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        p="$4"
        bg="$background"
        borderTopWidth={1}
        borderTopColor="$gray5"
        gap="$2"
      >
        {!!error && (
          <Text fontSize={12} color="#EF4444">{error}</Text>
        )}
        <XStack ai="center" jc="space-between">
          <Text fontSize={13} color="$gray10">{t('receiptReview.totalItems', { count: items.length }).replace('{{count}}', String(items.length))}</Text>
          <Text fontSize={18} fontWeight="700" color="#2ECC71">{fmtCurrency(grandTotal)}</Text>
        </XStack>
        <Button
          onPress={goNext}
          disabled={items.length === 0}
          bg="#2ECC71"
          color="white"
          h={48}
          icon={CheckCircle2}
        >
          {t('receiptReview.nextAssign', 'Next: Assign Items')}
        </Button>
      </YStack>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content gap="$3" p="$4" br={16}>
            <Dialog.Title>{t('receiptReview.manualProduct', 'Manual Product')}</Dialog.Title>
            <Input
              placeholder={t('receiptReview.productName')}
              value={draft.name}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, name: value }))}
            />
            <XStack gap="$2">
              <Input
                f={1}
                keyboardType="numeric"
                placeholder={t('receiptReview.price')}
                value={draft.unitPrice}
                onChangeText={(value) => setDraft((prev) => ({ ...prev, unitPrice: value }))}
              />
              <Input
                w={110}
                keyboardType="numeric"
                placeholder={t('receiptReview.qty')}
                value={draft.quantity}
                onChangeText={(value) => setDraft((prev) => ({ ...prev, quantity: value }))}
              />
            </XStack>
            {error && <Text color="#EF4444" fontSize={12}>{error}</Text>}
            <XStack gap="$2" jc="flex-end">
              <Button onPress={() => setShowAddDialog(false)} variant="outlined">
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onPress={addManualItem} bg="#2ECC71" color="white">
                {t('receiptReview.manualAdd')}
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </YStack>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
