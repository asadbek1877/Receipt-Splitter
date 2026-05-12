import { api } from '@/shared/api';

export interface AnalyticsData {
  totalSpent: number;
  totalSessions: number;
  averagePerSession: number;
  monthlyChart: Array<{
    month: string;
    total: number;
    sessions: number;
  }>;
  topParticipants: Array<{
    uniqueId: string;
    sessions: number;
  }>;
}

export interface UpdateAnalyticsPayload {
  totalSpent?: number;
  totalSessions?: number;
}

export const analyticsApi = {
  getAnalytics: async (): Promise<AnalyticsData> => {
    const response = await api.get('/analytics');
    return response.data;
  },

  updateAnalytics: async (payload: UpdateAnalyticsPayload): Promise<AnalyticsData> => {
    const response = await api.patch('/analytics', payload);
    return response.data;
  },
};