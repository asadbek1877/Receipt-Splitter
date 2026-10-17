import { apiClient } from '@/features/auth/api';

export type ReceiptImagePayload = {
  mimeType: string;
  data: string; // base64 without data URI prefix
};

export interface ParseReceiptRequest {
  sessionName: string;
  language: string;
  image: ReceiptImagePayload;
}

export type ParsedReceiptItemKind = 'item' | 'fee' | 'discount' | string;

export type ReceiptAdjustmentType = 'tax' | 'discount' | 'tip' | 'service';

/** Receipt-level tax / discount / tip / service charge. `amount` is always positive. */
export interface ReceiptAdjustment {
  id: string;
  type: ReceiptAdjustmentType;
  label: string;
  amount: number;
  /** Already contained in item prices (e.g. VAT "incl."): shown, never added again. */
  includedInPrices: boolean;
}

/** Bounded server-side AI processing (~40s) plus upload time. */
export const RECEIPT_SCAN_TIMEOUT_MS = 60000;

export interface ParsedReceiptItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Actual printed line total (after any line discount). */
  totalPrice: number;
  /** Line discount already reflected in totalPrice. */
  discount?: number;
  imageUrl?: string | null;
  imageUri?: string | null;
  thumbnailUrl?: string | null;
  kind?: ParsedReceiptItemKind;
  needsReview?: boolean;
  issues?: string[];
}

export interface ReceiptSummary {
  /** Payable total computed from items and adjustments. */
  grandTotal: number;
  subtotal?: number;
  printedTotal?: number | null;
  /** Items + adjustments do not add up to the printed total. */
  printedTotalMismatch?: boolean;
  adjustments?: ReceiptAdjustment[];
  needsReview?: boolean;
  issues?: string[];
  currency?: string;
  [key: string]: unknown;
}

export interface ParseReceiptResponse {
  sessionId: number;
  sessionName: string;
  language: string;
  items: ParsedReceiptItem[];
  summary?: ReceiptSummary;
  /** 'mock' only comes from the backend's explicit development mock mode. */
  source?: 'gemini' | 'mock' | string;
}

export type ReceiptParticipant = {
  uniqueId: string;
  username: string;
};

export type ReceiptSplitMode = 'equal' | 'count';

export interface FinalizeReceiptItemPayload {
  id: string;
  name: string;
  price: number;
  quantity: number;
  /** Actual line total; the backend uses it instead of price × quantity. */
  totalPrice: number;
  kind?: ParsedReceiptItemKind;
  splitMode: ReceiptSplitMode;
  assignedTo?: string[];
  perPersonCount?: Record<string, number>;
}

export interface FinalizeReceiptRequest {
  sessionId: number;
  sessionName: string;
  participants: ReceiptParticipant[];
  items: FinalizeReceiptItemPayload[];
  adjustments?: ReceiptAdjustment[];
  currency?: string; // ✅ Добавьте валюту в запрос
}

export interface FinalizeTotalsByParticipant {
  uniqueId: string;
  username: string;
  amountOwed: number;
}

export interface FinalizeTotalsByItem {
  itemId: string;
  name: string;
  total: number;
  /** 'item' or the adjustment type (tax / discount / tip / service). */
  kind?: string;
}

export interface ReceiptAllocation {
  itemId: string;
  participantId: string;
  shareAmount: number;
  shareUnits?: number;
  shareRatio?: number;
}

