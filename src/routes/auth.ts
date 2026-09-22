import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { authenticateToken, signAuthToken, type AuthRequest } from "../middleware/auth.js";
import {
  generateVerificationCode,
  saveVerificationCode,
  getVerificationCode,
  deleteVerificationCode,
  saveResetToken,
  getResetToken,
  deleteResetToken,
} from "../services/mockState.js";
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
  isValidEmail,
  EMAIL_VALIDATION_MESSAGE,
  isValidUsername,
  USERNAME_VALIDATION_MESSAGE,
} from "../utils/validation.js";
import { PUBLIC_USER_SELECT, toPublicUser } from "../utils/publicUser.js";
import { sendVerificationCode, sendPasswordResetCode, isEmailConfigured } from "../services/emailService.js";

const router = Router();

const EMAIL_UNAVAILABLE_MESSAGE =
  "Email service is not configured. Please try again later.";

function generateUniqueId() {
  return "#" + Math.floor(1000 + Math.random() * 9000);
}

// Helper: coerce value to string if possible
function coerceString(val: any): string | undefined {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return undefined;
}

class EmailInUseError extends Error {}

/** Creates a persistent user with a uniqueId that is not already taken. */
async function createPersistentUser(data: {
  email: string;
  username: string;
  passwordHash: string;
}) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const uniqueId = generateUniqueId();
    const taken = await prisma.user.findUnique({ where: { uniqueId }, select: { id: true } });
    if (taken) continue;
    try {
      return await prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          password: data.passwordHash,
          uniqueId,
        },
        select: PUBLIC_USER_SELECT,
      });
    } catch (e: any) {
      if (e?.code === "P2002") {
        const target = String(e?.meta?.target ?? "");
        if (target.includes("email")) throw new EmailInUseError();
        continue; // uniqueId race: try another one
      }
      throw e;
    }
  }
  throw new Error("Failed to generate a unique user id");
}

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Авторизация и регистрация пользователей
 */

/**
 * @swagger
 * /auth/register/send-code:
 *   post:
 *     summary: Step 1 — Send verification code to email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, username]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification code sent
 *       409:
 *         description: Email already in use
 *       503:
 *         description: Email service not configured
 */
