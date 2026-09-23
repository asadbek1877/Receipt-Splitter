import { Router } from "express";
import type { Response } from "express";
import multer from "multer";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";
import { parseReceipt, ReceiptParseError } from "../services/receiptParser.js";
import { prisma } from "../config/prisma.js";
import type { Prisma, TransactionCategory } from "@prisma/client";
import { computeSplit, normalizeParticipants, SplitValidationError } from "../services/splitCalculator.js";
import { resolveEligibleDebtors } from "../services/debtEligibility.js";
import { allocateMinor, fromMinor } from "../utils/money.js";

const router = Router();

/** Thrown inside the finalize transaction when the session is not owned by the caller. */
class SessionAccessError extends Error {}

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
 *                       discount: { type: number, nullable: true }
 *                       kind: { type: string, nullable: true }
 *                       needsReview: { type: boolean }
 *                       issues: { type: array, items: { type: string } }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     subtotal: { type: number }
 *                     grandTotal: { type: number, description: "Payable total computed from items and adjustments" }
 *                     printedTotal: { type: number, nullable: true }
 *                     printedTotalMismatch: { type: boolean, description: "Items + adjustments differ from the printed total" }
 *                     currency: { type: string, example: "USD" }
 *                     adjustments: { type: array, items: { type: object } }
 *                     needsReview: { type: boolean }
 *                     issues: { type: array, items: { type: string } }
 *                 source: { type: string, enum: [gemini, mock] }
 *       422:
 *         description: AI answered but no usable receipt could be read
 *       502:
 *         description: AI service failed or timed out
 *       503:
 *         description: AI service not configured
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
        if (parseError instanceof ReceiptParseError) {
          const status =
            parseError.code === "AI_NOT_CONFIGURED" ? 503 : parseError.code === "AI_INVALID_RESULT" ? 422 : 502;
          return res.status(status).json({ error: parseError.message, code: parseError.code });
        }
        return res.status(500).json({ error: "Failed to parse receipt" });
      }

      // The session must exist in the database: finalize later verifies ownership against it.
      let sessionId: number;
      try {
        const createdSession = await prisma.session.create({
          data: {
            creatorId: req.user.id,
            total: parseResult.summary?.grandTotal || 0,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        sessionId = createdSession.id;
      } catch (dbError: any) {
        console.error("Database error while creating session:", dbError);
        return res.status(500).json({ error: "Failed to create session" });
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
 *                     price: { type: number, description: "Unit price" }
 *                     quantity: { type: number }
 *                     totalPrice: { type: number, description: "Actual line total (wins over price × quantity)" }
 *                     kind: { type: string, nullable: true }
 *                     splitMode: { type: string, enum: [equal, count] }
 *                     perPersonCount: { type: object, additionalProperties: { type: number } }
 *                     assignedTo: { type: array, items: { type: string } }
 *               adjustments:
 *                 type: array
 *                 description: Receipt-level tax/discount/tip/service, shared in proportion to item subtotals
 *                 items:
 *                   type: object
 *                   required: [type, amount]
 *                   properties:
 *                     id: { type: string }
 *                     type: { type: string, enum: [tax, discount, tip, service] }
 *                     label: { type: string }
 *                     amount: { type: number, description: "Positive magnitude; discounts reduce the total" }
 *                     includedInPrices: { type: boolean, description: "Tax/service already in item prices (not added again)" }
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
      const userId = req.user.id;
      const { sessionName, participants: rawParticipants, items } = req.body || {};
      const sessionId = Number(req.body?.sessionId);
      const currency = normalizeCurrencyCode(req.body?.currency);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: "sessionId required" });
      }
      if (!Array.isArray(rawParticipants) || rawParticipants.length === 0) {
        return res.status(400).json({ error: "participants array required" });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "items array required" });
      }
      const participants = normalizeParticipants(rawParticipants);
      if (participants.length === 0) {
        return res.status(400).json({ error: "participants array required" });
      }

      // Only the creator of a session may finalize it.
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, creatorId: true },
      });
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      if (session.creatorId !== userId) {
        return res.status(403).json({ error: "You do not have access to this session" });
      }

      const split = computeSplit(items, participants, currency, req.body?.adjustments);
      const { grandTotal, subtotal, adjustments, byParticipant, byItem, allocations, digits } = split;

      // Validate calculations
      if (grandTotal < 0) {
        return res.status(400).json({ error: "calculated total cannot be negative" });
      }
      if (allocations.length === 0) {
        return res.status(400).json({ error: "no items were assigned to participants" });
      }

      const payer = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, uniqueId: true, username: true, email: true },
      });
      if (!payer) return res.status(401).json({ error: "Unauthorized" });

      const now = new Date();
      const responsePayload = {
        sessionId,
        sessionName: sessionName || null,
        status: "finalized",
        createdAt: now.toISOString(),
        finalizedAt: now.toISOString(),
        currency,
        payer: {
          id: payer.id,
          uniqueId: payer.uniqueId,
          username: payer.username || payer.email,
        },
        totals: {
          currency,
          subtotal,
          adjustments,
          grandTotal,
          byParticipant,
          byItem,
        },
        allocations,
      };

      const participantUniqueIds = byParticipant
        .map((p) => String(p.uniqueId || "").trim())
        .filter(Boolean)
        .join(",");

      // Debts are only recorded for participants who are real, accepted friends of the payer.
      const debtCandidates = byParticipant.filter(
        (p) => p.uniqueId !== payer.uniqueId && (split.participantTotalsMinor.get(p.uniqueId) ?? 0) > 0
      );
      const eligibleDebtors = await resolveEligibleDebtors(
        userId,
        debtCandidates.map((p) => p.uniqueId)
      );

      // All writes succeed together or not at all.
      await prisma.$transaction(
        async (tx) => {
          const closed = await tx.session.updateMany({
            where: { id: sessionId, creatorId: userId },
            data: { status: "CLOSED", total: grandTotal },
          });
          if (closed.count !== 1) throw new SessionAccessError();

          const historyData = {
            sessionName: sessionName || null,
            payload: { ...responsePayload, creatorId: userId } as unknown as Prisma.InputJsonObject,
            participantUniqueIds,
            grandTotal,
            currency,
            finalizedAt: now,
          };
          const storedHistoryEntry = await tx.sessionHistoryEntry.upsert({
            where: { sessionId },
            create: { sessionId, creatorId: userId, ...historyData },
            update: historyData,
          });

          await tx.transaction.deleteMany({
            where: { userId, sessionHistoryId: storedHistoryEntry.id },
          });

          const categoryTotalsMinor = new Map<string, number>();
          items.forEach((item: any, index: number) => {
            const amountMinor = split.itemTotalsMinor[index] ?? 0;
            if (amountMinor <= 0) return;
            const category = inferTransactionCategory(item?.name);
            categoryTotalsMinor.set(category, (categoryTotalsMinor.get(category) || 0) + amountMinor);
          });
          // Receipt-level adjustments (tax, discount, tip, service) are spread over the
          // categories in proportion, so the transactions add up to the receipt total.
          if (categoryTotalsMinor.size > 0 && split.adjustmentsTotalMinor !== 0) {
            const categories = Array.from(categoryTotalsMinor.keys());
            const shares = allocateMinor(
              split.adjustmentsTotalMinor,
              categories.map((c) => categoryTotalsMinor.get(c) ?? 0)
            );
            categories.forEach((c, i) => {
              categoryTotalsMinor.set(c, (categoryTotalsMinor.get(c) ?? 0) + (shares[i] ?? 0));
            });
          }
          if (categoryTotalsMinor.size === 0) {
            categoryTotalsMinor.set(
              "OTHER",
              split.itemTotalsMinor.reduce((s, v) => s + v, 0) + split.adjustmentsTotalMinor
            );
          }

          let debtTransactionId: number | null = null;
          for (const [category, totalMinor] of categoryTotalsMinor) {
            const transactionRecord = await tx.transaction.create({
              data: {
                userId,
                sessionHistoryId: storedHistoryEntry.id,
                totalAmount: fromMinor(totalMinor, digits),
                currency,
                category: category as TransactionCategory,
                description: sessionName || `Session #${sessionId}`,
              },
            });
            if (!debtTransactionId) debtTransactionId = transactionRecord.id;
          }
          if (!debtTransactionId) return;

          for (const participant of debtCandidates) {
            const debtorId = eligibleDebtors.get(participant.uniqueId);
            if (!debtorId) continue;
            await tx.debt.create({
              data: {
                transactionId: debtTransactionId,
                creditorId: userId,
                debtorId,
                amount: fromMinor(split.participantTotalsMinor.get(participant.uniqueId) ?? 0, digits),
                currency,
                status: "ACTIVE",
                description: sessionName || `Session #${sessionId}`,
              },
            });
          }
        },
        { timeout: 20000 }
      );

      console.log("POST /sessions/finalize success:", {
        sessionId,
        participantCount: participants.length,
        itemCount: items.length,
        grandTotal,
        allocationsCount: allocations.length,
      });

      return res.json(responsePayload);
    } catch (err) {
      if (err instanceof SessionAccessError) {
        return res.status(403).json({ error: "You do not have access to this session" });
      }
      if (err instanceof SplitValidationError) {
        return res.status(400).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
      }
      console.error("POST /sessions/finalize error:", err);
      return res.status(500).json({ error: "Failed to finalize session. Nothing was saved." });
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

      const userHistory = dbHistory.map((entry) => ({
        sessionId: entry.sessionId,
        sessionName: entry.sessionName || "",
        finalizedAt: entry.finalizedAt.toISOString(),
        grandTotal: Number(entry.grandTotal),
        currency: entry.currency,
        participantUniqueIds: entry.participantUniqueIds,
        isCreator: true,
        payload: entry.payload,
      }));
      
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
