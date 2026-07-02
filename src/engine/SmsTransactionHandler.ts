// ─── SMS → Transaction + Wallet + Widget Sync ───────────────────────
// Credits: announce + wallet credit + RECEIVED txn
// Debits: store txn only (no wallet change, no soundbox)

import { PaymentNotification } from './PaymentSmsParser';
import { useStore } from '../store/useStore';
import { createTransaction } from './TransactionEngine';
import type { Transaction } from '../types';
import { syncExpenseData, syncGoalAmount, syncHomeWidget, syncBalanceWidget } from './WidgetService';
import { isWidgetAvailable } from './WidgetService';

function txnFingerprint(notification: PaymentNotification): string {
  if (notification.refNumber) return `ref:${notification.refNumber}`;
  return `${notification.type}:${notification.amount}:${notification.sender}:${notification.rawBody.slice(0, 40)}`;
}

function isDuplicate(notification: PaymentNotification): boolean {
  const { transactions } = useStore.getState();
  const fp = txnFingerprint(notification);
  return transactions.some(t => {
    if (t.responseMessage?.includes(fp)) return true;
    if (notification.refNumber && t.responseMessage?.includes(notification.refNumber)) return true;
    if (notification.refNumber && t.smsBody?.includes(notification.refNumber)) return true;
    return false;
  });
}

function getTodaySpent(): number {
  const { transactions } = useStore.getState();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return transactions
    .filter(t => t.timestamp >= start.getTime() && t.status === 'SUCCESS')
    .reduce((sum, t) => sum + t.amount, 0);
}

function syncWidgetsAfterPayment(user: ReturnType<typeof useStore.getState>['user'], settings: ReturnType<typeof useStore.getState>['settings']) {
  if (!isWidgetAvailable()) return;
  const wallet = user.walletBalance ?? user.balance ?? 0;
  const bank = user.bankBalance ?? 0;
  const todaySpent = getTodaySpent();
  syncHomeWidget(wallet, bank).catch(() => {});
  syncBalanceWidget(wallet, bank, todaySpent).catch(() => {});
  syncGoalAmount(user.goalAmount || 0, wallet).catch(() => {});
  syncExpenseData(user.spentThisMonth || 0, user.monthlyBudget || 0, user.budgetResetDay || 1).catch(() => {});
}

/**
 * Process a parsed payment SMS — returns true if a new transaction was stored.
 */
export function handlePaymentSmsNotification(notification: PaymentNotification): boolean {
  const fingerprint = txnFingerprint(notification);
  if (isDuplicate(notification)) return false;

  const state = useStore.getState();
  const { addTransaction, setUser, user, settings } = state;

  if (notification.type === 'CREDIT') {
    const receiver = notification.sender || 'Payment Received';
    const txn = createTransaction(
      notification.amount,
      receiver,
      receiver.split('@')[0] || receiver,
      'GSM',
      'ONLINE',
      'PAY',
    );
    const stored: Transaction = {
      ...txn,
      status: 'RECEIVED',
      responseMessage: `SMS credit ${fingerprint}`,
      smsBody: notification.rawBody.slice(0, 500),
    };
    addTransaction(stored);

    const newWallet = (user.walletBalance ?? user.balance ?? 0) + notification.amount;
    setUser({
      walletBalance: newWallet,
      balance: settings.balanceSource === 'WALLET' ? newWallet : user.balance,
    });
    syncWidgetsAfterPayment(useStore.getState().user, settings);
    return true;
  }

  // DEBIT — record in passbook / expense only; wallet unchanged; no announcement
  const merchant = extractDebitMerchant(notification.rawBody) || notification.sender || 'Payment';
  const txn = createTransaction(
    notification.amount,
    merchant,
    merchant,
    'GSM',
    'ONLINE',
    'PAY',
  );
  const stored: Transaction = {
    ...txn,
    status: 'SUCCESS',
    responseMessage: `SMS debit ${fingerprint}`,
    smsBody: notification.rawBody.slice(0, 500),
  };
  addTransaction(stored);
  syncWidgetsAfterPayment(useStore.getState().user, settings);
  return true;
}

function extractDebitMerchant(body: string): string {
  const toMatch = body.match(/\bTo\s+([A-Za-z0-9\s.&'-]+?)(?:\s+On|\s+Ref|\s+Not You|$)/i);
  if (toMatch?.[1]) return toMatch[1].trim();
  return '';
}
