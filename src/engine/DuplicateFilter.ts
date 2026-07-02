import { PaymentNotification } from './PaymentSmsParser';

export class DuplicateFilter {
  private cache: Map<string, number> = new Map();
  private readonly TTL_MS = 60000; // 60 seconds rolling cache

  /**
   * Generates a unique fingerprint for a payment notification
   * using a combination of details to ensure accuracy without false positives.
   */
  private generateFingerprint(notification: PaymentNotification): string {
    // If we have a reference number, use it alongside bank and amount for high confidence
    if (notification.refNumber) {
      return `${notification.bank}_${notification.refNumber}_${notification.amount}`;
    }
    
    // Otherwise, generate a hash based on available data
    const normalizedSender = (notification.sender || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
    const normalizedBank = (notification.bank || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
    
    // We intentionally omit timestamp from fingerprint because the duplicate 
    // sms might arrive a few seconds later. We want to catch them within the TTL.
    return `${notification.type}_${normalizedBank}_${normalizedSender}_${notification.amount}`;
  }

  /**
   * Checks if a notification is a duplicate.
   * If it's not a duplicate, adds it to the cache.
   */
  public isDuplicate(notification: PaymentNotification): boolean {
    this.cleanCache();

    const fingerprint = this.generateFingerprint(notification);
    
    if (this.cache.has(fingerprint)) {
      return true;
    }

    this.cache.set(fingerprint, Date.now());
    return false;
  }

  /**
   * Cleans up expired entries from the cache to prevent memory leaks
   */
  private cleanCache() {
    const now = Date.now();
    for (const [key, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears the entire cache (useful for testing or reset)
   */
  public clear() {
    this.cache.clear();
  }
}

// Export a singleton instance for global use
export const duplicateFilter = new DuplicateFilter();
