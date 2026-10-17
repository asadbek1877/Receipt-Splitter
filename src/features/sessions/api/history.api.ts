import { apiClient } from '@/features/auth/api';

/** Totals: по товарам */
export type SessionHistoryTotalsByItem = {
  kind?: string;
  name: string;
  total: number;
  itemId: string;
  id?: string;
  totalAmount?: number;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  splitMode?: 'equal' | 'count' | string;
};

/** Totals: по участникам */
export type SessionHistoryTotalsByParticipant = {
  uniqueId: string;
  username: string;
  amountOwed: number;
  avatarUrl?: string | null;
};

/** Аллокации — доли товара по участникам */
export type SessionHistoryAllocation = {
  itemId: string;
  shareRatio?: number;
  shareAmount: number;
  shareUnits?: number | null;
  participantId: string; // это uniqueId участника
};

/** Карточка товара (для справки) */
export type SessionHistoryItem = {
  itemId: string;
  name: string;
  total: number;
};

/** Упакованный пэйлоуд от бэка (внутри entries[n].payload) */
export type SessionHistoryPayload = {
  status: 'finalized' | 'draft' | string;
  totals: {
    byItem: SessionHistoryTotalsByItem[];
    grandTotal: number;
    byParticipant: SessionHistoryTotalsByParticipant[];
  };
  createdAt: string; // ISO
  sessionId: number;
  allocations: SessionHistoryAllocation[];
  payer?: {
    id?: number;
    uniqueId?: string;
    username?: string;
  } | null;
  currency?: string;
  finalizedAt?: string;
  sessionName?: string;
};

/** Сырая запись, как приходит с сервера */
export interface SessionHistoryEntryRaw {
  sessionId: number;
  sessionName: string;
  finalizedAt: string;
  grandTotal: number;
  currency: string;
  participantUniqueIds: string;
  isCreator: boolean;
  payload: SessionHistoryPayload;
}

/** Облегчённый вид участника для UI */
export type SessionHistoryParticipantLight = {
  uniqueId: string;
  username: string;
  avatarUrl?: string | null;
};

/** Нормализованная запись для UI */
export interface SessionHistoryEntry {
  sessionId: number;
  sessionName: string;
  finalizedAt?: string;
  createdAt?: string;
  grandTotal: number;
  currency: string;

  participantUniqueIds: string;

  totals?: SessionHistoryPayload['totals'];
  allocations?: SessionHistoryAllocation[];
  participants?: SessionHistoryParticipantLight[];
  payer?: SessionHistoryPayload['payer'];

  isCreator: boolean;
  payload: SessionHistoryPayload;
}

/** Сырой ответ всего списка */
export interface SessionHistoryResponseRaw {
  scope: 'latest';
  count: number;
  limit: number;
  entries: SessionHistoryEntryRaw[];
}

const HISTORY_ENDPOINT = '/sessions/history';
// The backend rejects limit > 50 with HTTP 400 (GET /sessions/history), so never ask for more.
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 5;

let currentRequest: AbortController | null = null;

/** ===== Debug helpers ===== */
const DEBUG_HISTORY =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  process.env.EXPO_PUBLIC_DEBUG_HISTORY === '1' ||
  process.env.NODE_ENV === 'development';

const safeStringify = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    // на всякий случай, если будут циклы
    return String(obj);
  }
};

const logReq = (msg: string, extra?: any) => {
  if (!DEBUG_HISTORY) return;
  // eslint-disable-next-line no-console
  console.log(`HISTORY ⟶ ${msg}`, extra ? `\n${safeStringify(extra)}` : '');
};

// Summary only: stringifying the whole history (up to 50 full payloads) on every fetch
// blocked the JS thread and flooded the Metro log.
const logRes = (msg: string, data?: any) => {
  if (!DEBUG_HISTORY) return;
  // eslint-disable-next-line no-console
  console.log(`HISTORY ⟵ ${msg}`, data ? { count: data?.count, limit: data?.limit, scope: data?.scope } : '');
};

const logErr = (msg: string, error: any) => {
  if (!DEBUG_HISTORY) return;
  // eslint-disable-next-line no-console
  console.log(`HISTORY ✖ ${msg}`, `\n${safeStringify(error)}`);
};
/** ========================= */

export const SessionsHistoryApi = {
  /**
   * Получить историю сессий (сырой ответ от сервера)
   */
  async listLatest(options?: {
    limit?: number;
    all?: boolean;
  }): Promise<SessionHistoryResponseRaw> {
    // Callers are serialized by the history store, so requests never overlap here and
    // nothing needs to be rejected or aborted.
    const all = options?.all ?? false;
    const limit = options?.limit;

    const finalLimit =
      typeof limit === 'number' && Number.isFinite(limit)
        ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)))
        : DEFAULT_LIMIT;

    currentRequest = new AbortController();

    const reqMeta = {
      url: HISTORY_ENDPOINT,
      params: { all, limit: finalLimit },
      headers: { Accept: 'application/json' as const },
    };

    logReq('GET /sessions/history (params, headers)', reqMeta);

    try {
      const { data } = await apiClient.get<SessionHistoryResponseRaw>(HISTORY_ENDPOINT, {
        params: reqMeta.params,
        headers: reqMeta.headers,
        signal: currentRequest.signal,
      });

      // ПОЛНЫЙ ЛОГ ОТВЕТА СЕРВЕРА
      logRes('response from /sessions/history', data);

      return data;
    } catch (error: any) {
      // Полный лог ошибки (включая Axios поля, если есть)
      logErr('error from /sessions/history', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        responseData: error?.response?.data,
      });

      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        throw new Error('Request cancelled');
      }
      throw error;
    } finally {
      currentRequest = null;
    }
  },

  isRequestInProgress(): boolean {
    return currentRequest !== null;
  },

  cancelCurrentRequest(): void {
    if (currentRequest) {
      currentRequest.abort();
      currentRequest = null;
      logReq('cancelCurrentRequest() called');
    }
  },
};