router.post("/register/send-code", async (req, res, next) => {
  try {
    const ct = String(req.headers["content-type"] || "");
    if (!ct.includes("application/json")) {
      return res.status(415).json({ success: false, error: "Content-Type must be application/json" });
    }

    const { email, password, username } = req.body ?? {};
    const emailVal = coerceString(email);
    const passwordVal = coerceString(password);
    const usernameVal = coerceString(username);

    if (!emailVal || !passwordVal || !usernameVal) {
      return res.status(400).json({ success: false, error: "Please provide email, password, and username" });
    }

    const cleanEmail = emailVal.trim().toLowerCase();
    const cleanUsername = usernameVal.trim();
    const cleanPassword = passwordVal;

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: EMAIL_VALIDATION_MESSAGE });
    }
    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({ success: false, error: USERNAME_VALIDATION_MESSAGE });
    }
    if (!isStrongPassword(cleanPassword)) {
      return res.status(400).json({ success: false, error: PASSWORD_POLICY_MESSAGE });
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
    if (existing) {
      return res.status(409).json({ success: false, error: "This email is already registered. Please sign in." });
    }

    if (!isEmailConfigured()) {
      return res.status(503).json({ success: false, error: EMAIL_UNAVAILABLE_MESSAGE });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    const code = generateVerificationCode();

    saveVerificationCode(cleanEmail, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      type: "register",
      pendingData: { username: cleanUsername, email: cleanEmail, passwordHash: hashedPassword },
    });

    const sent = await sendVerificationCode(cleanEmail, code);
    if (!sent) {
      deleteVerificationCode(cleanEmail);
      return res.status(503).json({ success: false, error: "Failed to send verification email. Please try again later." });
    }

    return res.json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

/**
 * @swagger
 * /auth/register/verify:
 *   post:
 *     summary: Step 2 — Verify code and complete registration
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registration complete, returns token + user
 *       400:
 *         description: Invalid or expired code
 */
router.post("/register/verify", async (req, res, next) => {
  try {
    const ct = String(req.headers["content-type"] || "");
    if (!ct.includes("application/json")) {
      return res.status(415).json({ success: false, error: "Content-Type must be application/json" });
    }

    const { email, code } = req.body ?? {};
    const emailVal = coerceString(email);
    const codeVal = coerceString(code);

    if (!emailVal || !codeVal) {
      return res.status(400).json({ success: false, error: "Email and code are required." });
    }

    const cleanEmail = emailVal.trim().toLowerCase();
    const cleanCode = codeVal.trim();

    const entry = getVerificationCode(cleanEmail);
    if (!entry || entry.type !== "register") {
      return res.status(400).json({ success: false, error: "Verification code expired or not found. Please request a new one." });
    }

    if (entry.code !== cleanCode) {
      return res.status(400).json({ success: false, error: "Invalid verification code. Please try again." });
    }

    if (!entry.pendingData) {
      return res.status(400).json({ success: false, error: "Registration data not found. Please start over." });
    }

    let user;
    try {
      user = await createPersistentUser({
        email: entry.pendingData.email,
        username: entry.pendingData.username,
        passwordHash: entry.pendingData.passwordHash,
      });
    } catch (e) {
      if (e instanceof EmailInUseError) {
        deleteVerificationCode(cleanEmail);
        return res.status(409).json({ success: false, error: "This email is already registered. Please sign in." });
      }
      throw e;
    }

    deleteVerificationCode(cleanEmail);

    console.log("/auth/register/verify success:", { id: user.id });
    return res.json({
      success: true,
      token: signAuthToken(user),
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Direct registration (без верификации, fallback)
 *     tags: [Auth]
 *     security: []
 */
router.post("/register", async (req, res, next) => {
  const ct = String(req.headers["content-type"] || "");
  try {
    if (!ct.includes("application/json")) {
      return res.status(415).json({ error: "Content-Type must be application/json" });
    }

    const { email, password, username } = req.body ?? {};
    const emailVal = coerceString(email);
    const passwordVal = coerceString(password);
    const usernameVal = coerceString(username);

    if (!emailVal || !passwordVal || !usernameVal) {
      return res.status(400).json({ success: false, error: "Please provide email, password, and username" });
    }

    const cleanEmail = emailVal.trim().toLowerCase();
    const cleanUsername = usernameVal.trim();
    const cleanPassword = passwordVal;

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: EMAIL_VALIDATION_MESSAGE });
    }
    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({ success: false, error: USERNAME_VALIDATION_MESSAGE });
    }
    if (!isStrongPassword(cleanPassword)) {
      return res.status(400).json({ success: false, error: PASSWORD_POLICY_MESSAGE });
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
    if (existing) {
      return res.status(409).json({ success: false, error: "This email is already registered. Please sign in." });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    let user;
    try {
      user = await createPersistentUser({
        email: cleanEmail,
        username: cleanUsername,
        passwordHash: hashedPassword,
      });
    } catch (e) {
      if (e instanceof EmailInUseError) {
        return res.status(409).json({ success: false, error: "This email is already registered. Please sign in." });
      }
      throw e;
    }

    console.log("/auth/register success:", { id: user.id });
    res.json({
      success: true,
      token: signAuthToken(user),
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Авторизация пользователя
 *     tags: [Auth]
 *     security: []
 */
router.post("/login", async (req, res, next) => {
  try {
    const ct = String(req.headers["content-type"] || "");
    if (!ct.includes("application/json")) {
      return res.status(415).json({ success: false, error: "Content-Type must be application/json", code: 415 });
    }

    const { email, password } = req.body ?? {};
    const emailVal = coerceString(email);
    const passwordVal = coerceString(password);

    if (!emailVal || !passwordVal) {
      return res.status(400).json({ success: false, error: "Please provide both email and password", code: 400 });
    }

    const cleanEmail = emailVal.trim().toLowerCase();
    const cleanPassword = passwordVal;

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ success: false, error: "Please provide both email and password", code: 400 });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: EMAIL_VALIDATION_MESSAGE, code: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Account not found or incorrect password",
        code: 401,
      });
    }

    const isValid = await bcrypt.compare(cleanPassword, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: "Account not found or incorrect password",
        code: 401,
      });
    }

    console.log("/auth/login success:", { id: user.id });
    res.json({
      success: true,
      token: signAuthToken(user),
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Получение информации о текущем пользователе
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json(toPublicUser(user));
  } catch (err) {
    console.error("/auth/me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Send password reset code to email
 *     tags: [Auth]
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    // Checked before the user lookup so the response does not reveal whether an account exists.
    if (!isEmailConfigured()) {
      return res.status(503).json({ success: false, error: EMAIL_UNAVAILABLE_MESSAGE });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: cleanEmail }, select: { id: true } });
    if (user) {
      const code = generateVerificationCode();
      saveVerificationCode(cleanEmail, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        type: "reset",
      });
      const sent = await sendPasswordResetCode(cleanEmail, code);
      if (!sent) {
        deleteVerificationCode(cleanEmail);
        return res.status(503).json({ success: false, error: "Failed to send reset email. Please try again later." });
      }
    }

    return res.json({
      success: true,
      message: "If an account exists with this email, a reset code has been sent.",
    });
  } catch (err) {
    console.error("/auth/forgot-password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /auth/verify-reset-code:
 *   post:
 *     summary: Verify the password reset code
 *     tags: [Auth]
 */
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || typeof email !== "string" || !code || typeof code !== "string") {
      return res.status(400).json({ success: false, error: "Email and code are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const entry = getVerificationCode(cleanEmail);

    if (!entry || entry.type !== "reset") {
      return res.status(400).json({ success: false, error: "Reset code expired or not found. Please request a new one." });
    }

    if (entry.code !== code.trim()) {
      return res.status(400).json({ success: false, error: "Invalid reset code. Please try again." });
    }

    // Generate a temporary reset token
    const resetToken = jwt.sign(
      { email: cleanEmail, purpose: "reset" },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    saveResetToken(resetToken, { email: cleanEmail, expiresAt: Date.now() + 15 * 60 * 1000 });
    deleteVerificationCode(cleanEmail);

    return res.json({ success: true, resetToken });
  } catch (err) {
    console.error("/auth/verify-reset-code error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with verified token
 *     tags: [Auth]
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body || {};
    if (!resetToken || typeof resetToken !== "string") {
      return res.status(400).json({ success: false, error: "Reset token is required" });
    }
    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({ success: false, error: "New password is required" });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, error: PASSWORD_POLICY_MESSAGE });
    }

    const entry = getResetToken(resetToken);
    if (!entry) {
      return res.status(400).json({ success: false, error: "Reset token is invalid or expired. Please start over." });
    }

    const user = await prisma.user.findUnique({ where: { email: entry.email }, select: { id: true } });
    if (!user) {
      deleteResetToken(resetToken);
      return res.status(400).json({ success: false, error: "Reset token is invalid or expired. Please start over." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
    deleteResetToken(resetToken);

    console.log("/auth/reset-password success:", { id: user.id });
    return res.json({
      success: true,
      message: "Password has been reset successfully. Please sign in with your new password."
    });
  } catch (err) {
    console.error("/auth/reset-password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
