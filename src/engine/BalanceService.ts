// ─── Balance Service ─────────────────────────────────────────────────
// Centralized HDFC balance SMS requests with throttling + strict parsing

import { Alert } from 'react-native';
import { sendSMS, readRecentSms, isSmsAvailable } from './SmsService';
import { findLatestBalanceInMessages, parseSmsForBalance } from './BalanceSmsParser';
import { dialUssdCode } from './USSDService';
import { buildBalanceCheckCommand } from './USSDBuilder';
import { HDFC_BALANCE_SMS_NUMBER, HDFC_BALANCE_REFRESH_MS } from '../utils/constants';
import type { SmsMessage } from '../types';

let lastHdfcBalanceRequestMs = 0;
let requestInFlight = false;
let inFlightReleaseTimer: ReturnType<typeof setTimeout> | null = null;

const MANUAL_DEBOUNCE_MS = 15_000;
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 36;

export type BalanceRequestOptions = {
  force?: boolean;
  reason?: 'app-open' | 'auto-refresh' | 'manual' | string;
};

export function getLastBalanceRequestTime(): number {
  return lastHdfcBalanceRequestMs;
}

function releaseInFlightLater(): void {
  if (inFlightReleaseTimer) clearTimeout(inFlightReleaseTimer);
  inFlightReleaseTimer = setTimeout(() => {
    requestInFlight = false;
    inFlightReleaseTimer = null;
  }, 90_000);
}

export function isHdfcBalanceSender(sender: string): boolean {
  const s = sender.toUpperCase();
  return (
    s.includes('HDFC') ||
    s.includes('07308080808') ||
    s.includes('7070022222') ||
    s.includes('VM-HDFCBK') ||
    s.includes('HDFCBK')
  );
}

export async function scanInboxForBalance(sinceMs?: number): Promise<number | null> {
  if (!isSmsAvailable()) return null;
  try {
    const messages = await readRecentSms(30);
    return findLatestBalanceInMessages(messages, sinceMs ?? getLastBalanceRequestTime() - 15_000);
  } catch {
    return null;
  }
}

export function tryParseBalanceFromSms(body: string): number | null {
  return parseSmsForBalance(body);
}

export async function requestHdfcBalanceSms(options?: BalanceRequestOptions): Promise<boolean> {
  if (!isSmsAvailable()) return false;

  const now = Date.now();
  const force = options?.force === true;

  if (requestInFlight) return false;

  if (force) {
    if (lastHdfcBalanceRequestMs > 0 && now - lastHdfcBalanceRequestMs < MANUAL_DEBOUNCE_MS) {
      return false;
    }
  } else if (lastHdfcBalanceRequestMs > 0 && now - lastHdfcBalanceRequestMs < HDFC_BALANCE_REFRESH_MS) {
    return false;
  }

  requestInFlight = true;
  lastHdfcBalanceRequestMs = now;
  releaseInFlightLater();

  try {
    await sendSMS(HDFC_BALANCE_SMS_NUMBER, 'bal');
    return true;
  } catch (err) {
    requestInFlight = false;
    if (inFlightReleaseTimer) {
      clearTimeout(inFlightReleaseTimer);
      inFlightReleaseTimer = null;
    }
    throw err;
  }
}

export async function pollHdfcBalanceSms(
  onBalance: (amount: number) => void,
  onTimeout?: () => void,
  options?: { sinceMs?: number },
): Promise<() => void> {
  const sinceMs = options?.sinceMs ?? Math.max(0, getLastBalanceRequestTime() - 15_000);
  let attempts = 0;
  let stopped = false;

  const tryScan = async () => {
    if (stopped) return false;
    const bal = await scanInboxForBalance(sinceMs);
    if (bal !== null) {
      stopped = true;
      clearInterval(pollInterval);
      requestInFlight = false;
      if (inFlightReleaseTimer) {
        clearTimeout(inFlightReleaseTimer);
        inFlightReleaseTimer = null;
      }
      onBalance(bal);
      return true;
    }
    return false;
  };

  // Immediate scan — reply may already be in inbox
  await tryScan();
  if (stopped) return () => {};

  const pollInterval = setInterval(async () => {
    attempts++;
    const found = await tryScan();
    if (found) return;
    if (attempts >= MAX_POLL_ATTEMPTS) {
      stopped = true;
      clearInterval(pollInterval);
      requestInFlight = false;
      if (inFlightReleaseTimer) {
        clearTimeout(inFlightReleaseTimer);
        inFlightReleaseTimer = null;
      }
      onTimeout?.();
    }
  }, POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(pollInterval);
    requestInFlight = false;
    if (inFlightReleaseTimer) {
      clearTimeout(inFlightReleaseTimer);
      inFlightReleaseTimer = null;
    }
  };
}

export async function openUssdBalanceCheck(): Promise<void> {
  await dialUssdCode(buildBalanceCheckCommand());
  Alert.alert('Balance Check', 'Follow the USSD prompts on your screen to view balance.');
}

export async function openUssdService(code: string, label: string): Promise<void> {
  await dialUssdCode(code);
  Alert.alert(label, 'Complete the steps in the USSD dialog on your screen.');
}

/** Handle a live incoming SMS — returns balance if this is a balance reply. */
export function handleIncomingBalanceSms(sms: SmsMessage): number | null {
  return parseSmsForBalance(sms.body);
}
