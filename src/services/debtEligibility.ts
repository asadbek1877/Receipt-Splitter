import { prisma } from "../config/prisma.js";

/**
 * Resolves which of the given uniqueIds may be recorded as debtors of `creditorId`.
 * A debt can only be created against a real user who is an ACCEPTED friend of
 * the creditor; client-supplied identities are never trusted on their own.
 *
 * Returns a map of uniqueId -> user id for the eligible users only.
 */
export async function resolveEligibleDebtors(
  creditorId: number,
  uniqueIds: string[]
): Promise<Map<string, number>> {
  const eligible = new Map<string, number>();
  const candidates = Array.from(new Set(uniqueIds.filter(Boolean)));
  if (candidates.length === 0) return eligible;

  const users = await prisma.user.findMany({
    where: { uniqueId: { in: candidates }, id: { not: creditorId } },
    select: { id: true, uniqueId: true },
  });
  if (users.length === 0) return eligible;

  const userIds = users.map((u) => u.id);
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: creditorId, receiverId: { in: userIds } },
        { receiverId: creditorId, requesterId: { in: userIds } },
      ],
    },
    select: { requesterId: true, receiverId: true },
  });
  const friendIds = new Set(
    friendships.map((f) => (f.requesterId === creditorId ? f.receiverId : f.requesterId))
  );

  for (const user of users) {
    if (friendIds.has(user.id)) eligible.set(user.uniqueId, user.id);
  }
  return eligible;
}
