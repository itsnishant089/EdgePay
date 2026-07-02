// ─── Zustand Store ───────────────────────────────────────────────────

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStore, Transaction, NetworkMode, SmsPermissions, UssdPermissions, UserData, AppSettings, Contact, AppNotification } from '../types';
import { STORAGE_KEYS, DEFAULT_USER, DEFAULT_SETTINGS, DEFAULT_WALLET_BALANCE } from '../utils/constants';
import type { BalanceSource } from '../types';

interface UIState {
  theme: 'light' | 'dark';
  language: 'en' | 'hi' | 'mr' | 'ur' | 'bn' | 'kn' | 'or' | 'pa' | 'gu' | 'ta' | 'te';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'en' | 'hi' | 'mr' | 'ur' | 'bn' | 'kn' | 'or' | 'pa' | 'gu' | 'ta' | 'te') => void;
}

export const useStore = create<AppStore & UIState>((set, get) => ({
  // ─── User ────────────────────────────────────────────────────────
  user: { ...DEFAULT_USER },

  setUser: (updates: Partial<UserData>) => {
    set(state => {
      const newUser = { ...state.user, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(newUser)).catch(() => {});
      return { user: newUser };
    });
  },

  // ─── Settings ────────────────────────────────────────────────────
  settings: { ...DEFAULT_SETTINGS },

  setSettings: (updates: Partial<AppSettings>) => {
    set(state => {
      const newSettings = { ...state.settings, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings)).catch(() => {});
      return { settings: newSettings };
    });
  },

  // ─── UI / Theme / Lang ───────────────────────────────────────────
  theme: 'light' as 'light' | 'dark', 
  language: 'en' as 'en' | 'hi' | 'mr' | 'ur' | 'bn' | 'kn' | 'or' | 'pa' | 'gu' | 'ta' | 'te',

  toggleTheme: () => {
    set(state => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
  },

  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
  },

  setLanguage: (lang: 'en' | 'hi' | 'mr' | 'ur' | 'bn' | 'kn' | 'or' | 'pa' | 'gu' | 'ta' | 'te') => {
    set({ language: lang });
  },

  // ─── Network ─────────────────────────────────────────────────────
  networkMode: 'DETECTING' as NetworkMode,

  setNetworkMode: (mode: NetworkMode) => set({ networkMode: mode }),

  // ─── Transactions ────────────────────────────────────────────────
  transactions: [],

  addTransaction: (txn: Transaction) => {
    set(state => {
      const updated = [txn, ...state.transactions];
      let newSpent = state.user.spentThisMonth;

      const countsAsExpense =
        txn.status !== 'FAILED' &&
        txn.status !== 'CANCELLED' &&
        txn.status !== 'RECEIVED' &&
        txn.action !== 'REQUEST';

      if (countsAsExpense) {
        newSpent += txn.amount;
      }

      const newUser = { ...state.user, spentThisMonth: newSpent };
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated)).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(newUser)).catch(() => {});
      return { transactions: updated, user: newUser };
    });
  },

  updateTransaction: (id: string, updates: Partial<Transaction>) => {
    set(state => {
      const updated = state.transactions.map(txn =>
        txn.id === id ? { ...txn, ...updates } : txn
      );
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated)).catch(() => {});
      return { transactions: updated };
    });
  },

  cancelTransaction: (id: string) => {
    set(state => {
      const updated = state.transactions.map(txn =>
        txn.id === id ? { ...txn, status: 'CANCELLED' as const } : txn
      );
      const updatedQueue = state.pendingQueue.filter(txn => txn.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated)).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(updatedQueue)).catch(() => {});
      return { transactions: updated, pendingQueue: updatedQueue };
    });
  },

  removeTransaction: (id: string) => {
    set(state => {
      const removed = state.transactions.find(t => t.id === id);
      let newSpent = state.user.spentThisMonth;
      if (removed && removed.status !== 'FAILED' && removed.status !== 'CANCELLED' && removed.status !== 'RECEIVED' && removed.action !== 'REQUEST') {
        newSpent = Math.max(0, newSpent - removed.amount);
      }
      const updated = state.transactions.filter(txn => txn.id !== id);
      const updatedQueue = state.pendingQueue.filter(txn => txn.id !== id);
      const newUser = { ...state.user, spentThisMonth: newSpent };
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated)).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(updatedQueue)).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(newUser)).catch(() => {});
      return { transactions: updated, pendingQueue: updatedQueue, user: newUser };
    });
  },

  getRecentTransactions: (count: number = 5) => {
    return get().transactions.slice(0, count);
  },

  // ─── Queue ───────────────────────────────────────────────────────
  pendingQueue: [],

  addToQueue: (txn: Transaction) => {
    set(state => {
      const updated = [...state.pendingQueue, { ...txn, status: 'QUEUED' as const }];
      AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(updated)).catch(() => {});
      return { pendingQueue: updated };
    });
  },

  removeFromQueue: (id: string) => {
    set(state => {
      const updated = state.pendingQueue.filter(txn => txn.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(updated)).catch(() => {});
      return { pendingQueue: updated };
    });
  },

  // ─── Permissions ─────────────────────────────────────────────────
  smsPermissions: {
    send: false,
    receive: false,
    read: false,
    allGranted: false,
  },

  setSmsPermissions: (perms: SmsPermissions) => set({ smsPermissions: perms }),

  ussdPermissions: {
    callPhone: false,
    readPhoneState: false,
    allGranted: false,
  },

  setUssdPermissions: (perms: UssdPermissions) => set({ ussdPermissions: perms }),

  // ─── UI ──────────────────────────────────────────────────────────
  isLoading: false,
  setLoading: (loading: boolean) => set({ isLoading: loading }),

  // ─── Auth ────────────────────────────────────────────────────────
  isAuthenticated: false,
  setAuthenticated: (val: boolean) => set({ isAuthenticated: val }),

  recalculateSpending: () => {
    set(state => {
      let totalSpent = 0;
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      if (state.transactions && Array.isArray(state.transactions)) {
        state.transactions.forEach(txn => {
          const txnDate = new Date(txn.timestamp);
          if (txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear) {
            if (
              txn.status !== 'FAILED' &&
              txn.status !== 'CANCELLED' &&
              txn.status !== 'RECEIVED' &&
              txn.action !== 'REQUEST'
            ) {
              totalSpent += txn.amount;
            }
          }
        });
      }
      
      const newUser = { ...state.user, spentThisMonth: totalSpent };
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(newUser)).catch(() => {});
      return { user: newUser };
    });
  },

  checkAndResetBudget: () => {
    const { user } = get();
    if (!user.budgetResetDay || user.budgetResetDay < 1 || user.budgetResetDay > 31) return;

    const today = new Date();
    const isResetDay = today.getDate() === user.budgetResetDay;
    const key = `@edgepay/last_reset_${today.getFullYear()}_${today.getMonth()}`;

    AsyncStorage.getItem(key).then(lastReset => {
      if (isResetDay && lastReset !== 'true') {
        set({ user: { ...user, spentThisMonth: 0 } });
        AsyncStorage.setItem(key, 'true');
      }
    });
  },

  // ─── Contacts ────────────────────────────────────────────────────
  contacts: [],
  setContacts: (contacts: Contact[]) => set({ contacts }),
  toggleFavoriteContact: (id: string) => {
    set(state => ({
      contacts: state.contacts.map(c => 
        c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
      )
    }));
  },

  // ─── Notifications ────────────────────────────────────────────────
  notifications: [],
  addNotification: (notif: AppNotification) => {
    set(state => {
      const updated = [notif, ...state.notifications];
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated)).catch(() => {});
      return { notifications: updated };
    });
  },
  markNotificationRead: (id: string) => {
    set(state => {
      const updated = state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated)).catch(() => {});
      return { notifications: updated };
    });
  },
  markAllNotificationsRead: () => {
    set(state => {
      const updated = state.notifications.map(n => ({ ...n, isRead: true }));
      AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated)).catch(() => {});
      return { notifications: updated };
    });
  }
}));

