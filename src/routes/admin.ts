import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";

const router = Router();

function getAdminPassword(): string {
  return process.env.ADMIN_PANEL_PASSWORD || "admin123";
}

function assertAdmin(req: AuthRequest, res: Response): boolean {
  const password = String(req.headers["x-admin-password"] || "").trim();
  if (!password) {
    res.status(401).json({ error: "Admin password required" });
    return false;
  }
  if (password !== getAdminPassword()) {
    res.status(403).json({ error: "Invalid admin password" });
    return false;
  }
  return true;
}

router.post("/unlock", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  if (!assertAdmin(req, res)) return;
  return res.json({ success: true });
});

router.get("/overview", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!assertAdmin(req, res)) return;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [users, sessions, historyEntries] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, username: true, uniqueId: true, createdAt: true },
      }),
      prisma.session.findMany({
        select: { id: true, createdAt: true },
      }),
      prisma.sessionHistoryEntry.findMany({
        where: { finalizedAt: { gte: sevenDaysAgo } },
        select: { payload: true },
      }),
    ]);

    const topItemsMap = new Map<string, number>();
    historyEntries.forEach((entry) => {
      const payload: any = entry.payload;
      const byItem = payload?.totals?.byItem;
      if (!Array.isArray(byItem)) return;
      byItem.forEach((it: any) => {
        const name = typeof it?.name === "string" ? it.name.trim() : "";
        if (!name) return;
        topItemsMap.set(name, (topItemsMap.get(name) || 0) + 1);
      });
    });

    const topItems = Array.from(topItemsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.json({
      usersTotal: users.length,
      activeUsers7d: new Set(
        historyEntries
          .map((entry: any) => Number(entry?.payload?.creatorId || 0))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      ).size,
      sessionsTotal: sessions.length,
      topItems,
    });
  } catch (err) {
    console.error("GET /admin/overview error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/users", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!assertAdmin(req, res)) return;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        uniqueId: true,
        createdAt: true,
        avatarUrl: true,
        sessionsCreated: {
          select: { id: true, createdAt: true },
        },
        sessionHistoryEntries: {
          orderBy: { finalizedAt: "desc" },
          take: 20,
          select: { finalizedAt: true, payload: true },
        },
      },
      orderBy: { id: "asc" },
    });

    const payload = users.map((user) => {
      const topItemsMap = new Map<string, number>();
      user.sessionHistoryEntries.forEach((entry: any) => {
        const byItem = entry?.payload?.totals?.byItem;
        if (!Array.isArray(byItem)) return;
        byItem.forEach((it: any) => {
          const name = typeof it?.name === "string" ? it.name.trim() : "";
          if (!name) return;
          topItemsMap.set(name, (topItemsMap.get(name) || 0) + 1);
        });
      });

      const topItems = Array.from(topItemsMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        uniqueId: user.uniqueId,
        createdAt: user.createdAt,
        avatarUrl: user.avatarUrl,
        sessionsCount: user.sessionsCreated.length,
        lastActiveAt: user.sessionHistoryEntries[0]?.finalizedAt || null,
        topItems,
      };
    });

    return res.json(payload);
  } catch (err) {
    console.error("GET /admin/users error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/users/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!assertAdmin(req, res)) return;

    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const username = typeof req.body?.username === "string" ? req.body.username.trim() : undefined;
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : undefined;

    if (!username && !email) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username ? { username } : {}),
        ...(email ? { email } : {}),
      },
      select: {
        id: true,
        email: true,
        username: true,
        uniqueId: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return res.json(updated);
  } catch (err: any) {
    console.error("PATCH /admin/users/:id error:", err);
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
