// ─── Send Money Screen 3.0 ──────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AmountInput } from '../components/AmountInput';
import { useStore } from '../store/useStore';
import { createTransaction, executeUssdTransaction, executeWalletTransaction } from '../engine/TransactionEngine';
import { validateUssdReceiver, buildRequestMoneyCommand } from '../engine/USSDBuilder';
import { dialUssdCode } from '../engine/USSDService';
import { PaymentManager } from '../engine/PaymentManager';
import { formatCurrency, getUserUpiId } from '../utils/formatters';
import { translations } from '../utils/i18n';
import { useTheme, spacing, typography, gradients } from '../theme';
import { PinScreen } from '../components/PinScreen';
import { authenticate, isBiometricAvailable } from '../engine/BiometricService';
import { AvatarCircle } from '../components/AvatarCircle';
import { QuickAmountChips } from '../components/QuickAmountChips';
import { TAB_BAR_HEIGHT, DEFAULT_WALLET_BALANCE } from '../utils/constants';
import { resolvePaymentMethod } from '../utils/paymentMode';
import type { TransactionStatus, TransactionMethod } from '../types';

export const SendMoneyScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation, route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, networkMode, language, settings, addTransaction, updateTransaction, setUser } = useStore();
  const t = translations[language] || translations.en;

  const isRequestMode = route?.params?.mode === 'request';
  const initialReceiver = route?.params?.receiver || '';
  
  const [receiver, setReceiver] = useState(initialReceiver);
  const [receiverName, setReceiverName] = useState(route?.params?.name || '');
  const [amount, setAmount] = useState(route?.params?.amount ? String(route.params.amount) : '');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<TransactionMethod>(route?.params?.method || 'USSD');
  const autoSwitch = settings.autoSwitchPaymentMode !== false;
  const effectiveMethod = resolvePaymentMethod(networkMode, settings, method);
  const walletBalance = user.walletBalance ?? user.balance ?? DEFAULT_WALLET_BALANCE;
  const userUpi = getUserUpiId(user);
  
  const [isSending, setIsSending] = useState(false);
  const [txnStatus, setTxnStatus] = useState<TransactionStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);

  const executionLocked = useRef(false);
  const currentTxnId = useRef<string | null>(null);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    if (route?.params?.method) return;
    if (autoSwitch) {
      setMethod(networkMode === 'ONLINE' ? 'WALLET' : 'USSD');
    }
  }, [networkMode, autoSwitch, route?.params?.method]);

  useEffect(() => {
    if (route?.params?.receiver != null) setReceiver(route.params.receiver);
    if (route?.params?.name != null) setReceiverName(route.params.name);
    if (route?.params?.amount != null) setAmount(String(route.params.amount));
    if (route?.params?.method) setMethod(route.params.method);
    if (route?.params?.note) setNote(route.params.note);
  }, [route?.params?.receiver, route?.params?.name, route?.params?.amount, route?.params?.method, route?.params?.note]);

  // Reset pay mode when opening Pay tab without a pre-filled receiver
  useFocusEffect(
    useCallback(() => {
      if (!route?.params?.receiver && route?.params?.mode !== 'request') {
        navigation.setParams({ mode: 'pay' });
      }
      PaymentManager.releaseLock();
      executionLocked.current = false;
    }, [navigation, route?.params?.mode, route?.params?.receiver]),
  );

  const numericAmount = parseInt(amount, 10) || 0;
  const receiverValidation = validateUssdReceiver(receiver);
  const isInputValid = receiverValidation.valid && numericAmount > 0 &&
    (effectiveMethod !== 'WALLET' || numericAmount <= walletBalance);

  const handleInitialPay = () => {
    if (!isInputValid || isSending) return;
    if (isRequestMode) {
      handleRequestMoney();
      return;
    }
    setShowConfirmModal(true);
  };

  const handleRequestMoney = async () => {
    if (executionLocked.current) return;
    executionLocked.current = true;
    setIsSending(true);
    setTxnStatus('PENDING');
    setStatusMessage('Opening USSD dialer...');
    try {
      const ussdCode = buildRequestMoneyCommand(receiver, numericAmount);
      await dialUssdCode(ussdCode);
      const txn = createTransaction(numericAmount, receiver, receiverName, networkMode, 'USSD', 'REQUEST');
      addTransaction({ ...txn, status: 'SENT' });
      setTxnStatus('SUCCESS');
      setStatusMessage('Follow USSD prompts to complete your request.');
    } catch (error: any) {
      setTxnStatus('FAILED');
      setStatusMessage('Could not open USSD dialer. Check permissions.');
    } finally {
      setIsSending(false);
      executionLocked.current = false;
    }
  };

  const startPaymentFlow = async () => {
    setShowConfirmModal(false);
    const biometricAvailable = await isBiometricAvailable();
    if (biometricAvailable) {
      const success = await authenticate(`Pay ₹${numericAmount} to ${receiverName || receiver}`);
      if (!success) return;
    }
    setShowPinEntry(true);
  };

  const onPinVerified = (_pin: string) => {
    setShowPinEntry(false);
    if (effectiveMethod === 'WALLET') executeSimulatedWalletPayment();
    else executeRealUssdPayment();
  };

  const executeRealUssdPayment = async () => {
    if (executionLocked.current) return;
    setIsSending(true);
    executionLocked.current = true;
    setTxnStatus('PENDING');
    setStatusMessage(t.wait_sms);

    const txn = createTransaction(numericAmount, receiver, receiverName, networkMode, 'USSD', 'PAY');
    currentTxnId.current = txn.id;
    addTransaction(txn);

    try {
      const result = await executeUssdTransaction(txn, (id, status, message) => {
        setTxnStatus(status);
        setStatusMessage(message || '');
        updateTransaction(id, { status, responseMessage: message });
      });
      if (result.status === 'SUCCESS') {
        if (effectiveMethod === 'WALLET') {
          const newWallet = Math.max(0, walletBalance - numericAmount);
          setUser({ walletBalance: newWallet, balance: newWallet });
        }
      } else if (result.status === 'FAILED' && currentTxnId.current) {
        updateTransaction(currentTxnId.current, { status: 'FAILED', responseMessage: result.status });
      }
    } catch (error: any) {
      setTxnStatus('FAILED');
      setStatusMessage(t.failed);
      if (currentTxnId.current) {
        updateTransaction(currentTxnId.current, { status: 'FAILED', responseMessage: error?.message });
      }
    } finally {
      setIsSending(false);
      executionLocked.current = false;
      PaymentManager.releaseLock();
      currentTxnId.current = null;
    }
  };

  const executeSimulatedWalletPayment = async () => {
    if (executionLocked.current) return;
    setIsSending(true);
    executionLocked.current = true;
    setTxnStatus('SENT');
    setStatusMessage('Connecting to Edge Wallet...');

    const txn = createTransaction(numericAmount, receiver, receiverName, networkMode, 'WALLET', 'PAY');
    currentTxnId.current = txn.id;
    addTransaction(txn);

    try {
      const result = await executeWalletTransaction(txn, (id, status, message) => {
        setTxnStatus(status);
        setStatusMessage(message || '');
        updateTransaction(id, { status, responseMessage: message });
      });
      if (result.status === 'SUCCESS') {
        const newWallet = Math.max(0, walletBalance - numericAmount);
        setUser({ walletBalance: newWallet, balance: newWallet });
      } else if (result.status === 'FAILED' && currentTxnId.current) {
        updateTransaction(currentTxnId.current, { status: 'FAILED', responseMessage: 'Wallet transfer failed' });
      }
    } catch (error: any) {
      setTxnStatus('FAILED');
      setStatusMessage('Wallet transfer failed');
      if (currentTxnId.current) {
        updateTransaction(currentTxnId.current, { status: 'FAILED', responseMessage: error?.message });
      }
    } finally {
      setIsSending(false);
      executionLocked.current = false;
      PaymentManager.releaseLock();
      currentTxnId.current = null;
    }
  };

  const handleReset = () => {
    setTxnStatus(null);
    setStatusMessage('');
    setReceiver('');
    setReceiverName('');
    setAmount('');
    setNote('');
    PaymentManager.releaseLock();
    executionLocked.current = false;
    navigation.navigate('SendMoney', { mode: 'pay' });
  };

  // ─── Success Screen ────────────────────────────────────────────────
  if (txnStatus === 'SUCCESS' || txnStatus === 'FAILED') {
    const isSuccess = txnStatus === 'SUCCESS';
    return (
      <View style={[s.screen, { backgroundColor: colors.background, padding: 24, paddingTop: insets.top + 40 }]}>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <View style={[s.resultIcon, { backgroundColor: isSuccess ? colors.success + '15' : colors.error + '15' }]}>
            <Icon name={isSuccess ? 'check' : 'close'} size={60} color={isSuccess ? colors.success : colors.error} />
          </View>
          
          <Text style={[s.resultTitle, { color: colors.textPrimary }]}>
            {isSuccess ? (isRequestMode ? 'Request Sent' : 'Payment Successful') : (isRequestMode ? 'Request Failed' : 'Payment Failed')}
          </Text>
          <Text style={[s.resultAmount, { color: colors.textPrimary }]}>₹{numericAmount.toLocaleString('en-IN')}</Text>
          
          <View style={[s.receiptCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.borderLight }]}>
            <View style={s.receiptHeader}>
              <Icon name="check-decagram" size={20} color={colors.success} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>Secure Payment</Text>
            </View>
            <View style={s.receiptDivider} />
            <View style={s.receiptRow}>
              <Text style={{ color: colors.textSecondary }}>To</Text>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{receiverName || receiver}</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={{ color: colors.textSecondary }}>From</Text>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{user.bank || 'Edge Wallet'}</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={{ color: colors.textSecondary }}>UPI ID</Text>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{userUpi}</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={{ color: colors.textSecondary }}>Ref ID</Text>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>EP{(Math.random() * 1000000000).toFixed(0)}</Text>
            </View>
            <View style={s.receiptRow}>
              <Text style={{ color: colors.textSecondary }}>Date & Time</Text>
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{new Date().toLocaleString()}</Text>
            </View>
            {statusMessage ? (
              <View style={[s.statusMessageWrap, { backgroundColor: isSuccess ? colors.success + '20' : colors.error + '20' }]}>
                <Text style={{ color: isSuccess ? colors.success : colors.error, fontSize: 13, fontWeight: '600' }}>{statusMessage}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 12, marginBottom: insets.bottom + 20 }}>
          {isSuccess && (
            <TouchableOpacity style={[s.shareBtn, { borderColor: colors.primary }]}>
              <Icon name="share-variant" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Share Receipt</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.doneBtn, { backgroundColor: colors.primary }]} onPress={handleReset}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Main Payment Input Screen ─────────────────────────────────────
  return (
    <KeyboardAvoidingView style={[s.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{isRequestMode ? 'Request Money' : 'Send Money'}</Text>
        {!isRequestMode ? (
          <TouchableOpacity
            style={[s.methodToggle, { backgroundColor: colors.surfaceHighlight, opacity: autoSwitch ? 0.85 : 1 }]}
            onPress={() => !autoSwitch && setMethod(method === 'USSD' ? 'WALLET' : 'USSD')}
            disabled={autoSwitch}
          >
            <Icon name={effectiveMethod === 'USSD' ? 'bank-outline' : 'wallet-outline'} size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
              {autoSwitch ? (effectiveMethod === 'WALLET' ? 'WALLET · AUTO' : 'USSD · AUTO') : (method === 'USSD' ? 'BANK' : 'WALLET')}
            </Text>
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: TAB_BAR_HEIGHT + 120 }} keyboardShouldPersistTaps="handled">
        {/* Contact Profile Header */}
        <View style={s.profileHeader}>
          {!receiverValidation.valid ? (
            <>
              <AvatarCircle name="?" size={80} fontSize={28} />
              <TextInput
                style={[s.receiverInput, { color: colors.textPrimary, borderColor: colors.border, marginTop: 16 }]}
                placeholder="Mobile Number or UPI ID"
                placeholderTextColor={colors.textTertiary}
                value={receiver}
                onChangeText={setReceiver}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={!initialReceiver}
                keyboardType="default"
              />
            </>
          ) : (
            <>
              <AvatarCircle name={receiverName || receiver || '?'} size={80} fontSize={28} />
              <Text style={[s.profileName, { color: colors.textPrimary }]}>
                {receiverName ? receiverName : receiver}
              </Text>
              <View style={[s.upiBadge, { paddingRight: 8 }]}>
                <Text style={s.upiBadgeText}>
                  {receiverValidation.type === 'upi' ? receiver : `Ph: ${receiver}`}
                </Text>
                <Icon name="check-decagram" size={14} color={colors.success} style={{ marginLeft: 4, marginRight: 8 }} />
                <TouchableOpacity
                  onPress={() => { setReceiver(''); setReceiverName(''); }}
                  style={{ padding: 4, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12 }}
                >
                  <Icon name="close" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Amount Input */}
        <View style={s.amountSection}>
          <Text style={[s.currencySymbol, { color: colors.textPrimary }]}>₹</Text>
          <TextInput
            ref={amountRef}
            style={[s.amountInput, { color: colors.textPrimary }]}
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            editable={receiverValidation.valid}
            autoFocus={receiverValidation.valid && !amount}
          />
        </View>

        <QuickAmountChips selected={numericAmount} onSelect={(amt) => setAmount(String(amt))} />

        <TextInput
          style={[s.noteInput, { backgroundColor: colors.surfaceHighlight, color: colors.textPrimary }]}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.textTertiary}
          value={note}
          onChangeText={setNote}
          maxLength={30}
        />

        {receiverValidation.error && receiver.length > 3 && (
          <Text style={[s.error, { color: colors.error }]}>{receiverValidation.error}</Text>
        )}

        {effectiveMethod === 'WALLET' && numericAmount > walletBalance && (
          <Text style={[s.error, { color: colors.error }]}>
            Insufficient wallet balance. Available: {formatCurrency(walletBalance)}
          </Text>
        )}
      </ScrollView>

      {/* Bottom Pay Button — positioned above tab bar */}
      <View style={[s.footer, { paddingBottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity 
          style={[s.payBtn, !isInputValid && { opacity: 0.5 }]} 
          onPress={handleInitialPay} 
          disabled={!isInputValid || isSending}
          activeOpacity={0.8}
        >
          <LinearGradient colors={gradients.primary} style={s.payGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.payText}>{isRequestMode ? 'REQUEST MONEY' : 'PAY NOW'} ₹{numericAmount ? numericAmount.toLocaleString('en-IN') : '0'}</Text>
            <Icon name="arrow-right" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
            <View style={s.modalHeader}>
              <AvatarCircle name={receiverName || receiver} size={48} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[s.modalTitle, { color: colors.textPrimary }]} numberOfLines={1}>{isRequestMode ? 'Requesting from' : 'Paying'} {receiverName || receiver}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {effectiveMethod === 'WALLET' ? 'From Edge Wallet (simulation)' : `From ${user.bank}`}
                </Text>
              </View>
            </View>

            <View style={s.modalAmountWrap}>
              <Text style={{ color: colors.textPrimary, fontSize: 36, fontWeight: '900' }}>₹{numericAmount.toLocaleString('en-IN')}</Text>
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalBtn} onPress={() => setShowConfirmModal(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.primary }]} onPress={startPaymentFlow}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PinScreen 
        visible={showPinEntry} 
        mode="verify" 
        title={effectiveMethod === 'WALLET' ? 'Wallet PIN' : 'UPI PIN'}
        subtitle={`To pay ₹${numericAmount} to ${receiverName || receiver}${effectiveMethod === 'WALLET' ? ' via Edge Wallet' : ''}`}
        onComplete={onPinVerified} 
        onCancel={() => setShowPinEntry(false)} 
      />
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  methodToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  
  profileHeader: { alignItems: 'center', marginTop: 10, marginBottom: 40 },
  profileName: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 6, textAlign: 'center' },
  upiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  upiBadgeText: { fontSize: 13, fontWeight: '500', color: '#636366' },
  receiverInput: { borderWidth: 1, width: '100%', borderRadius: 12, padding: 16, fontSize: 16, textAlign: 'center' },
  
  amountSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  currencySymbol: { fontSize: 40, fontWeight: '600', marginRight: 8 },
  amountInput: { fontSize: 56, fontWeight: '800', minWidth: 100, textAlign: 'center' },
  
  noteInput: { borderRadius: 16, padding: 16, fontSize: 15, marginTop: 10 },
  error: { fontSize: 12, marginTop: 8, textAlign: 'center' },
  
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 10,
    backgroundColor: 'transparent',
  },
  payBtn: { borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: {width:0,height:4}, shadowOpacity: 0.3, shadowRadius: 8 },
  payGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 8 },
  payText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 16 },
  modalContent: { borderRadius: 32, padding: 24, paddingBottom: 32, elevation: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalAmountWrap: { alignItems: 'center', paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.05)', marginBottom: 24 },
  modalFooter: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  
  resultIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  resultTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  resultAmount: { fontSize: 48, fontWeight: '900', marginBottom: 32 },
  receiptCard: { width: '100%', borderRadius: 20, padding: 20, borderWidth: 1, gap: 14 },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  receiptDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 8, borderStyle: 'dashed' },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusMessageWrap: { marginTop: 12, padding: 12, borderRadius: 12, alignItems: 'center' },
  
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
  doneBtn: { alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16 },
});
