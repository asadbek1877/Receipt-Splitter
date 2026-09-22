import { allocateMinor, currencyMinorDigits, fromMinor, toMinor } from "../utils/money.js";

export interface SplitParticipantInput {
  uniqueId: string;
  username: string;
}

export interface SplitResult {
  digits: number;
  grandTotal: number;
  byItem: Array<{ id: unknown; name: unknown; totalAmount: number; itemId: unknown; total: number }>;
  byParticipant: Array<{
    uniqueId: string;
    username: string;
    amountOwed: number;
    participantId: string;
    total: number;
  }>;
  allocations: Array<{
    itemId: unknown;
    participantId: string;
    shareAmount: number;
    shareRatio: number;
    shareUnits: number | null;
  }>;
  /** Minor-unit totals per item, in input order (used for analytics records). */
  itemTotalsMinor: number[];
  participantTotalsMinor: Map<string, number>;
}

/** Normalizes the participants list: string ids only, no duplicates. */
export function normalizeParticipants(raw: unknown[]): SplitParticipantInput[] {
  const seen = new Set<string>();
  const result: SplitParticipantInput[] = [];
  for (const p of raw as any[]) {
    const uniqueId = typeof p?.uniqueId === "string" ? p.uniqueId.trim() : "";
    if (!uniqueId || seen.has(uniqueId)) continue;
    seen.add(uniqueId);
    result.push({
      uniqueId,
      username: typeof p?.username === "string" && p.username ? p.username : uniqueId,
    });
  }
  return result;
}

function itemTotalMajor(item: any): number {
  return Number(item?.totalPrice || item?.price * (item?.quantity || 1) || 0);
}

/**
 * Computes per-item and per-participant shares in integer minor units.
 * For every item, the allocated shares sum exactly to the allocated item amount,
 * so participant totals always sum to the total of the assigned items.
 */
export function computeSplit(
  items: any[],
  participants: SplitParticipantInput[],
  currency: string
): SplitResult {
  const digits = currencyMinorDigits(currency);
  const participantIds = new Set(participants.map((p) => p.uniqueId));
  const participantTotalsMinor = new Map<string, number>(participants.map((p) => [p.uniqueId, 0]));
  const byItem: SplitResult["byItem"] = [];
  const allocations: SplitResult["allocations"] = [];
  const itemTotalsMinor: number[] = [];

  items.forEach((item: any, itemIndex: number) => {
    const itemMinor = toMinor(itemTotalMajor(item), digits);
    itemTotalsMinor.push(itemMinor);
    const itemTotal = fromMinor(itemMinor, digits);
    byItem.push({ id: item?.id, name: item?.name, totalAmount: itemTotal, itemId: item?.id, total: itemTotal });

    const splitMode = item?.splitMode || "equal";
    let shareIds: string[] = [];
    let weights: number[] = [];
    let amountToAllocate = 0;
    let unitsMode = false;

    if (splitMode === "count" && item?.perPersonCount && typeof item.perPersonCount === "object") {
      for (const [uid, rawCount] of Object.entries(item.perPersonCount)) {
        const count = Number(rawCount);
        if (!participantIds.has(uid) || !Number.isFinite(count) || count <= 0) continue;
        shareIds.push(uid);
        weights.push(count);
      }
      const totalUnits = weights.reduce((sum, w) => sum + w, 0);
      const quantity = Number(item?.quantity) > 0 ? Number(item.quantity) : 1;
      // Charge only for the assigned units, never more than the line total.
      amountToAllocate =
        totalUnits >= quantity
          ? itemMinor
          : allocateMinor(itemMinor, [totalUnits, quantity - totalUnits])[0] ?? 0;
      unitsMode = true;
    } else if (splitMode === "equal" && Array.isArray(item?.assignedTo)) {
      shareIds = Array.from(
        new Set<string>(
          item.assignedTo.filter((uid: unknown): uid is string => typeof uid === "string" && participantIds.has(uid))
        )
      );
      weights = shareIds.map(() => 1);
      amountToAllocate = itemMinor;
    }

    if (shareIds.length === 0) return;

    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    const parts = allocateMinor(amountToAllocate, weights, itemIndex);
    shareIds.forEach((uid, i) => {
      const shareMinor = parts[i] ?? 0;
      participantTotalsMinor.set(uid, (participantTotalsMinor.get(uid) ?? 0) + shareMinor);
      allocations.push({
        itemId: item?.id,
        participantId: uid,
        shareAmount: fromMinor(shareMinor, digits),
        shareRatio: (weights[i] ?? 0) / weightSum,
        shareUnits: unitsMode ? weights[i] ?? null : null,
      });
    });
  });

  const byParticipant = participants.map((p) => {
    const amount = fromMinor(participantTotalsMinor.get(p.uniqueId) ?? 0, digits);
    return {
      uniqueId: p.uniqueId,
      username: p.username,
      amountOwed: amount,
      participantId: p.uniqueId,
      total: amount,
    };
  });

  const grandTotal = fromMinor(
    itemTotalsMinor.reduce((sum, v) => sum + v, 0),
    digits
  );

  return {
    digits,
    grandTotal,
    byItem,
    byParticipant,
    allocations,
    itemTotalsMinor,
    participantTotalsMinor,
  };
}
