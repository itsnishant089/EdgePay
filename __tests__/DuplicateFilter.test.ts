import { duplicateFilter } from '../src/engine/DuplicateFilter';
import { PaymentNotification } from '../src/engine/PaymentSmsParser';

describe('DuplicateFilter', () => {
  beforeEach(() => {
    duplicateFilter.clear();
  });

  it('allows unique payments', () => {
    const notif1: PaymentNotification = { type: 'CREDIT', amount: 500, sender: 'Rahul', bank: 'SBI', rawBody: '' };
    expect(duplicateFilter.isDuplicate(notif1)).toBe(false);
  });

  it('blocks duplicate payments within TTL', () => {
    const notif1: PaymentNotification = { type: 'CREDIT', amount: 500, sender: 'Rahul', bank: 'SBI', refNumber: '123', rawBody: '' };
    expect(duplicateFilter.isDuplicate(notif1)).toBe(false); // First time
    expect(duplicateFilter.isDuplicate(notif1)).toBe(true); // Second time
  });

  it('allows same amount from different senders', () => {
    const notif1: PaymentNotification = { type: 'CREDIT', amount: 500, sender: 'Rahul', bank: 'SBI', rawBody: '' };
    const notif2: PaymentNotification = { type: 'CREDIT', amount: 500, sender: 'Amit', bank: 'SBI', rawBody: '' };
    expect(duplicateFilter.isDuplicate(notif1)).toBe(false);
    expect(duplicateFilter.isDuplicate(notif2)).toBe(false);
  });
});
