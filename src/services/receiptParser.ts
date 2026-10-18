import {
  validateReceiptPayload,
  type ValidatedReceipt,
  type ValidatedReceiptItem,
} from "./receiptValidation.js";

/** Shape returned to the route */
export type ParsedReceiptItem = ValidatedReceiptItem;

export interface ParseResult extends ValidatedReceipt {
  rawModelText?: string | undefined; // for debugging (only when DEBUG_PARSE=1)
  model?: string | undefined; // which model was used
  durationMs?: number | undefined;
  /** "mock" is only ever produced in explicit, non-production mock mode. */
  source: "gemini" | "mock";
  modelsTried?: Array<ModelAttempt> | undefined;
}

export interface ModelAttempt {
  model: string;
  status: "ok" | "timeout" | "http_error" | "network_error" | "empty" | "invalid_json" | "invalid_receipt";
  httpStatus?: number;
  durationMs: number;
  detail?: string;
}

export interface ParseOptions {
  language: string; // BCP-47 like ru-RU, en-US
  sessionName: string;
  mimeType: string;
  imageBase64: string; // no data: prefix, raw base64
}

export type ReceiptParseErrorCode =
  | "AI_NOT_CONFIGURED" // no API key (503)
  | "AI_UNAVAILABLE" // every attempt failed or timed out (502)
  | "AI_INVALID_RESULT"; // the model answered, but no usable receipt (422)

export class ReceiptParseError extends Error {
  constructor(
    public code: ReceiptParseErrorCode,
    message: string,
    public attempts: ModelAttempt[] = []
  ) {
    super(message);
    this.name = "ReceiptParseError";
  }
}

// Environment-driven configuration
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1";
const GEMINI_MODEL_PARSE = process.env.GEMINI_MODEL_PARSE || "gemini-2.5-flash";
const GEMINI_MODEL_FALLBACKS = (process.env.GEMINI_MODEL_FALLBACKS || "gemini-2.0-flash")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}

/** Hard limits: at most MAX_ATTEMPTS model calls, each bounded, all within TOTAL_TIMEOUT_MS. */
export function getParserLimits() {
  return {
    maxAttempts: intFromEnv("GEMINI_MAX_ATTEMPTS", 2, 1, 3),
    attemptTimeoutMs: intFromEnv("GEMINI_ATTEMPT_TIMEOUT_MS", 35000, 1000, 60000),
    // must stay below the app's 60s request timeout
    totalTimeoutMs: intFromEnv("GEMINI_TOTAL_TIMEOUT_MS", 55000, 1000, 90000),
  };
}

const DEBUG_PARSE = process.env.DEBUG_PARSE === "1";

const EXTRACTION_INSTRUCTIONS = `You are a receipt parser. Return ONLY valid JSON with this shape:
{
  "items": [
    { "name": "string", "quantity": number, "unitPrice": number, "lineTotal": number, "discount": number | null }
  ],
  "adjustments": [
    { "type": "tax" | "discount" | "tip" | "service", "label": "string", "amount": number, "includedInPrices": boolean }
  ],
  "summary": { "printedSubtotal": number | null, "printedTotal": number | null, "currency": "ISO_4217" }
}
Rules:
- Numbers are plain JSON numbers with a dot as decimal separator, no currency symbols, no thousands separators.
- "items" contains only purchased products/dishes. Never put tax, tips, service charges or receipt-level discounts in "items".
- "lineTotal" is the amount printed for that line after any line discount. Do not recompute it.
- "discount" is a discount printed on that specific line (positive number), otherwise null.
- "quantity" is the printed quantity (may be fractional for weighed goods). Use 1 only if no quantity is printed.
- "adjustments" lists receipt-level tax, discount, tip and service charge lines. "amount" is always a positive number.
- Set "includedInPrices" to true when the receipt says the tax/service is already included in the prices (e.g. "VAT incl.", "в т.ч. НДС", "QQS shu jumladan"), otherwise false.
- "printedTotal" is the final total printed on the receipt, or null if it cannot be read.
- Report the currency as an ISO 4217 code, or "UNKNOWN" if unsure.
- If a value cannot be read, use null. Never guess or invent items or prices.`;

function unwrapMarkdown(t: string): string {
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && typeof fence[1] === "string") return fence[1].trim();
  return t.trim();
}

function extractJson(text: string): unknown | undefined {
  const cleaned = unwrapMarkdown(text);
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return undefined;
  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch {
    return undefined;
  }
}

/** Demo receipt for explicit development mock mode. Always flagged for review. */
function parseMockReceipt(): ParseResult {
  const validated = validateReceiptPayload({
    items: [
      { name: "Coffee", quantity: 1, unitPrice: 5, lineTotal: 5 },
      { name: "Sandwich", quantity: 1, unitPrice: 8.5, lineTotal: 8.5 },
    ],
    adjustments: [{ type: "tip", label: "Tips", amount: 2.5, includedInPrices: false }],
    summary: { printedTotal: 16, currency: "USD" },
  });
  if (!validated.ok) throw new Error("Mock receipt failed validation");
  const { receipt } = validated;
  return {
    ...receipt,
    summary: {
      ...receipt.summary,
      needsReview: true,
      issues: ["DEMO DATA: this is a mock receipt, not a real scan.", ...receipt.summary.issues],
    },
    source: "mock",
    durationMs: 0,
  };
}

