import { Router } from "express";
import type { Response } from "express";
import multer from "multer";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";
import { parseReceipt } from "../services/receiptParser.js";
import { prisma } from "../config/prisma.js";

const router = Router();

const DEFAULT_CURRENCY_CODE = "UNKNOWN";
const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;

type UploadedReceiptFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size: number;
};

const receiptImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

// In-memory storage for finalized sessions (keyed by userId)
const sessionHistory: Map<number, any[]> = new Map();

function normalizeCurrencyCode(input: unknown): string {
  if (typeof input !== "string") return DEFAULT_CURRENCY_CODE;
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_CURRENCY_CODE;
  const upper = trimmed.toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : DEFAULT_CURRENCY_CODE;
}

function inferTransactionCategory(name: unknown): string {
  const text = String(name || "").toLowerCase();
  if (/(coffee|tea|cola|juice|water|drink|latte|cappuccino|espresso|suv|ichimlik|choy|kofe|кофе|чай|напит|сок)/i.test(text)) {
    return "DRINKS";
  }
  if (/(taxi|bus|metro|fuel|parking|transport|yo'l|йул|такси|бензин|транспорт)/i.test(text)) {
    return "TRANSPORT";
  }
  if (/(movie|cinema|game|ticket|entertainment|kino|кино|билет)/i.test(text)) {
    return "ENTERTAINMENT";
  }
  if (/(electric|gas|internet|phone|utility|kommunal|коммунал|свет|газ)/i.test(text)) {
    return "UTILITIES";
  }
  if (/(shirt|shoe|clothes|market|shop|shopping|kiyim|магазин|одежд|обув)/i.test(text)) {
    return "SHOPPING";
  }
  if (/(bread|rice|meat|chicken|beef|fish|salad|soup|pizza|burger|food|meal|osh|non|go'sht|ovqat|еда|хлеб|мясо|салат|суп|пицца)/i.test(text)) {
    return "FOOD";
  }
  return "OTHER";
}

/**
 * @swagger
 * /sessions/scan:
 *   post:
 *     summary: Parse receipt image (session creation + immediate normalized items)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionName, language, image]
 *             properties:
 *               sessionName:
 *                 type: string
 *                 example: "Кафе на Октябрь"
 *               language:
 *                 type: string
 *                 example: ru-RU
 *               image:
 *                 type: object
 *                 required: [mimeType, data]
 *                 properties:
 *                   mimeType:
 *                     type: string
 *                     example: image/jpeg
 *                   data:
 *                     type: string
 *                     description: Base64 image data
 *     responses:
 *       200:
 *         description: Parsed receipt items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId: { type: integer }
 *                 sessionName: { type: string }
 *                 language: { type: string }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       unitPrice: { type: number }
 *                       quantity: { type: number }
 *                       totalPrice: { type: number }
 *                       kind: { type: string, nullable: true }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     grandTotal: { type: number }
 *                     currency: { type: string, nullable: true, example: "USD" }
 */
router.post(
  "/scan",
  authenticateToken,
  receiptImageUpload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      
      const uploadedFile = (req as AuthRequest & { file?: UploadedReceiptFile }).file;
      const { sessionName, language } = req.body || {};
      const image = uploadedFile
        ? {
            mimeType: uploadedFile.mimetype || "image/jpeg",
            data: uploadedFile.buffer.toString("base64"),
          }
        : req.body?.image;
      
      // Validation
      if (!sessionName || typeof sessionName !== "string") {
        return res.status(400).json({ error: "sessionName required" });
      }
      if (!language || typeof language !== "string") {
        return res.status(400).json({ error: "language required" });
      }
      if (!image || typeof image !== "object") {
        return res.status(400).json({ error: "image object required" });
      }
      if (!image.mimeType || typeof image.mimeType !== "string") {
        return res.status(400).json({ error: "image.mimeType required" });
      }
      if (!image.data || typeof image.data !== "string") {
        return res.status(400).json({ error: "image.data (base64) required" });
      }
      
      // Validate base64 length (should be reasonably sized)
      if (!uploadedFile && image.data.length > 5000000) {
        return res.status(413).json({ error: "Image too large (max 5MB)" });
      }

      // Parse receipt using AI
      let parseResult;
      try {
        parseResult = await parseReceipt({
          language,
          sessionName,
          mimeType: image.mimeType,
          imageBase64: image.data,
        });
      } catch (parseError) {
        console.error("parseReceipt failed:", parseError);
        // Return better error message for common issues
        const errMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
        if (errMsg.includes('GEMINI_API_KEY')) {
          return res.status(503).json({ 
            error: "AI service not configured",
            details: "GEMINI_API_KEY not set, using fallback mock parser"
          });
        }
        return res.status(500).json({ 
          error: "Failed to parse receipt",
          details: errMsg 
        });
      }

      let sessionId = Math.floor(Math.random() * 1000000);
      
      try {
        // Only try to insert into Prisma if the user exists in Prisma
        // This is a temporary fix because auth is using mockState but sessions are using Prisma
        const userExists = await prisma.user.findUnique({
          where: { id: req.user.id }
        });
        
        if (userExists) {
          const createdSession = await prisma.session.create({
            data: {
              creatorId: req.user.id,
              total: parseResult.summary?.grandTotal || 0,
              status: "ACTIVE",
            },
            select: { id: true },
          });
          sessionId = createdSession.id;
        } else {
          console.warn(`[Sessions] User ${req.user.id} not found in PostgreSQL. Using mock sessionId=${sessionId}`);
        }
      } catch (dbError: any) {
        console.error("Database error while creating session:", dbError);
        console.warn(`[Sessions] Falling back to mock sessionId=${sessionId} due to DB error`);
      }

      console.log("POST /sessions/scan success:", { 
        sessionId, 
        sessionName, 
        itemsCount: parseResult.items.length,
        source: parseResult.source 
      });
      
      return res.json({
        sessionId,
        sessionName,
        language,
        items: parseResult.items,
        summary: parseResult.summary,
        source: parseResult.source,
      });
    } catch (err) {
      console.error("POST /sessions/scan error:", err);
      const errMsg = err instanceof Error ? err.message : 'Server error';
      return res.status(500).json({ 
        error: errMsg || "Failed to process receipt" 
      });
    }
  }
);

