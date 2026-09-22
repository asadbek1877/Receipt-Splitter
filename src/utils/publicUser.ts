// Only these fields may ever be sent to clients. Never include `password`.
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  uniqueId: true,
  avatarUrl: true,
} as const;

export type PublicUser = {
  id: number;
  email: string;
  username: string;
  uniqueId: string;
  avatarUrl: string | null;
};

export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    uniqueId: user.uniqueId,
    avatarUrl: user.avatarUrl ?? null,
  };
}
