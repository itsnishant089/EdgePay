import { parsePaymentSms, formatAmountForSpeech, buildAnnouncementText } from '../src/engine/PaymentSmsParser';

describe('PaymentSmsParser 2.0', () => {
  it('detects HDFC credit', () => {
    const sms = 'Rs. 500.00 CREDITED to a/c **1234 on 12-MAY-2023 from JOHN DOE. Ref 1234567890';
    const result = parsePaymentSms('HDFCBK', sms);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(500);
    expect(result?.type).toBe('CREDIT');
    expect(result?.sender).toBe('JOHN DOE');
    expect(result?.bank).toBe('HDFC Bank');
    expect(result?.refNumber).toBe('1234567890');
  });

  it('detects PhonePe merchant payment', () => {
    const sms = 'You have received Rs. 2,350 from Rahul on PhonePe. TxnId: P23482348234';
    const result = parsePaymentSms('PHONEPE', sms);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(2350);
    expect(result?.type).toBe('CREDIT');
    expect(result?.sender).toBe('Rahul');
    expect(result?.bank).toBe('PhonePe');
    expect(result?.refNumber).toBe('P23482348234');
  });

  it('detects VPA / UPI sender', () => {
    const sms = 'A/c *1234 Credited for Rs 100.00 on 12/12/2023 by VPA john@ybl - UPI Ref 123456';
    const result = parsePaymentSms('SBI', sms);
    expect(result?.amount).toBe(100);
    expect(result?.sender).toBe('john@ybl');
  });

  it('ignores OTPs and Spam', () => {
    expect(parsePaymentSms('ICICIB', 'Your OTP for txn is 123456. Do not share.')).toBeNull();
    expect(parsePaymentSms('HDFCBK', 'Get personal loan up to Rs. 50,000. Apply now!')).toBeNull();
  });

  it('formats amount for speech correctly', () => {
    expect(formatAmountForSpeech(500, 'en')).toBe('500 rupees');
    expect(formatAmountForSpeech(500.50, 'en')).toBe('500 rupees and 50 paise');
    expect(formatAmountForSpeech(500, 'hi')).toBe('500 रुपये');
    expect(formatAmountForSpeech(500.50, 'hi')).toBe('500 रुपये 50 पैसे');
  });

  it('detects HDFC credit alert format', () => {
    const sms = 'Credit Alert! Rs.1.00 credited to HDFC Bank A/c XX7906 on 02-07-26 from VPA nishant.it089@okicici (UPI 654955050822)';
    const result = parsePaymentSms('HDFCBK', sms);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(1);
    expect(result?.type).toBe('CREDIT');
    expect(result?.sender).toBe('nishant.it089@okicici');
  });

  it('builds natural english announcement', () => {
    const notification = { type: 'CREDIT', amount: 500, sender: 'Rahul', bank: 'PhonePe', rawBody: '' } as any;
    const text = buildAnnouncementText(notification, { language: 'en', speakBankName: true, speakSenderName: true, enabled: true, announceCredits: true, announceDebits: false, speechRate: 1, announcementStyle: 'PERSONAL' });
    expect(text).toBe('Credit alert. 500 rupees credited from Rahul.');
  });

  it('builds merchant hindi announcement', () => {
    const notification = { type: 'CREDIT', amount: 500, sender: 'Rahul', bank: 'PhonePe', rawBody: '' } as any;
    const text = buildAnnouncementText(notification, { language: 'hi', speakBankName: true, speakSenderName: true, enabled: true, announceCredits: true, announceDebits: false, speechRate: 1, announcementStyle: 'MERCHANT' });
    expect(text).toBe('क्रेडिट अलर्ट। PhonePe पर 500 रुपये प्राप्त हुए।');
  });

  it('does not block credit when VPA contains cashback substring', () => {
    const sms =
      'Credit Alert! Rs.10.28 credited to HDFC Bank A/c XX7906 on 03-07-26 from VPA bhimcashback@hdfcbank (UPI 103594054054)';
    const result = parsePaymentSms('VM-HDFCBK-S', sms);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('CREDIT');
    expect(result?.amount).toBe(10.28);
    expect(result?.sender).toBe('bhimcashback@hdfcbank');
  });
});
