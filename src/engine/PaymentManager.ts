// ─── Payment Manager 3.0 ─────────────────────────────────────────────
// Production-grade payment state machine, queue manager, and recovery engine.
// Solves: frozen screens, duplicate payments, state corruption, silent failures.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction, TransactionStatus } from '../types';

// ─── Transaction State Machine ──────────────────────────────────────

export type PaymentState =
  | 'IDLE'
  | 'VALIDATING'
  | 'PREPARING'
  | 'PROCESSING'
  | 'WAITING_CONFIRMATION'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'RETRY';

const VALID_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  IDLE:                 ['VALIDATING'],
  VALIDATING:           ['PREPARING', 'FAILED', 'CANCELLED'],
  PREPARING:            ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING:           ['WAITING_CONFIRMATION', 'FAILED', 'CANCELLED', 'TIMEOUT'],
  WAITING_CONFIRMATION: ['SUCCESS', 'FAILED', 'TIMEOUT', 'RETRY'],
  SUCCESS:              ['IDLE'],
  FAILED:               ['IDLE', 'RETRY'],
  CANCELLED:            ['IDLE'],
  TIMEOUT:              ['IDLE', 'RETRY'],
  RETRY:                ['VALIDATING', 'FAILED', 'CANCELLED'],
};

// ─── Payment Log ────────────────────────────────────────────────────

export interface PaymentLogEntry {
  timestamp: number;
  state: PaymentState;
  message: string;
  data?: any;
}

// ─── Payment Manager Singleton ──────────────────────────────────────

const STORAGE_KEY_PENDING = '@edgepay/pending_payment';
const STORAGE_KEY_LOG = '@edgepay/payment_log';
const MAX_LOG_ENTRIES = 200;
const MAX_RETRIES = 3;
const PAYMENT_TIMEOUT_MS = 120_000; // 2 minutes

class PaymentManagerImpl {
  private currentState: PaymentState = 'IDLE';
  private activeTxnId: string | null = null;
  private activeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private log: PaymentLogEntry[] = [];
  private listeners: Set<(state: PaymentState, message: string) => void> = new Set();
  private executionLock = false;

  // ─── State Machine ─────────────────────────────────────────────

  getState(): PaymentState {
    return this.currentState;
  }

  getActiveTxnId(): string | null {
    return this.activeTxnId;
  }

  isLocked(): boolean {
    return this.executionLock;
  }

