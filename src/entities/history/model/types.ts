import type { Receipt } from '../../receipt';
import type { Debt } from '../../debt';

/**
 * History transaction - represents a complete transaction record with receipt and generated debts
 */
export interface HistoryTransaction {
  id: string;
  receipt: Receipt; // The original receipt
  generatedDebts: Debt[]; // Array of debts created from this receipt
  createdAt: Date;
}
