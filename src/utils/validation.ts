import type { Request } from "express";

// Enhanced password validation with clear messaging
export function isStrongPassword(pw: string): boolean {
  if (typeof pw !== "string") return false;
  if (pw.length < 6) return false;
  // Optional: could add more strength requirements here
  return true;
}

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 6 characters";

// Email validation
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const EMAIL_VALIDATION_MESSAGE =
  "Please enter a valid email address";

// Username validation
export function isValidUsername(username: string): boolean {
  if (typeof username !== "string") return false;
  if (username.length < 2) return false;
  if (username.length > 32) return false;
  // Allow alphanumeric, underscore, hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  return usernameRegex.test(username);
}

export const USERNAME_VALIDATION_MESSAGE =
  "Username must be 2-32 characters (alphanumeric, underscore, hyphen only)";

// Check JSON content type
export function hasJsonContentType(req: Request): boolean {
  const ct = String(req.headers["content-type"] || "");
  return ct.includes("application/json");
}
