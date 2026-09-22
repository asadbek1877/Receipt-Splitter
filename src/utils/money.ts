// Monetary helpers. All split math is done in integer minor units (e.g. cents)
// so that participant shares always add up exactly to the item/receipt totals.

const DEFAULT_MINOR_DIGITS = 2;

/** Number of minor-unit digits for an ISO 4217 currency (JPY → 0, USD → 2, KWD → 3). */
export function currencyMinorDigits(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) return DEFAULT_MINOR_DIGITS;
  try {
    const digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits;
    return typeof digits === "number" && digits >= 0 && digits <= 4
      ? digits
      : DEFAULT_MINOR_DIGITS;
  } catch {
    return DEFAULT_MINOR_DIGITS;
  }
}

/**
 * Convert a major-unit amount to integer minor units, rounding half away from zero.
 * Uses the decimal string form so values like 1.005 round to 101 cents, not 100.
 */
export function toMinor(amount: number, digits: number): number {
  if (!Number.isFinite(amount)) return 0;
  const negative = amount < 0;
  const [intPart = "0", fracPart = ""] = Math.abs(amount).toFixed(digits + 6).split(".");
  const kept = fracPart.slice(0, digits);
  const nextDigit = Number(fracPart.charAt(digits) || "0");
  let minor = Number(intPart + kept);
  if (nextDigit >= 5) minor += 1;
  return negative ? -minor : minor;
}

export function fromMinor(minor: number, digits: number): number {
  return Number((minor / 10 ** digits).toFixed(digits));
}

/**
 * Split an integer amount across weights using the largest-remainder method.
 * The returned parts always sum exactly to `total`. Ties are broken starting at
 * `tieOffset` so leftover units rotate between items instead of always landing
 * on the same participant.
 */
export function allocateMinor(total: number, weights: number[], tieOffset = 0): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(total);
  const exact = weights.map((w) => (absTotal * w) / weightSum);
  const parts = exact.map((value) => Math.floor(value));
  let remainder = absTotal - parts.reduce((sum, p) => sum + p, 0);

  const order = exact
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
      rotated: (index - (tieOffset % n) + n) % n,
    }))
    .sort((a, b) => b.fraction - a.fraction || a.rotated - b.rotated);

  for (let i = 0; remainder > 0; i = (i + 1) % n) {
    const target = order[i];
    if (!target) break;
    parts[target.index] = (parts[target.index] ?? 0) + 1;
    remainder -= 1;
  }

  return parts.map((p) => p * sign);
}
