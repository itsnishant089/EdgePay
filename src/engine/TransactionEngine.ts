// ─── Transaction Engine 3.0 ──────────────────────────────────────────
// Redesigned with proper state machine integration, timeout handling,
// automatic recovery, structured logging, and zero-freeze guarantees.

import type { Transaction, TransactionStatus, NetworkMode, SmsMessage } from '../types';
import { generateTransactionId } from '../utils/formatters';
import { buildUssdCommand } from './USSDBuilder';
import { sendUssdRequest, dialUssdCode } from './USSDService';
import { onSmsReceived, readRecentSms } from './SmsService';
import { parseSmsForTransaction, isBankSms, parseDemoSms } from './SmsParser';
import { PaymentManager, PaymentState } from './PaymentManager';

const SMS_WAIT_TIMEOUT_MS = 120_000; // 2 minutes — auto-fail pending payments
const SMS_POLL_INTERVAL_MS = 3000;

// ─── Validation ─────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: 'INVALID_RECEIVER' | 'INVALID_AMOUNT' | 'LIMIT_EXCEEDED' | 'DUPLICATE' | 'ENGINE_BUSY';
}

export function validateTransaction(
  amount: number,
  receiver: string,
  maxAmount: number = 100000,
  options?: { skipLockCheck?: boolean },
): ValidationResult {
  if (!options?.skipLockCheck && PaymentManager.isLocked()) {
    return { valid: false, error: 'A payment is already in progress', code: 'ENGINE_BUSY' };
  }

  if (!receiver || receiver.trim().length < 3) {
    return { valid: false, error: 'Please enter a valid receiver', code: 'INVALID_RECEIVER' };
  }
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than zero', code: 'INVALID_AMOUNT' };
  }
  if (amount > maxAmount) {
    return { valid: false, error: `Amount exceeds ₹${maxAmount} limit`, code: 'LIMIT_EXCEEDED' };
  }
  return { valid: true };
}

// ─── Transaction Creation ───────────────────────────────────────────

export function createTransaction(
  amount: number,
  receiver: string,
  receiverName?: string,
  mode: NetworkMode = 'GSM',
  method: 'USSD' | 'WALLET' | 'ONLINE' = 'USSD',
  action: 'PAY' | 'REQUEST' = 'PAY',
): Transaction {
  const ussdCommand = method === 'USSD' ? buildUssdCommand(receiver.trim(), amount) : undefined;
  return {
    id: generateTransactionId(),
    amount,
    receiver: receiver.trim(),
    receiverName: receiverName?.trim(),
    method,
    action,
    status: 'PENDING',
    timestamp: Date.now(),
    retryCount: 0,
    ussdCommand,
  };
}

// ─── USSD Execution (with state machine) ────────────────────────────

export async function executeUssdTransaction(
  transaction: Transaction,
  onStatusUpdate: (id: string, status: TransactionStatus, message?: string) => void
): Promise<Transaction> {
  // Acquire lock — prevents duplicate payments
  if (!PaymentManager.acquireLock(transaction.id)) {
    onStatusUpdate(transaction.id, 'FAILED', 'Another payment is in progress');
    return { ...transaction, status: 'FAILED' };
  }

  // Persist to recover from crash
  await PaymentManager.persistPendingPayment(transaction);

  const ussdCommand = buildUssdCommand(transaction.receiver, transaction.amount);
  let updatedTxn = { ...transaction, ussdCommand, status: 'SENT' as TransactionStatus };
  const txnStartTime = Date.now();

  try {
    // ── VALIDATING ──
    PaymentManager.transition('VALIDATING', 'Validating payment details');
    onStatusUpdate(transaction.id, 'PENDING', 'Validating...');

    const validation = validateTransaction(transaction.amount, transaction.receiver, 100000, { skipLockCheck: true });
    if (!validation.valid) {
      PaymentManager.transition('FAILED', validation.error || 'Validation failed');
      PaymentManager.releaseLock();
      onStatusUpdate(transaction.id, 'FAILED', validation.error);
      return { ...updatedTxn, status: 'FAILED' };
    }

    // ── PREPARING ──
    PaymentManager.transition('PREPARING', 'Building USSD command');
    onStatusUpdate(transaction.id, 'PENDING', 'Preparing payment...');

    // ── PROCESSING ──
    PaymentManager.transition('PROCESSING', 'Dialing USSD');
    onStatusUpdate(transaction.id, 'SENT', 'Opening USSD dialer...');
    await dialUssdCode(ussdCommand);

    // ── WAITING CONFIRMATION ──
    PaymentManager.transition('WAITING_CONFIRMATION', 'Awaiting SMS confirmation');
    onStatusUpdate(transaction.id, 'PENDING', 'Awaiting SMS Confirmation...');

    // Start timeout
    PaymentManager.startTimeout(() => {
      if (PaymentManager.getState() === 'WAITING_CONFIRMATION') {
        PaymentManager.transition('TIMEOUT', 'Bank confirmation timed out');
        onStatusUpdate(transaction.id, 'FAILED', 'Confirmation timed out. Check your bank app.');
      }
    }, SMS_WAIT_TIMEOUT_MS);

    const smsResult = await waitForBankConfirmation(transaction, txnStartTime);

    if (smsResult === 'SUCCESS') {
      PaymentManager.transition('SUCCESS', 'Payment confirmed via SMS');
      onStatusUpdate(transaction.id, 'SUCCESS', 'Payment Completed!');
      return { ...updatedTxn, status: 'SUCCESS' };
    }

    // Check if timeout already fired
    if (PaymentManager.getState() === 'TIMEOUT') {
      onStatusUpdate(transaction.id, 'FAILED', 'Confirmation timed out');
      return { ...updatedTxn, status: 'FAILED' };
    }

    PaymentManager.transition('FAILED', 'No confirmation received');
    PaymentManager.releaseLock();
    onStatusUpdate(transaction.id, 'FAILED', 'No confirmation received.');
    return { ...updatedTxn, status: 'FAILED' };

  } catch (error: any) {
    const errorMsg = error?.message || 'Transaction failed';
    PaymentManager.transition('FAILED', `Error: ${errorMsg}`);
    PaymentManager.releaseLock();
    onStatusUpdate(transaction.id, 'FAILED', 'Transaction failed. Please retry.');
    return { ...updatedTxn, status: 'FAILED' };
  }
}

