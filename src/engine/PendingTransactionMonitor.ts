import { useStore } from '../store/useStore';
import { PaymentManager } from './PaymentManager';

/** Pending transactions older than this are marked failed */
export const PENDING_TRANSACTION_TIMEOUT_MS = 2 * 60 * 1000;

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function expireStalePendingTransactions(): number {
  const now = Date.now();
  const { transactions, updateTransaction } = useStore.getState();
  let expired = 0;

  for (const txn of transactions) {
    if (txn.status !== 'PENDING' && txn.status !== 'SENT') continue;
    if (now - txn.timestamp < PENDING_TRANSACTION_TIMEOUT_MS) continue;

    updateTransaction(txn.id, {
      status: 'FAILED',
      responseMessage: 'Transaction timed out after 2 minutes',
    });
    expired++;
  }

  if (expired > 0) {
    PaymentManager.releaseLock();
  }
  return expired;
}

export function startPendingTransactionMonitor(): () => void {
  stopPendingTransactionMonitor();
  expireStalePendingTransactions();
  monitorInterval = setInterval(expireStalePendingTransactions, 15_000);
  return stopPendingTransactionMonitor;
}

export function stopPendingTransactionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
