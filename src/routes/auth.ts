import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";
import {
  getOrCreateUser,
  updateUser,
  findUserByEmail,
  createUser,
  toPublicUser,
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
import { APIError } from "../middleware/errorHandler.js";
import { sendVerificationCode, sendPasswordResetCode, isEmailConfigured } from "../services/emailService.js";

const router = Router();

function generateUniqueId() {
  return "#" + Math.floor(1000 + Math.random() * 9000);
}

// Helper: coerce value to string if possible
function coerceString(val: any): string | undefined {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return undefined;
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

    // Check if email already exists
    const existing = findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: "This email is already registered. Please sign in." });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    const code = generateVerificationCode();

    // Save verification code with pending user data
    saveVerificationCode(cleanEmail, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      type: "register",
      pendingData: { username: cleanUsername, email: cleanEmail, passwordHash: hashedPassword },
    });

    // Send email
    await sendVerificationCode(cleanEmail, code);

    const debugCode = !isEmailConfigured() && process.env.NODE_ENV !== "production" ? code : undefined;

    console.log("/auth/register/send-code:", { email: cleanEmail, code });
    return res.json({
      success: true,
      message: "Verification code sent to your email.",
      ...(debugCode ? { debugCode } : {}),
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

    // Create the user
    const uniqueId = generateUniqueId();
    const user = createUser({
      email: entry.pendingData.email,
      username: entry.pendingData.username,
      passwordHash: entry.pendingData.passwordHash,
      uniqueId,
    });

    deleteVerificationCode(cleanEmail);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    console.log("/auth/register/verify success:", { id: user.id });
    return res.json({
      success: true,
      token,
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

    // Check if email already exists
    const existing = findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: "This email is already registered. Please sign in." });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    const uniqueId = generateUniqueId();

    const user = createUser({
      email: cleanEmail,
      username: cleanUsername,
      passwordHash: hashedPassword,
      uniqueId,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    console.log("/auth/register success:", { id: user.id });
    res.json({
      success: true,
      token,
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
  console.log("/auth/login body:", req.body);
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

    // Find user by email
    const user = findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: "Account not found or incorrect password",
        code: 401,
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ 
        success: false,
        error: "Account not found or incorrect password",
        code: 401,
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    console.log("/auth/login success:", { id: user.id });
    res.json({
      success: true,
      token,
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

    const user = getOrCreateUser(req.user.id, {
      email: req.user.email || "test@example.com",
    });

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

    const cleanEmail = email.trim().toLowerCase();

    // Always return success to prevent email enumeration
    // But only send email if user exists
    const user = findUserByEmail(cleanEmail);
    let debugResetCode: string | undefined;
    if (user) {
      const code = generateVerificationCode();
      saveVerificationCode(cleanEmail, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        type: "reset",
      });
      await sendPasswordResetCode(cleanEmail, code);
      console.log("/auth/forgot-password code:", { email: cleanEmail, code });
      if (!isEmailConfigured() && process.env.NODE_ENV !== "production") {
        debugResetCode = code;
      }
    } else {
      console.log("/auth/forgot-password: user not found for", cleanEmail);
    }

    return res.json({
      success: true,
      message: "If an account exists with this email, a reset code has been sent.",
      ...(debugResetCode ? { debugCode: debugResetCode } : {}),
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

    const user = findUserByEmail(entry.email);
    if (!user) {
      return res.status(400).json({ success: false, error: "User not found." });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    updateUser(user.id, { passwordHash: hashedPassword });
    deleteResetToken(resetToken);

    console.log("/auth/reset-password success for:", entry.email);
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
