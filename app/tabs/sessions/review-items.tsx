import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Input, Button, Dialog } from 'tamagui';
import { ChevronLeft, Plus, CheckCircle2 } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';

import {
  useReceiptSessionStore,
  type ReceiptSplitItem,
} from '@/features/receipt/model/receipt-session.store';
import { ReceiptItemRow, ReceiptItemSkeletonRow } from '@/features/receipt/ui/ReceiptItemRow';

type DraftItem = {
  name: string;
  unitPrice: string;
  quantity: string;
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

  const grandTotal = useMemo(
    () => items.reduce((acc, item) => acc + (item.totalPrice || item.unitPrice * item.quantity), 0),
    [items]
  );

  const fmtCurrency = (n: number) => `${currency} ${Math.round(n).toLocaleString('en-US')}`;

  const updateItem = (itemId: string, updater: (item: ReceiptSplitItem) => ReceiptSplitItem) => {
    setItems(items.map((item) => (item.id === itemId ? updater(item) : item)));
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  const addManualItem = () => {
    const name = draft.name.trim();
    const unitPrice = Number(draft.unitPrice);
    const quantity = Math.max(1, Number(draft.quantity));

    if (!name) {
      setError(t('receiptReview.errNameReq'));
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setError(t('receiptReview.errPriceReq'));
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
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
      splitMode: quantity > 1 ? 'count' : 'equal',
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

    // Navigate to the next screen (participants selection)
    router.push('/tabs/sessions/participants' as any);
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
          splitMode: nextItem.quantity > 1 ? 'count' : 'equal',
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
