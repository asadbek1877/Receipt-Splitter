import axios, { AxiosError } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken, saveToken } from '@/shared/lib/utils/token-storage';
import { emitUnauthorized } from '@/shared/api/auth-events';

const DEFAULT_API_PORT = '3001';

const resolveApiUrl = (): string => {
  // 1. Try Expo hostUri first (auto-detects dev machine IP reliably)
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants.manifest2 as any)?.extra?.expoClient?.hostUri ||
    (Constants.manifest as any)?.hostUri;

  const hostIp = hostUri ? String(hostUri).split(':')[0] : '';

  // 2. If env variable is set, use it
  const envUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  if (envUrl) return envUrl;

  // 3. Auto-detect from Expo dev server
  if (hostIp) return `http://${hostIp}:${DEFAULT_API_PORT}`;

  // 4. Platform-specific fallbacks
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_API_PORT}`;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
};

const API_URL = resolveApiUrl();
console.log('[API] Base URL:', API_URL);

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Simple retry wrapper for network errors
const MAX_RETRIES = 1;
const RETRY_DELAY = 800;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Only requests whose HTTP method is safe to repeat may be auto-retried. A timeout or
// dropped connection gives no guarantee the server didn't already act on the original
// request, so retrying a POST/PATCH/PUT/DELETE here could resend a non-idempotent write
// (e.g. POST /sessions/scan, POST /sessions/finalize) and duplicate its side effects.
// This is a client-side convenience only — the backend does not rely on it for
// correctness (see the server-side idempotency key on /sessions/scan and the
// status-guarded finalize transaction).
const RETRY_SAFE_METHODS = new Set(['get', 'head', 'options']);
const isRetrySafeRequest = (config: any): boolean =>
  RETRY_SAFE_METHODS.has(String(config?.method || '').toLowerCase());

// Custom error class to mark errors that have already been formatted
class ApiError extends Error {
  /** Already formatted by the interceptor — do not wrap again */
  __processed = true;
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

apiClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  // If the error was already processed by the formatting interceptor, pass through
  if ((error as any).__processed) return Promise.reject(error);

  const config = error.config as any;
  if (!config) return Promise.reject(error);
  config.__retryCount = config.__retryCount || 0;
  // Only retry on actual network errors (no response at all), NOT on 500s, and only for
  // methods that are safe to repeat.
  const isNetworkError = !error.response && (String(error.message).toLowerCase().includes('network') || error.code === 'ECONNABORTED');
  if (isNetworkError && isRetrySafeRequest(config) && config.__retryCount < MAX_RETRIES) {
    config.__retryCount += 1;
    await sleep(RETRY_DELAY * config.__retryCount);
    return apiClient(config);
  }
  return Promise.reject(error);
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await getToken();
    if (token) {
      const headers: any = config.headers ?? {};
      if (typeof headers.set === 'function') {
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('Content-Type', headers.get?.('Content-Type') ?? 'application/json');
      } else {
        config.headers = {
          ...headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': headers['Content-Type'] ?? 'application/json',
        };
      }
    }
  } catch {
    // If token retrieval fails we keep going; request will likely return 401.
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // If error was already formatted (e.g. from a retry), pass through without re-wrapping
    if ((error as any).__processed) {
      return Promise.reject(error);
    }

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;
      const serverMsg: string | undefined =
        typeof data === 'string' ? data : data?.message || data?.error;

      switch (status) {
        case 400:
          throw new ApiError(serverMsg || 'Invalid request. Please check your input.');
        case 401:
          emitUnauthorized();
          throw new ApiError(serverMsg || 'Authorization failed');
        case 409:
          throw new ApiError(serverMsg || 'This resource already exists.');
        case 415:
          throw new ApiError(serverMsg || 'Invalid content type.');
        case 422:
          throw new ApiError(serverMsg || 'Validation error');
        case 500:
          throw new ApiError(serverMsg || 'Server error. Please try again later.');
        default:
          throw new ApiError(serverMsg || `Request failed (${status})`);
      }
    } else if (error.request) {
      const msg = String(error.message).toLowerCase();
      if (msg.includes('network') || msg.includes('err_connection')) {
        throw new ApiError('Network error. Please check your connection.');
      }
      if (error.code === 'ECONNABORTED') {
        throw new ApiError('Request timed out. Please try again.');
      }
      throw new ApiError('Server is not responding. Please check your connection and try again.');
    }

    throw new ApiError(error.message || 'Unexpected error');
  }
);
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    username: string;
    uniqueId: string;
    avatarUrl: string | null;
  };
}

export interface User {
  id: number;
  email: string;
  username: string;
  uniqueId: string;
  avatarUrl: string | null;
}

/** ===== Auth API ===== */

/** POST /auth/login */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

/** POST /auth/register */
export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
  return data;
}

/**
 * GET /auth/me
 * If token is provided it is used directly; otherwise the request
 * interceptor injects the stored token automatically.
 */
export async function getCurrentUser(token?: string): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me', token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined,
  );
  return data;
}

/** POST /auth/logout */
export async function logout(token?: string): Promise<void> {
  await apiClient.post('/auth/logout', {}, token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined,
  );
}
/**
 * POST /uploads/avatar
 * Uploads a new avatar file and returns the CDN URL.
 */
export interface UploadAvatarResponse {
  success: boolean;
  avatarUrl: string;
  key: string;
}

// Multipart uploads go through React Native's own fetch, not axios: axios 1.x on
// Android fails file FormData with a bare "Network Error" (it cannot set the
// multipart boundary). fetch builds the body and boundary natively.
export async function uploadAvatar(formData: FormData): Promise<UploadAvatarResponse> {
  const token = await getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/uploads/avatar`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
  } catch (e: any) {
    throw new ApiError(
      e?.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Network error. Please check your connection.',
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401) emitUnauthorized();
    throw new ApiError(data?.error || data?.message || `Upload failed (${res.status})`);
  }
  return data as UploadAvatarResponse;
}

