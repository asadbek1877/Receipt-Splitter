import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';

const router = Router();

// GET /analytics - grouped totals by currency and category for current user.
// Amounts in different currencies are never added together. The top-level
// totalSpent/byCategory fields refer to `currency`: the requested ?currency=,
// otherwise the currency of the most recent transaction.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const groups = await prisma.transaction.groupBy({
      by: ['currency', 'category'],
      where: { userId: Number(userId) },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const byCurrencyMap = new Map<
      string,
      { currency: string; totalSpent: number; totalTransactions: number; byCategory: Array<{ category: string; total: number }> }
    >();
    for (const g of groups) {
      const entry = byCurrencyMap.get(g.currency) ?? {
        currency: g.currency,
        totalSpent: 0,
        totalTransactions: 0,
        byCategory: [],
      };
      const total = Number(g._sum.totalAmount || 0);
      entry.totalSpent += total;
      entry.totalTransactions += Number(g._count.id || 0);
      entry.byCategory.push({ category: g.category, total });
      byCurrencyMap.set(g.currency, entry);
    }
    const byCurrency = Array.from(byCurrencyMap.values());

    const requested = typeof req.query.currency === 'string' ? req.query.currency.trim().toUpperCase() : '';
    const latest = requested
      ? null
      : await prisma.transaction.findFirst({
          where: { userId: Number(userId) },
          orderBy: { createdAt: 'desc' },
          select: { currency: true },
        });
    const currency = requested || latest?.currency || null;
    const selected = currency ? byCurrencyMap.get(currency) : undefined;

    res.json({
      currency,
      totalSpent: selected?.totalSpent ?? 0,
      totalTransactions: selected?.totalTransactions ?? 0,
      byCategory: selected?.byCategory ?? [],
      byCurrency,
    });
  } catch (err) {
    console.error('GET /analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
