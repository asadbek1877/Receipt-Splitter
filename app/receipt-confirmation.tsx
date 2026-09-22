// app/receipt-confirmation.tsx — Receipt Confirmation & Review
import React, { useCallback, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Alert,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  YStack,
  XStack,
  Text,
  Card,
  Button,
  Select,
  Separator,
  Spinner,
} from 'tamagui';
import {
  ChevronLeft,
  Check,
  AlertCircle,
  Users as UsersIcon,
  DollarSign,
} from '@tamagui/lucide-icons';
import { useSplitterStore } from '@/shared/store/useSplitterStore';
import type { Receipt, ReceiptItem } from '@/entities';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { saveReceiptToServer, refreshSplitterStoreFromBackend } from '@/features/receipt/api/receipts.api';

/**
 * Receipt Confirmation Screen
 * Review scanned receipt data and confirm before processing
 */
export default function ReceiptConfirmation() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Get store actions and state
  const processReceipt = useSplitterStore((state) => state.processReceipt);
  const participants = useSplitterStore((state) => state.participants);

  // Parse receipt data from route params
  // In a real app, you'd pass this from OCR processing
  const mockReceiptData: Receipt = {
    id: params.receiptId?.toString() || `receipt-${Date.now()}`,
    merchantName: params.merchantName?.toString() || 'Sample Restaurant',
    totalAmount: parseFloat(params.totalAmount?.toString() || '50.00'),
    date: new Date(params.date?.toString() || Date.now()),
    payerId: params.payerId?.toString() || '',
    participantIds: (params.participantIds as string)?.split(',') || [],
    items: (params.items as any) || [
      {
        id: 'item-1',
        name: 'Pasta',
        price: 15.0,
        category: 'Food' as const,
        assignedToIds: ['user-1', 'user-2'],
      },
      {
        id: 'item-2',
        name: 'Drink',
        price: 10.0,
        category: 'Drinks' as const,
        assignedToIds: ['user-1'],
      },
      {
        id: 'item-3',
        name: 'Salad',
        price: 12.0,
        category: 'Food' as const,
        assignedToIds: ['user-2', 'user-3'],
      },
      {
        id: 'item-4',
        name: 'Coffee',
        price: 5.0,
        category: 'Drinks' as const,
        assignedToIds: ['user-3'],
      },
    ],
  };

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return `$${amount.toFixed(2)}`;
  }, []);

  // Get participant name
  const getParticipantName = useCallback(
    (id: string) => {
      const participant = participants.find((p) => p.id === id);
      return participant?.name || `User ${id}`;
    },
    [participants]
  );

  // Validate form
  const isValid = useMemo(() => {
    return selectedPayerId.length > 0 && mockReceiptData.items.length > 0;
  }, [selectedPayerId, mockReceiptData.items.length]);

  // Calculate per-person split for preview
  const calculateSplit = useCallback(
    (item: ReceiptItem) => {
      return item.price / item.assignedToIds.length;
    },
    []
  );

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!isValid) {
      Alert.alert(t('receiptConfirmation.invalidTitle'), t('receiptConfirmation.selectPayer'));
      return;
    }

    setIsProcessing(true);

    try {
      // Create receipt with selected payer
      const receiptData: Receipt = {
        ...mockReceiptData,
        payerId: selectedPayerId,
      };

      // Process locally (Zustand) for immediate UI responsiveness
      processReceipt(receiptData);

      // Prepare allocations for backend (who owes how much)
      const allocationMap: Record<string, number> = {};
      receiptData.items.forEach((it) => {
        const perPerson = (it.price || 0) / (it.assignedToIds?.length || 1);
        (it.assignedToIds || []).forEach((uid) => {
          if (uid === receiptData.payerId) return; // payer does not owe themselves
          allocationMap[uid] = (allocationMap[uid] || 0) + perPerson;
        });
      });

      const allocations = Object.entries(allocationMap).map(([userUniqueId, amount]) => ({ userUniqueId, amount }));

      // Send to backend and refresh analytics/debts UI
      try {
        await saveReceiptToServer({
          sessionId: undefined,
          totalAmount: receiptData.totalAmount,
          category: 'OTHER',
          description: receiptData.merchantName,
          allocations,
        });

        // Refresh analytics and debts from server into local store
        await refreshSplitterStoreFromBackend();
      } catch (err) {
        console.warn('Failed to sync with server, continuing locally', err);
      }

      // Show success message
      if (Platform.OS === 'android') {
        ToastAndroid.show(t('receiptConfirmation.saved'), ToastAndroid.SHORT);
      } else {
        Alert.alert(t('common.success'), t('receiptConfirmation.saved'));
      }

      // Navigate back to tabs
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Error processing receipt:', error);
      Alert.alert(t('common.error'), t('receiptConfirmation.processFailed'));
    } finally {
      setIsProcessing(false);
    }
  }, [isValid, selectedPayerId, mockReceiptData, processReceipt, router, t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView>
        <YStack padding="$4" gap="$4">
          {/* Header */}
          <XStack alignItems="center" gap="$3">
            <Button
              size="$3"
              circular
              icon={<ChevronLeft size={24} />}
              backgroundColor="transparent"
              onPress={() => router.back()}
            />
            <YStack flex={1}>
              <Text fontSize="$6" fontWeight="bold" color="#333">
                {t('receiptConfirmation.title')}
              </Text>
              <Text fontSize="$3" color="#999">
                {t('receiptConfirmation.subtitle')}
              </Text>
            </YStack>
          </XStack>

          {/* Receipt Details Card */}
          <Card
            bordered
            padding="$4"
            backgroundColor="#fff"
            elevation="$2"
            borderColor="#e0e0e0"
          >
            <LinearGradient
              colors={['#faf9f7', '#f3f1ef']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                borderRadius: 8,
                opacity: 0.3,
              }}
            />

            <YStack gap="$3">
              <YStack gap="$2">
                <Text fontSize="$5" fontWeight="bold" color="#333">
                  {mockReceiptData.merchantName}
                </Text>
                <Text fontSize="$3" color="#999">
                  {new Date(mockReceiptData.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </YStack>

              <Separator />

              <YStack gap="$2">
                <Text fontSize="$4" fontWeight="bold" color="#666">
                  {t('receiptConfirmation.itemsCount', { count: mockReceiptData.items.length })}
                </Text>

                {mockReceiptData.items.map((item: ReceiptItem) => (
                  <Card
                    key={item.id}
                    padding="$3"
                    backgroundColor="#fafafa"
                    borderColor="#f0f0f0"
                    bordered
                  >
                    <YStack gap="$2">
                      <XStack justifyContent="space-between" alignItems="flex-start">
                        <YStack flex={1} gap="$1">
                          <Text fontSize="$4" fontWeight="600" color="#333">
                            {item.name}
                          </Text>
                          <Text fontSize="$2" color="#999">
                            {item.category}
                          </Text>
                        </YStack>
                        <Text fontSize="$4" fontWeight="bold" color="#0284c7">
                          {formatCurrency(item.price)}
                        </Text>
                      </XStack>

                      <YStack gap="$1" paddingTop="$2" borderTopColor="#e0e0e0" borderTopWidth={1}>
                        <Text fontSize="$3" color="#666">
                          {t('receiptConfirmation.splitAmong', { count: item.assignedToIds.length })}
                        </Text>
                        <YStack gap="$1" paddingLeft="$2">
                          {item.assignedToIds.map((userId: string) => (
                            <XStack
                              key={userId}
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Text fontSize="$3" color="#666">
                                • {getParticipantName(userId)}
                              </Text>
                              <Text fontSize="$3" fontWeight="500" color="#999">
                                {formatCurrency(calculateSplit(item))}
                              </Text>
                            </XStack>
                          ))}
                        </YStack>
                      </YStack>
                    </YStack>
                  </Card>
                ))}
              </YStack>

              <Separator />

              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$5" fontWeight="bold" color="#333">
                  {t('quickSplit.totalAmount')}
                </Text>
                <Text fontSize="$6" fontWeight="bold" color="#0284c7">
                  {formatCurrency(mockReceiptData.totalAmount)}
                </Text>
              </XStack>
            </YStack>
          </Card>

          {/* Select Payer */}
          <YStack gap="$3">
            <YStack gap="$2">
              <XStack alignItems="center" gap="$2">
                <UsersIcon size={20} color="#0284c7" />
                <Text fontSize="$4" fontWeight="bold" color="#333">
                  {t('receiptConfirmation.whoPaid')}
                </Text>
              </XStack>
              <Text fontSize="$3" color="#999">
                {t('receiptConfirmation.selectPayerHint')}
              </Text>
            </YStack>

            {participants.length > 0 ? (
              <YStack gap="$2">
                {participants.map((participant) => (
                  <Button
                    key={participant.id}
                    size="$4"
                    padding="$3"
                    backgroundColor={
                      selectedPayerId === participant.id ? '#0284c7' : '#f5f5f5'
                    }
                    borderColor={selectedPayerId === participant.id ? '#0284c7' : '#e0e0e0'}
                    borderWidth={1}
                    onPress={() => setSelectedPayerId(participant.id)}
                  >
                    <XStack
                      justifyContent="space-between"
                      alignItems="center"
                      width="100%"
                    >
                      <Text
                        color={selectedPayerId === participant.id ? '#fff' : '#333'}
                        fontWeight="500"
                      >
                        {participant.name}
                      </Text>
                      {selectedPayerId === participant.id && (
                        <Check size={20} color="#fff" />
                      )}
                    </XStack>
                  </Button>
                ))}
              </YStack>
            ) : (
              <Card
                padding="$4"
                backgroundColor="#fff3cd"
                borderColor="#ffeaa7"
                bordered
              >
                <XStack gap="$2" alignItems="flex-start">
                  <AlertCircle size={20} color="#ff6b6b" marginTop="$1" />
                  <YStack flex={1}>
                    <Text fontSize="$3" fontWeight="600" color="#333">
                      {t('receiptConfirmation.noParticipants')}
                    </Text>
                    <Text fontSize="$2" color="#666" marginTop="$1">
                      {t('receiptConfirmation.noParticipantsHint')}
                    </Text>
                  </YStack>
                </XStack>
              </Card>
            )}
          </YStack>

          {/* Action Buttons */}
          <YStack gap="$2" marginTop="$4">
            <Button
              size="$5"
              backgroundColor="#0284c7"
              color="#fff"
              disabled={!isValid || isProcessing}
              onPress={handleConfirm}
              icon={isProcessing ? <Spinner color="#fff" /> : <Check size={20} />}
            >
              <Text color="#fff" fontWeight="bold">
                {isProcessing ? t('receiptConfirmation.processing') : t('receiptConfirmation.confirmSave')}
              </Text>
            </Button>

            <Button
              size="$5"
              backgroundColor="#f5f5f5"
              color="#333"
              borderWidth={1}
              borderColor="#e0e0e0"
              onPress={() => router.back()}
              disabled={isProcessing}
            >
              <Text color="#333" fontWeight="bold">
                {t('common.cancel')}
              </Text>
            </Button>
          </YStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
