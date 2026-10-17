import nodemailer from "nodemailer";

// SMTP configuration from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@splitter.app";
const APP_NAME = "Splitter";

function hasSmtpCredentials(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Outside production, a missing SMTP setup falls back to printing the code in the
// server console so registration / password reset can be tested locally.
function useConsoleFallback(): boolean {
  return !hasSmtpCredentials() && process.env.NODE_ENV !== "production";
}

export function isEmailConfigured(): boolean {
  return hasSmtpCredentials() || useConsoleFallback();
}

/**
 * Send a verification code email for registration
 */
export async function sendVerificationCode(to: string, code: string): Promise<boolean> {
  if (useConsoleFallback()) {
    console.log(`[Email:DEV] Verification code for ${to}: ${code}`);
    return true;
  }
  if (!isEmailConfigured()) {
    console.error("[Email] SMTP not configured; verification code was not sent.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: `${APP_NAME} — Код подтверждения / Verification Code`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #059669; font-size: 28px; margin: 0;">${APP_NAME}</h1>
            <p style="color: #6B7280; font-size: 14px; margin-top: 8px;">Email Verification</p>
          </div>
          <div style="background: white; border-radius: 12px; padding: 32px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">Ваш код подтверждения:</p>
            <p style="color: #6B7280; font-size: 13px; margin: 0 0 24px;">Your verification code:</p>
            <div style="background: #F0FDF4; border: 2px dashed #059669; border-radius: 12px; padding: 20px; margin: 0 auto; max-width: 200px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #059669;">${code}</span>
            </div>
            <p style="color: #9CA3AF; font-size: 13px; margin-top: 24px;">
              Код действителен 10 минут.<br/>
              Code is valid for 10 minutes.
            </p>
          </div>
          <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 16px;">
            Если вы не запрашивали этот код, просто проигнорируйте это письмо.<br/>
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `,
    });
    console.log(`[Email] Verification code sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send verification code to ${to}:`, error);
    return false;
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetCode(to: string, code: string): Promise<boolean> {
  if (useConsoleFallback()) {
    console.log(`[Email:DEV] Password reset code for ${to}: ${code}`);
    return true;
  }
  if (!isEmailConfigured()) {
    console.error("[Email] SMTP not configured; password reset code was not sent.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: `${APP_NAME} — Сброс пароля / Password Reset`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #059669; font-size: 28px; margin: 0;">${APP_NAME}</h1>
            <p style="color: #6B7280; font-size: 14px; margin-top: 8px;">Password Reset</p>
          </div>
          <div style="background: white; border-radius: 12px; padding: 32px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">Код для сброса пароля:</p>
            <p style="color: #6B7280; font-size: 13px; margin: 0 0 24px;">Your password reset code:</p>
            <div style="background: #FEF3C7; border: 2px dashed #D97706; border-radius: 12px; padding: 20px; margin: 0 auto; max-width: 200px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #D97706;">${code}</span>
            </div>
            <p style="color: #9CA3AF; font-size: 13px; margin-top: 24px;">
              Код действителен 10 минут.<br/>
              Code is valid for 10 minutes.
            </p>
          </div>
          <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 16px;">
            Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.<br/>
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `,
    });
    console.log(`[Email] Password reset code sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send reset code to ${to}:`, error);
    return false;
  }
}
