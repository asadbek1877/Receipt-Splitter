// Server-side idempotency for non-idempotent, resource-creating POST endpoints
// (currently only /sessions/scan). Backed by the IdempotencyKey table so it survives
// concurrent requests and process restarts — never an in-memory-only map.
//
// The table is optional at runtime: if the pending migration that creates it hasn't
// been applied yet, every call here degrades to `unsupported` and the caller proceeds
// exactly as it did before this feature existed. Nothing breaks either way.

import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

const MAX_KEY_LENGTH = 200;

export type IdempotencyClaim =
  | { mode: "proceed"; rowId: number }
  | { mode: "replay"; status: number; body: unknown }
  | { mode: "conflict" }
  | { mode: "unsupported" };

function isMissingTable(err: unknown): boolean {
  // P2021: table does not exist yet (migration not applied). Any other error should
  // surface normally rather than being silently swallowed.
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
}

let warnedMissingTable = false;
function warnOnceMissingTable() {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.warn(
    "[idempotency] IdempotencyKey table not found — the pending migration has not been applied yet. " +
      "Falling back to non-idempotent behavior."
  );
}

/** Extracts a usable client-supplied idempotency key from a request header value. */
export function readIdempotencyKey(headerValue: unknown): string | null {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_KEY_LENGTH) return null;
  return trimmed;
}

/**
 * Attempts to claim `key` for `userId`/`endpoint`.
 * - `proceed`: no prior attempt (or the prior attempt failed and is being retried);
 *   the caller should do the real work and call `completeIdempotencyKey(rowId, ...)`.
 * - `replay`: a previous attempt already completed; return its stored response verbatim
 *   without repeating any work.
 * - `conflict`: another request with the same key is still in flight right now.
 * - `unsupported`: the table isn't available yet; caller proceeds with no idempotency
 *   guarantee, identical to behavior before this feature existed.
 */
export async function claimIdempotencyKey(
  userId: number,
  endpoint: string,
  key: string
): Promise<IdempotencyClaim> {
  try {
    const row = await prisma.idempotencyKey.create({
      data: { userId, endpoint, key, status: "PENDING" },
      select: { id: true },
    });
    return { mode: "proceed", rowId: row.id };
  } catch (err) {
    if (isMissingTable(err)) {
      warnOnceMissingTable();
      return { mode: "unsupported" };
    }
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
      throw err;
    }
    // A row for this key already exists — inspect it instead of racing another insert.
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: { userId_endpoint_key: { userId, endpoint, key } },
  });
  if (!existing) {
    // Extremely unlikely: the conflicting row was deleted between the failed create and
    // this read. Treat as a fresh attempt.
    return claimIdempotencyKey(userId, endpoint, key);
  }

  if (existing.status === "COMPLETED") {
    return { mode: "replay", status: existing.responseStatus ?? 200, body: existing.responseBody };
  }
  if (existing.status === "PENDING") {
    return { mode: "conflict" };
  }

  // FAILED: nothing was created last time, so it's safe (and helpful) to let a retry
  // with the same key try again. Claim it with a guarded update so two concurrent
  // retries can't both "win" the revival.
  const revived = await prisma.idempotencyKey.updateMany({
    where: { id: existing.id, status: "FAILED" },
    data: { status: "PENDING", responseStatus: null, responseBody: Prisma.JsonNull },
  });
  if (revived.count !== 1) {
    // Someone else revived it a moment earlier; re-check its (now current) state.
    const reread = await prisma.idempotencyKey.findUnique({ where: { id: existing.id } });
    if (reread?.status === "COMPLETED") {
      return { mode: "replay", status: reread.responseStatus ?? 200, body: reread.responseBody };
    }
    return { mode: "conflict" };
  }
  return { mode: "proceed", rowId: existing.id };
}

export async function completeIdempotencyKey(
  rowId: number,
  outcome: "COMPLETED" | "FAILED",
  responseStatus: number,
  responseBody: unknown
): Promise<void> {
  try {
    await prisma.idempotencyKey.update({
      where: { id: rowId },
      data: {
        status: outcome,
        responseStatus,
        responseBody: responseBody as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    if (isMissingTable(err)) return; // table vanished mid-request (shouldn't happen); nothing to do
    // Never let bookkeeping failures mask the real response already sent to the client.
    console.error("[idempotency] failed to record outcome:", err);
  }
}
