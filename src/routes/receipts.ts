import { Router } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';

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

    if (!Number.isFinite(Number(totalAmount))) {
      return res.status(400).json({ error: 'totalAmount is required' });
    }
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: 'allocations array required' });
    }

    // Run DB transaction to create Transaction and Debt records atomically
    const db = prisma as any;
    const result = await db.$transaction(async (tx: any) => {
      const historyEntry = sessionId
        ? await tx.sessionHistoryEntry.findUnique({
            where: { sessionId: Number(sessionId) },
            select: { id: true },
          })
        : null;

      const txRec = await tx.transaction.create({
        data: {
          userId,
          ...(historyEntry ? { sessionHistoryId: historyEntry.id } : {}),
          totalAmount: Number(totalAmount),
          category: category || 'OTHER',
          description: description || null,
        },
      });

      const createdDebts = [];
      for (const alloc of allocations) {
        if (!alloc || !alloc.userUniqueId || !Number.isFinite(Number(alloc.amount))) continue;
        const debtor = await tx.user.findUnique({ where: { uniqueId: String(alloc.userUniqueId) } });
        if (!debtor) continue;

        const debt = await tx.debt.create({
          data: {
            transactionId: txRec.id,
            creditorId: userId,
            debtorId: debtor.id,
            amount: Number(alloc.amount),
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
