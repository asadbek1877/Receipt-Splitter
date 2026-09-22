import type { ExpenseCategory } from '../../receipt';

/**
 * Analytics summary - aggregated expense and debt statistics
 */
export interface AnalyticsSummary {
  totalExpenses: number; // Total amount spent across all receipts
  totalOwed: number; // Total amount this user owes to others
  totalDebt: number; // Total amount others owe to this user
  expensesByCategory: Record<ExpenseCategory, number>; // Breakdown of expenses by category
}
