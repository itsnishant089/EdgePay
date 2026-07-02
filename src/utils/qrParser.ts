// ─── QR Parser ───────────────────────────────────────────────────────
// Offline UPI QR parser — no network required

import { QRPaymentData } from '../types';
import { buildUssdCommand, sanitizeReceiver, extractMobileFromVpa } from '../engine/USSDBuilder';

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parseQueryString(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = query.split('&');
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = decodeParam(pair.slice(0, eq).trim());
    const val = decodeParam(pair.slice(eq + 1).trim());
    if (key) params[key.toLowerCase()] = val;
  }
  return params;
}

/** Extract upi://pay?... URI embedded inside Bharat QR or plain text */
function extractUpiUri(data: string): string | null {
  const match = data.match(/upi:\/\/pay\?[^\s"']+/i);
  return match ? match[0] : null;
}

/** Parse EMVCo Bharat QR (starts with 000201) — extract UPI link from tag 26 */
function parseBharatQR(data: string): QRPaymentData | null {
  const trimmed = data.trim();
  if (!trimmed.startsWith('000201')) return null;

  const upiMatch = trimmed.match(/upi:\/\/pay\?[^\\]+/i);
  if (upiMatch) {
    return parseUpiUri(upiMatch[0]);
  }

  // TLV fallback: look for pa= pattern anywhere in payload
  const paMatch = trimmed.match(/pa=([a-zA-Z0-9._@-]+)/i);
  if (paMatch) {
    const pnMatch = trimmed.match(/pn=([^&\\]+)/i);
    const amMatch = trimmed.match(/am=([0-9.]+)/i);
    const tnMatch = trimmed.match(/tn=([^&\\]+)/i);
    let upiId = paMatch[1];
    const mobilePrefix = extractMobileFromVpa(upiId);
    if (mobilePrefix) upiId = mobilePrefix;
    return {
      upiId,
      name: pnMatch ? decodeParam(pnMatch[1]) : 'Merchant',
      amount: amMatch ? parseFloat(amMatch[1]) : undefined,
      note: tnMatch ? decodeParam(tnMatch[1]) : undefined,
      raw: data,
    };
  }
  return null;
}

function parseUpiUri(uri: string): QRPaymentData | null {
  const normalized = uri.trim();
  if (!/^upi:\/\/pay/i.test(normalized)) return null;

  const qIndex = normalized.indexOf('?');
  if (qIndex === -1) return null;

  const params = parseQueryString(normalized.slice(qIndex + 1));
  let upiId = params.pa || params.payeeaddress || '';
  if (!upiId) return null;

  const mobilePrefix = extractMobileFromVpa(upiId);
  if (mobilePrefix) upiId = mobilePrefix;

  const amountStr = params.am || params.amount;
  const name = params.pn || params.payeeName || params.merchant || 'Unknown';
  const note = params.tn || params.note;

  return {
    upiId,
    name: decodeParam(name),
    amount: amountStr ? parseFloat(amountStr) : undefined,
    note: note ? decodeParam(note) : undefined,
    raw: uri,
  };
}

function parsePlainQR(data: string): QRPaymentData | null {
  const trimmed = data.trim();

  const phoneRegex = /^(\+91|91)?(\d{10})$/;
  const phoneMatch = trimmed.match(phoneRegex);
  if (phoneMatch) {
    return { upiId: phoneMatch[2], name: 'Phone Payment', raw: data };
  }

  if (trimmed.includes('@')) {
    const mobilePrefix = extractMobileFromVpa(trimmed);
    return {
      upiId: mobilePrefix || trimmed.toLowerCase(),
      name: mobilePrefix ? 'Phone Payment' : trimmed.split('@')[0],
      raw: data,
    };
  }

  return null;
}

/**
 * Parse any UPI QR string (camera, gallery, offline)
 */
export function parseUPIQR(qrData: string): QRPaymentData | null {
  if (!qrData || qrData.length < 5) return null;

  const trimmed = qrData.trim();

  // 1. Direct upi:// URI
  if (/^upi:\/\/pay/i.test(trimmed)) {
    return parseUpiUri(trimmed);
  }

  // 2. Bharat QR / NPCI EMVCo
  if (trimmed.startsWith('000201')) {
    const bharat = parseBharatQR(trimmed);
    if (bharat) return bharat;
  }

  // 3. UPI URI embedded in longer string
  const embedded = extractUpiUri(trimmed);
  if (embedded) {
    return parseUpiUri(embedded);
  }

  // 4. Plain phone / VPA
  return parsePlainQR(trimmed);
}

export function qrToUssdCommand(data: QRPaymentData, amount: number): string {
  const mobile = extractMobileFromVpa(data.upiId);
  const receiver = mobile || data.upiId;
  return buildUssdCommand(receiver, amount);
}

export function qrToSmsCommand(data: QRPaymentData, amount: number): string {
  const receiver = data.upiId.includes('@') ? data.upiId.split('@')[0] : data.upiId;
  return `PAY ${amount} TO ${receiver}`;
}

export function validateQRData(data: QRPaymentData | null): {
  valid: boolean;
  error?: string;
} {
  if (!data) return { valid: false, error: 'Invalid QR code' };
  if (!data.upiId) return { valid: false, error: 'No payment ID found in QR code' };
  if (data.amount !== undefined && (isNaN(data.amount) || data.amount <= 0)) {
    return { valid: false, error: 'Invalid amount in QR code' };
  }
  return { valid: true };
}

export function getReceiverFromQR(data: QRPaymentData): {
  receiver: string;
  name: string;
  type: 'mobile' | 'upi';
} {
  const cleaned = sanitizeReceiver(data.upiId);
  const mobile = extractMobileFromVpa(cleaned);
  const isMobile = mobile !== null || /^\d{10}$/.test(cleaned);
  return {
    receiver: mobile || cleaned,
    name: data.name || (isMobile ? 'Mobile Payment' : cleaned.split('@')[0]),
    type: isMobile ? 'mobile' : 'upi',
  };
}