  transition(newState: PaymentState, message: string = '', data?: any): boolean {
    const allowed = VALID_TRANSITIONS[this.currentState];
    if (!allowed || !allowed.includes(newState)) {
      this.addLog(this.currentState, `BLOCKED transition to ${newState}: ${message}`);
      return false;
    }

    this.currentState = newState;
    this.addLog(newState, message, data);
    this.notifyListeners(newState, message);

    // Terminal states release lock immediately so user can retry
    if (['SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(newState)) {
      this.clearTimeout();
      this.persistPendingPayment(null);
      this.executionLock = false;
    }

    // IDLE resets everything
    if (newState === 'IDLE') {
      this.activeTxnId = null;
      this.executionLock = false;
      this.clearTimeout();
    }

    return true;
  }

  // ─── Execution Lock (prevents duplicate payments) ──────────────

  acquireLock(txnId: string): boolean {
    if (this.executionLock) {
      this.addLog(this.currentState, `Lock denied for ${txnId} — already processing ${this.activeTxnId}`);
      return false;
    }
    this.executionLock = true;
    this.activeTxnId = txnId;
    this.addLog('IDLE', `Lock acquired for ${txnId}`);
    return true;
  }

  releaseLock(): void {
    this.executionLock = false;
    this.activeTxnId = null;
  }

  // ─── Timeout Management ────────────────────────────────────────

  startTimeout(onTimeout: () => void, ms: number = PAYMENT_TIMEOUT_MS): void {
    this.clearTimeout();
    this.activeTimeoutId = setTimeout(() => {
      if (this.currentState === 'PROCESSING' || this.currentState === 'WAITING_CONFIRMATION') {
        onTimeout();
      }
    }, ms);
  }

  clearTimeout(): void {
    if (this.activeTimeoutId) {
      clearTimeout(this.activeTimeoutId);
      this.activeTimeoutId = null;
    }
  }

  // ─── Listeners ─────────────────────────────────────────────────

  subscribe(listener: (state: PaymentState, message: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(state: PaymentState, message: string): void {
    this.listeners.forEach(l => {
      try { l(state, message); } catch (_) {}
    });
  }

  // ─── Logging ───────────────────────────────────────────────────

  private addLog(state: PaymentState, message: string, data?: any): void {
    const entry: PaymentLogEntry = { timestamp: Date.now(), state, message, data };
    this.log.push(entry);

    // Trim
    if (this.log.length > MAX_LOG_ENTRIES) {
      this.log = this.log.slice(-MAX_LOG_ENTRIES);
    }

    // Persist async
    this.persistLog();

    if (__DEV__) {
      console.log(`[PaymentManager] [${state}] ${message}`, data || '');
    }
  }

  getLog(): PaymentLogEntry[] {
    return [...this.log];
  }

  getRecentLog(count: number = 20): PaymentLogEntry[] {
    return this.log.slice(-count);
  }

  // ─── Persistence (crash recovery) ─────────────────────────────

  async persistPendingPayment(txn: Transaction | null): Promise<void> {
    try {
      if (txn) {
        await AsyncStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(txn));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY_PENDING);
      }
    } catch (_) {}
  }

  async recoverPendingPayment(): Promise<Transaction | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_PENDING);
      if (!raw) return null;
      const txn = JSON.parse(raw) as Transaction;
      // If payment was stuck in a non-terminal state, mark it as FAILED
      if (txn.status === 'PENDING' || txn.status === 'SENT') {
        txn.status = 'FAILED';
        this.addLog('IDLE', `Recovered stuck transaction ${txn.id} — marked as FAILED`);
      }
      await AsyncStorage.removeItem(STORAGE_KEY_PENDING);
      return txn;
    } catch (_) {
      await AsyncStorage.removeItem(STORAGE_KEY_PENDING);
      return null;
    }
  }

  private async persistLog(): Promise<void> {
    try {
      const trimmed = this.log.slice(-50); // Only persist last 50 for space
      await AsyncStorage.setItem(STORAGE_KEY_LOG, JSON.stringify(trimmed));
    } catch (_) {}
  }

  async loadLog(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_LOG);
      if (raw) {
        this.log = JSON.parse(raw);
      }
    } catch (_) {
      this.log = [];
    }
  }

  // ─── State Corruption Detection & Recovery ─────────────────────

  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if stuck in non-terminal state
    if (this.executionLock && !this.activeTxnId) {
      issues.push('Execution lock held without active transaction');
      this.releaseLock();
    }

    // Check for orphaned pending payments
    const pending = await this.recoverPendingPayment();
    if (pending) {
      issues.push(`Recovered orphaned transaction: ${pending.id}`);
    }

    // Verify AsyncStorage is accessible
    try {
      await AsyncStorage.setItem('@edgepay/health_check', 'ok');
      await AsyncStorage.removeItem('@edgepay/health_check');
    } catch (e) {
      issues.push('AsyncStorage is not accessible — possible corruption');
    }

    // Force reset to IDLE if in a bad state
    if (!['IDLE', 'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(this.currentState)) {
      issues.push(`State was stuck at ${this.currentState} — reset to IDLE`);
      this.currentState = 'IDLE';
      this.releaseLock();
    }

    return { healthy: issues.length === 0, issues };
  }

  // ─── Full Reset (last resort, no data loss) ───────────────────

  async reset(): Promise<void> {
    this.currentState = 'IDLE';
    this.activeTxnId = null;
    this.executionLock = false;
    this.clearTimeout();
    await AsyncStorage.removeItem(STORAGE_KEY_PENDING);
    this.addLog('IDLE', 'Payment engine fully reset');
  }
}

// Export singleton
export const PaymentManager = new PaymentManagerImpl();