export function isMockParserEnabled(): boolean {
  return process.env.RECEIPT_PARSER_MODE === "mock" && process.env.NODE_ENV !== "production";
}

export async function parseReceipt(options: ParseOptions): Promise<ParseResult> {
  if (isMockParserEnabled()) {
    console.warn("[parseReceipt] RECEIPT_PARSER_MODE=mock: returning demo data flagged as mock");
    return parseMockReceipt();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ReceiptParseError("AI_NOT_CONFIGURED", "AI receipt scanning is not configured.");
  }

  const { maxAttempts, attemptTimeoutMs, totalTimeoutMs } = getParserLimits();
  const candidates = Array.from(new Set([GEMINI_MODEL_PARSE, ...GEMINI_MODEL_FALLBACKS])).slice(0, maxAttempts);
  const prompt = `${EXTRACTION_INSTRUCTIONS}\nLanguage context of receipt: ${options.language}\nSession Name: ${options.sessionName}`;

  const startedAt = Date.now();
  const attempts: ModelAttempt[] = [];
  let modelAnswered = false;

  for (const modelName of candidates) {
    const remaining = totalTimeoutMs - (Date.now() - startedAt);
    if (remaining < 500) break;
    const timeoutMs = Math.min(attemptTimeoutMs, remaining);
    const attemptStart = Date.now();

    let text: string;
    try {
      text = await generateViaRest(apiKey, modelName, prompt, options.imageBase64, options.mimeType, timeoutMs);
    } catch (err: any) {
      const status: ModelAttempt["status"] =
        err?.name === "TimeoutError" || err?.name === "AbortError"
          ? "timeout"
          : err?.status
          ? "http_error"
          : "network_error";
      attempts.push({
        model: modelName,
        status,
        httpStatus: err?.status,
        durationMs: Date.now() - attemptStart,
        detail: err?.message,
      });
      if (DEBUG_PARSE) console.warn(`[parseReceipt] ${modelName} ${status}: ${err?.message}`);
      continue;
    }

    modelAnswered = true;
    if (!text) {
      attempts.push({ model: modelName, status: "empty", durationMs: Date.now() - attemptStart });
      continue;
    }
    const json = extractJson(text);
    if (json === undefined) {
      attempts.push({ model: modelName, status: "invalid_json", durationMs: Date.now() - attemptStart, detail: `${text.length} chars` });
      continue;
    }
    const validated = validateReceiptPayload(json);
    if (!validated.ok) {
      attempts.push({
        model: modelName,
        status: "invalid_receipt",
        durationMs: Date.now() - attemptStart,
        detail: validated.errors.join("; "),
      });
      continue;
    }

    const durationMs = Date.now() - attemptStart;
    attempts.push({ model: modelName, status: "ok", durationMs });
    return {
      ...validated.receipt,
      source: "gemini",
      model: modelName,
      durationMs,
      rawModelText: DEBUG_PARSE ? text.slice(0, 4000) : undefined,
      modelsTried: DEBUG_PARSE ? attempts : undefined,
    };
  }

  console.error("[parseReceipt] all attempts failed", attempts);
  if (modelAnswered) {
    throw new ReceiptParseError(
      "AI_INVALID_RESULT",
      "AI could not read this receipt. Please retake a clearer photo with the whole receipt inside the frame.",
      attempts
    );
  }
  throw new ReceiptParseError(
    "AI_UNAVAILABLE",
    "The AI service did not respond in time. Please try again.",
    attempts
  );
}

async function generateViaRest(
  apiKey: string,
  model: string,
  prompt: string,
  base64: string,
  mime: string,
  timeoutMs: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${prompt}\nOUTPUT ONLY RAW JSON. NO MARKDOWN.` },
          { inlineData: { data: base64, mimeType: mime } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      // Long shop receipts (20+ lines) must not be cut off mid-JSON.
      // NOTE: do not disable Gemini "thinking" to save time: it was 3x faster but misread
      // thousands separators (a 48,000 total came back as 48).
      maxOutputTokens: 8192,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    let message = resp.statusText;
    try {
      const payload = JSON.parse(await resp.text());
      message = payload?.error?.message || message;
    } catch {}
    throw Object.assign(new Error(`HTTP ${resp.status} ${message}`), { status: resp.status });
  }
  const json: any = await resp.json();
  const texts: string[] = [];
  if (Array.isArray(json?.candidates)) {
    for (const cand of json.candidates) {
      const parts = cand?.content?.parts || cand?.parts || [];
      for (const p of parts) if (typeof p?.text === "string") texts.push(p.text);
    }
  }
  return texts.join("\n").trim();
}