export interface UpdateAvatarPayload {
  avatarUrl: string;
}

/**
 * PATCH /users/me/avatar
 * Updates the current user's avatar URL.
 */
export async function updateAvatar(payload: UpdateAvatarPayload): Promise<User> {
  const response = await apiClient.patch<User | null>('/users/me/avatar', payload);
  if (response.data) {
    return response.data;
  }
  return getCurrentUser();
}

export interface UpdateUsernamePayload {
  username: string;
}

/**
 * PATCH /user/username
 * Updates the current user's username.
 */
export async function updateUsername(payload: UpdateUsernamePayload): Promise<User> {
  const response = await apiClient.patch<User | null>('/user/username', payload);
  if (response.data) {
    return response.data;
  }
  return getCurrentUser();
}

export interface UpdateEmailPayload {
  email: string;
  currentPassword: string;
}

/**
 * PATCH /user/email
 * Updates the current user's email address. The server issues a new token
 * (tokens are bound to the email), which replaces the stored one.
 */
export async function updateEmail(payload: UpdateEmailPayload): Promise<User> {
  const response = await apiClient.patch<(User & { token?: string }) | null>('/user/email', payload);
  if (response.data) {
    const { token, ...user } = response.data;
    if (token) {
      await saveToken(token);
    }
    return user;
  }
  return getCurrentUser();
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/**
 * PATCH /user/password
 * Changes the current user's password.
 */
export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiClient.patch('/user/password', payload);
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

/** POST /auth/forgot-password */
export async function forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const { data } = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', payload);
  return data;
}

// --- Registration with email verification ---

export interface SendVerificationCodeRequest {
  email: string;
  password: string;
  username: string;
}

export interface SendVerificationCodeResponse {
  success: boolean;
  message: string;
}

/** POST /auth/register/send-code — Step 1: send verification code */
export async function sendRegistrationCode(payload: SendVerificationCodeRequest): Promise<SendVerificationCodeResponse> {
  const { data } = await apiClient.post<SendVerificationCodeResponse>('/auth/register/send-code', payload);
  return data;
}

export interface VerifyRegistrationCodeRequest {
  email: string;
  code: string;
}

/** POST /auth/register/verify — Step 2: verify code and complete registration */
export async function verifyRegistrationCode(payload: VerifyRegistrationCodeRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register/verify', payload);
  return data;
}

// --- Password reset with code ---

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface VerifyResetCodeResponse {
  success: boolean;
  resetToken: string;
}

/** POST /auth/verify-reset-code — Verify reset code */
export async function verifyResetCode(payload: VerifyResetCodeRequest): Promise<VerifyResetCodeResponse> {
  const { data } = await apiClient.post<VerifyResetCodeResponse>('/auth/verify-reset-code', payload);
  return data;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

/** POST /auth/reset-password — Reset password with token */
export async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const { data } = await apiClient.post<ResetPasswordResponse>('/auth/reset-password', payload);
  return data;
}

/**
 * DELETE /users/me/avatar
 * Resets the current user's avatar to default (null in DB).
 */
export async function resetAvatar(): Promise<User> {
  const response = await apiClient.delete<User | null>('/users/me/avatar');
  if (response.data) {
    return response.data;
  }
  return getCurrentUser();
}
