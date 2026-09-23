import { Router } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { resolveEligibleDebtors } from '../services/debtEligibility.js';

const router = Router();

/**
 * POST /receipts
 * Body:
 * {
 *   sessionId?: number,
 *   totalAmount: number,
 *   category?: string,
 *   description?: string,
 *   allocations: [{ userUniqueId: string, amount: number, description?: string }]
 * }
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;
    const { sessionId, totalAmount, category, description, allocations } = req.body || {};
    // Currency is recorded as given (ISO 4217) or explicitly UNKNOWN; it is never assumed.
    const rawCurrency = typeof req.body?.currency === 'string' ? req.body.currency.trim().toUpperCase() : '';
    const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'UNKNOWN';

    if (!Number.isFinite(Number(totalAmount))) {
      return res.status(400).json({ error: 'totalAmount is required' });
    }
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: 'allocations array required' });
    }

    // A receipt may only be linked to the caller's own finalized session.
    let historyEntry: { id: number } | null = null;
    if (sessionId) {
      historyEntry = await prisma.sessionHistoryEntry.findFirst({
        where: { sessionId: Number(sessionId), creatorId: userId },
        select: { id: true },
      });
      if (!historyEntry) {
        return res.status(404).json({ error: 'Session not found' });
      }
    }

    // Debts may only target real users who are accepted friends of the caller.
    const requestedDebtors = allocations
      .filter((alloc: any) => alloc && alloc.userUniqueId && Number.isFinite(Number(alloc.amount)))
      .map((alloc: any) => String(alloc.userUniqueId));
    const eligibleDebtors = await resolveEligibleDebtors(userId, requestedDebtors);
    const ineligible = requestedDebtors.filter((uid: string) => !eligibleDebtors.has(uid));
    if (ineligible.length > 0) {
      return res.status(400).json({
        error: 'Debts can only be created for your accepted friends',
        details: { ineligible: ineligible.join(',') },
      });
    }

    // Run DB transaction to create Transaction and Debt records atomically
    const db = prisma as any;
    const result = await db.$transaction(async (tx: any) => {
      const txRec = await tx.transaction.create({
        data: {
          userId,
          ...(historyEntry ? { sessionHistoryId: historyEntry.id } : {}),
          totalAmount: Number(totalAmount),
          currency,
          category: category || 'OTHER',
          description: description || null,
        },
      });

      const createdDebts = [];
      for (const alloc of allocations) {
        if (!alloc || !alloc.userUniqueId || !Number.isFinite(Number(alloc.amount))) continue;
        const debtorId = eligibleDebtors.get(String(alloc.userUniqueId));
        if (!debtorId) continue;

        const debt = await tx.debt.create({
          data: {
            transactionId: txRec.id,
            creditorId: userId,
            debtorId,
            amount: Number(alloc.amount),
            currency,
            status: 'ACTIVE',
            description: alloc.description || null,
          },
        });
        createdDebts.push(debt);
      }

      return { transaction: txRec, debts: createdDebts };
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('POST /receipts error:', err);
    return res.status(500).json({ error: 'Failed to save receipt' });
  }
});

export default router;
