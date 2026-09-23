/**
 * Debt entity - represents money owed between two users
 */
export interface Debt {
  id: string;
  ownerUserId?: string; // Current account that owns this local debt record
  fromUserId: string; // User who owes money
  toUserId: string; // User who is owed money
  amount: number;
  /** ISO 4217 code of the receipt the debt came from; amounts in different currencies are never summed. */
  currency?: string;
  receiptId: string; // Reference to the receipt that generated this debt
  description?: string | null;
  date: Date;
  status?: 'ACTIVE' | 'PAID' | 'CANCELLED';
  paidAt?: Date | null;
}
