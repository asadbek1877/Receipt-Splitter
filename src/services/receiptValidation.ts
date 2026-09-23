// Strict runtime validation of AI receipt output.
// Invalid or missing numbers never silently become 0: the affected line or the whole
// receipt is flagged `needsReview` with a human-readable issue, or rejected outright.

import { currencyMinorDigits, fromMinor, toMinor } from "../utils/money.js";

export type AdjustmentType = "tax" | "discount" | "tip" | "service";

export interface ReceiptAdjustment {
  id: string;
  type: AdjustmentType;
  label: string;
  /** Always a positive magnitude. Discounts reduce the payable total; the others increase it. */
  amount: number;
  /** True when the amount is already contained in item prices (e.g. VAT printed "incl."). */
  includedInPrices: boolean;
}

export interface ValidatedReceiptItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  /** Actual payable line total as printed (after any item-level discount). */
  totalPrice: number;
  /** Item-level discount already reflected in totalPrice (positive magnitude). */
  discount?: number;
  kind: "item";
  needsReview?: boolean;
  issues?: string[];
}

export interface ValidatedReceipt {
  items: ValidatedReceiptItem[];
  summary: {
    currency: string;
    /** Sum of item line totals. */
    subtotal: number;
    /** Payable total computed from items and adjustments. */
    grandTotal: number;
    /** Total printed on the receipt, if the model found one. */
    printedTotal: number | null;
    /** True when items + adjustments do not add up to the printed total. */
    printedTotalMismatch: boolean;
    adjustments: ReceiptAdjustment[];
    needsReview: boolean;
    issues: string[];
  };
}

export type ValidationResult =
  | { ok: true; receipt: ValidatedReceipt }
  | { ok: false; errors: string[] };

export const MAX_QUANTITY = 1000;

const ADJUSTMENT_ALIASES: Record<string, AdjustmentType> = {
  tax: "tax",
  vat: "tax",
  nds: "tax",
  discount: "discount",
  coupon: "discount",
  promo: "discount",
  tip: "tip",
  tips: "tip",
  gratuity: "tip",
  service: "service",
  service_charge: "service",
  servicecharge: "service",
  fee: "service",
};

const DISCOUNT_NAME = /discount|coupon|promo|скидк|chegirma|割引|値引/i;

/**
 * Parses a numeric value from model output.
 * Accepts finite numbers and plain numeric strings ("12.50", "12,50").
 * Returns null for missing values and NaN for present-but-invalid values.
 */
export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string") {
    const compact = value.replace(/\s+/g, "");
    if (!/^[-+]?\d+([.,]\d+)?$/.test(compact)) return NaN;
    return Number(compact.replace(",", "."));
  }
  return NaN;
}

const isValid = (n: number | null): n is number => n !== null && Number.isFinite(n);

export function normalizeCurrencyCode(value: unknown): string | null {
  const SYMBOL_TO_ISO: Record<string, string> = {
    $: "USD", US$: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", 円: "JPY", "₽": "RUB", РУБ: "RUB",
    "РУБ.": "RUB", RUR: "RUB", "₴": "UAH", "₩": "KRW", "₦": "NGN", "₹": "INR", "₺": "TRY",
    C$: "CAD", A$: "AUD", HK$: "HKD", SG$: "SGD", "SO'M": "UZS", "SOʻM": "UZS", SUM: "UZS", СУМ: "UZS",
  };
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper === "UNKNOWN") return null;
  if (SYMBOL_TO_ISO[trimmed]) return SYMBOL_TO_ISO[trimmed] ?? null;
  if (SYMBOL_TO_ISO[upper]) return SYMBOL_TO_ISO[upper] ?? null;
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return null;
}

function extractCurrency(raw: any): string | null {
  const candidates = [
    raw?.summary?.currency,
    raw?.summary?.currencyCode,
    raw?.currency,
    raw?.currencyCode,
  ];
  for (const candidate of candidates) {
    const code = normalizeCurrencyCode(candidate);
    if (code) return code;
  }
  return null;
}

