import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import { getDefaultAvatarUrl } from "../config/app.js";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";
import { PUBLIC_USER_SELECT, toPublicUser } from "../utils/publicUser.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Public user info and profile avatar management
 */

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get public user profile by numeric id
 *     description: Requires authentication. `email` is only included for the caller's own profile.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: raw
 *         schema:
 *           type: boolean
 *         description: If true, returns raw DB avatarUrl (nullable). If false/missing, returns default avatar when DB value is null.
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 email:
 *                   type: string
 *                 username:
 *                   type: string
 *                 uniqueId:
 *                   type: string
 *                 avatarUrl:
 *                   type: string
 *                   nullable: true
 *       404:
 *         description: User not found
 */
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id))
      return res.status(400).json({ error: "Invalid id" });

    const user = await prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
    if (!user) return res.status(404).json({ error: "User not found" });

    const rawParam = String(req.query.raw ?? "").toLowerCase();
    const isRaw = rawParam === "true" || rawParam === "1";
    const avatarUrl = isRaw
      ? user.avatarUrl ?? null
      : user.avatarUrl ?? getDefaultAvatarUrl();

    return res.json({
      id: user.id,
      // Email is private: only returned to the account owner.
      ...(req.user?.id === user.id ? { email: user.email } : {}),
      username: user.username,
      uniqueId: user.uniqueId,
      avatarUrl,
    });
  } catch (err) {
    console.error("GET /users/:id error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /users/me/avatar:
 *   patch:
 *     summary: Update current user's avatar URL
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [avatarUrl]
 *             properties:
 *               avatarUrl:
 *                 type: string
 *                 example: https://cdn.example.com/avatars/u1.png
 *     responses:
 *       200:
 *         description: Avatar updated
 */
router.patch(
  "/me/avatar",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const avatarUrlRaw = req.body?.avatarUrl;
      const avatarUrl =
        typeof avatarUrlRaw === "string" ? avatarUrlRaw.trim() : "";
      if (!avatarUrl)
        return res.status(400).json({ error: "avatarUrl is required" });

      // Lenient URL validation: allow any http(s) URL in mock mode
      try {
        const u = new URL(avatarUrl);
        if (!/^https?:$/.test(u.protocol)) throw new Error("bad");
      } catch {
        return res.status(400).json({ error: "Invalid avatarUrl" });
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl },
        select: PUBLIC_USER_SELECT,
      });
      console.log("/users/me/avatar updated:", { id: req.user.id });
      return res.json(toPublicUser(updated));
    } catch (err) {
      console.error("PATCH /users/me/avatar error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /users/me/avatar:
 *   delete:
 *     summary: Reset current user's avatar to default (sets DB to null)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar reset
 */
router.delete(
  "/me/avatar",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: null },
        select: PUBLIC_USER_SELECT,
      });
      console.log("/users/me/avatar reset:", { id: req.user.id });
      return res.json(toPublicUser(updated));
    } catch (err) {
      console.error("DELETE /users/me/avatar error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
