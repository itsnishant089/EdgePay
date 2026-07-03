// ─── Transaction Types ───────────────────────────────────────────────

export type TransactionStatus = 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED' | 'QUEUED' | 'CANCELLED' | 'RECEIVED';

export type TransactionMethod = 'USSD' | 'ONLINE' | 'WALLET';

export type NetworkMode = 'ONLINE' | 'GSM' | 'DETECTING';

export interface Transaction {
  id: string;
  amount: number;
  receiver: string;
  receiverName?: string;
  method: TransactionMethod;
  status: TransactionStatus;
  timestamp: number;
  ussdCommand?: string;
  action?: 'PAY' | 'REQUEST';
  smsBody?: string;
  retryCount: number;
  lastRetryAt?: number;
  responseMessage?: string;
  upiId?: string;
}

// ─── QR Data Types ───────────────────────────────────────────────────

export interface QRPaymentData {
  upiId: string;
  name: string;
  amount?: number;
  note?: string;
  raw: string;
}

// ─── SMS Types ───────────────────────────────────────────────────────

export interface SmsMessage {
  sender: string;
  body: string;
  timestamp: number;
  source?: string;
}

export interface SmsPermissions {
  send: boolean;
  receive: boolean;
  read: boolean;
  allGranted: boolean;
}

export interface SmsSendResult {
  status: 'SENT' | 'FAILED';
  phoneNumber: string;
  message: string;
  timestamp: number;
}

export type SmsParseResult = 'SUCCESS' | 'FAILED' | 'UNKNOWN';

// ─── USSD Types ──────────────────────────────────────────────────────

export interface UssdPermissions {
  callPhone: boolean;
  readPhoneState: boolean;
  allGranted: boolean;
}

export interface UssdResponse {
  status: 'SUCCESS' | 'DIALED';
  request?: string;
  response?: string;
  ussdCode?: string;
  timestamp: number;
}

// ─── Contact Types ───────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  phone: string;
  photo?: string | null;
  upiId?: string;
  isFavorite: boolean;
  lastPaidAt?: number;
  lastAmount?: number;
}

// ─── User Types ──────────────────────────────────────────────────────

export type BalanceSource = 'WALLET' | 'BANK';

export interface UserData {
  name: string;
  phone: string;
  upiId?: string;
  balance: number;
  walletBalance: number;
  bankBalance: number;
  currency: string;
  bank: string;
  isOnboarded: boolean;
  goalAmount: number;
  monthlyBudget: number;
  spentThisMonth: number;
  budgetResetDay: number; // 1-31
  isMerchantMode?: boolean;
}

// ─── Notification Types ──────────────────────────────────────────────

export type NotificationType = 'PAYMENT' | 'ALERT' | 'REMINDER' | 'GOAL' | 'ANNOUNCEMENT';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
  actionUrl?: string;
}

// ─── Settings Types ──────────────────────────────────────────────────

export interface AppSettings {
  gatewayNumber: string;
  smsTemplate: string;
  maxTransactionAmount: number;
  pinHash: string;
  isBiometricEnabled: boolean;
  isSoundboxEnabled: boolean;
  soundboxLanguage: 'en' | 'hi';
  balanceSource: BalanceSource;
  autoSwitchPaymentMode: boolean;
  isWidgetEnabled: boolean;
  autoBalanceRefresh: boolean;
  autoBalanceOnAppOpen: boolean;
}

// ─── Store Types ─────────────────────────────────────────────────────

export interface AppStore {
  // User
  user: UserData;
  setUser: (user: Partial<UserData>) => void;

  // Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;

  // Network
  networkMode: NetworkMode;
  setNetworkMode: (mode: NetworkMode) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (txn: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  cancelTransaction: (id: string) => void;
  removeTransaction: (id: string) => void;
  getRecentTransactions: (count?: number) => Transaction[];

  // Queue
  pendingQueue: Transaction[];
  addToQueue: (txn: Transaction) => void;
  removeFromQueue: (id: string) => void;

  // Permissions
  smsPermissions: SmsPermissions;
  setSmsPermissions: (perms: SmsPermissions) => void;

  ussdPermissions: UssdPermissions;
  setUssdPermissions: (perms: UssdPermissions) => void;

  // UI
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Auth
  isAuthenticated: boolean;
  setAuthenticated: (val: boolean) => void;
  recalculateSpending: () => void;
  checkAndResetBudget: () => void;

  // Contacts
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  toggleFavoriteContact: (id: string) => void;

  // Notifications
  notifications: AppNotification[];
  addNotification: (notif: AppNotification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

// ─── Navigation Types ────────────────────────────────────────────────

export type RootTabParamList = {
  Dashboard: undefined;
  SendMoney: { receiver?: string; amount?: number; name?: string; method?: string } | undefined;
  QRScan: undefined;
  History: undefined;
  Setup: undefined;
  Settings: undefined;
  Account: undefined;
  Services: undefined;
  UpiPayment: undefined;
  ExpenseTracker: undefined;
  Contacts: undefined;
  WidgetSettings: undefined;
  Diagnostics: undefined;
  ContactProfile: { contact: any }; // Using any here to avoid circular dependencies if needed, or import Contact
};
