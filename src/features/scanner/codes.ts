/**
 * Understands what a scanned QR / barcode contains. Pure functions (no React, no
 * network) so they can be unit-tested and reused.
 *
 * Honest limits: a QR code on a shop receipt is only a LINK to the tax portal's copy of the
 * receipt; the items are not inside the code and that portal's API requires a signed request
 * from the tax authority's own site. So for fiscal links we decode and show what is in the
 * code (terminal, receipt number, date, fiscal sign) and let the user open the official page.
 */

export type RawCode = { type: string; data: string };

/** Barcode formats worth listening for (QR + the usual retail / logistics codes). */
export const CODE_TYPES = [
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'pdf417',
  'datamatrix',
  'aztec',
] as const;

export type CodeInfo =
  | {
      kind: 'fiscal';
      url: string;
      host: string;
      terminalId: string;
      receiptNo: string;
      /** Purchase date/time encoded in the code (local time), if it parses. */
      dateTime: Date | null;
      fiscalSign?: string;
    }
  | { kind: 'url'; url: string; host: string; secure: boolean }
  | {
      kind: 'product';
      code: string;
      format: 'EAN-13' | 'EAN-8' | 'UPC-A' | 'UPC-E';
      /** Country/region where the code prefix was issued (NOT necessarily where it was made). */
      region?: string;
      /** False when the check digit does not match: a misread or a damaged code. */
      checksumOk: boolean;
    }
  | { kind: 'text'; text: string; format: string };

const FORMAT_NAMES: Record<string, string> = {
  qr: 'QR',
  ean13: 'EAN-13',
  ean8: 'EAN-8',
  upc_a: 'UPC-A',
  upc_e: 'UPC-E',
  code128: 'Code 128',
  code39: 'Code 39',
  code93: 'Code 93',
  itf14: 'ITF-14',
  pdf417: 'PDF417',
  datamatrix: 'Data Matrix',
  aztec: 'Aztec',
  codabar: 'Codabar',
};

export const formatName = (type: string) => FORMAT_NAMES[type.toLowerCase()] ?? type;

/** Query string → object, without relying on React Native's partial URL implementation. */
export function parseQuery(url: string): Record<string, string> {
  const q = url.split('#')[0].split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const pair of q.split('&')) {
    if (!pair) continue;
    const [k, ...rest] = pair.split('=');
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    } catch {
      out[k] = rest.join('=');
    }
  }
  return out;
}

function hostOf(url: string): string {
  const m = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i);
  return m ? m[1].toLowerCase() : '';
}

/** "20261018133500" → Date(2026-10-18 13:35:00), validated. */
export function parseFiscalDate(value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
  const date = new Date(y, mo - 1, d, h, mi, s);
  const ok =
    date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date.getHours() === h && date.getMinutes() === mi;
  return ok ? date : null;
}

/** GS1 mod-10 check digit for EAN-13 / EAN-8 / UPC-A (digits only, last digit is the check). */
export function gs1ChecksumOk(digits: string): boolean {
  if (!/^\d+$/.test(digits) || ![8, 12, 13].includes(digits.length)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    const digit = Number(digits[digits.length - 2 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

// GS1 company-prefix ranges → issuing region (first three digits).
const GS1_PREFIXES: [number, number, string][] = [
  [0, 139, 'USA / Canada'],
  [300, 379, 'France'],
  [400, 440, 'Germany'],
  [450, 459, 'Japan'],
  [460, 469, 'Russia'],
  [470, 470, 'Kyrgyzstan'],
  [471, 471, 'Taiwan'],
  [478, 478, 'Uzbekistan'],
  [480, 480, 'Philippines'],
  [487, 487, 'Kazakhstan'],
  [500, 509, 'United Kingdom'],
  [540, 549, 'Belgium / Luxembourg'],
  [590, 590, 'Poland'],
  [600, 601, 'South Africa'],
  [690, 699, 'China'],
  [729, 729, 'Israel'],
  [750, 750, 'Mexico'],
  [789, 790, 'Brazil'],
  [800, 839, 'Italy'],
  [840, 849, 'Spain'],
  [869, 869, 'Turkey'],
  [870, 879, 'Netherlands'],
  [880, 880, 'South Korea'],
  [890, 890, 'India'],
  [893, 893, 'Vietnam'],
  [899, 899, 'Indonesia'],
  [930, 939, 'Australia'],
  [940, 949, 'New Zealand'],
];

export function regionForEan(code: string): string | undefined {
  const digits = code.length === 12 ? `0${code}` : code; // UPC-A is an EAN-13 with a leading 0
  if (digits.length !== 13) return undefined;
  const prefix = Number(digits.slice(0, 3));
  return GS1_PREFIXES.find(([from, to]) => prefix >= from && prefix <= to)?.[2];
}

/** Interpret a scanned code. */
export function classifyCode(raw: RawCode): CodeInfo {
  const type = raw.type.toLowerCase();
  const data = (raw.data ?? '').trim();
  const format = formatName(type);

  // ---- links (QR and friends) ----
  if (/^https?:\/\//i.test(data)) {
    const host = hostOf(data);
    const q = parseQuery(data);
    const isTaxHost = host === 'soliq.uz' || host.endsWith('.soliq.uz');
    if (isTaxHost && q.t && q.r && q.c) {
      return {
        kind: 'fiscal',
        url: data,
        host,
        terminalId: q.t,
        receiptNo: q.r,
        dateTime: parseFiscalDate(q.c),
        fiscalSign: q.s || undefined,
      };
    }
    return { kind: 'url', url: data, host, secure: /^https:/i.test(data) };
  }

  // ---- retail product barcodes ----
  const digits = data.replace(/\s+/g, '');
  const retailFormat =
    type === 'ean13' ? 'EAN-13' : type === 'ean8' ? 'EAN-8' : type === 'upc_a' ? 'UPC-A' : type === 'upc_e' ? 'UPC-E' : null;
  if (retailFormat && /^\d+$/.test(digits)) {
    return {
      kind: 'product',
      code: digits,
      format: retailFormat,
      region: regionForEan(digits),
      checksumOk: retailFormat === 'UPC-E' ? true : gs1ChecksumOk(digits),
    };
  }

  return { kind: 'text', text: data, format };
}
