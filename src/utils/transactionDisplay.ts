import type { Transaction } from '../types';

/** Money received (SMS credit, wallet incoming) */
export function isIncomingTransaction(t: Transaction): boolean {
  return t.status === 'RECEIVED';
}

/** Money sent / debited from user */
export function isOutgoingTransaction(t: Transaction): boolean {
  if (t.status === 'RECEIVED') return false;
  if (t.action === 'REQUEST') return false;
  return true;
}

export function getTransactionAmountSign(t: Transaction): string {
  if (t.status === 'CANCELLED') return '';
  return isIncomingTransaction(t) ? '+' : '-';
}

export function getTransactionLabel(t: Transaction): string {
  if (isIncomingTransaction(t)) {
    return `From ${t.receiverName || t.receiver}`;
  }
  return `To ${t.receiverName || t.receiver}`;
}
