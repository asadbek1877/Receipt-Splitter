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

export interface ParsedReceiptItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  kind?: ParsedReceiptItemKind;
}

export interface ReceiptSummary {
  grandTotal: number;
  currency?: string;
  [key: string]: unknown;
}

export interface ParseReceiptResponse {
  sessionId: number;
  sessionName: string;
  language: string;
  items: ParsedReceiptItem[];
  summary?: ReceiptSummary;
  source?: string;
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
      return new Error('AI service not configured. Using demo data.');
    }
    if (msg.includes('500') || msg.includes('Server error')) {
      return new Error('Server error. Please try again.');
    }
    
    return error;
  }
  return new Error('Unexpected error occurred');
};

export const ReceiptApi = {
  async parse(payload: ParseReceiptRequest): Promise<ParseReceiptResponse> {
    try {
      console.log('[ReceiptApi] Parsing receipt:', { sessionName: payload.sessionName, imageSize: payload.image.data.length, frameCropped: true });

      const { data } = await apiClient.post<ParseReceiptResponse>('/sessions/scan', payload);

      console.log('[ReceiptApi] Parse success:', { 
        sessionId: data.sessionId, 
        itemsCount: data.items?.length,
        grandTotal: data.summary?.grandTotal,
        source: data.source || 'backend'
      });
      return data;
    } catch (error) {
      const normalizedError = normalizeError(error);
      console.error('[ReceiptApi] Parse failed:', normalizedError.message);
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
      console.error('[ReceiptApi] Finalize failed:', normalizedError.message);
      throw normalizedError;
    }
  },
};

