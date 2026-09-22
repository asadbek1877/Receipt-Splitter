export type MockUser = {
  id: number;
  email: string;
  username: string;
  uniqueId: string;
  avatarUrl: string | null;
  passwordHash: string;
};

// Public user type (without password)
export type PublicUser = Omit<MockUser, 'passwordHash'>;

let nextUserId = 1;
const usersById = new Map<number, MockUser>();
const usersByEmail = new Map<string, MockUser>();

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

function defaultUniqueId(id: number) {
  return `#${String(id).padStart(4, '0')}`;
}

export function toPublicUser(user: MockUser): PublicUser {
  const { passwordHash, ...pub } = user;
  return pub;
}

export function findUserByEmail(email: string): MockUser | undefined {
  return usersByEmail.get(email.toLowerCase());
}

export function createUser(data: { email: string; username: string; passwordHash: string; uniqueId?: string }): MockUser {
  const id = nextUserId++;
  const user: MockUser = {
    id,
    email: data.email.toLowerCase(),
    username: data.username,
    uniqueId: data.uniqueId ?? defaultUniqueId(id),
    avatarUrl: null,
    passwordHash: data.passwordHash,
  };
  usersById.set(id, user);
  usersByEmail.set(user.email, user);
  return user;
}

export function getOrCreateUser(id: number, overrides?: Partial<MockUser>): MockUser {
  const existing = usersById.get(id);
  if (existing) {
    if (overrides && Object.keys(overrides).length > 0) {
      const updated = { ...existing, ...overrides };
      usersById.set(id, updated);
      usersByEmail.set(updated.email, updated);
      return updated;
    }
    return existing;
  }

  const created: MockUser = {
    id,
    email: overrides?.email ?? `user${id}@example.com`,
    username: overrides?.username ?? `User${id}`,
    uniqueId: overrides?.uniqueId ?? defaultUniqueId(id),
    avatarUrl: overrides?.avatarUrl ?? null,
    passwordHash: overrides?.passwordHash ?? '',
  };

  if (id >= nextUserId) nextUserId = id + 1;
  usersById.set(id, created);
  usersByEmail.set(created.email, created);
  return created;
}

export function updateUser(id: number, updates: Partial<MockUser>): MockUser {
  const current = getOrCreateUser(id);
  const updated = { ...current, ...updates };
  usersById.set(id, updated);
  usersByEmail.set(updated.email, updated);
  return updated;
}

// --- Verification Codes ---
export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
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
