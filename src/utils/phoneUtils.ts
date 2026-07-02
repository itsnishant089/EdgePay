/** Normalize contact phone to 10-digit Indian mobile for USSD/payments */
export function normalizePhoneForPayment(phone: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}
