// ─── Setup Screen 3.0 ──────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Image
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { requestSmsPermissions } from '../engine/SmsService';
import { requestUssdPermissions } from '../engine/USSDService';
import { SUPPORTED_BANKS, DEFAULT_WALLET_BALANCE, DEFAULT_UPI_ID } from '../utils/constants';
import { useTheme, spacing, typography, gradients } from '../theme';

export const SetupScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const setUser = useStore(state => state.setUser);
  const setAuthenticated = useStore(state => state.setAuthenticated);

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState('');

  const handleNext = async () => {
    if (step === 1 && name && phone.length >= 10) {
      try {
        await requestSmsPermissions();
        await requestUssdPermissions();
      } catch (e) {
        console.warn('Failed to request permissions during setup', e);
      }
      setStep(2);
    } else if (step === 2 && bank) {
      setUser({
        name,
        phone,
        bank,
        upiId: DEFAULT_UPI_ID,
        isOnboarded: true,
        currency: '₹',
        balance: DEFAULT_WALLET_BALANCE,
        walletBalance: DEFAULT_WALLET_BALANCE,
        bankBalance: 0,
        goalAmount: 0,
        monthlyBudget: 0,
        spentThisMonth: 0,
        budgetResetDay: 1,
      });
      setAuthenticated(true);
    }
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 40) }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          
          <View style={s.header}>
            <Image source={require('../../assets/EdgePay_Icon.png')} style={s.logo} />
            <Text style={[s.title, { color: colors.textPrimary }]}>Welcome to EdgePay</Text>
            <Text style={[s.subtitle, { color: colors.textSecondary }]}>
              {step === 1 ? 'Let\'s get to know you' : 'Select your primary bank'}
            </Text>
          </View>

          <View style={s.progressRow}>
            <View style={[s.progressDot, { backgroundColor: colors.primary }]} />
            <View style={[s.progressLine, { backgroundColor: step >= 2 ? colors.primary : colors.borderLight }]} />
            <View style={[s.progressDot, { backgroundColor: step >= 2 ? colors.primary : colors.borderLight }]} />
          </View>

          {step === 1 && (
            <View style={s.form}>
              <View style={[s.inputWrap, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="account-outline" size={20} color={colors.textTertiary} style={{ marginRight: 12 }} />
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={[s.inputWrap, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="phone-outline" size={20} color={colors.textTertiary} style={{ marginRight: 12 }} />
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  placeholder="Mobile Number"
                  placeholderTextColor={colors.textTertiary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={s.form}>
              {SUPPORTED_BANKS.map((b) => (
                <TouchableOpacity
                  key={b.code}
                  style={[
                    s.bankCard,
                    { backgroundColor: colors.surfaceHighlight, borderColor: bank === b.code ? colors.primary : colors.borderLight }
                  ]}
                  onPress={() => setBank(b.code)}
                  activeOpacity={0.7}
                >
                  <View style={[s.bankIcon, { backgroundColor: '#FFF' }]}>
                    <Icon name="bank" size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.bankName, { color: colors.textPrimary }]}>{b.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>USSD: {b.ussdShortCode}</Text>
                  </View>
                  {bank === b.code && <Icon name="check-circle" size={24} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24), backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[s.btn, (!name || phone.length < 10) && step === 1 ? { opacity: 0.5 } : null]}
          onPress={handleNext}
          disabled={(step === 1 && (!name || phone.length < 10)) || (step === 2 && !bank)}
        >
          <LinearGradient colors={gradients.primary} style={s.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.btnText}>{step === 1 ? 'Continue' : 'Complete Setup'}</Text>
            <Icon name="arrow-right" size={20} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 80, height: 80, borderRadius: 24, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '500' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 40, width: 100, alignSelf: 'center' },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  progressLine: { flex: 1, height: 3, marginHorizontal: 4, borderRadius: 2 },
  form: { gap: 16 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 60, borderRadius: 16 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  bankCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 2, gap: 16 },
  bankIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bankName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingTop: 16 },
  btn: { borderRadius: 16, overflow: 'hidden' },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 8 },
  btnText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
});
