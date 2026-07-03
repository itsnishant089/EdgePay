// ─── Payment Soundbox Engine 2.0 ──────────────────────────────────────
// Orchestrator for SMS listening, parsing, filtering, and queueing announcements.
// Fully offline — zero internet dependency.

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { readRecentSms } from './SmsService';
import Tts from 'react-native-tts';
import { parsePaymentSms, PaymentNotification } from './PaymentSmsParser';
import { soundboxQueue } from './SoundboxQueue';
import { duplicateFilter } from './DuplicateFilter';
import { handlePaymentSmsNotification } from './SmsTransactionHandler';

const { SmsModule, SoundboxAudio } = NativeModules;

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

export interface SoundboxConfig {
  enabled: boolean;
  language: string;
  announceCredits: boolean;
  announceDebits: boolean;
  speechRate: number;
  voicePitch?: number;
  minAmount?: number;
  speakSenderName?: boolean;
  speakBankName?: boolean;
  announcementStyle?: 'PERSONAL' | 'MERCHANT';
  silentHoursStart?: number; // 0-23 (e.g., 22 = 10 PM)
  silentHoursEnd?: number;   // 0-23 (e.g., 7 = 7 AM)
  volumeBoost?: boolean;
}

export const DEFAULT_SOUNDBOX_CONFIG: SoundboxConfig = {
  enabled: true,
  language: 'en',
  announceCredits: true,
  announceDebits: false,
  speechRate: 0.5,
  voicePitch: 1.0,
  minAmount: 0,
  speakSenderName: true,
  speakBankName: true,
  announcementStyle: 'PERSONAL',
  silentHoursStart: 22,
  silentHoursEnd: 7,
  volumeBoost: false,
};

/**
 * Check if current time is within silent hours
 */
