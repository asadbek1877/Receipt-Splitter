// src/features/debts/model/debts.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Debt = {
  id: string;
  personName: string;
  amount: number;
  currency: string;
  type: 'owe' | 'owed'; // 'owe' = I owe them, 'owed' = they owe me
  description?: string;
  createdAt: string;
  dueDate?: string;
  isPaid: boolean;
  paidAt?: string;
};

type State = {
  debts: Debt[];
};

type Actions = {
  addDebt: (debt: Omit<Debt, 'id' | 'createdAt' | 'isPaid'>) => void;
  updateDebt: (id: string, updates: Partial<Debt>) => void;
  markAsPaid: (id: string) => void;
  markAsUnpaid: (id: string) => void;
  deleteDebt: (id: string) => void;
  clearAll: () => void;
  getTotalOwed: () => number; // Money others owe me
  getTotalOwe: () => number; // Money I owe others
  getBalance: () => number; // Net balance (positive = I'm owed, negative = I owe)
};

export const useDebtsStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      debts: [],

      addDebt(debt) {
        const newDebt: Debt = {
          ...debt,
          id: `debt#${Date.now()}`,
          createdAt: new Date().toISOString(),
          isPaid: false,
        };
        set({ debts: [...get().debts, newDebt] });
      },

      updateDebt(id, updates) {
        set({
          debts: get().debts.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        });
      },

      markAsPaid(id) {
        set({
          debts: get().debts.map((d) =>
            d.id === id ? { ...d, isPaid: true, paidAt: new Date().toISOString() } : d
          ),
        });
      },

      markAsUnpaid(id) {
        set({
          debts: get().debts.map((d) =>
            d.id === id ? { ...d, isPaid: false, paidAt: undefined } : d
          ),
        });
      },

      deleteDebt(id) {
        set({ debts: get().debts.filter((d) => d.id !== id) });
      },

      clearAll() {
        set({ debts: [] });
      },

      getTotalOwed() {
        return get()
          .debts.filter((d) => d.type === 'owed' && !d.isPaid)
          .reduce((sum, d) => sum + d.amount, 0);
      },

      getTotalOwe() {
        return get()
          .debts.filter((d) => d.type === 'owe' && !d.isPaid)
          .reduce((sum, d) => sum + d.amount, 0);
      },

      getBalance() {
        return get().getTotalOwed() - get().getTotalOwe();
      },
    }),
    {
      name: 'debts-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