export interface FinalizeReceiptResponse {
  sessionId: number;
  sessionName: string;
  status: string;
  createdAt: string;
  totals: {
    grandTotal: number;
    subtotal?: number;
    adjustments?: Array<ReceiptAdjustment & { appliedAmount: number }>;
    currency?: string;
    byParticipant?: FinalizeTotalsByParticipant[];
    byItem?: FinalizeTotalsByItem[];
  };
  allocations?: ReceiptAllocation[];
}

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    const msg = error.message || '';
    
    // Network connectivity issues
    if (msg.includes('ECONNREFUSED') || msg.includes('Network request failed')) {
      return new Error('Cannot connect to server. Make sure backend is running.');
    }
    if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
      return new Error('Connection timeout. Server taking too long. Please try again.');
    }
    if (msg.includes('ENOTFOUND') || msg.includes('Network')) {
      return new Error('Network unavailable. Check your internet connection.');
    }
    
    // API validation/client errors
    if (msg.includes('400') || msg.includes('Invalid request')) {
      return new Error('Invalid request format. Check image and session data.');
    }
    if (msg.includes('413') || msg.includes('too large')) {
      return new Error('Image too large. Please use a smaller image or clearer photo (max 5MB).');
    }
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      return new Error('Session expired. Please log in again.');
    }
    
    // Specific parsing errors
    if (msg.includes('parse') || msg.includes('AI could not')) {
      return new Error('Could not read receipt. Make sure:\n• Receipt is fully within the frame\n• Image is clear and well-lit\n• Receipt is not crumpled or damaged\n\nTry taking another photo.');
    }
    
    // Server errors
    if (msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('not configured')) {
      return new Error('AI receipt scanning is not available right now. Please try again later.');
    }
    if (msg.includes('500') || msg.includes('Server error')) {
      return new Error('Server error. Please try again.');
    }
    
    return error;
  }
  return new Error('Unexpected error occurred');
};

export const ReceiptApi = {
  /**
   * @param idempotencyKey Identifies this logical scan attempt to the server. Reusing the
   * same key on a retry (after a timeout, or the user tapping "scan" again for the same
   * captured photo) makes the server return the original result instead of calling the
   * AI and creating a session a second time. Pass a fresh key only for a genuinely new
   * scan (a new photo).
   */
  async parse(payload: ParseReceiptRequest, idempotencyKey?: string): Promise<ParseReceiptResponse> {
    try {
      console.log('[ReceiptApi] Parsing receipt:', { sessionName: payload.sessionName, imageSize: payload.image.data.length, frameCropped: true });

      const { data } = await apiClient.post<ParseReceiptResponse>('/sessions/scan', payload, {
        timeout: RECEIPT_SCAN_TIMEOUT_MS,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      });

      console.log('[ReceiptApi] Parse success:', { 
        sessionId: data.sessionId, 
        itemsCount: data.items?.length,
        grandTotal: data.summary?.grandTotal,
        source: data.source || 'backend'
      });
      return data;
    } catch (error) {
      const normalizedError = normalizeError(error);
      console.warn('[ReceiptApi] Parse failed:', normalizedError.message);
      throw normalizedError;
    }
  },

  async parseUpload(formData: FormData, idempotencyKey?: string): Promise<ParseReceiptResponse> {
    try {
      const { data } = await apiClient.post<ParseReceiptResponse>('/sessions/scan', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        timeout: RECEIPT_SCAN_TIMEOUT_MS,
      });

      console.log('[ReceiptApi] Upload parse success:', {
        sessionId: data.sessionId,
        itemsCount: data.items?.length,
        grandTotal: data.summary?.grandTotal,
        source: data.source || 'backend',
      });
      return data;
    } catch (error) {
      const normalizedError = normalizeError(error);
      console.warn('[ReceiptApi] Upload parse failed:', normalizedError.message);
      throw normalizedError;
    }
  },

  async finalize(payload: FinalizeReceiptRequest): Promise<FinalizeReceiptResponse> {
    try {
      console.log('[ReceiptApi] Finalizing receipt:', { 
        sessionId: payload.sessionId,
        itemCount: payload.items?.length,
        participantCount: payload.participants?.length,
        currency: payload.currency
      });

      const { data } = await apiClient.post<FinalizeReceiptResponse>('/sessions/finalize', payload);

      console.log('[ReceiptApi] Finalize success:', { 
        sessionId: data.sessionId, 
        grandTotal: data.totals?.grandTotal,
        allocationsCount: data.allocations?.length,
        participantCount: data.totals?.byParticipant?.length
      });
      return data;
    } catch (error) {
      const normalizedError = normalizeError(error);
      console.warn('[ReceiptApi] Finalize failed:', normalizedError.message);
      throw normalizedError;
    }
  },
};

