import {
  parseSmsForBalance,
  isPaymentOrCreditSms,
  isBalanceReplySms,
} from '../src/engine/BalanceSmsParser';

describe('BalanceSmsParser', () => {
  const creditAlert =
    'Credit Alert!\nRs.1.00 credited to HDFC Bank A/c XX7906 on 02-07-26 from VPA nishant.it089@okicici (UPI 654955050822)';

  const balanceSms =
    'Dear Customer,\nYour Balance in account no. ending with 7906 is Rs. 6,233.43\n-HDFC Bank';

  const rcsBalance =
    'Your account balance for account ending with 7906 is ₹6,243.71';

  const rcsBalanceNotification =
    'HDFC Bank\nYour account balance for account ending with 7906 is INR 6,243.71';

  const richRcsBalanceReply =
    'Account Balance\nHi! Thanks for reaching out to HDFC Bank!\nYour account balance for account ending with 7906\nis ₹6,243.71\nExplore our WhatsApp Banking for 220+ transactions all at your fingertips!\nTry ChatBanking\nBook FD';

  it('rejects HDFC credit alert', () => {
    expect(isPaymentOrCreditSms(creditAlert)).toBe(true);
    expect(parseSmsForBalance(creditAlert)).toBeNull();
    expect(isBalanceReplySms(creditAlert)).toBe(false);
  });

  it('parses HDFC balance SMS', () => {
    expect(parseSmsForBalance(balanceSms)).toBe(6233.43);
    expect(isBalanceReplySms(balanceSms)).toBe(true);
  });

  it('parses HDFC RCS balance format', () => {
    expect(parseSmsForBalance(rcsBalance)).toBe(6243.71);
  });

  it('parses HDFC RCS notification body format', () => {
    expect(parseSmsForBalance(rcsBalanceNotification)).toBe(6243.71);
  });

  it('parses rich HDFC RCS chat reply with promo content', () => {
    expect(parseSmsForBalance(richRcsBalanceReply)).toBe(6243.71);
  });

  it('does not treat credited amount as balance', () => {
    const sms =
      'Credit Alert!\nRs.10.28 credited to HDFC Bank A/c XX7906 on 03-07-26 from VPA bhimcashback@hdfcbank (UPI 103594054054)';
    expect(parseSmsForBalance(sms)).toBeNull();
  });
});
