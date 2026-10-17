import { create } from 'zustand';

import {
  SessionsHistoryApi,
  SessionHistoryEntry,
  SessionHistoryEntryRaw,
  SessionHistoryResponseRaw,
  SessionHistoryPayload,
} from '@/features/sessions/api/history.api';

type State = {
  sessions: SessionHistoryEntry[];
  count: number;
  limit?: number;
  loading: boolean;
  initialized: boolean;
  error?: string;
  lastFetchedAt?: number | null; // <= когда последний раз загрузили
};

type Actions = {
  fetchHistory: (limit?: number, all?: boolean) => Promise<SessionHistoryResponseRaw | undefined>;
  /** Принудительное обновление, игнорируя давность */
  forceRefresh: (limit?: number, all?: boolean) => Promise<SessionHistoryResponseRaw | undefined>;
  /** Обновить, только если данные «протухли» */
  refreshIfStale: (maxAgeMs?: number, limit?: number, all?: boolean) => Promise<void>;
  getSession: (sessionId: string | number) => SessionHistoryEntry | undefined;
  clearError: () => void;
  reset: () => void;
};

const initialState: State = {
  sessions: [],
  count: 0,
  limit: undefined,
  loading: false,
  initialized: false,
  error: undefined,
  lastFetchedAt: null,
};

const normalizeEntry = (raw: SessionHistoryEntryRaw): SessionHistoryEntry => {
  const rawAny = raw as any;
  const fallbackPayload: SessionHistoryPayload | undefined = rawAny.items || rawAny.participants
    ? {
        status: rawAny.status || 'finalized',
        totals: {
          byItem: (rawAny.items ?? []).map((item: any) => ({
            itemId: String(item.itemId ?? item.id),
            name: item.name || 'Item',
            total: Number(item.total ?? item.totalAmount ?? 0),
            kind: item.kind,
          })),
          grandTotal: Number(rawAny.grandTotal || 0),
          byParticipant: (rawAny.participants ?? []).map((participant: any) => ({
            uniqueId: participant.uniqueId,
            username: participant.username || participant.uniqueId,
            amountOwed: Number(participant.amountOwed ?? participant.total ?? 0),
            avatarUrl: participant.avatarUrl ?? null,
          })),
        },
        createdAt: rawAny.createdAt || rawAny.finalizedAt || new Date().toISOString(),
        finalizedAt: rawAny.finalizedAt,
        sessionId: Number(rawAny.sessionId || 0),
        sessionName: rawAny.sessionName,
        allocations: rawAny.allocations ?? [],
        currency: rawAny.currency,
        payer: rawAny.payer ?? null,
      }
    : undefined;
  const p: SessionHistoryPayload | undefined = raw.payload ?? fallbackPayload;

  const participants =
    p?.totals?.byParticipant?.map(bp => ({
      uniqueId: bp.uniqueId,
      username: bp.username,
      avatarUrl: bp.avatarUrl ?? null,
    })) ?? [];

  const finalizedAt = raw.finalizedAt || p?.finalizedAt;
  const createdAt = p?.createdAt;

  const grandTotal =
    typeof raw.grandTotal === 'number' ? raw.grandTotal : p?.totals?.grandTotal ?? 0;

  return {
    sessionId: raw.sessionId ?? p?.sessionId ?? 0,
    sessionName: raw.sessionName || p?.sessionName || 'Bill',
    finalizedAt,
    createdAt,
    grandTotal,
    currency: raw.currency || 'UNKNOWN',
    participantUniqueIds: (raw.participantUniqueIds && typeof raw.participantUniqueIds === 'string') 
      ? raw.participantUniqueIds 
      : (Array.isArray(raw.participantUniqueIds) ? raw.participantUniqueIds.join(',') : ''),
    totals: p?.totals,
    allocations: p?.allocations ?? [],
    participants,
    payer: p?.payer ?? null,
    isCreator: raw.isCreator,
    payload: p!,
  };
};

