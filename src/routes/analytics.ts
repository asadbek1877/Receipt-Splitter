import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';

const router = Router();

// GET /analytics - grouped totals by category for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const db = prisma as any;
    // Group transactions by category
    const groups = await db.transaction.groupBy({
      by: ['category'],
      where: { userId: Number(userId) },
      _sum: { totalAmount: true },
    });

    const totalRow = await db.transaction.aggregate({
      where: { userId: Number(userId) },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const result = {
      totalSpent: Number(totalRow._sum.totalAmount || 0),
      totalTransactions: Number(totalRow._count.id || 0),
      byCategory: groups.map((g: any) => ({ category: g.category, total: Number(g._sum.totalAmount || 0) })),
    };

    res.json(result);
  } catch (err) {
    console.error('GET /analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;