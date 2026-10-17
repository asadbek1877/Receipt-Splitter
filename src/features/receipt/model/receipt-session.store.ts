import { create } from 'zustand';
import type {
  FinalizeReceiptResponse,
  FinalizeReceiptItemPayload,
  FinalizeTotalsByItem,
  FinalizeTotalsByParticipant,
  ParseReceiptRequest,
  ParseReceiptResponse,
  ReceiptParticipant,
  ReceiptSummary,
  ReceiptSplitMode,
  ReceiptAllocation,
} from '@/features/receipt/api/receipt.api';
import { ReceiptApi } from '@/features/receipt/api/receipt.api';
import { v4 as uuid } from 'uuid';

export type CapturedReceiptImage = {
  uri?: string;
  mimeType: string;
  base64: string;
  width?: number;
  height?: number;
};

export interface ReceiptSplitItem {
  id: string;
  name: string;
  imageUrl?: string | null;
  imageUri?: string | null;
  thumbnailUrl?: string | null;
  unitPrice: number;
  quantity: number;
  /** Actual line total; never reconstructed from unitPrice × quantity when printed. */
  totalPrice: number;
  discount?: number;
  kind?: string;
  /** Set when the AI value could not be read reliably; cleared once the user edits the item. */
  needsReview?: boolean;
  issues?: string[];
  splitMode: ReceiptSplitMode;
  assignedTo: string[];
  perPersonCount: Record<string, number>;
}

export interface ReceiptSessionMeta {
  sessionId: number;
  sessionName: string;
  language: string;
  summary?: ReceiptSummary;
}

export type FinishPayload = {
  sessionId?: number;
  sessionName?: string;
  receiptId?: string;
  participants?: ReceiptParticipant[];
  totals?: Record<string, number>;
  totalsByParticipant?: FinalizeTotalsByParticipant[];
  totalsByItem?: FinalizeTotalsByItem[];
  allocations?: ReceiptAllocation[];
  status?: string;
  createdAt?: string;
  grandTotal?: number;
  currency?: string;
};

interface ReceiptSessionStore {
  capture?: CapturedReceiptImage;
  /**
   * Identifies the current in-progress scan attempt to the server (sent as the
   * Idempotency-Key header). Generated once per captured photo, not per HTTP call, so a
   * retry of the SAME captured photo — including a duplicate request the client did not
   * intend to send — resolves to the same server-side result instead of a second AI call
   * and a second session. A genuinely new photo gets a new key.
   */
  scanIdempotencyKey?: string;
  parsing: boolean;
  parseError?: string;
  session?: ReceiptSessionMeta;
  items: ReceiptSplitItem[];
  participants: ReceiptParticipant[];
  currency: string; // ✅ Добавлено поле для валюты
  finalizing: boolean;
  finalizeError?: string;
  finalized?: FinalizeReceiptResponse;
  lastFinishPayload?: FinishPayload;

  setCapture: (capture?: CapturedReceiptImage) => void;
  clearCapture: () => void;
  setSessionName: (sessionName: string) => void;
  setParticipants: (participants: ReceiptParticipant[]) => void;
  setCurrency: (currency: string) => void; // ✅ Добавлен метод
  updateItem: (itemId: string, updater: (prev: ReceiptSplitItem) => ReceiptSplitItem) => void;
  setItems: (items: ReceiptSplitItem[]) => void;
  setLastFinishPayload: (payload?: FinishPayload) => void;

  /** Client-side safeguard only: while a scan is in flight, a re-entrant call (e.g. a
   * double-tap) is joined to the same request instead of firing a second one. The
   * server-side idempotency key above is what makes this safe even if this guard is
   * ever bypassed. */
  parseReceipt: (payload: ParseReceiptRequest) => Promise<ParseReceiptResponse>;
  parseReceiptUpload: (formData: FormData) => Promise<ParseReceiptResponse>;
  finalizeSession: () => Promise<FinalizeReceiptResponse>;
  reset: () => void;
}

const INITIAL_STATE: Pick<ReceiptSessionStore,
  'capture' | 'scanIdempotencyKey' | 'parsing' | 'parseError' | 'session' | 'items' | 'participants' | 'currency' | 'finalizing' | 'finalizeError' | 'finalized' | 'lastFinishPayload'
> = {
  capture: undefined,
  scanIdempotencyKey: undefined,
  parsing: false,
  parseError: undefined,
  session: undefined,
  items: [],
  participants: [],
  currency: 'UZS', // ✅ Значение по умолчанию
  finalizing: false,
  finalizeError: undefined,
  finalized: undefined,
  lastFinishPayload: undefined,
};

/** Units can only be counted out per person for whole quantities (not e.g. 0.75 kg). */
export const defaultSplitMode = (quantity: number): ReceiptSplitMode =>
  Number.isInteger(quantity) && quantity > 1 ? 'count' : 'equal';

/** Mock receipts come only from the backend's explicit dev mode; never accept them in release builds. */
const assertRealScan = (response: ParseReceiptResponse) => {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (response.source !== 'gemini' && !isDev) {
    throw new Error('Receipt could not be scanned. Please try again.');
  }
};