export function getDisplayBalance(
  user: { walletBalance?: number; bankBalance?: number; balance?: number },
  balanceSource: BalanceSource,
): number {
  if (balanceSource === 'BANK') {
    return user.bankBalance ?? 0;
  }
  return user.walletBalance ?? user.balance ?? DEFAULT_WALLET_BALANCE;
}

export function syncActiveBalance(
  user: { walletBalance?: number; bankBalance?: number },
  balanceSource: BalanceSource,
): number {
  return getDisplayBalance(user, balanceSource);
}

/**
 * Initialize store with persisted data
 */
export async function initializeStore(): Promise<void> {
  try {
    const [transactionsData, userData, queueData, settingsData, notificationsData] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
      AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
      AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE),
      AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
      AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
    ]);

    const state: Partial<AppStore & UIState> = {};

    if (transactionsData) {
      state.transactions = JSON.parse(transactionsData);
    }
    if (userData) {
      const parsedUser = JSON.parse(userData);
      const walletBalance = parsedUser.walletBalance ?? parsedUser.balance ?? DEFAULT_WALLET_BALANCE;
      const bankBalance = parsedUser.bankBalance ?? 0;
      state.user = {
        ...DEFAULT_USER,
        ...parsedUser,
        upiId: parsedUser.upiId || DEFAULT_USER.upiId,
        walletBalance,
        bankBalance,
        balance: walletBalance > 0 ? walletBalance : DEFAULT_WALLET_BALANCE,
      };
      if ((state.user.walletBalance ?? 0) <= 0) {
        state.user.walletBalance = DEFAULT_WALLET_BALANCE;
        state.user.balance = DEFAULT_WALLET_BALANCE;
      }
      
      // Auto-recalculate spentThisMonth from transactions if needed
      if (state.transactions) {
        let totalSpent = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        state.transactions.forEach((txn: any) => {
          const txnDate = new Date(txn.timestamp);
          // Simple month boundary check — in a real app would use the user.budgetResetDay
          if (txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear) {
            if (
              txn.status !== 'FAILED' &&
              txn.status !== 'CANCELLED' &&
              txn.status !== 'RECEIVED' &&
              txn.action !== 'REQUEST'
            ) {
              totalSpent += txn.amount;
            }
          }
        });
        if (state.user) {
          state.user.spentThisMonth = totalSpent;
        }
      }
    }
    if (queueData) {
      state.pendingQueue = JSON.parse(queueData);
    }
    if (settingsData) {
      state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) };
    }
    if (notificationsData) {
      state.notifications = JSON.parse(notificationsData);
    }

    useStore.setState(state);
  } catch (error) {
    console.error('[Store] Failed to initialize:', error);
  }
}