// ─── SMS Confirmation Listener ──────────────────────────────────────

function waitForBankConfirmation(
  transaction: Transaction,
  txnStartTime: number
): Promise<'SUCCESS' | 'FAILED'> {
  return new Promise((resolve) => {
    let resolved = false;

    const finish = (result: 'SUCCESS' | 'FAILED') => {
      if (resolved) return;
      resolved = true;
      subscription.remove();
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      resolve(result);
    };

    // Method 1: Real-time SMS listener
    const subscription = onSmsReceived((sms: SmsMessage) => {
      if (isBankSms(sms.sender)) {
        const result = parseSmsForTransaction(sms);
        if (result === 'SUCCESS') {
          finish('SUCCESS');
          return;
        }
      }
      const demoResult = parseDemoSms(sms.body);
      if (demoResult.result === 'SUCCESS') {
        finish('SUCCESS');
      }
    });

    // Method 2: Poll SMS inbox
    const pollTimer = setInterval(async () => {
      try {
        const recentMessages = await readRecentSms(15);
        for (const sms of recentMessages) {
          if (sms.timestamp >= txnStartTime - 5000) {
            if (isBankSms(sms.sender)) {
              const result = parseSmsForTransaction(sms);
              if (result === 'SUCCESS') {
                finish('SUCCESS');
                return;
              }
            }
            const demoResult = parseDemoSms(sms.body);
            if (demoResult.result === 'SUCCESS') {
              finish('SUCCESS');
              return;
            }
          }
        }
      } catch (_) {
        // Continue polling silently
      }
    }, SMS_POLL_INTERVAL_MS);

    // Timeout fallback
    const timeoutTimer = setTimeout(() => {
      finish('FAILED');
    }, SMS_WAIT_TIMEOUT_MS);
  });
}

// ─── Wallet Transaction (simulated) ────────────────────────────────

export async function executeWalletTransaction(
  transaction: Transaction,
  onStatusUpdate: (id: string, status: TransactionStatus, message?: string) => void
): Promise<Transaction> {
  if (!PaymentManager.acquireLock(transaction.id)) {
    onStatusUpdate(transaction.id, 'FAILED', 'Another payment is in progress');
    return { ...transaction, status: 'FAILED' };
  }

  await PaymentManager.persistPendingPayment(transaction);
  const updatedTxn = { ...transaction, status: 'SENT' as TransactionStatus };

  try {
    PaymentManager.transition('VALIDATING', 'Wallet PIN verified');
    onStatusUpdate(transaction.id, 'PENDING', 'Processing wallet payment...');

    PaymentManager.transition('PROCESSING', 'Simulated wallet transfer');
    await new Promise<void>(r => setTimeout(r, 600));

    PaymentManager.transition('SUCCESS', 'Wallet payment completed');
    onStatusUpdate(transaction.id, 'SUCCESS', 'Payment processed successfully!');
    PaymentManager.releaseLock();
    return { ...updatedTxn, status: 'SUCCESS' };

  } catch (error) {
    PaymentManager.transition('FAILED', 'Wallet transaction failed');
    PaymentManager.releaseLock();
    onStatusUpdate(transaction.id, 'FAILED', 'Wallet transfer failed.');
    return { ...updatedTxn, status: 'FAILED' };
  }
}