const toSplitItems = (response: ParseReceiptResponse): ReceiptSplitItem[] =>
  response.items.map((item) => ({
    id: item.id,
    name: item.name,
    imageUrl: item.imageUrl,
    imageUri: item.imageUri,
    thumbnailUrl: item.thumbnailUrl,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    totalPrice: item.totalPrice,
    discount: item.discount,
    kind: item.kind,
    needsReview: item.needsReview,
    issues: item.issues,
    splitMode: defaultSplitMode(item.quantity),
    assignedTo: [],
    perPersonCount: {},
  }));

const toParsedSessionState = (response: ParseReceiptResponse) => ({
  parsing: false,
  parseError: undefined,
  session: {
    sessionId: response.sessionId,
    sessionName: response.sessionName,
    language: response.language,
    summary: response.summary,
  },
  items: toSplitItems(response),
  participants: [],
  currency: response.summary?.currency || 'UNKNOWN',
  finalized: undefined,
  finalizeError: undefined,
});

// Module-level, not store state: a Promise is not serializable state and this is a
// process-local dedupe guard, not a correctness mechanism (the server is authoritative).
let inFlightScan: Promise<ParseReceiptResponse> | null = null;

export const useReceiptSessionStore = create<ReceiptSessionStore>((set, get) => ({
  ...INITIAL_STATE,

  setCapture: (capture) => set({ capture, scanIdempotencyKey: capture ? uuid() : undefined }),
  clearCapture: () => set({ capture: undefined, scanIdempotencyKey: undefined }),

  setSessionName: (sessionName) => {
    set((state) => {
      if (!state.session) {
        // Create a placeholder session meta so the name is persisted before parsing
        return {
          session: {
            sessionId: 0,
            sessionName,
            language: 'uz-UZ',
          } as ReceiptSessionMeta,
        };
      }
      return { session: { ...state.session, sessionName } };
    });
  },

  setParticipants: (participants) => set({ participants }),

  setCurrency: (currency) => set({ currency }), // ✅ Новый метод

  updateItem: (itemId, updater) => {
    set((state) => ({
      items: state.items.map((item) => item.id === itemId ? updater(item) : item),
    }));
  },

  setItems: (items) => set({ items }),
  setLastFinishPayload: (payload) => set({ lastFinishPayload: payload }),

  parseReceipt: async (payload) => {
    if (inFlightScan) return inFlightScan; // join the already-running attempt instead of duplicating it
    const key = get().scanIdempotencyKey ?? uuid();
    const run = (async () => {
      set({ parsing: true, parseError: undefined });
      try {
        const response = await ReceiptApi.parse(payload, key);
        assertRealScan(response);
        set(toParsedSessionState(response));
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to parse receipt';
        set({ parsing: false, parseError: message });
        throw error;
      } finally {
        inFlightScan = null;
      }
    })();
    inFlightScan = run;
    return run;
  },

  parseReceiptUpload: async (formData) => {
    if (inFlightScan) return inFlightScan;
    const key = get().scanIdempotencyKey ?? uuid();
    const run = (async () => {
      set({ parsing: true, parseError: undefined });
      try {
        const response = await ReceiptApi.parseUpload(formData, key);
        assertRealScan(response);
        set(toParsedSessionState(response));
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to parse receipt';
        set({ parsing: false, parseError: message });
        throw error;
      } finally {
        inFlightScan = null;
      }
    })();
    inFlightScan = run;
    return run;
  },

  finalizeSession: async () => {
    const { session, participants, items, currency } = get();
    if (!session) throw new Error('No session to finalize');
    if (participants.length === 0) throw new Error('Add at least one participant');

    const payloadItems: FinalizeReceiptItemPayload[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.unitPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      kind: item.kind,
      splitMode: item.splitMode,
      assignedTo: item.splitMode === 'equal' ? item.assignedTo : undefined,
      perPersonCount: item.splitMode === 'count' ? item.perPersonCount : undefined,
    }));

    set({ finalizing: true, finalizeError: undefined });
    try {
      const response = await ReceiptApi.finalize({
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        participants,
        items: payloadItems,
        adjustments: session.summary?.adjustments ?? [],
        currency,
      });

      const nextState: Partial<ReceiptSessionStore> = {
        finalizing: false,
        finalized: response,
        finalizeError: undefined,
        lastFinishPayload: {
          sessionId: response.sessionId,
          sessionName: response.sessionName,
          participants,
          totalsByParticipant: response.totals?.byParticipant,
          totalsByItem: response.totals?.byItem,
          allocations: response.allocations,
          grandTotal: response.totals?.grandTotal,
          currency: response.totals?.currency ?? currency,
          status: response.status,
          createdAt: response.createdAt,
        },
      };

      if (response.totals?.currency) {
        nextState.currency = response.totals.currency;
      }

      set(nextState);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to finalize session';
      set({ finalizing: false, finalizeError: message });
      throw error;
    }
  },

  reset: () => set({ ...INITIAL_STATE }),
}));
