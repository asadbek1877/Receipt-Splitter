import { Router } from "express";
import type { Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.js";
import { authenticateToken, signAuthToken, type AuthRequest } from "../middleware/auth.js";
import {
  hasJsonContentType,
  isStrongPassword,
  isValidEmail,
  PASSWORD_POLICY_MESSAGE,
} from "../utils/validation.js";
import { PUBLIC_USER_SELECT, toPublicUser } from "../utils/publicUser.js";

const router = Router();

/** Verifies `password` against the stored hash of the given user. */
async function verifyUserPassword(userId: number, password: unknown): Promise<"ok" | "missing" | "invalid" | "no-user"> {
  if (typeof password !== "string" || !password) return "missing";
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) return "no-user";
  return (await bcrypt.compare(password, user.password)) ? "ok" : "invalid";
}

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User management
 */

/**
 * @swagger
 * /user/update:
 *   patch:
 *     summary: Update user profile (username or password)
 *     description: Changing the password requires currentPassword.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: NewName
 *               password:
 *                 type: string
 *                 example: newStrongPassword123
 *               currentPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: User data updated
 *       400:
 *         description: No fields to update or wrong current password
 *       415:
 *         description: Invalid Content-Type (application/json required)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.patch(
  "/update",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!hasJsonContentType(req)) {
        return res
          .status(415)
          .json({ error: "Content-Type must be application/json" });
      }
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { username, password, currentPassword } = req.body ?? {};
      if (!username && !password) {
        return res.status(400).json({ error: "Provide username or password" });
      }

      const data: { username?: string; password?: string } = {};
      if (typeof username === "string" && username.trim()) {
        data.username = username.trim();
      }
      if (typeof password === "string" && password) {
        if (!isStrongPassword(password)) {
          return res.status(400).json({ error: PASSWORD_POLICY_MESSAGE });
        }
        const check = await verifyUserPassword(req.user.id, currentPassword);
        if (check === "no-user") return res.status(404).json({ error: "User not found" });
        if (check !== "ok") {
          return res.status(400).json({ error: "Current password is incorrect" });
        }
        data.password = await bcrypt.hash(password, 10);
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "Invalid field values" });
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data,
        select: PUBLIC_USER_SELECT,
      });

      console.log("/user/update success:", { id: updated.id });
      return res.json(toPublicUser(updated));
    } catch (err: any) {
      if (err?.code === "P2025") {
        return res.status(404).json({ error: "User not found" });
      }
      console.error("/user/update error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /user/username:
 *   patch:
 *     summary: Update username
 *     description: Change only the username of the current user.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username:
 *                 type: string
 *                 example: NewName
 *     responses:
 *       200:
 *         description: Username updated
 *       400:
 *         description: Invalid username
 *       415:
 *         description: Invalid Content-Type (application/json required)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.patch(
  "/username",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!hasJsonContentType(req)) {
        return res
          .status(415)
          .json({ error: "Content-Type must be application/json" });
      }
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const { username } = req.body ?? {};
      if (typeof username !== "string") {
        return res.status(400).json({ error: "Username must be a string" });
      }
      const clean = username.trim();
      if (!clean || clean.length < 2 || clean.length > 32) {
        return res
          .status(400)
          .json({ error: "Username must be 2-32 characters" });
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { username: clean },
        select: PUBLIC_USER_SELECT,
      });

      return res.json(toPublicUser(updated));
    } catch (err: any) {
      if (err?.code === "P2025") {
        return res.status(404).json({ error: "User not found" });
      }
      console.error("/user/username error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /user/email:
 *   patch:
 *     summary: Update email
 *     description: >
 *       Change the email of the current user. Requires the current password.
 *       Returns the updated user and a new `token`, because tokens are bound to the email.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, currentPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 example: new@example.com
 *               currentPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email updated
 *       400:
 *         description: Invalid email or wrong current password
 *       415:
 *         description: Invalid Content-Type (application/json required)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Email already in use
 */
