// Short-lived, in-process storage for email verification codes and password
// reset tokens. User accounts are NOT stored here — they live in PostgreSQL.

import { randomInt } from "node:crypto";

// Verification codes: email -> { code, expiresAt, type }
export type VerificationEntry = {
  code: string;
  expiresAt: number;
  type: 'register' | 'reset';
  // For register: temporary user data
  pendingData?: { username: string; email: string; passwordHash: string };
};
const verificationCodes = new Map<string, VerificationEntry>();

// Password reset tokens: token -> { email, expiresAt }
export type ResetTokenEntry = { email: string; expiresAt: number };
const resetTokens = new Map<string, ResetTokenEntry>();

// --- Verification Codes ---
export function generateVerificationCode(): string {
  return String(randomInt(100000, 1000000)); // 6-digit code
}

export function saveVerificationCode(email: string, entry: VerificationEntry): void {
  verificationCodes.set(email.toLowerCase(), entry);
}

export function getVerificationCode(email: string): VerificationEntry | undefined {
  const entry = verificationCodes.get(email.toLowerCase());
  if (entry && entry.expiresAt < Date.now()) {
    verificationCodes.delete(email.toLowerCase());
    return undefined;
  }
  return entry;
}

export function deleteVerificationCode(email: string): void {
  verificationCodes.delete(email.toLowerCase());
}

// --- Password Reset Tokens ---
export function saveResetToken(token: string, entry: ResetTokenEntry): void {
  resetTokens.set(token, entry);
}

export function getResetToken(token: string): ResetTokenEntry | undefined {
  const entry = resetTokens.get(token);
  if (entry && entry.expiresAt < Date.now()) {
    resetTokens.delete(token);
    return undefined;
  }
  return entry;
}

export function deleteResetToken(token: string): void {
  resetTokens.delete(token);
}
