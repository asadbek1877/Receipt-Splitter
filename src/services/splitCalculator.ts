import { allocateMinor, currencyMinorDigits, fromMinor, toMinor } from "../utils/money.js";

export interface SplitParticipantInput {
  uniqueId: string;
  username: string;
}

export type AdjustmentType = "tax" | "discount" | "tip" | "service";
const ADJUSTMENT_TYPES = new Set<AdjustmentType>(["tax", "discount", "tip", "service"]);

export interface AppliedAdjustment {
  id: string;
  type: AdjustmentType;
  label: string;
  /** Positive magnitude as printed. */
  amount: number;
  includedInPrices: boolean;
  /** Effect on the payable total: negative for discounts, 0 when included in prices. */
  appliedAmount: number;
}

/** Client input that cannot produce a correct split. Maps to HTTP 400. */
export class SplitValidationError extends Error {
  constructor(message: string, public details?: Record<string, string>) {
    super(message);
    this.name = "SplitValidationError";
  }
}

export interface SplitResult {
  digits: number;
  subtotal: number;
  grandTotal: number;
  adjustments: AppliedAdjustment[];
  byItem: Array<{
    id: unknown;
    name: unknown;
    totalAmount: number;
    itemId: unknown;
    total: number;
    kind: string;
  }>;
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
  /** Minor-unit totals per purchased item, in input order (used for analytics records). */
  itemTotalsMinor: number[];
  /** Minor-unit total of applied receipt-level adjustments (signed). */
  adjustmentsTotalMinor: number;
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

function itemLabel(item: any, index: number): string {
  return typeof item?.name === "string" && item.name ? item.name : `item ${index + 1}`;
}

/**
 * Payable line total of an item. The actual line total (`totalPrice`) wins over
 * unitPrice × quantity, so line discounts, weighed goods and package prices survive.
 */
function itemLineTotal(item: any, index: number): number {
  const hasTotal = item?.totalPrice !== undefined && item?.totalPrice !== null;
  const value = hasTotal ? Number(item.totalPrice) : Number(item?.price) * Number(item?.quantity ?? 1);
  if (!Number.isFinite(value)) {
    throw new SplitValidationError(`Invalid price for "${itemLabel(item, index)}"`);
  }
  if (value < 0) {
    throw new SplitValidationError(
      `Item "${itemLabel(item, index)}" has a negative amount. Record discounts as a discount adjustment.`
    );
  }
  return value;
}

export function normalizeAdjustments(raw: unknown): Omit<AppliedAdjustment, "appliedAmount">[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new SplitValidationError("adjustments must be an array");
  return raw.map((adj: any, index) => {
    const type = adj?.type as AdjustmentType;
    if (!ADJUSTMENT_TYPES.has(type)) {
      throw new SplitValidationError(`Unknown adjustment type "${String(adj?.type)}"`);
    }
    const amount = Number(adj?.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new SplitValidationError(`Adjustment amounts must be positive numbers (${type})`);
    }
    return {
      id: typeof adj?.id === "string" && adj.id ? adj.id : `ADJ${index + 1}`,
      type,
      label: typeof adj?.label === "string" && adj.label ? adj.label : type,
      amount,
      includedInPrices: (type === "tax" || type === "service") && adj?.includedInPrices === true,
    };
  });
}

/**
 * Computes per-item and per-participant shares in integer minor units.
 *
 * Invariants (for inputs that pass validation):
 *  - every item is fully assigned, otherwise SplitValidationError is thrown;
 *  - each item's (and each adjustment's) shares sum exactly to its amount;
 *  - participant totals sum exactly to grandTotal = subtotal + applied adjustments.
 */
export function computeSplit(
  items: any[],
  participants: SplitParticipantInput[],
  currency: string,
  rawAdjustments?: unknown
): SplitResult {
  const digits = currencyMinorDigits(currency);
  const participantIds = new Set(participants.map((p) => p.uniqueId));
  const participantTotalsMinor = new Map<string, number>(participants.map((p) => [p.uniqueId, 0]));
  const itemSubtotalsMinor = new Map<string, number>(participants.map((p) => [p.uniqueId, 0]));
  const byItem: SplitResult["byItem"] = [];
  const allocations: SplitResult["allocations"] = [];
  const itemTotalsMinor: number[] = [];
  const unassigned: string[] = [];

  const adjustmentInputs = normalizeAdjustments(rawAdjustments);

  items.forEach((item: any, itemIndex: number) => {
    const itemMinor = toMinor(itemLineTotal(item, itemIndex), digits);
    itemTotalsMinor.push(itemMinor);
    const itemTotal = fromMinor(itemMinor, digits);
    byItem.push({
      id: item?.id,
      name: item?.name,
      totalAmount: itemTotal,
      itemId: item?.id,
      total: itemTotal,
      kind: "item",
    });

    const splitMode = item?.splitMode || "equal";
    let shareIds: string[] = [];
    let weights: number[] = [];
    let unitsMode = false;

    if (splitMode === "count") {
      const quantity = Number(item?.quantity) > 0 ? Number(item.quantity) : 1;
      for (const [uid, rawCount] of Object.entries(item?.perPersonCount ?? {})) {
        const count = Number(rawCount);
        if (!participantIds.has(uid) || !Number.isFinite(count) || count <= 0) continue;
        shareIds.push(uid);
        weights.push(count);
      }
      const totalUnits = weights.reduce((sum, w) => sum + w, 0);
      if (Math.abs(totalUnits - quantity) > 1e-9) {
        if (totalUnits > quantity) {
          throw new SplitValidationError(
            `"${itemLabel(item, itemIndex)}" has ${totalUnits} units assigned but only ${quantity} on the receipt`
          );
        }
        unassigned.push(itemLabel(item, itemIndex));
        return;
      }
      unitsMode = true;
    } else {
      shareIds = Array.from(
        new Set<string>(
          (Array.isArray(item?.assignedTo) ? item.assignedTo : []).filter(
            (uid: unknown): uid is string => typeof uid === "string" && participantIds.has(uid)
          )
        )
      );
      weights = shareIds.map(() => 1);
    }

    if (shareIds.length === 0) {
      unassigned.push(itemLabel(item, itemIndex));
      return;
    }

    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    const parts = allocateMinor(itemMinor, weights, itemIndex);
    shareIds.forEach((uid, i) => {
      const shareMinor = parts[i] ?? 0;
      participantTotalsMinor.set(uid, (participantTotalsMinor.get(uid) ?? 0) + shareMinor);
      itemSubtotalsMinor.set(uid, (itemSubtotalsMinor.get(uid) ?? 0) + shareMinor);
      allocations.push({
        itemId: item?.id,
        participantId: uid,
        shareAmount: fromMinor(shareMinor, digits),
        shareRatio: (weights[i] ?? 0) / weightSum,
        shareUnits: unitsMode ? weights[i] ?? null : null,
      });
    });
  });

  if (unassigned.length > 0) {
    throw new SplitValidationError("All items must be fully assigned before finalizing", {
      unassignedItems: unassigned.join(", "),
    });
  }

  const subtotalMinor = itemTotalsMinor.reduce((sum, v) => sum + v, 0);

  // Receipt-level adjustments are shared in proportion to each participant's item subtotal.
  const shareBase = participants.map((p) => itemSubtotalsMinor.get(p.uniqueId) ?? 0);
  const baseWeights = shareBase.some((v) => v > 0) ? shareBase : participants.map(() => 1);
  let adjustmentsTotalMinor = 0;
  const adjustments: AppliedAdjustment[] = adjustmentInputs.map((adj, index) => {
    const amountMinor = toMinor(adj.amount, digits);
    const appliedMinor = adj.includedInPrices ? 0 : adj.type === "discount" ? -amountMinor : amountMinor;
    adjustmentsTotalMinor += appliedMinor;
    const applied: AppliedAdjustment = {
      ...adj,
      amount: fromMinor(amountMinor, digits),
      appliedAmount: fromMinor(appliedMinor, digits),
    };
    if (appliedMinor === 0) return applied;

    const rowId = `adj-${adj.id}`;
    byItem.push({
      id: rowId,
      name: adj.label,
      totalAmount: applied.appliedAmount,
      itemId: rowId,
      total: applied.appliedAmount,
      kind: adj.type,
    });
    const parts = allocateMinor(appliedMinor, baseWeights, items.length + index);
    const weightSum = baseWeights.reduce((sum, w) => sum + w, 0);
    participants.forEach((p, i) => {
      const shareMinor = parts[i] ?? 0;
      if (shareMinor === 0) return;
      participantTotalsMinor.set(p.uniqueId, (participantTotalsMinor.get(p.uniqueId) ?? 0) + shareMinor);
      allocations.push({
        itemId: rowId,
        participantId: p.uniqueId,
        shareAmount: fromMinor(shareMinor, digits),
        shareRatio: (baseWeights[i] ?? 0) / weightSum,
        shareUnits: null,
      });
    });
    return applied;
  });

  const grandTotalMinor = subtotalMinor + adjustmentsTotalMinor;
  if (grandTotalMinor < 0) {
    throw new SplitValidationError("Discounts cannot exceed the receipt subtotal");
  }

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

  return {
    digits,
    subtotal: fromMinor(subtotalMinor, digits),
    grandTotal: fromMinor(grandTotalMinor, digits),
    adjustments,
    byItem,
    byParticipant,
    allocations,
    itemTotalsMinor,
    adjustmentsTotalMinor,
    participantTotalsMinor,
  };
}
