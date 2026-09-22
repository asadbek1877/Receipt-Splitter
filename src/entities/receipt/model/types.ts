/**
 * Receipt entity models - core types for expense splitting
 */

/**
 * Expense category union type
 */
export type ExpenseCategory = 'Food' | 'Drinks' | 'Shopping' | 'Transport' | 'Other';

/**
 * Receipt item - individual line item in a receipt
 */
export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  category: ExpenseCategory;
  assignedToIds: string[]; // Array of Participant IDs who share this item
}

/**
 * Receipt - main receipt document with all items and participants
 */
export interface Receipt {
  id: string;
  merchantName: string;
  totalAmount: number;
  date: Date;
  items: ReceiptItem[];
  payerId: string; // Participant ID who paid
  participantIds: string[]; // Array of all involved participant IDs
}
