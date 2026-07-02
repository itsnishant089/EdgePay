import { PaymentNotification, buildAnnouncementText } from './PaymentSmsParser';
import { SoundboxConfig } from './PaymentSoundbox';
import Tts from 'react-native-tts';
import { NativeModules } from 'react-native';

const { SoundboxAudio } = NativeModules;

export type AnnouncementTask = {
  notification: PaymentNotification;
  config: SoundboxConfig;
  text: string;
  id: string;
};

export class SoundboxQueue {
  private queue: AnnouncementTask[] = [];
  private isPlaying = false;
  private currentTask: AnnouncementTask | null = null;

  /**
   * Enqueues an announcement and starts processing if idle.
   */
  public enqueue(notification: PaymentNotification, config: SoundboxConfig) {
    if (!config.enabled) return;

    // Filter by minimum amount if configured
    if (config.minAmount && notification.amount < config.minAmount) {
      console.log(`[SoundboxQueue] Ignored due to minAmount: ${notification.amount} < ${config.minAmount}`);
      return;
    }

    const text = buildAnnouncementText(notification, config);
    const task: AnnouncementTask = {
      notification,
      config,
      text,
      id: Math.random().toString(36).substring(7),
    };

    // Priority insertion: Incoming (CREDIT) > Refunds/Outgoing (DEBIT)
    if (notification.type === 'CREDIT') {
      // Find the first non-credit and insert before it
      const insertIndex = this.queue.findIndex(t => t.notification.type !== 'CREDIT');
      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }
    } else {
      this.queue.push(task);
    }

    console.log(`[SoundboxQueue] Enqueued task ${task.id}. Queue size: ${this.queue.length}`);
    this.processNext();
  }

  /**
   * Processes the next task in the queue.
   */
  private async processNext() {
    if (this.isPlaying || this.queue.length === 0) return;

    this.isPlaying = true;
    this.currentTask = this.queue.shift() || null;

    if (!this.currentTask) {
      this.isPlaying = false;
      return;
    }

    const { text, config } = this.currentTask;

    try {
      // Play native chime instantly via SoundboxAudioModule (ToneGenerator)
      if (SoundboxAudio && SoundboxAudio.playChime) {
        await SoundboxAudio.playChime();
      }

      // Small pause after chime before TTS starts
      await new Promise(resolve => setTimeout(resolve, 300));

      // Setup TTS for this announcement
      await Tts.stop(); // Stop anything current
      if (config.speechRate) {
        await Tts.setDefaultRate(config.speechRate);
      }
      
      // Determine language
      const langCode = config.language === 'hi' ? 'hi-IN' : 'en-IN';
      try {
        await Tts.setDefaultLanguage(langCode);
      } catch (e) {
        // fallback
      }

      // Set voice pitch (male/female approximation or custom)
      if (config.voicePitch) {
        await Tts.setDefaultPitch(config.voicePitch);
      }

      console.log(`[SoundboxQueue] Speaking: ${text}`);

      // We wait for TTS to finish using a Promise wrapper
      await new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
          if (!finished) {
            finished = true;
            resolve();
          }
        };

        const onFinishListener = Tts.addEventListener('tts-finish', () => finish());
        const onCancelListener = Tts.addEventListener('tts-cancel', () => finish());
        const onErrorListener = Tts.addEventListener('tts-error', () => finish());

        Tts.speak(text);

        // Failsafe timeout based on text length (approx 150ms per char + 2s padding)
        setTimeout(() => {
          onFinishListener.remove();
          onCancelListener.remove();
          onErrorListener.remove();
          finish();
        }, text.length * 150 + 2000);
      });

      // Play success tone natively
      if (SoundboxAudio && SoundboxAudio.playSuccessTone) {
        await SoundboxAudio.playSuccessTone();
      }

      // Pause before next announcement if queue is not empty
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

    } catch (e) {
      console.error('[SoundboxQueue] Error playing announcement:', e);
    } finally {
      this.isPlaying = false;
      this.currentTask = null;
      // Process next in queue
      this.processNext();
    }
  }

  /**
   * Clears the queue and stops current playback.
   */
  public cancelAll() {
    this.queue = [];
    Tts.stop();
    this.isPlaying = false;
    this.currentTask = null;
    console.log('[SoundboxQueue] Cancelled all tasks.');
  }

  /** Stop current speech and clear queue — used by profile test toggle */
  public stopSpeaking(): void {
    this.cancelAll();
  }

  public isSpeaking(): boolean {
    return this.isPlaying;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const soundboxQueue = new SoundboxQueue();
