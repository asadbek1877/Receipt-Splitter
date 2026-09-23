import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { currencyMinorDigits, fromMinor, toMinor } from '../utils/money.js';

/** Sums debt amounts per currency using exact minor units. */
function sumByCurrency(list: Array<{ amount: unknown; currency?: string | null }>): Map<string, number> {
  const minorTotals = new Map<string, number>();
  for (const debt of list) {
    const code = debt.currency || 'UNKNOWN';
    const minor = toMinor(Number(debt.amount || 0), currencyMinorDigits(code));
    minorTotals.set(code, (minorTotals.get(code) ?? 0) + minor);
  }
  return new Map(
    Array.from(minorTotals, ([code, minor]) => [code, fromMinor(minor, currencyMinorDigits(code))])
  );
}

const router = Router();

const debtInclude = {
  creditor: { select: { id: true, username: true, uniqueId: true } },
  debtor: { select: { id: true, username: true, uniqueId: true } },
  transaction: true,
};

const parseDebtId = (raw: unknown) => {
  const debtId = Number(raw);
  return Number.isInteger(debtId) && debtId > 0 ? debtId : null;
};

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

// GET /debts - get active debts and paid history for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const db = prisma as any;
    // Debts where others owe the current user
    const owedList = await db.debt.findMany({
      where: { creditorId: Number(userId), status: 'ACTIVE' },
      include: debtInclude,
      orderBy: { createdAt: 'desc' },
    });

    // Debts where current user owes others
    const iOweList = await db.debt.findMany({
      where: { debtorId: Number(userId), status: 'ACTIVE' },
      include: debtInclude,
      orderBy: { createdAt: 'desc' },
    });

    const historyList = await db.debt.findMany({
      where: {
        status: 'PAID',
        OR: [{ creditorId: Number(userId) }, { debtorId: Number(userId) }],
      },
      include: debtInclude,
      orderBy: [{ settledAt: 'desc' }, { createdAt: 'desc' }],
    });

    // Amounts in different currencies are never added together.
    const owedByCurrency = sumByCurrency(owedList);
    const iOweByCurrency = sumByCurrency(iOweList);
    const currencies = Array.from(new Set([...owedByCurrency.keys(), ...iOweByCurrency.keys()]));
    const totalsByCurrency = currencies.map((code) => ({
      currency: code,
      owed: owedByCurrency.get(code) ?? 0,
      iOwe: iOweByCurrency.get(code) ?? 0,
    }));

    // Legacy single-number totals refer to one explicit currency: the requested one,
    // otherwise the currency of the most recent active debt.
    const requested = typeof req.query.currency === 'string' ? req.query.currency.trim().toUpperCase() : '';
    const mostRecent = [...owedList, ...iOweList].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const currency = requested || mostRecent?.currency || null;
    const totalOwed = currency ? owedByCurrency.get(currency) ?? 0 : 0;
    const totalIOwe = currency ? iOweByCurrency.get(currency) ?? 0 : 0;

    res.json({ currency, totalOwed, totalIOwe, totalsByCurrency, owedList, iOweList, historyList });
  } catch (err) {
    console.error('GET /debts error:', err);
    res.status(500).json({ error: 'Failed to fetch debts' });
  }
});

// PUT /debts/:id/status - toggle paid/unpaid status
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const debtId = parseDebtId(req.params.id);
    const isPaid = toBoolean(req.body?.isPaid);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!debtId) return res.status(400).json({ error: 'Invalid debt id' });
    if (isPaid === null) return res.status(400).json({ error: 'isPaid boolean is required' });

    const db = prisma as any;
    const debt = await db.debt.findFirst({
      where: {
        id: debtId,
        OR: [{ creditorId: Number(userId) }, { debtorId: Number(userId) }],
      },
    });

    if (!debt) {
      return res.status(404).json({ error: 'Debt not found or access denied' });
    }

    const updatedDebt = await db.debt.update({
      where: { id: debtId },
      data: {
        status: isPaid ? 'PAID' : 'ACTIVE',
        settledAt: isPaid ? new Date() : null,
      },
      include: debtInclude,
    });

    res.json({ success: true, debt: updatedDebt });
  } catch (err) {
    console.error('PUT /debts/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update debt status' });
  }
});

// PATCH /debts/:id/pay - backwards-compatible mark paid endpoint
router.patch('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const debtId = parseDebtId(req.params.id);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!debtId) return res.status(400).json({ error: 'Invalid debt id' });

    const db = prisma as any;
    const debt = await db.debt.findFirst({
      where: {
        id: debtId,
        OR: [{ creditorId: Number(userId) }, { debtorId: Number(userId) }],
      },
    });

    if (!debt) {
      return res.status(404).json({ error: 'Debt not found or access denied' });
    }

    const updatedDebt = await db.debt.update({
      where: { id: debtId },
      data: {
        status: 'PAID',
        settledAt: new Date(),
      },
      include: debtInclude,
    });

    res.json({ success: true, debt: updatedDebt });
  } catch (err) {
    console.error('PATCH /debts/:id/pay error:', err);
    res.status(500).json({ error: 'Failed to mark debt as paid' });
  }
});

// PUT /debts/:id - edit debt amount/details. Only the creditor/creator can edit.
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const debtId = parseDebtId(req.params.id);
    const amount = Number(req.body?.amount);
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : undefined;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!debtId) return res.status(400).json({ error: 'Invalid debt id' });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const db = prisma as any;
    const debt = await db.debt.findUnique({
      where: { id: debtId },
      select: { id: true, creditorId: true },
    });

    if (!debt) return res.status(404).json({ error: 'Debt not found' });
    if (debt.creditorId !== Number(userId)) {
      return res.status(403).json({ error: 'Only the debt creator can edit this debt' });
    }

    const updatedDebt = await db.debt.update({
      where: { id: debtId },
      data: {
        amount,
        ...(description !== undefined ? { description: description || null } : {}),
      },
      include: debtInclude,
    });

    res.json({ success: true, debt: updatedDebt });
  } catch (err) {
    console.error('PUT /debts/:id error:', err);
    res.status(500).json({ error: 'Failed to update debt' });
  }
});

export default router;
