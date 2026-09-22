// app/splitter-dashboard.tsx — Receipt Splitter Dashboard
import React, { useCallback, useMemo } from 'react';
import { ScrollView, RefreshControl, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { YStack, XStack, Text, Card, Button, Separator, ScrollView as TamaguiScrollView } from 'tamagui';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Wallet,
  History as HistoryIcon,
  Plus,
  ChevronRight,
} from '@tamagui/lucide-icons';
import { useSplitterStore } from '@/shared/store/useSplitterStore';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Dashboard Screen - Summary and recent history of expense splitting
 */
export default function SplitterDashboard() {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  // Get store data
  const analytics = useSplitterStore((state) => state.analytics);
  const history = useSplitterStore((state) => state.history);
  const participants = useSplitterStore((state) => state.participants);

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return `$${amount.toFixed(2)}`;
  }, []);

  // Format date
  const formatDate = useCallback((date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // Get participant name by ID
  const getParticipantName = useCallback(
    (id: string) => {
      const participant = participants.find((p) => p.id === id);
      return participant?.name || 'Unknown';
    },
    [participants]
  );

  // Recent transactions (limit to 5)
  const recentTransactions = useMemo(() => {
    return history.slice(0, 5);
  }, [history]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <YStack padding="$4" gap="$4">
          {/* Header */}
          <YStack>
            <Text fontSize="$8" fontWeight="bold" color="#333">
              Splitter Dashboard
            </Text>
            <Text fontSize="$4" color="#999" marginTop="$2">
              Track your expenses and debts
            </Text>
          </YStack>

          {/* Summary Cards */}
          <YStack gap="$3">
            {/* Total Expenses Card */}
            <Card
              bordered
              padding="$4"
              backgroundColor="#fff"
              elevation="$2"
              borderColor="#e0e0e0"
            >
              <LinearGradient
                colors={['#f0f9ff', '#e0f2fe']}
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
              <XStack justifyContent="space-between" alignItems="center">
                <YStack gap="$2" flex={1}>
                  <XStack alignItems="center" gap="$2">
                    <BarChart3 size={24} color="#0284c7" />
                    <Text fontSize="$3" color="#666" fontWeight="500">
                      Total Expenses
                    </Text>
                  </XStack>
                  <Text fontSize="$7" fontWeight="bold" color="#0284c7">
                    {formatCurrency(analytics.totalExpenses)}
                  </Text>
                </YStack>
              </XStack>
            </Card>

            {/* Total Owed (To Receive) Card */}
            <Card
              bordered
              padding="$4"
              backgroundColor="#fff"
              elevation="$2"
              borderColor="#e0e0e0"
            >
              <LinearGradient
                colors={['#f0fdf4', '#e0f8f0']}
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
              <XStack justifyContent="space-between" alignItems="center">
                <YStack gap="$2" flex={1}>
                  <XStack alignItems="center" gap="$2">
                    <TrendingUp size={24} color="#16a34a" />
                    <Text fontSize="$3" color="#666" fontWeight="500">
                      Total Owed (To Receive)
                    </Text>
                  </XStack>
                  <Text fontSize="$7" fontWeight="bold" color="#16a34a">
                    {formatCurrency(analytics.totalOwed)}
                  </Text>
                </YStack>
              </XStack>
            </Card>

            {/* Total Debt (To Pay) Card */}
            <Card
              bordered
              padding="$4"
              backgroundColor="#fff"
              elevation="$2"
              borderColor="#e0e0e0"
            >
              <LinearGradient
                colors={['#fef2f2', '#fee2e2']}
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
              <XStack justifyContent="space-between" alignItems="center">
                <YStack gap="$2" flex={1}>
                  <XStack alignItems="center" gap="$2">
                    <TrendingDown size={24} color="#dc2626" />
                    <Text fontSize="$3" color="#666" fontWeight="500">
                      Total Debt (To Pay)
                    </Text>
                  </XStack>
                  <Text fontSize="$7" fontWeight="bold" color="#dc2626">
                    {formatCurrency(analytics.totalDebt)}
                  </Text>
                </YStack>
              </XStack>
            </Card>
          </YStack>

          <Separator />

          {/* Expenses by Category */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$5" fontWeight="bold" color="#333">
                Expenses by Category
              </Text>
            </XStack>

            <YStack gap="$2">
              {Object.entries(analytics.expensesByCategory).map(([category, amount]) => (
                <Card
                  key={category}
                  padding="$3"
                  backgroundColor="#fff"
                  borderColor="#e0e0e0"
                  bordered
                >
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize="$4" color="#666" fontWeight="500">
                      {category}
                    </Text>
                    <Text fontSize="$4" fontWeight="bold" color="#0284c7">
                      {formatCurrency(amount)}
                    </Text>
                  </XStack>
                </Card>
              ))}
            </YStack>
          </YStack>

          <Separator />

          {/* Recent History */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$5" fontWeight="bold" color="#333">
                Recent Transactions
              </Text>
              {history.length > 0 && (
                <Text fontSize="$3" color="#999">
                  {history.length} total
                </Text>
              )}
            </XStack>

            {recentTransactions.length > 0 ? (
              <YStack gap="$3">
                {recentTransactions.map((transaction) => (
                  <Card
                    key={transaction.id}
                    padding="$4"
                    backgroundColor="#fff"
                    borderColor="#e0e0e0"
                    bordered
                    borderRadius="$3"
                    elevation="$2"
                  >
                    <YStack gap="$3">
                      {/* Header - Merchant Name and Date */}
                      <XStack justifyContent="space-between" alignItems="flex-start">
                        <YStack flex={1} gap="$1">
                          <Text fontSize="$5" fontWeight="700" color="#1a1a1a">
                            {transaction.receipt.merchantName}
                          </Text>
                          <Text fontSize="$2" color="#666" fontWeight="400">
                            {formatDate(transaction.createdAt)}
                          </Text>
                        </YStack>
                        <YStack alignItems="flex-end" gap="$1">
                          <Text fontSize="$6" fontWeight="800" color="#0284c7">
                            {formatCurrency(transaction.receipt.totalAmount)}
                          </Text>
                          <Text fontSize="$2" color="#999">
                            Total
                          </Text>
                        </YStack>
                      </XStack>

                      {/* Who Paid Section */}
                      <YStack
                        gap="$2"
                        padding="$3"
                        backgroundColor="#f0fdf4"
                        borderRadius="$2"
                        borderColor="#dcfce7"
                        borderWidth={1}
                      >
                        <Text fontSize="$2" fontWeight="600" color="#666">
                          PAID BY
                        </Text>
                        <Text fontSize="$4" fontWeight="700" color="#16a34a">
                          {getParticipantName(transaction.receipt.payerId)}
                        </Text>
                      </YStack>

                      {/* Items List Section */}
                      {transaction.receipt.items.length > 0 && (
                        <YStack
                          gap="$2"
                          padding="$3"
                          backgroundColor="#f9fafb"
                          borderRadius="$2"
                          borderColor="#e5e7eb"
                          borderWidth={1}
                        >
                          <Text fontSize="$2" fontWeight="600" color="#666">
                            ITEMS ({transaction.receipt.items.length})
                          </Text>
                          <YStack gap="$2">
                            {transaction.receipt.items.map((item) => (
                              <XStack
                                key={item.id}
                                justifyContent="space-between"
                                alignItems="center"
                                paddingVertical="$2"
                                borderBottomColor="#e5e7eb"
                                borderBottomWidth={1}
                              >
                                <YStack flex={1} gap="$1">
                                  <Text fontSize="$3" color="#333" fontWeight="500">
                                    {item.name}
                                  </Text>
                                  <Text fontSize="$2" color="#999">
                                    {item.category}
                                  </Text>
                                </YStack>
                                <Text fontSize="$3" fontWeight="600" color="#374151">
                                  {formatCurrency(item.price)}
                                </Text>
                              </XStack>
                            ))}
                          </YStack>
                        </YStack>
                      )}

                      {/* Generated Debts Section */}
                      {transaction.generatedDebts.length > 0 && (
                        <YStack
                          gap="$2"
                          padding="$3"
                          backgroundColor="#fef2f2"
                          borderRadius="$2"
                          borderColor="#fee2e2"
                          borderWidth={1}
                        >
                          <Text fontSize="$2" fontWeight="600" color="#991b1b">
                            DEBTS CREATED ({transaction.generatedDebts.length})
                          </Text>
                          <YStack gap="$2">
                            {transaction.generatedDebts.map((debt) => (
                              <XStack
                                key={debt.id}
                                justifyContent="space-between"
                                alignItems="center"
                                paddingVertical="$2"
                                paddingHorizontal="$2"
                                backgroundColor="#fff"
                                borderRadius="$2"
                                borderColor="#fca5a5"
                                borderWidth={1}
                              >
                                <Text fontSize="$3" color="#333" flex={1} fontWeight="500">
                                  <Text color="#dc2626" fontWeight="700">
                                    {getParticipantName(debt.fromUserId)}
                                  </Text>
                                  <Text color="#666"> owes </Text>
                                  <Text color="#16a34a" fontWeight="700">
                                    {getParticipantName(debt.toUserId)}
                                  </Text>
                                </Text>
                                <Text fontSize="$4" fontWeight="700" color="#dc2626">
                                  {formatCurrency(debt.amount)}
                                </Text>
                              </XStack>
                            ))}
                          </YStack>
                        </YStack>
                      )}
                    </YStack>
                  </Card>
                ))}
              </YStack>
            ) : (
              <Card
                padding="$6"
                backgroundColor="#f9f9f9"
                borderColor="#e0e0e0"
                bordered
                alignItems="center"
              >
                <HistoryIcon size={48} color="#ccc" />
                <Text fontSize="$4" color="#999" marginTop="$2">
                  No transactions yet
                </Text>
              </Card>
            )}
          </YStack>

          {/* Action Button */}
          <Button
            size="$5"
            backgroundColor="#0284c7"
            color="#fff"
            marginTop="$4"
            onPress={() => router.push('/receipt-confirmation' as any)}
            icon={<Plus size={20} color="#fff" />}
          >
            <Text color="#fff" fontWeight="bold">
              Add Receipt
            </Text>
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
