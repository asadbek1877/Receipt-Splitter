import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from '@/shared/lib/utils/uuid';
import type {
  Participant,
  Receipt,
  ExpenseCategory,
} from '../../entities';
import type { Debt } from '../../entities/debt';
import type { AnalyticsSummary } from '../../entities/analytics';
import type { HistoryTransaction } from '../../entities/history';

/**
 * App store state interface
 */
interface AppState {
  participants: Participant[];
  receipts: Receipt[];
  debts: Debt[];
  history: HistoryTransaction[];
  analytics: AnalyticsSummary;
}

/**
 * App store actions interface
 */
interface AppActions {
  processReceipt: (receipt: Receipt) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  clearHistory: () => void;
  resetStore: () => void;
}

/**
 * Initial analytics state
 */
const initialAnalytics: AnalyticsSummary = {
  totalExpenses: 0,
  totalOwed: 0,
  totalDebt: 0,
  expensesByCategory: {
    Food: 0,
    Drinks: 0,
    Shopping: 0,
    Transport: 0,
    Other: 0,
  },
};

/**
 * Initial app state
 */
const initialState: AppState = {
  participants: [],
  receipts: [],
  debts: [],
  history: [],
  analytics: { ...initialAnalytics },
};

/**
 * Zustand store for managing app state and actions
 * Includes persistence via AsyncStorage
 */
export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set) => ({
      ...initialState,

      /**
       * Process a receipt and automatically generate debts
       * Performs the following:
       * 1. Divides each item price by the number of assigned participants
       * 2. Creates debts for each non-payer participant
       * 3. Consolidates multiple debts from the same receipt into one
       * 4. Updates analytics with expenses and debts
       * 5. Creates a history transaction record
       */
      processReceipt: (receipt: Receipt) =>
        set((state) => {
          // Map to consolidate debts per user (fromUserId -> amount)
          const debtMap = new Map<string, number>();

          // Process each item in the receipt
          receipt.items.forEach((item) => {
            const splitAmount = item.price / item.assignedToIds.length;

            // For each person assigned to this item
            item.assignedToIds.forEach((participantId: string) => {
              // Skip if this person is the payer
              if (participantId === receipt.payerId) {
                return;
              }

              // Accumulate debt for this participant
              const currentDebt = debtMap.get(participantId) || 0;
              debtMap.set(participantId, currentDebt + splitAmount);
            });

            // Update analytics: add item price to its category
            const category: ExpenseCategory = item.category;
            state.analytics.expensesByCategory[category] =
              (state.analytics.expensesByCategory[category] || 0) + item.price;
          });

          // Create consolidated Debt objects from the debtMap
          const generatedDebts: Debt[] = Array.from(debtMap.entries()).map(
            ([fromUserId, amount]) => ({
              id: uuid(),
              fromUserId,
              toUserId: receipt.payerId,
              amount,
              receiptId: receipt.id,
              date: new Date(),
            })
          );

          // Calculate total owed from all generated debts
          const totalOwedAmount = generatedDebts.reduce(
            (sum, debt) => sum + debt.amount,
            0
          );

          // Create history transaction record
          const historyTransaction: HistoryTransaction = {
            id: uuid(),
            receipt,
            generatedDebts,
            createdAt: new Date(),
          };

          // Update analytics
          const updatedAnalytics: AnalyticsSummary = {
            ...state.analytics,
            totalExpenses: state.analytics.totalExpenses + receipt.totalAmount,
            totalOwed: state.analytics.totalOwed + totalOwedAmount,
            totalDebt: state.analytics.totalDebt + totalOwedAmount,
          };

          // Return updated state
          return {
            receipts: [...state.receipts, receipt],
            debts: [...state.debts, ...generatedDebts],
            history: [historyTransaction, ...state.history],
            analytics: updatedAnalytics,
          };
        }),

      /**
       * Add a participant to the store
       */
      addParticipant: (participant: Participant) =>
        set((state) => ({
          participants: [...state.participants, participant],
        })),

      /**
       * Remove a participant from the store
       */
      removeParticipant: (participantId: string) =>
        set((state) => ({
          participants: state.participants.filter((p) => p.id !== participantId),
        })),

      /**
       * Clear all history transactions
       */
      clearHistory: () =>
        set(() => ({
          history: [],
        })),

      /**
       * Reset the entire store to initial state
       */
      resetStore: () =>
        set(() => ({
          ...initialState,
          analytics: { ...initialAnalytics },
        })),
    }),
    {
      name: 'receipt-splitter-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
