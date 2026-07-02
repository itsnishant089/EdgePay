// ─── Balance Service ─────────────────────────────────────────────────
// Shared balance fetch logic for Dashboard and App startup

import { Alert } from 'react-native';
import { sendSMS, readRecentSms, isSmsAvailable } from './SmsService';
import { parseSmsForBalance } from './SmsParser';
import { dialUssdCode } from './USSDService';
import { buildBalanceCheckCommand } from './USSDBuilder';
import { HDFC_BALANCE_SMS_NUMBER } from '../utils/constants';

export async function requestHdfcBalanceSms(): Promise<void> {
  if (!isSmsAvailable()) return;
  await sendSMS(HDFC_BALANCE_SMS_NUMBER, 'bal');
}

export async function pollHdfcBalanceSms(
  onBalance: (amount: number) => void,
  onTimeout?: () => void,
): Promise<() => void> {
  let attempts = 0;
  const maxAttempts = 12;
  const pollInterval = setInterval(async () => {
    attempts++;
    try {
      const messages = await readRecentSms(15);
      for (const msg of messages) {
        const sender = msg.sender.toUpperCase();
        if (!sender.includes('HDFC') && !sender.includes('07308080808') && !sender.includes('7070022222')) {
          continue;
        }
        const bal = parseSmsForBalance(msg.body);
        if (bal !== null) {
          clearInterval(pollInterval);
          onBalance(bal);
          return;
        }
        const hdfcMatch = msg.body.match(/(?:is|balance|avl)[:\s]*(?:Rs\.?|₹)?\s*([\d,]+\.?\d*)/i);
        if (hdfcMatch) {
          const parsedBal = parseFloat(hdfcMatch[1].replace(/,/g, ''));
          if (!isNaN(parsedBal)) {
            clearInterval(pollInterval);
            onBalance(parsedBal);
            return;
          }
        }
      }
    } catch (_) {}
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      onTimeout?.();
    }
  }, 3000);
  return () => clearInterval(pollInterval);
}

export async function openUssdBalanceCheck(): Promise<void> {
  await dialUssdCode(buildBalanceCheckCommand());
  Alert.alert('Balance Check', 'Follow the USSD prompts on your screen to view balance.');
}

export async function openUssdService(code: string, label: string): Promise<void> {
  await dialUssdCode(code);
  Alert.alert(label, 'Complete the steps in the USSD dialog on your screen.');
}
