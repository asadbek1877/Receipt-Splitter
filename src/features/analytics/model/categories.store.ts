// src/features/analytics/model/categories.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Category {
  id: string;
  name: string;
  nameUz: string;
  amount: number;
  color: string;
  icon: string;
}

// Default categories
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food & Restaurants', nameUz: 'Ovqat & Restoranlar', amount: 0, color: '#e74c3c', icon: '🍕' },
  { id: 'drinks', name: 'Drinks & Beverages', nameUz: 'Ichimliklar', amount: 0, color: '#3498db', icon: '🥤' },
  { id: 'entertainment', name: 'Entertainment', nameUz: "Ko'ngil ochar", amount: 0, color: '#e91e63', icon: '🎬' },
  { id: 'transport', name: 'Transport', nameUz: 'Transport', amount: 0, color: '#9b59b6', icon: '🚗' },
  { id: 'shopping', name: 'Shopping', nameUz: 'Xarid', amount: 0, color: '#f39c12', icon: '🛍️' },
  { id: 'groceries', name: 'Groceries', nameUz: 'Oziq-ovqat', amount: 0, color: '#2ECC71', icon: '🛒' },
  { id: 'utilities', name: 'Utilities', nameUz: 'Kommunal', amount: 0, color: '#1abc9c', icon: '💡' },
  { id: 'health', name: 'Health', nameUz: "Sog'liq", amount: 0, color: '#00bcd4', icon: '💊' },
  { id: 'other', name: 'Other', nameUz: 'Boshqa', amount: 0, color: '#607d8b', icon: '📦' },
];

interface CategoriesState {
  categories: Category[];
  totalBudget: number;
  
  // Actions
  updateCategoryAmount: (id: string, amount: number) => void;
  setTotalBudget: (total: number) => void;
  distributeBudget: (total: number) => void;
  resetCategories: () => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  removeCategory: (id: string) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  getTotalAmount: () => number;
}

export const useCategoriesStore = create<CategoriesState>()(
  persist(
    (set, get) => ({
      categories: DEFAULT_CATEGORIES,
      totalBudget: 0,

      updateCategoryAmount(id, amount) {
        set({
          categories: get().categories.map((cat) =>
            cat.id === id ? { ...cat, amount: Math.max(0, amount) } : cat
          ),
        });
      },

      setTotalBudget(total) {
        set({ totalBudget: Math.max(0, total) });
      },

      distributeBudget(total) {
        const categories = get().categories;
        const currentTotal = categories.reduce((sum, c) => sum + c.amount, 0);
        
        if (currentTotal === 0) {
          // Equal distribution if no amounts set
          const perCategory = Math.floor(total / categories.length);
          set({
            totalBudget: total,
            categories: categories.map((cat, idx) => ({
              ...cat,
              amount: idx === categories.length - 1 
                ? total - perCategory * (categories.length - 1)
                : perCategory,
            })),
          });
        } else {
          // Proportional distribution based on current amounts
          const ratio = total / currentTotal;
          set({
            totalBudget: total,
            categories: categories.map((cat) => ({
              ...cat,
              amount: Math.round(cat.amount * ratio),
            })),
          });
        }
      },

      resetCategories() {
        set({ categories: DEFAULT_CATEGORIES, totalBudget: 0 });
      },

      addCategory(category) {
        const id = `cat_${Date.now()}`;
        set({
          categories: [...get().categories, { ...category, id }],
        });
      },

      removeCategory(id) {
        set({
          categories: get().categories.filter((cat) => cat.id !== id),
        });
      },

      updateCategory(id, updates) {
        set({
          categories: get().categories.map((cat) =>
            cat.id === id ? { ...cat, ...updates } : cat
          ),
        });
      },

      getTotalAmount() {
        return get().categories.reduce((sum, cat) => sum + cat.amount, 0);
      },
    }),
    {
      name: 'splitter-categories',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