export function validateReceiptPayload(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["Model output is not a JSON object"] };
  }
  const data = raw as any;
  if (!Array.isArray(data.items)) {
    return { ok: false, errors: ["Model output has no items array"] };
  }

  const receiptIssues: string[] = [];
  let receiptNeedsReview = false;

  const currencyCode = extractCurrency(data);
  if (!currencyCode) {
    receiptIssues.push("Currency was not detected. Please check the receipt currency.");
    receiptNeedsReview = true;
  }
  const currency = currencyCode ?? "UNKNOWN";
  const digits = currencyMinorDigits(currency);
  const round = (n: number) => fromMinor(toMinor(n, digits), digits);
  const oneUnit = 1 / 10 ** digits;

  const adjustments: ReceiptAdjustment[] = [];
  const items: ValidatedReceiptItem[] = [];

  const pushAdjustment = (type: AdjustmentType, label: string, rawAmount: unknown, included: unknown) => {
    const amount = parseAmount(rawAmount);
    if (!isValid(amount)) {
      receiptIssues.push(`Could not read the amount of "${label}".`);
      receiptNeedsReview = true;
      return;
    }
    adjustments.push({
      id: `ADJ${adjustments.length + 1}`,
      type,
      label,
      amount: round(Math.abs(amount)),
      // Only tax and service charges can already be contained in item prices.
      includedInPrices: (type === "tax" || type === "service") && included === true,
    });
  };

  // Receipt-level adjustments reported explicitly by the model.
  if (Array.isArray(data.adjustments)) {
    for (const adj of data.adjustments) {
      const typeKey = String(adj?.type ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
      const type = ADJUSTMENT_ALIASES[typeKey];
      const label = typeof adj?.label === "string" && adj.label.trim() ? adj.label.trim() : typeKey || "Adjustment";
      if (!type) {
        receiptIssues.push(`Unrecognized receipt line "${label}" was not applied.`);
        receiptNeedsReview = true;
        continue;
      }
      pushAdjustment(type, label, adj?.amount, adj?.includedInPrices);
    }
  }

  data.items.forEach((it: any, index: number) => {
    const issues: string[] = [];
    const rawName = typeof it?.name === "string" ? it.name.trim() : "";
    const name = rawName || `Item ${index + 1}`;
    if (!rawName) issues.push("Item name is missing.");

    const unitRaw = parseAmount(it?.unitPrice ?? it?.price);
    const qtyRaw = parseAmount(it?.quantity);
    const lineRaw = parseAmount(it?.lineTotal ?? it?.totalPrice);
    const discRaw = parseAmount(it?.discount);

    // Lines the model labelled as tax/tip/service/discount become receipt-level adjustments.
    const kindKey = String(it?.kind ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    const kindType = ADJUSTMENT_ALIASES[kindKey];
    const looksLikeDiscount = DISCOUNT_NAME.test(name);
    const negativeLine = (isValid(lineRaw) && lineRaw < 0) || (isValid(unitRaw) && unitRaw < 0);
    if (kindType || (negativeLine && looksLikeDiscount)) {
      const type: AdjustmentType = kindType ?? "discount";
      const amount = isValid(lineRaw)
        ? lineRaw
        : isValid(unitRaw)
        ? unitRaw * (isValid(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1)
        : lineRaw ?? unitRaw;
      pushAdjustment(type, name, amount, it?.includedInPrices);
      return;
    }

    for (const [label, value] of [["unit price", unitRaw], ["quantity", qtyRaw], ["line total", lineRaw], ["discount", discRaw]] as const) {
      if (value !== null && !Number.isFinite(value)) issues.push(`Invalid ${label} value.`);
    }

    const unit = isValid(unitRaw) ? unitRaw : null;
    const line = isValid(lineRaw) ? lineRaw : null;
    const itemDiscount = isValid(discRaw) ? Math.abs(discRaw) : 0;

    // Quantity
    let quantity: number;
    if (isValid(qtyRaw)) {
      quantity = qtyRaw;
      if (quantity <= 0 || quantity > MAX_QUANTITY) {
        issues.push(`Quantity ${qtyRaw} is out of range.`);
        quantity = 1;
      }
    } else {
      quantity = 1;
      if (qtyRaw === null && unit !== null && line !== null) {
        const implied = (line + itemDiscount) / unit;
        const rounded = Math.round(implied);
        if (unit > 0 && rounded >= 1 && Math.abs(implied - rounded) < 1e-6) {
          quantity = rounded;
        } else if (Math.abs(unit - line - itemDiscount) > oneUnit) {
          issues.push("Quantity is missing and cannot be derived from the prices.");
        }
      }
      // Otherwise: only one price was printed, so one unit is the only safe reading.
      // A present-but-invalid quantity was already reported above.
    }
    quantity = Number(quantity.toFixed(3));

    // Prices
    let unitPrice: number;
    let totalPrice: number;
    let discount = itemDiscount;
    if (unit === null && line === null) {
      issues.push("Price is missing.");
      unitPrice = 0;
      totalPrice = 0;
    } else if (line === null) {
      unitPrice = unit as number;
      totalPrice = unitPrice * quantity - discount;
    } else if (unit === null) {
      totalPrice = line;
      unitPrice = (line + discount) / quantity;
    } else {
      unitPrice = unit;
      totalPrice = line;
      const gross = unit * quantity;
      const tolerance = oneUnit * Math.max(1, Math.ceil(quantity));
      if (totalPrice < gross - discount - tolerance) {
        // Printed line total is lower than unit × quantity: an item-level discount.
        discount = gross - totalPrice;
      } else if (Math.abs(gross - discount - totalPrice) > tolerance) {
        issues.push(
          `Line total ${round(totalPrice)} does not match ${round(unit)} × ${quantity}${discount ? ` − ${round(discount)}` : ""}.`
        );
      }
    }

    if (unitPrice < 0 || totalPrice < 0) {
      issues.push("Negative price on an item line.");
    }

    const item: ValidatedReceiptItem = {
      id: String(index + 1) + "-" + Math.random().toString(36).slice(2, 7),
      name,
      unitPrice: round(unitPrice),
      quantity,
      totalPrice: round(totalPrice),
      kind: "item",
    };
    if (discount > oneUnit / 2) item.discount = round(discount);
    if (issues.length > 0) {
      item.needsReview = true;
      item.issues = issues;
    }
    items.push(item);
  });

  if (items.length === 0) {
    return { ok: false, errors: ["No purchasable items were found on the receipt"] };
  }
  if (items.every((item) => item.issues?.includes("Price is missing."))) {
    return { ok: false, errors: ["No item prices could be read"] };
  }

  const toM = (n: number) => toMinor(n, digits);
  const subtotalMinor = items.reduce((sum, item) => sum + toM(item.totalPrice), 0);
  const adjustmentsMinor = adjustments.reduce((sum, adj) => {
    if (adj.includedInPrices) return sum;
    return sum + (adj.type === "discount" ? -toM(adj.amount) : toM(adj.amount));
  }, 0);
  const payableMinor = subtotalMinor + adjustmentsMinor;

  if (payableMinor < 0) {
    receiptIssues.push("Discounts exceed the receipt subtotal.");
    receiptNeedsReview = true;
  }

  const printedRaw = parseAmount(
    data?.summary?.printedTotal ?? data?.summary?.total ?? data?.printedTotal ?? data?.total
  );
  let printedTotal: number | null = null;
  let printedTotalMismatch = false;
  if (printedRaw !== null && !Number.isFinite(printedRaw)) {
    receiptIssues.push("The printed receipt total could not be read.");
    receiptNeedsReview = true;
  } else if (isValid(printedRaw)) {
    printedTotal = round(printedRaw);
    const toleranceMinor = Math.max(1, Math.ceil(items.length / 2));
    if (Math.abs(toM(printedTotal) - payableMinor) > toleranceMinor) {
      printedTotalMismatch = true;
      receiptNeedsReview = true;
    }
  }

  // Item-level problems are reported on the items themselves.
  if (items.some((item) => item.needsReview)) receiptNeedsReview = true;

  return {
    ok: true,
    receipt: {
      items,
      summary: {
        currency,
        subtotal: fromMinor(subtotalMinor, digits),
        grandTotal: fromMinor(payableMinor, digits),
        printedTotal,
        printedTotalMismatch,
        adjustments,
        needsReview: receiptNeedsReview,
        issues: receiptIssues,
      },
    },
  };
}
