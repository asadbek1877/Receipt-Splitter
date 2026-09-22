import { apiClient } from '@/features/auth/api';
import { useSplitterStore } from '@/shared/store/useSplitterStore';
import { useAppStore } from '@/shared/lib/stores/app-store';
import type { Debt } from '@/entities/debt';

type Allocation = { userUniqueId: string; amount: number; description?: string };

const initialCategoryTotals = () => ({
  Food: 0,
  Drinks: 0,
  Shopping: 0,
  Transport: 0,
  Other: 0,
});

function normalizeCategoryLabel(category: unknown): string {
  const value = String(category || '').trim().toUpperCase();
  switch (value) {
    case 'FOOD':
      return 'Food';
    case 'DRINKS':
      return 'Drinks';
    case 'SHOPPING':
      return 'Shopping';
    case 'TRANSPORT':
      return 'Transport';
    case 'ENTERTAINMENT':
      return 'Entertainment';
    case 'UTILITIES':
      return 'Utilities';
    default:
      return 'Other';
  }
}

function inferCategoryFromName(name: unknown): string {
  const text = String(name || '').toLowerCase();
  if (/(coffee|tea|cola|juice|water|drink|latte|cappuccino|espresso|suv|ichimlik|choy|kofe|кофе|чай|напит|сок|морс)/i.test(text)) {
    return 'Drinks';
  }
  if (/(taxi|bus|metro|fuel|parking|transport|yo'l|йул|такси|бензин|транспорт)/i.test(text)) {
    return 'Transport';
  }
  if (/(shirt|shoe|clothes|market|shop|shopping|kiyim|магазин|одежд|обув)/i.test(text)) {
    return 'Shopping';
  }
  if (/(bread|rice|meat|chicken|beef|fish|salad|soup|pizza|burger|food|meal|osh|non|go'sht|ovqat|еда|хлеб|мясо|салат|суп|пицца|телятина|чорба|хлеб)/i.test(text)) {
    return 'Food';
  }
  return 'Other';
}

function normalizeDebtStatus(status: unknown): NonNullable<Debt['status']> {
  if (status === 'PAID') return 'PAID';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'ACTIVE';
}

export async function saveReceiptToServer(payload: {
  sessionId?: number;
  totalAmount: number;
  category?: string;
  description?: string;
  allocations: Allocation[];
}) {
  const { data } = await apiClient.post('/receipts', payload);
  return data;
}

export async function fetchAnalyticsFromServer() {
  const { data } = await apiClient.get('/analytics');
  return data;
}

export async function fetchDebtsFromServer() {
  const { data } = await apiClient.get('/debts');
  return data;
}

export async function markDebtAsPaid(debtId: string | number) {
  const { data } = await apiClient.patch(`/debts/${debtId}/pay`);
  return data;
}

export async function setDebtPaidStatus(debtId: string | number, isPaid: boolean) {
  const { data } = await apiClient.put(`/debts/${debtId}/status`, { isPaid });
  return data;
}

export async function updateDebtOnServer(
  debtId: string | number,
  payload: { amount: number; description?: string | null }
) {
  const { data } = await apiClient.put(`/debts/${debtId}`, payload);
  return data;
}

export async function fetchSessionsHistoryFromServer() {
  const { data } = await apiClient.get('/sessions/history', {
    params: { all: true, limit: 50 },
  });
  return data;
}

function buildAnalyticsFromHistory(history: any) {
  const expensesByCategory: Record<string, number> = initialCategoryTotals();
  let totalExpenses = 0;

  const entries = Array.isArray(history?.entries) ? history.entries : [];
  entries.forEach((entry: any) => {
    const payload = entry?.payload ?? entry;
    const items = payload?.totals?.byItem ?? entry?.items ?? [];
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item: any) => {
        const amount = Number(item.total ?? item.totalAmount ?? item.price ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        const category = normalizeCategoryLabel(item.category) || inferCategoryFromName(item.name);
        const finalCategory = category === 'Other' ? inferCategoryFromName(item.name) : category;
        expensesByCategory[finalCategory] = (expensesByCategory[finalCategory] || 0) + amount;
        totalExpenses += amount;
      });
      return;
    }

    const grandTotal = Number(entry?.grandTotal ?? payload?.totals?.grandTotal ?? 0);
    if (Number.isFinite(grandTotal) && grandTotal > 0) {
      expensesByCategory.Other = (expensesByCategory.Other || 0) + grandTotal;
      totalExpenses += grandTotal;
    }
  });

  return { totalExpenses, expensesByCategory };
}

/**
 * Helper to refresh local Zustand store from backend data
 */
export async function refreshSplitterStoreFromBackend() {
  const [analytics, debts, history] = await Promise.all([
    fetchAnalyticsFromServer(),
    fetchDebtsFromServer(),
    fetchSessionsHistoryFromServer().catch(() => null),
  ]);

  // Map analytics.byCategory -> useSplitterStore.analytics.expensesByCategory
  const store = useSplitterStore.getState();
  const currentUserId = useAppStore.getState().user?.uniqueId;
  const historyAnalytics = buildAnalyticsFromHistory(history);
  const serverTotalSpent = Number(analytics.totalSpent || 0);
  const shouldUseHistoryAnalytics = historyAnalytics.totalExpenses > serverTotalSpent;
  const mappedExpensesByCategory: any = shouldUseHistoryAnalytics
    ? { ...historyAnalytics.expensesByCategory }
    : { ...initialCategoryTotals() };

  if (!shouldUseHistoryAnalytics && Array.isArray(analytics.byCategory)) {
    analytics.byCategory.forEach((row: any) => {
      const category = normalizeCategoryLabel(row.category);
      mappedExpensesByCategory[category] = Number(row.total || 0);
    });
  }

  const owedList = Array.isArray(debts.owedList) ? debts.owedList : [];
  const iOweList = Array.isArray(debts.iOweList) ? debts.iOweList : [];
  const historyList = Array.isArray(debts.historyList) ? debts.historyList : [];
  const mappedDebts = [...owedList, ...iOweList, ...historyList].map((debt: any) => ({
    id: String(debt.id),
    ownerUserId: currentUserId,
    fromUserId: debt.debtor?.uniqueId ?? String(debt.debtorId ?? ''),
    toUserId: debt.creditor?.uniqueId ?? String(debt.creditorId ?? ''),
    amount: Number(debt.amount || 0),
    receiptId: String(debt.transaction?.sessionHistoryId ?? debt.transactionId ?? ''),
    description: debt.description ?? null,
    date: debt.createdAt ? new Date(debt.createdAt) : new Date(),
    status: normalizeDebtStatus(debt.status),
    paidAt: debt.settledAt ? new Date(debt.settledAt) : null,
  }));

  const totalOwed = Number(debts.totalOwed || 0);
  const totalIOwe = Number(debts.totalIOwe || 0);

  useSplitterStore.setState({
    analytics: {
      totalExpenses: shouldUseHistoryAnalytics ? historyAnalytics.totalExpenses : serverTotalSpent,
      totalOwed,
      totalDebt: totalOwed + totalIOwe,
      expensesByCategory: mappedExpensesByCategory,
    },
    debts: [
      ...mappedDebts,
      ...store.debts.filter((debt: any) => {
        if (!String(debt.id || '').startsWith('settlement-')) return false;
        if (!currentUserId) return false;
        return debt.ownerUserId === currentUserId;
      }),
    ],
  });
}