router.patch(
  "/email",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!hasJsonContentType(req)) {
        return res
          .status(415)
          .json({ error: "Content-Type must be application/json" });
      }
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const { email, currentPassword } = req.body ?? {};
      if (typeof email !== "string") {
        return res.status(400).json({ error: "Email must be a string" });
      }
      const clean = email.trim().toLowerCase();
      if (!clean || !isValidEmail(clean)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const check = await verifyUserPassword(req.user.id, currentPassword);
      if (check === "no-user") return res.status(404).json({ error: "User not found" });
      if (check === "missing") {
        return res.status(400).json({ error: "Current password is required to change email" });
      }
      if (check === "invalid") {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      const taken = await prisma.user.findUnique({ where: { email: clean }, select: { id: true } });
      if (taken && taken.id !== req.user.id) {
        return res.status(409).json({ error: "Email already in use" });
      }

      try {
        const updated = await prisma.user.update({
          where: { id: req.user.id },
          data: { email: clean },
          select: PUBLIC_USER_SELECT,
        });
        return res.json({ ...toPublicUser(updated), token: signAuthToken(updated) });
      } catch (e: any) {
        if (e?.code === "P2002") {
          return res.status(409).json({ error: "Email already in use" });
        }
        if (e?.code === "P2025") {
          return res.status(404).json({ error: "User not found" });
        }
        throw e;
      }
    } catch (err) {
      console.error("/user/email error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /user/password:
 *   patch:
 *     summary: Update password
 *     description: Change password by providing the current password and a new one.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldPass123
 *               newPassword:
 *                 type: string
 *                 example: Aa1!secure
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Invalid input or wrong current password
 *       415:
 *         description: Invalid Content-Type (application/json required)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.patch(
  "/password",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!hasJsonContentType(req)) {
        return res
          .status(415)
          .json({ error: "Content-Type must be application/json" });
      }
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const { currentPassword, newPassword } = req.body ?? {};
      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string"
      ) {
        return res
          .status(400)
          .json({ error: "Both currentPassword and newPassword are required" });
      }
      if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ error: PASSWORD_POLICY_MESSAGE });
      }

      const check = await verifyUserPassword(req.user.id, currentPassword);
      if (check === "no-user") return res.status(404).json({ error: "User not found" });
      if (check !== "ok") {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: await bcrypt.hash(newPassword, 10) },
      });

      console.log("/user/password success:", { id: req.user.id });
      return res.json({ success: true });
    } catch (err: any) {
      if (err?.code === "P2025") {
        return res.status(404).json({ error: "User not found" });
      }
      console.error("/user/password error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Removes the user and every row that references them, in one transaction.
 * Debts in which the user is creditor or debtor are removed as well, because
 * the schema requires both parties to exist.
 */
async function deleteUserAndRelatedData(userId: number) {
  await prisma.$transaction(async (tx) => {
    const ownedSessions = await tx.session.findMany({ where: { creatorId: userId }, select: { id: true } });
    const ownedSessionIds = ownedSessions.map((s) => s.id);

    const historyEntries = await tx.sessionHistoryEntry.findMany({
      where: { OR: [{ creatorId: userId }, { sessionId: { in: ownedSessionIds } }] },
      select: { id: true },
    });
    const historyIds = historyEntries.map((h) => h.id);

    // Other users' transactions may reference this user's history; keep them, drop the link.
    await tx.transaction.updateMany({
      where: { sessionHistoryId: { in: historyIds }, userId: { not: userId } },
      data: { sessionHistoryId: null },
    });
    await tx.debt.deleteMany({ where: { OR: [{ creditorId: userId }, { debtorId: userId }] } });
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.sessionHistoryEntry.deleteMany({ where: { id: { in: historyIds } } });

    await tx.itemAssignment.deleteMany({
      where: { OR: [{ userId }, { item: { sessionId: { in: ownedSessionIds } } }] },
    });
    await tx.receiptItem.deleteMany({ where: { sessionId: { in: ownedSessionIds } } });
    await tx.sessionParticipant.deleteMany({
      where: { OR: [{ userId }, { sessionId: { in: ownedSessionIds } }] },
    });

    const ownedGroups = await tx.group.findMany({ where: { ownerId: userId }, select: { id: true } });
    const ownedGroupIds = ownedGroups.map((g) => g.id);
    await tx.session.updateMany({ where: { groupId: { in: ownedGroupIds } }, data: { groupId: null } });
    await tx.groupMember.deleteMany({
      where: { OR: [{ userId }, { groupId: { in: ownedGroupIds } }] },
    });
    await tx.group.deleteMany({ where: { id: { in: ownedGroupIds } } });

    await tx.session.deleteMany({ where: { id: { in: ownedSessionIds } } });
    await tx.friendship.deleteMany({ where: { OR: [{ requesterId: userId }, { receiverId: userId }] } });
    await tx.user.delete({ where: { id: userId } });
  }, { timeout: 20000 });
}

/**
 * @swagger
 * /user/delete:
 *   delete:
 *     summary: Delete user account
 *     description: Permanently deletes the account and its data. Requires the current password.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deleted
 *       400:
 *         description: Missing or wrong password
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.delete(
  "/delete",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const check = await verifyUserPassword(req.user.id, req.body?.password);
      if (check === "no-user") return res.status(404).json({ error: "User not found" });
      if (check === "missing") {
        return res.status(400).json({ error: "Password is required to delete the account" });
      }
      if (check === "invalid") {
        return res.status(400).json({ error: "Password is incorrect" });
      }

      await deleteUserAndRelatedData(req.user.id);

      console.log("/user/delete success:", { id: req.user.id });
      return res.json({ success: true });
    } catch (err) {
      console.error("/user/delete error:", err);
      return res.status(500).json({ error: "Failed to delete account" });
    }
  }
);

/**
 * @swagger
 * /user/list:
 *   get:
 *     summary: List users (temporary)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список пользователей
 */
router.get(
  "/list",
  authenticateToken,
  async (_req: AuthRequest, res: Response) => {
    try {
      // Mock users list
      const users = [
        { id: 1, email: 'test@example.com', username: 'TestUser', uniqueId: '#1234', avatarUrl: null },
      ];
      console.log("/user/list count:", users.length);
      return res.json(users);
    } catch (err) {
      console.error("/user/list error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
