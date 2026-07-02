import type { BalanceSource, NetworkMode, TransactionMethod } from '../types';
import type { AppSettings } from '../types';

/** When auto-switch is on: online → wallet simulation, offline → USSD bank */
export function getAutoPaymentMethod(networkMode: NetworkMode): TransactionMethod {
  return networkMode === 'ONLINE' ? 'WALLET' : 'USSD';
}

export function getAutoBalanceSource(networkMode: NetworkMode): BalanceSource {
  return networkMode === 'ONLINE' ? 'WALLET' : 'BANK';
}

export function resolvePaymentMethod(
  networkMode: NetworkMode,
  settings: AppSettings,
  manualMethod: TransactionMethod,
): TransactionMethod {
  if (settings.autoSwitchPaymentMode !== false) {
    return getAutoPaymentMethod(networkMode);
  }
  return manualMethod;
}
