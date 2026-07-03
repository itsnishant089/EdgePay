// ─── Balance SMS parsing (separate from payment/credit SMS) ─────────────

import type { SmsMessage } from '../types';

/**
 * Returns true if this SMS is a payment/credit/debit alert — NOT a balance reply.
 */
export function isPaymentOrCreditSms(body: string): boolean {
  const upper = body.toUpperCase();
  if (upper.includes('CREDIT ALERT')) return true;
  if (/\bCREDITED\s+TO\b/.test(upper)) return true;
  if (/\bFROM\s+VPA\b/.test(upper)) return true;
  if (/\bSENT\s+RS\.?\b/.test(upper)) return true;
  if (/\bDEBITED\b/.test(upper)) return true;
  if (/\bWITHDRAWN\b/.test(upper)) return true;
  if (/\(UPI\s+\d+\)/.test(upper)) return true;
  if (/\bTO\s+[A-Z0-9]/.test(upper) && upper.includes('FROM HDFC')) return true;
  return false;
}

/**
 * Parse HDFC / SBI balance reply SMS only.
 * Ignores credit alerts, debits, and generic Rs. amounts in payment SMS.
 */
export function parseSmsForBalance(body: string): number | null {
  if (!body || isPaymentOrCreditSms(body)) return null;

  const normalized = body.replace(/,/g, '').replace(/\s+/g, ' ').trim();

  // HDFC: "Dear Customer, Your Balance in account no. ending with 7906 is Rs. 6,233.43"
  const hdfcEnding = normalized.match(
    /(?:your\s+)?(?:balance\s+in\s+account|account\s+balance\s+for\s+account)[\s\S]*?ending\s+with\s+\d+\s+is\s+(?:Rs\.?|₹|INR)\s*([\d.]+)/i,
  );
  if (hdfcEnding?.[1]) {
    const val = parseFloat(hdfcEnding[1]);
    if (!isNaN(val) && val >= 0) return val;
  }

  const hdfcShort = normalized.match(
    /your\s+balance\s+in\s+account\s+no\.?\s+ending\s+with\s+\d+\s+is\s+(?:Rs\.?|₹|INR)\s*([\d.]+)/i,
  );
  if (hdfcShort?.[1]) {
    const val = parseFloat(hdfcShort[1]);
    if (!isNaN(val) && val >= 0) return val;
  }

  // RCS / chat: "Account Balance ... ending with 7906 is ₹6243.71"
  const accountBalanceBlock = normalized.match(
    /account\s+balance[\s\S]{0,120}?ending\s+with\s+\d+\s+is\s+(?:Rs\.?|₹|INR)\s*([\d.]+)/i,
  );
  if (accountBalanceBlock?.[1]) {
    const val = parseFloat(accountBalanceBlock[1]);
    if (!isNaN(val) && val >= 0) return val;
  }

  const accountBalanceGeneric = normalized.match(
    /your\s+account\s+balance[\s\S]{0,140}?(?:is|:)\s*(?:Rs\.?|INR|\u20B9)\s*([\d.]+)/i,
  );
  if (accountBalanceGeneric?.[1]) {
    const val = parseFloat(accountBalanceGeneric[1]);
    if (!isNaN(val) && val >= 0) return val;
  }

  if (!/\b(balance|available\s+balance|avl\s*bal|account\s+balance)\b/i.test(body)) {
    return null;
  }

  const balanceIs = normalized.match(
    /\b(?:balance|available\s+balance|avl\s*bal|account\s+balance)\b[\s\S]{0,120}?\bis\s+(?:Rs\.?|₹|INR)\s*([\d.]+)/i,
  );
  if (balanceIs?.[1]) {
    const val = parseFloat(balanceIs[1]);
    if (!isNaN(val) && val >= 0) return val;
  }

  const balanceColon = normalized.match(
    /\b(?:balance|available\s+balance|avl\s*bal)\b\s*[:]\s*(?:Rs\.?|₹|INR)?\s*([\d.]+)/i,
  );
  if (balanceColon?.[1]) {
    const val = parseFloat(balanceColon[1]);
    if (!isNaN(val) && val >= 0) return val;
  }

  const sbiMatch = normalized.match(
    /(?:available\s+balance|balance)\s*[:]\s*(?:INR|RS\.?|₹)\s*([\d.]+)/i,
  );
  if (sbiMatch?.[1]) {
    const val = parseFloat(sbiMatch[1]);
    if (!isNaN(val) && val >= 0) return val;
  }

  return null;
}

export function isBalanceReplySms(body: string): boolean {
  return parseSmsForBalance(body) !== null;
}

/**
 * Pick the newest balance reply from inbox messages.
 * Prefers messages after sinceMs; falls back to recent replies within fallbackWindowMs.
 */
export function findLatestBalanceInMessages(
  messages: SmsMessage[],
  sinceMs?: number,
  fallbackWindowMs = 10 * 60_000,
): number | null {
  const cutoff = sinceMs ?? 0;
  const now = Date.now();
  let bestAfter: { bal: number; ts: number } | null = null;
  let bestRecent: { bal: number; ts: number } | null = null;

  for (const msg of messages) {
    const bal = parseSmsForBalance(msg.body);
    if (bal === null) continue;

    if (msg.timestamp >= cutoff) {
      if (!bestAfter || msg.timestamp > bestAfter.ts) {
        bestAfter = { bal, ts: msg.timestamp };
      }
    } else if (msg.timestamp >= now - fallbackWindowMs) {
      if (!bestRecent || msg.timestamp > bestRecent.ts) {
        bestRecent = { bal, ts: msg.timestamp };
      }
    }
  }

  if (bestAfter) return bestAfter.bal;
  if (bestRecent && cutoff > 0 && bestRecent.ts >= cutoff - fallbackWindowMs) {
    return bestRecent.bal;
  }
  return bestRecent?.bal ?? null;
}