function isSilentHour(config: SoundboxConfig): boolean {
  if (config.silentHoursStart === undefined || config.silentHoursEnd === undefined) return false;
  const hour = new Date().getHours();
  const start = config.silentHoursStart;
  const end = config.silentHoursEnd;
  if (start < end) {
    return hour >= start && hour < end;
  } else {
    // Wraps around midnight (e.g., 22 to 7)
    return hour >= start || hour < end;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Notification Listeners
// ──────────────────────────────────────────────────────────────────────

type PaymentCallback = (notification: PaymentNotification) => void;
const paymentListeners: PaymentCallback[] = [];

export function onPaymentDetected(callback: PaymentCallback): { remove: () => void } {
  paymentListeners.push(callback);
  return {
    remove: () => {
      const idx = paymentListeners.indexOf(callback);
      if (idx >= 0) paymentListeners.splice(idx, 1);
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Engine State
// ──────────────────────────────────────────────────────────────────────

let smsSubscription: { remove: () => void } | null = null;
let inboxPollTimer: ReturnType<typeof setInterval> | null = null;
let currentConfig: SoundboxConfig = { ...DEFAULT_SOUNDBOX_CONFIG };
const processedSmsKeys = new Set<string>();
let lastSeenInboxTs = 0;

function smsDedupeKey(sender: string, body: string, timestamp?: number): string {
  return `${sender}|${body.slice(0, 120)}|${timestamp ?? 0}`;
}

function markSmsProcessed(sender: string, body: string, timestamp?: number): void {
  processedSmsKeys.add(smsDedupeKey(sender, body, timestamp));
  if (processedSmsKeys.size > 200) {
    const first = processedSmsKeys.values().next().value;
    if (first) processedSmsKeys.delete(first);
  }
  if (timestamp) lastSeenInboxTs = Math.max(lastSeenInboxTs, timestamp);
}

async function initTts(): Promise<void> {
  try {
    await Tts.getInitStatus();
    Tts.setIgnoreSilentSwitch('ignore');
    Tts.setDucking(true);
  } catch (_) {}
}

async function pollInboxForCredits(): Promise<void> {
  if (!currentConfig.enabled || !currentConfig.announceCredits) return;
  try {
    const messages = await readRecentSms(12);
    for (const msg of messages) {
      if (msg.timestamp <= lastSeenInboxTs - 2000) continue;
      const key = smsDedupeKey(msg.sender, msg.body, msg.timestamp);
      if (processedSmsKeys.has(key)) continue;
      handleIncomingSms(msg);
    }
  } catch (_) {}
}

function startInboxCreditPoll(): void {
  if (inboxPollTimer) return;
  inboxPollTimer = setInterval(() => {
    pollInboxForCredits().catch(() => {});
  }, 6000);
}

function stopInboxCreditPoll(): void {
  if (inboxPollTimer) {
    clearInterval(inboxPollTimer);
    inboxPollTimer = null;
  }
}

/**
 * Handle an incoming SMS Event
 */
function handleIncomingSms(sms: any) {
  if (!currentConfig.enabled) return;

  const { sender, body, timestamp } = sms;
  if (!body) return;

  const key = smsDedupeKey(sender || '', body, timestamp);
  if (processedSmsKeys.has(key)) return;

  console.log('[SoundboxEngine] SMS received from:', sender);

  const notification = parsePaymentSms(sender, body);
  if (!notification) return;

  markSmsProcessed(sender || '', body, timestamp);

  console.log(`[SoundboxEngine] Payment detected: ${notification.type} ${notification.amount}`);

  // 2. Always store transaction / update wallet (dedup inside handler)
  handlePaymentSmsNotification(notification);

  const shouldAnnounceCredit = notification.type === 'CREDIT' && currentConfig.announceCredits;
  const shouldAnnounceDebit = notification.type === 'DEBIT' && currentConfig.announceDebits;
  if (!shouldAnnounceCredit && !shouldAnnounceDebit) return;

  // 3. Silent Hours — skip voice only
  if (isSilentHour(currentConfig)) {
    console.log('[SoundboxEngine] Silent hours active, skipping announcement.');
    return;
  }

  // 4. Duplicate Filter — announcement dedup
  if (duplicateFilter.isDuplicate(notification)) {
    console.log('[SoundboxEngine] Duplicate blocked by filter.');
    return;
  }

  // 5. Enqueue announcement
  if (notification.type === 'CREDIT' && shouldAnnounceCredit) {
    soundboxQueue.enqueue(notification, currentConfig);
  } else if (notification.type === 'DEBIT' && shouldAnnounceDebit) {
    soundboxQueue.enqueue(notification, currentConfig);
  }

  // 6. Notify UI Listeners
  paymentListeners.forEach(cb => {
    try { cb(notification); } catch {}
  });
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/**
 * Start the Payment Soundbox
 */
export async function startSoundbox(config: SoundboxConfig): Promise<void> {
  currentConfig = { ...DEFAULT_SOUNDBOX_CONFIG, ...config };

  if (!currentConfig.enabled) {
    console.log('[SoundboxEngine] Disabled, not starting');
    stopSoundbox();
    return;
  }

  if (Platform.OS !== 'android' || !SmsModule) {
    console.warn('[SoundboxEngine] Only available on Android with SmsModule');
    return;
  }

  // Remove existing subscription if any
  stopSoundbox();

  try {
    await initTts();

    if (SmsModule.startSmsListener) {
      await SmsModule.startSmsListener();
    }

    const emitter = new NativeEventEmitter(SmsModule);
    smsSubscription = emitter.addListener('onSmsReceived', handleIncomingSms);
    startInboxCreditPoll();
    pollInboxForCredits().catch(() => {});

    console.log('[SoundboxEngine] Started — listening via foreground service');
  } catch (err) {
    console.error('[SoundboxEngine] Failed to start:', err);
  }
}

/**
 * Stop the soundbox listener
 */
export function stopSoundbox(): void {
  stopInboxCreditPoll();
  if (smsSubscription) {
    smsSubscription.remove();
    smsSubscription = null;
    
    if (Platform.OS === 'android' && SmsModule && SmsModule.stopSmsListener) {
      SmsModule.stopSmsListener().catch(console.error);
    }
    
    soundboxQueue.cancelAll();
    console.log('[SoundboxEngine] Stopped');
  }
}

/**
 * Update soundbox config without restarting
 */
export function updateSoundboxConfig(config: Partial<SoundboxConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  console.log('[SoundboxEngine] Config updated:', currentConfig);
  
  if (!currentConfig.enabled) {
    stopSoundbox();
  } else if (currentConfig.enabled && !smsSubscription) {
    startSoundbox(currentConfig);
  }
}

/**
 * Test the soundbox by simulating a payment announcement
 */
export function stopSoundboxAnnouncement(): void {
  soundboxQueue.stopSpeaking();
}

export function isSoundboxSpeaking(): boolean {
  return soundboxQueue.isSpeaking() || soundboxQueue.getQueueLength() > 0;
}

export async function testSoundboxAnnouncement(
  lang: string,
  amount: number = 1,
): Promise<void> {
  const testNotification: PaymentNotification = {
    type: 'CREDIT',
    amount,
    sender: 'nishant.it089@okicici',
    bank: 'HDFC Bank',
    refNumber: '654955050822',
    rawBody: `Credit Alert! Rs.${amount.toFixed(2)} credited to HDFC Bank A/c XX7906 on 02-07-26 from VPA nishant.it089@okicici (UPI 654955050822)`,
  };

  const testConfig: SoundboxConfig = {
    ...currentConfig,
    enabled: true,
    language: lang,
    announceCredits: true,
  };

  // Directly push to queue
  soundboxQueue.enqueue(testNotification, testConfig);
}

/**
 * Get current soundbox status
 */
export function getSoundboxStatus(): {
  running: boolean;
  config: SoundboxConfig;
} {
  return {
    running: smsSubscription !== null,
    config: { ...currentConfig },
  };
}