/**
 * @swagger
 * tags:
 *   name: Sessions
 *   description: Receipt split sessions
 */

/**
 * @swagger
 * /sessions:
 *   post:
 *     summary: Create a session (optionally within a group)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: integer
 *                 nullable: true
 *               serviceFee:
 *                 type: number
 *                 nullable: true
 *               total:
 *                 type: number
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Session created
 */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const groupId = req.body?.groupId;
    const serviceFee = Number(req.body?.serviceFee ?? 0);
    const total = Number(req.body?.total ?? 0);

    // Mock session creation
    const mockSession = {
      id: Math.floor(Math.random() * 10000) + 1,
      creatorId: req.user.id,
      groupId: groupId != null ? Number(groupId) : null,
      serviceFee: serviceFee || 0,
      total: total || 0,
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };

    console.log("POST /sessions create mock:", { id: mockSession.id, groupId: mockSession.groupId });
    return res.json(mockSession);
  } catch (err) {
    console.error("POST /sessions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /sessions:
 *   get:
 *     summary: List sessions (by group or personal created)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: Sessions list
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    
    // Mock sessions list
    const mockSessions = [
      {
        id: 1,
        creatorId: req.user.id,
        groupId: null,
        total: 109000,
        serviceFee: 0,
        status: "OPEN",
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        creatorId: req.user.id,
        groupId: 1,
        total: 250000,
        serviceFee: 25000,
        status: "CLOSED",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    console.log("GET /sessions - returning mock sessions:", mockSessions.length);
    return res.json(mockSessions);
  } catch (err) {
    console.error("GET /sessions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /sessions/{sessionId}/close:
 *   patch:
 *     summary: Close a session (creator only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Session closed
 */
router.patch(
  "/:sessionId/close",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const sessionId = Number(req.params.sessionId);
      if (!Number.isFinite(sessionId))
        return res.status(400).json({ error: "Invalid sessionId" });
      
      // Mock close session
      const mockSession = {
        id: sessionId,
        creatorId: req.user.id,
        groupId: null,
        total: 109000,
        serviceFee: 0,
        status: "CLOSED",
        createdAt: new Date().toISOString(),
      };

      console.log("PATCH /sessions/:sessionId/close mock:", { id: sessionId });
      return res.json(mockSession);
    } catch (err) {
      console.error("PATCH /sessions/:sessionId/close error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * @swagger
 * /sessions/finalize:
 *   post:
 *     summary: Finalize a session by computing allocations for provided items & participants (purely computational for now)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, participants, items]
 *             properties:
 *               currency: { type: string, example: "JPY", nullable: true }
 *               sessionId: { type: integer }
 *               sessionName: { type: string }
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [uniqueId, username]
 *                   properties:
 *                     uniqueId: { type: string }
 *                     username: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, name, price, quantity, splitMode]
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     price: { type: number }
 *                     quantity: { type: number }
 *                     kind: { type: string, nullable: true }
 *                     splitMode: { type: string, enum: [equal, count] }
 *                     perPersonCount: { type: object, additionalProperties: { type: number } }
 *                     assignedTo: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Finalized allocations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId: { type: integer }
 *                 sessionName: { type: string, nullable: true }
 *                 status: { type: string }
 *                 finalizedAt: { type: string, format: date-time }
 *                 createdAt: { type: string, format: date-time }
 *                 currency: { type: string }
 *                 totals:
 *                   type: object
 *                   properties:
 *                     currency: { type: string }
 *                     grandTotal: { type: number }
 *                     byParticipant:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           uniqueId: { type: string }
 *                           username: { type: string }
 *                           amountOwed: { type: number }
 *                           participantId: { type: string }
 *                           total: { type: number }
 *                     byItem:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemId: { type: string }
 *                           name: { type: string }
 *                           total: { type: number }
 *                           kind: { type: string, nullable: true }
 *                 allocations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       itemId: { type: string }
 *                       participantId: { type: string }
 *                       shareAmount: { type: number }
 *                       shareRatio: { type: number, nullable: true }
 *                       shareUnits: { type: number, nullable: true }
 */
router.post(
  "/finalize",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { sessionId, sessionName, participants, items } = req.body || {};
      const currency = normalizeCurrencyCode(req.body?.currency);
      if (!Number.isFinite(Number(sessionId))) {
        return res.status(400).json({ error: "sessionId required" });
      }
      if (!Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({ error: "participants array required" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items array required" });
      }

      // Initialize participant totals
      const participantTotals: Record<string, number> = {};
      participants.forEach((p: any) => {
        participantTotals[p.uniqueId] = 0;
      });

      const byItem: any[] = [];
      const allocations: any[] = [];

      // Process each item based on split mode
      items.forEach((item: any) => {
        const itemTotal = item.totalPrice || item.price * (item.quantity || 1) || 0;
        byItem.push({
          id: item.id,
          name: item.name,
          totalAmount: itemTotal,
          itemId: item.id,
          total: itemTotal,
        });

        const splitMode = item.splitMode || 'equal';

        if (splitMode === 'count' && item.perPersonCount) {
          // Count mode: distribute by units
          const perPersonCount = item.perPersonCount;
          const totalUnits = Object.values(perPersonCount).reduce(
            (sum: number, count: any) => sum + (Number(count) || 0),
            0
          );

          if (totalUnits > 0) {
            const unitPrice = item.price || 0;
            Object.entries(perPersonCount).forEach(([uid, count]: [string, any]) => {
              const numCount = Number(count) || 0;
              if (numCount > 0) {
                const shareAmount = Math.round(unitPrice * numCount);
                participantTotals[uid] = (participantTotals[uid] || 0) + shareAmount;
                allocations.push({
                  itemId: item.id,
                  participantId: uid,
                  shareAmount,
                  shareUnits: numCount,
                  shareRatio: numCount / totalUnits,
                });
              }
            });
          }
        } else if (splitMode === 'equal' && Array.isArray(item.assignedTo)) {
          // Equal mode: split evenly among assigned participants
          const assignedTo = item.assignedTo.filter((uid: any) => uid);
          if (assignedTo.length > 0) {
            const perPerson = Math.round(itemTotal / assignedTo.length);
            assignedTo.forEach((uid: string) => {
              participantTotals[uid] = (participantTotals[uid] || 0) + perPerson;
              allocations.push({
                itemId: item.id,
                participantId: uid,
                shareAmount: perPerson,
                shareRatio: 1 / assignedTo.length,
                shareUnits: null,
              });
            });
          }
        }
      });

      const byParticipant = participants.map((p: any) => ({
        uniqueId: p.uniqueId,
        username: p.username,
        amountOwed: participantTotals[p.uniqueId] || 0,
        participantId: p.uniqueId,
        total: participantTotals[p.uniqueId] || 0,
      }));

      const grandTotal = byItem.reduce((sum, item) => sum + item.total, 0);

      const now = new Date();
      const payer = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, uniqueId: true, username: true, email: true },
      });
      const responsePayload = {
        sessionId: Number(sessionId),
        sessionName: sessionName || null,
        status: "finalized",
        createdAt: now.toISOString(),
        finalizedAt: now.toISOString(),
        currency,
        payer: payer
          ? {
              id: payer.id,
              uniqueId: payer.uniqueId,
              username: payer.username || payer.email,
            }
          : null,
        totals: {
          currency,
          grandTotal,
          byParticipant,
          byItem,
        },
        allocations,
      };

      // Validate calculations
      if (grandTotal < 0) {
        return res.status(400).json({ error: "calculated total cannot be negative" });
      }
      if (allocations.length === 0) {
        return res.status(400).json({ error: "no items were assigned to participants" });
      }

      console.log("POST /sessions/finalize success:", { 
        sessionId, 
        participantCount: participants.length, 
        itemCount: items.length,
        grandTotal,
        allocationsCount: allocations.length
      });

      // Store in history
      try {
        const userId = req.user.id;
        if (!sessionHistory.has(userId)) {
          sessionHistory.set(userId, []);
        }
        const userHistory = sessionHistory.get(userId)!;
        
        // Create history entry
        const historyEntry = {
          receiptId: `receipt-${sessionId}`,
          sessionId,
          sessionName: sessionName || null,
          finalizedAt: now.toISOString(),
          currency,
          grandTotal,
          participants: byParticipant.map((p: any) => ({
            uniqueId: p.uniqueId,
            username: p.username,
            total: p.total,
          })),
          items: byItem.map((item: any) => ({
            itemId: item.id,
            name: item.name,
            total: item.total,
          })),
          allocations,
        };
        
        // Add to beginning of array (most recent first)
        userHistory.unshift(historyEntry);
        
        // Keep only last 50 entries
        if (userHistory.length > 50) {
          userHistory.length = 50;
        }

        const participantUniqueIds = byParticipant
          .map((p: any) => String(p.uniqueId || "").trim())
          .filter(Boolean)
          .join(",");

        // Check if user and session exist before saving to Prisma
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, uniqueId: true, username: true },
        });
        
        if (userExists) {
          const sessionExists = await prisma.session.findUnique({ where: { id: Number(sessionId) } });
          let storedHistoryEntryId: number | null = null;

          if (sessionExists) {
            await prisma.session.update({
              where: { id: Number(sessionId) },
              data: {
                status: "CLOSED",
                total: grandTotal,
              },
            });

            const storedHistoryEntry = await prisma.sessionHistoryEntry.upsert({
              where: { sessionId: Number(sessionId) },
              create: {
                sessionId: Number(sessionId),
                creatorId: userId,
                sessionName: sessionName || null,
                payload: {
                  ...responsePayload,
                  creatorId: userId,
                },
                participantUniqueIds,
                grandTotal,
                currency,
                finalizedAt: now,
              },
              update: {
                sessionName: sessionName || null,
                payload: {
                  ...responsePayload,
                  creatorId: userId,
                },
                participantUniqueIds,
                grandTotal,
                currency,
                finalizedAt: now,
              },
            });

            storedHistoryEntryId = storedHistoryEntry.id;
            console.log("History stored successfully in DB for user:", userId);
          } else {
            console.warn(`Session ${sessionId} not in DB, analytics will be saved without DB history link`);
          }

          await (prisma as any).$transaction(async (tx: any) => {
            if (storedHistoryEntryId) {
              await tx.transaction.deleteMany({
                where: {
                  userId,
                  sessionHistoryId: storedHistoryEntryId,
                },
              });
            }

            const categoryTotals = new Map<string, number>();
            for (const item of items) {
              const amount = Number(item.totalPrice || item.price * (item.quantity || 1) || 0);
              if (!Number.isFinite(amount) || amount <= 0) continue;
              const category = inferTransactionCategory(item.name);
              categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
            }

            if (categoryTotals.size === 0) {
              categoryTotals.set("OTHER", grandTotal);
            }

            let debtTransactionId: number | null = null;
            for (const [category, totalAmount] of categoryTotals) {
              const transactionRecord = await tx.transaction.create({
                data: {
                  userId,
                  ...(storedHistoryEntryId ? { sessionHistoryId: storedHistoryEntryId } : {}),
                  totalAmount,
                  category,
                  description: sessionName || `Session #${sessionId}`,
                },
              });
              if (!debtTransactionId) {
                debtTransactionId = transactionRecord.id;
              }
            }

            if (!debtTransactionId) return;

            for (const participant of byParticipant) {
              const participantUniqueId = String(participant.uniqueId || "").trim();
              const amount = Number(participant.amountOwed || 0);

              if (!participantUniqueId || amount <= 0) continue;
              if (userExists.uniqueId && participantUniqueId === userExists.uniqueId) continue;

              const debtor = await tx.user.findUnique({
                where: { uniqueId: participantUniqueId },
                select: { id: true },
              });
              if (!debtor) continue;

              await tx.debt.create({
                data: {
                  transactionId: debtTransactionId,
                  creditorId: userId,
                  debtorId: debtor.id,
                  amount,
                  status: "ACTIVE",
                  description: sessionName || `Session #${sessionId}`,
                },
              });
            }
          });
          console.log("Analytics and debts stored successfully for user:", userId);
        } else {
          console.warn(`User ${userId} not in DB, history/analytics saved in memory only`);
        }
      } catch (historyErr) {
        console.error("Failed to store history:", historyErr);
        // Don't fail the request if history storage fails - return response anyway
      }

      return res.json(responsePayload);
    } catch (err) {
      console.error("POST /sessions/finalize error:", err);
      const errMsg = err instanceof Error ? err.message : 'Failed to finalize session';
      return res.status(500).json({ error: errMsg });
    }
  }
);

