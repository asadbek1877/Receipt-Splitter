// src/shared/lib/stores/currency-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CurrencyRates {
  [code: string]: number;
}

interface CurrencyState {
  rates: CurrencyRates;
  lastUpdated: number | null;
  source: string;
  loading: boolean;
  error: string | null;
}

interface CurrencyActions {
  fetchRates: () => Promise<void>;
  shouldUpdate: () => boolean;
  getRateToUSD: (code: string) => number;
}

const DEFAULT_RATES: CurrencyRates = {
  USD: 1,
  UZS: 12750,
  EUR: 0.92,
  RUB: 89,
  KZT: 480,
  GBP: 0.79,
  TRY: 32,
  CNY: 7.25,
};

// 12 hours in milliseconds
const UPDATE_INTERVAL = 12 * 60 * 60 * 1000;

export const useCurrencyStore = create<CurrencyState & CurrencyActions>()(
  persist(
    (set, get) => ({
      rates: DEFAULT_RATES,
      lastUpdated: null,
      source: 'Default rates',
      loading: false,
      error: null,

      shouldUpdate: () => {
        const { lastUpdated } = get();
        if (!lastUpdated) return true;
        const age = Date.now() - lastUpdated;
        return age > UPDATE_INTERVAL;
      },

      fetchRates: async () => {
        const { loading, shouldUpdate } = get();
        
        // Don't fetch if already loading
        if (loading) return;
        
        // Don't fetch if recently updated
        if (!shouldUpdate()) return;

        set({ loading: true, error: null });

        try {
          // Using exchangerate-api.com (free tier)
          // Alternative: frankfurter.app, open.er-api.com
          const response = await fetch(
            'https://api.exchangerate-api.com/v4/latest/USD',
            { 
              method: 'GET',
              headers: { 'Accept': 'application/json' },
            }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch rates');
          }

          const data = await response.json();
          
          if (data && data.rates) {
            const newRates: CurrencyRates = {
              USD: 1,
              UZS: data.rates.UZS || DEFAULT_RATES.UZS,
              EUR: data.rates.EUR || DEFAULT_RATES.EUR,
              RUB: data.rates.RUB || DEFAULT_RATES.RUB,
              KZT: data.rates.KZT || DEFAULT_RATES.KZT,
              GBP: data.rates.GBP || DEFAULT_RATES.GBP,
              TRY: data.rates.TRY || DEFAULT_RATES.TRY,
              CNY: data.rates.CNY || DEFAULT_RATES.CNY,
            };

            set({
              rates: newRates,
              lastUpdated: Date.now(),
              source: 'ExchangeRate-API',
              loading: false,
              error: null,
            });
          } else {
            throw new Error('Invalid response format');
          }
        } catch (error: any) {
          // Silently fail, keep existing rates
          set({
            loading: false,
            error: null, // Don't show error to user
          });
        }
      },

      getRateToUSD: (code: string) => {
        const { rates } = get();
        return rates[code] || 1;
      },
    }),
    {
      name: 'currency-rates-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        rates: state.rates,
        lastUpdated: state.lastUpdated,
        source: state.source,
      }),
    }
  )
);

// Helper to format last updated time
export function formatLastUpdated(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}
