import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../config/prisma.js";
import { getDefaultAvatarUrl } from "../config/app.js";
import jwt from "jsonwebtoken";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Friends
 *   description: Friends and friend request management
 */

/** Helper to select public fields */
const userPublicSelect = {
  id: true,
  email: true,
  username: true,
  uniqueId: true,
  avatarUrl: true,
} as const;

/** Helper: choose secret for friend invites */
function getFriendInviteSecret() {
  return process.env.FRIEND_INVITE_SECRET || process.env.JWT_SECRET || "";
}

/**
 * @swagger
 * /friends/invite:
 *   post:
 *     summary: Create a short-lived friend invite token (auth required)
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresInSeconds:
 *                 type: integer
 *                 description: TTL in seconds (default 900 = 15 minutes)
 *     responses:
 *       200:
 *         description: Invite created
 */
router.post(
  "/invite",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const secret = getFriendInviteSecret();
      if (!secret)
        return res.status(500).json({ error: "Invite secret missing" });

      const nowSec = Math.floor(Date.now() / 1000);
      const ttl = Math.max(
        60,
        Math.min(3600, Number(req.body?.expiresInSeconds) || 900)
      );
      const exp = nowSec + ttl;
      const payload = {
        typ: "friend_invite" as const,
        inviterId: req.user.id,
        iat: nowSec,
        exp,
      };
      const token = jwt.sign(payload, secret);

      const baseUrl =
        process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
      const url = `${baseUrl}/friends/join?token=${encodeURIComponent(token)}`;
      console.log("/friends invite created:", { inviterId: req.user.id, exp });
      return res.json({
        token,
        url,
        expiresAt: new Date(exp * 1000).toISOString(),
      });
    } catch (err) {
      console.error("POST /friends/invite error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /friends/join:
 *   post:
 *     summary: Accept friend invite via token (auth required)
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Friendship created/accepted or already exists
 */
router.post(
  "/join",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const token =
        typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!token) return res.status(400).json({ error: "token is required" });

      const secret = getFriendInviteSecret();
      if (!secret)
        return res.status(500).json({ error: "Invite secret missing" });

      let decoded: any;
      try {
        decoded = jwt.verify(token, secret);
      } catch (e) {
        console.warn("/friends join invalid token:", e);
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      if (!decoded || decoded.typ !== "friend_invite" || !decoded.inviterId)
        return res.status(400).json({ error: "Invalid token payload" });

      const inviterId = Number(decoded.inviterId);
      const me = req.user.id;
      if (!Number.isFinite(inviterId))
        return res.status(400).json({ error: "Invalid token claims" });
      
      // Get inviter's user data
      const inviter = await prisma.user.findUnique({
        where: { id: inviterId },
        select: userPublicSelect,
      });
      
      if (!inviter) {
        return res.status(404).json({ error: "Inviter not found" });
      }
      
      if (inviterId === me) {
        return res.json({ 
          success: true, 
          action: "self",
          data: {
            name: inviter.username,
            username: inviter.uniqueId,
            avatar: inviter.avatarUrl || getDefaultAvatarUrl(),
            bio: "This is your own QR code!"
          }
        });
      }

      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: inviterId, receiverId: me },
            { requesterId: me, receiverId: inviterId },
          ],
        },
      });

      const responseData = {
        name: inviter.username,
        username: inviter.uniqueId,
        avatar: inviter.avatarUrl || getDefaultAvatarUrl(),
        bio: `${inviter.username} is now your friend!`
      };

      if (existing) {
        if (existing.status === "ACCEPTED") {
          return res.json({ 
            success: true, 
            action: "existing",
            data: { ...responseData, bio: `You are already friends with ${inviter.username}!` }
          });
        }
        const updated = await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: "ACCEPTED" },
        });
        console.log("/friends join accepted:", { id: updated.id });
        return res.json({ success: true, action: "accepted", data: responseData });
      }

      const created = await prisma.friendship.create({
        data: { requesterId: inviterId, receiverId: me, status: "ACCEPTED" },
      });
      console.log("/friends join created:", { id: created.id });
      return res.json({ success: true, action: "created", data: responseData });
    } catch (err) {
      console.error("POST /friends/join error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /friends:
 *   get:
 *     summary: List current user's friends
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список друзей
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserPublic'
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const myId = req.user.id;
    const accepted = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: myId }, { receiverId: myId }],
      },
      include: {
        requester: { select: userPublicSelect },
        receiver: { select: userPublicSelect },
      },
      orderBy: { updatedAt: "desc" },
    });

    const friends = accepted.map((fr) => {
      const user = fr.requesterId === myId ? fr.receiver : fr.requester;
      return {
        ...user,
        avatarUrl: user.avatarUrl ?? getDefaultAvatarUrl(),
      };
    });

    console.log("GET /friends count:", friends.length);
    return res.json(friends);
  } catch (err) {
    console.error("/friends error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /friends/requests:
 *   get:
 *     summary: Show incoming and outgoing friend requests
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Запросы в друзья
 */
router.get(
  "/requests",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const myId = req.user.id;
      const incomingRaw = await prisma.friendship.findMany({
        where: { receiverId: myId, status: "PENDING" },
        include: { requester: { select: userPublicSelect } },
        orderBy: { createdAt: "desc" },
      });
      const outgoingRaw = await prisma.friendship.findMany({
        where: { requesterId: myId, status: "PENDING" },
        include: { receiver: { select: userPublicSelect } },
        orderBy: { createdAt: "desc" },
      });

      const incoming = incomingRaw.map((fr) => ({
        id: fr.id,
        requesterId: fr.requesterId,
        user: {
          ...fr.requester,
          avatarUrl: fr.requester.avatarUrl ?? getDefaultAvatarUrl(),
        },
        createdAt: fr.createdAt,
      }));
      const outgoing = outgoingRaw.map((fr) => ({
        id: fr.id,
        receiverId: fr.receiverId,
        user: {
          ...fr.receiver,
          avatarUrl: fr.receiver.avatarUrl ?? getDefaultAvatarUrl(),
        },
        createdAt: fr.createdAt,
      }));

      return res.json({ incoming, outgoing });
    } catch (err) {
      console.error("/friends/requests error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /friends/search:
 *   get:
 *     summary: Search user by uniqueId
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: uniqueId пользователя (например, #1234)
 *     responses:
 *       200:
 *         description: Результат поиска
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserPublic'
 */
router.get(
  "/search",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const q = String(req.query.q || "").trim();
      console.log("GET /friends/search q:", q);
      if (!q) {
        console.log("GET /friends/search empty query");
        return res.json([]);
      }
      const user = await prisma.user.findUnique({
        where: { uniqueId: q },
        select: userPublicSelect,
      });
      const result = user
        ? [{ ...user, avatarUrl: user.avatarUrl ?? getDefaultAvatarUrl() }]
        : [];
      console.log("GET /friends/search result count:", result.length);
      return res.json(result);
    } catch (err) {
      console.error("/friends/search error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /friends/request:
 *   post:
 *     summary: Send a friend request by uniqueId
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [uniqueId]
 *             properties:
 *               uniqueId:
 *                 type: string
 *                 example: #1234
 *     responses:
 *       200:
 *         description: Запрос отправлен или подтвержден
 */
router.post(
  "/request",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const me = req.user.id;
      // Correctly parse unique ID as a string to avoid JSON errors.
      // Body is parsed by express.json() in server.ts, we strictly require a string here.
      const { uniqueId } = req.body ?? {};
      console.log("POST /friends/request body:", { uniqueId });
      if (typeof uniqueId !== "string" || !uniqueId.trim()) {
        return res.status(400).json({ error: "uniqueId is required" });
      }

      const target = await prisma.user.findUnique({
        where: { uniqueId: uniqueId.trim() },
        select: { id: true, uniqueId: true, username: true },
      });
      if (!target) return res.status(404).json({ error: "User not found" });
      if (target.id === me)
        return res.status(400).json({ error: "You cannot add yourself" });

      // Если есть встречный pending запрос от target -> меняем его на ACCEPTED
      const reciprocal = await prisma.friendship.findUnique({
        where: {
          requesterId_receiverId: { requesterId: target.id, receiverId: me },
        },
      });
      if (reciprocal && reciprocal.status === "PENDING") {
        const accepted = await prisma.friendship.update({
          where: { id: reciprocal.id },
          data: { status: "ACCEPTED" },
        });
        console.log("/friends/request auto-accepted:", { id: accepted.id });
        return res.json({ success: true, action: "accepted", id: accepted.id });
      }

      // Проверяем, не друзья ли уже
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: me, receiverId: target.id },
            { requesterId: target.id, receiverId: me },
          ],
        },
      });
      if (existing) {
        if (existing.status === "ACCEPTED")
          return res.status(409).json({ error: "Already friends" });
        if (existing.requesterId === me && existing.status === "PENDING")
          return res.status(409).json({ error: "Request already sent" });
        if (existing.receiverId === me && existing.status === "PENDING")
          return res.status(409).json({ error: "Awaiting your response" });
      }

      const created = await prisma.friendship.create({
        data: { requesterId: me, receiverId: target.id },
      });
      console.log("/friends/request created:", { id: created.id });
      return res.json({ success: true, action: "requested", id: created.id });
    } catch (err) {
      console.error("/friends/request error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /friends/accept:
 *   patch:
 *     summary: Accept a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [uniqueId]
 *               - required: [requesterId]
 *             properties:
 *               uniqueId:
 *                 type: string
 *               requesterId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Запрос принят
 */
router.patch(
  "/accept",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const me = req.user.id;
      // Correctly parse unique ID as a string to avoid JSON errors.
      // Body is parsed by express.json() in server.ts, we strictly require a string here.
      const { uniqueId, requesterId } = req.body ?? {};
      console.log("PATCH /friends/accept body:", { uniqueId, requesterId });

      let otherId: number | null = null;
      if (typeof requesterId === "number") {
        otherId = requesterId;
      } else if (typeof uniqueId === "string") {
        const u = await prisma.user.findUnique({
          where: { uniqueId: uniqueId.trim() },
          select: { id: true },
        });
        otherId = u?.id ?? null;
      }
      if (!otherId)
        return res
          .status(400)
          .json({ error: "Provide uniqueId or requesterId" });

      const fr = await prisma.friendship.findUnique({
        where: {
          requesterId_receiverId: { requesterId: otherId, receiverId: me },
        },
      });
      if (!fr || fr.status !== "PENDING") {
        return res.status(404).json({ error: "Request not found" });
      }
      const updated = await prisma.friendship.update({
        where: { id: fr.id },
        data: { status: "ACCEPTED" },
      });
      console.log("/friends/accept updated:", { id: updated.id });
      return res.json({ success: true, id: updated.id });
    } catch (err) {
      console.error("/friends/accept error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /friends/reject:
 *   patch:
 *     summary: Reject a friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [uniqueId]
 *               - required: [requesterId]
 *             properties:
 *               uniqueId:
 *                 type: string
 *               requesterId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Запрос отклонен
 */
router.patch(
  "/reject",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const me = req.user.id;
      // Correctly parse unique ID as a string to avoid JSON errors.
      // Body is parsed by express.json() in server.ts, we strictly require a string here.
      const { uniqueId, requesterId } = req.body ?? {};
      console.log("PATCH /friends/reject body:", { uniqueId, requesterId });

      let otherId: number | null = null;
      if (typeof requesterId === "number") {
        otherId = requesterId;
      } else if (typeof uniqueId === "string") {
        const u = await prisma.user.findUnique({
          where: { uniqueId: uniqueId.trim() },
          select: { id: true },
        });
        otherId = u?.id ?? null;
      }
      if (!otherId)
        return res
          .status(400)
          .json({ error: "Provide uniqueId or requesterId" });

      const fr = await prisma.friendship.findUnique({
        where: {
          requesterId_receiverId: { requesterId: otherId, receiverId: me },
        },
      });
      if (!fr || fr.status !== "PENDING") {
        return res.status(404).json({ error: "Request not found" });
      }
      const updated = await prisma.friendship.update({
        where: { id: fr.id },
        data: { status: "REJECTED" },
      });
      console.log("/friends/reject updated:", { id: updated.id });
      return res.json({ success: true, id: updated.id });
    } catch (err) {
      console.error("/friends/reject error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /friends/{uniqueId}:
 *   delete:
 *     summary: Remove friend (or cancel/clear requests)
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uniqueId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Связь удалена (если была)
 */
router.delete(
  "/:uniqueId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const me = req.user.id;
      const uniqueId = String(req.params.uniqueId || "").trim();
      if (!uniqueId) return res.status(400).json({ error: "Invalid uniqueId" });

      console.log("DELETE /friends by uniqueId:", { me, uniqueId });

      const other = await prisma.user.findUnique({
        where: { uniqueId },
        select: { id: true },
      });
      if (!other) return res.json({ success: true, removed: false });

      const fr = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: me, receiverId: other.id },
            { requesterId: other.id, receiverId: me },
          ],
        },
      });

      if (!fr) return res.json({ success: true, removed: false });

      await prisma.friendship.delete({ where: { id: fr.id } });
      console.log("DELETE /friends removed:", { linkId: fr.id });
      return res.json({ success: true, removed: true });
    } catch (err) {
      console.error("DELETE /friends/:uniqueId error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