/**
 * @swagger
 * /sessions/history:
 *   get:
 *     summary: Session finalize history for the current user
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Return full history when true (defaults to latest 5)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Override default result size when not requesting all
 *     responses:
 *       200:
 *         description: Session history entries
 */
router.get(
  "/history",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      if (!req.user.id) return res.status(400).json({ error: "Invalid user ID" });

      const userId = req.user.id;
      
      // Validate user ID format
      if (typeof userId !== 'number' && typeof userId !== 'string') {
        return res.status(400).json({ error: "Invalid user ID format" });
      }

      const dbHistory = await prisma.sessionHistoryEntry.findMany({
        where: { creatorId: Number(userId) },
        orderBy: { finalizedAt: "desc" },
        select: {
          sessionId: true,
          sessionName: true,
          finalizedAt: true,
          grandTotal: true,
          currency: true,
          participantUniqueIds: true,
          payload: true,
        },
      });

      const userHistory = dbHistory.length
        ? dbHistory.map((entry) => ({
            sessionId: entry.sessionId,
            sessionName: entry.sessionName || "",
            finalizedAt: entry.finalizedAt.toISOString(),
            grandTotal: Number(entry.grandTotal),
            currency: entry.currency,
            participantUniqueIds: entry.participantUniqueIds,
            isCreator: true,
            payload: entry.payload,
          }))
        : (sessionHistory.get(userId) || []);
      
      const requestAll = req.query.all === "true" || req.query.all === "1";
      const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      
      // Validate limit parameter
      if (limitParam !== undefined && (isNaN(limitParam) || limitParam < 1 || limitParam > 50)) {
        return res.status(400).json({ error: "limit must be between 1 and 50" });
      }
      
      let limit = 5;
      let scope = "latest";
      
      if (requestAll) {
        limit = 50;
        scope = "all";
      } else if (limitParam && limitParam >= 1 && limitParam <= 50) {
        limit = limitParam;
      }
      
      const entries = userHistory.slice(0, limit);
      
      console.log("GET /sessions/history success:", { userId, count: entries.length, limit, scope });
      
      return res.json({
        scope,
        count: entries.length,
        limit,
        entries,
      });
    } catch (err) {
      console.error("GET /sessions/history error:", err);
      const errMsg = err instanceof Error ? err.message : 'Failed to retrieve history';
      return res.status(500).json({ error: errMsg });
    }
  }
);

export default router;
