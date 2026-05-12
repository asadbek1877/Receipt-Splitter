import { create } from 'zustand';
import { analyticsApi, AnalyticsData, UpdateAnalyticsPayload } from '../api/analytics-api';

interface AnalyticsState {
  data: AnalyticsData | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetchAnalytics: () => Promise<void>;
  updateAnalytics: (payload: UpdateAnalyticsPayload) => Promise<void>;
  setLocalData: (updates: Partial<AnalyticsData>) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  data: null,
  loading: false,
  saving: false,
  error: null,

  fetchAnalytics: async () => {
    set({ loading: true, error: null });
    try {
      const data = await analyticsApi.getAnalytics();
      set({ data, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to load analytics', loading: false });
    }
  },

  updateAnalytics: async (payload: UpdateAnalyticsPayload) => {
    set({ saving: true, error: null });
    try {
      const data = await analyticsApi.updateAnalytics(payload);
      set({ data, saving: false });
    } catch (error: any) {
      // При ошибке API - обновляем локально
      const current = get().data;
      if (current) {
        const totalSpent = payload.totalSpent ?? current.totalSpent;
        const totalSessions = payload.totalSessions ?? current.totalSessions;
        const averagePerSession = totalSessions > 0 ? totalSpent / totalSessions : 0;
        set({
          data: { ...current, totalSpent, totalSessions, averagePerSession },
          saving: false,
        });
      } else {
        set({ saving: false });
      }
    }
  },

  setLocalData: (updates: Partial<AnalyticsData>) => {
    const current = get().data;
    if (current) {
      const newData = { ...current, ...updates };
      // Пересчитываем среднее
      if (updates.totalSpent !== undefined || updates.totalSessions !== undefined) {
        newData.averagePerSession = newData.totalSessions > 0 
          ? newData.totalSpent / newData.totalSessions 
          : 0;
      }
      set({ data: newData });
    }
  },
}));