// Several screens (home, history list, detail, analytics, finalize) ask for history at the
// same time and all share this one list. Requests are coalesced here: an identical request
// that is already running is shared, a different one waits for it. Nothing is dropped, so a
// finalize-time refresh can no longer be silently lost while another fetch is in flight.
let inFlightHistory: { key: string; promise: Promise<SessionHistoryResponseRaw | undefined> } | null = null;
// After a failure the same request is not retried for a few seconds: screens re-run their
// fetch effect when `loading` flips back, which would otherwise hammer an unreachable server.
const RETRY_COOLDOWN_MS = 5000;
let lastFailure: { key: string; at: number } | null = null;

export const useSessionsHistoryStore = create<State & Actions>((set, get) => ({
  ...initialState,

  fetchHistory(requestedLimit, all = false) {
    // The shared list never shrinks: a screen that needs 10 items is served by a list that
    // was already loaded with 50, so screens no longer overwrite each other's limits.
    const effectiveLimit = Math.max(requestedLimit ?? 0, get().limit ?? 0) || undefined;
    const key = `${effectiveLimit ?? ''}|${all}`;
    if (inFlightHistory && inFlightHistory.key === key) return inFlightHistory.promise;
    if (lastFailure && lastFailure.key === key && Date.now() - lastFailure.at < RETRY_COOLDOWN_MS) {
      return Promise.resolve(undefined);
    }

    const run = async (): Promise<SessionHistoryResponseRaw | undefined> => {
      set({ loading: true, error: undefined });
      try {
        const response = await SessionsHistoryApi.listLatest({
          limit: effectiveLimit,
          all,
        });

        const normalized = (response.entries ?? []).map(normalizeEntry);

        set({
          sessions: normalized,
          count: response.count ?? 0,
          limit: Math.max(response.limit ?? 0, get().limit ?? 0),
          initialized: true,
          loading: false,
          lastFetchedAt: Date.now(),
        });
        lastFailure = null;

        return response;
      } catch (error: any) {
        const errorMessage =
          error?.message === 'Request cancelled'
            ? 'Request was cancelled'
            : error?.message ?? 'Failed to load sessions history';

        // Keep the previous limit: a failed request must not make screens think the
        // larger list was loaded.
        set({ error: errorMessage, initialized: true, loading: false });
        lastFailure = { key, at: Date.now() };
        return undefined;
      }
    };

    const previous = inFlightHistory?.promise ?? Promise.resolve(undefined);
    const promise: Promise<SessionHistoryResponseRaw | undefined> = previous.then(run, run).finally(() => {
      if (inFlightHistory?.promise === promise) inFlightHistory = null;
    });
    inFlightHistory = { key, promise };
    return promise;
  },

  async forceRefresh(limit, all = false) {
    // Explicit refresh (pull-to-refresh, after finalize) bypasses the retry cooldown.
    lastFailure = null;
    return get().fetchHistory(limit, all);
  },

  async refreshIfStale(maxAgeMs = 15_000, limit, all = false) {
    const { lastFetchedAt, initialized } = get();

    // если ни разу не грузили — грузим
    if (!initialized || !lastFetchedAt) {
      await get().fetchHistory(limit, all);
      return;
    }

    // если данных нет — грузим
    if (get().sessions.length === 0) {
      await get().fetchHistory(limit, all);
      return;
    }

    // если «протухли» — грузим
    const age = Date.now() - lastFetchedAt;
    if (age > maxAgeMs) {
      await get().fetchHistory(limit, all);
    }
  },

  getSession(sessionId) {
    const idNumber = typeof sessionId === 'number' ? sessionId : Number(sessionId);
    if (Number.isNaN(idNumber)) return undefined;
    return get().sessions.find(session => session.sessionId === idNumber);
  },

  clearError() {
    set({ error: undefined });
  },

  reset() {
    set(initialState);
  },
}));
