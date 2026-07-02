import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, typography } from '../theme';
import { useStore } from '../store/useStore';
import { PaymentManager } from '../engine/PaymentManager';
import { checkUssdPermissions, getTelephonyInfo } from '../engine/USSDService';

export const DiagnosticsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const state = useStore();
  const [ussdPerms, setUssdPerms] = React.useState<any>(null);
  const [telephony, setTelephony] = React.useState<any>(null);

  React.useEffect(() => {
    checkUssdPermissions().then(setUssdPerms);
    getTelephonyInfo().then(setTelephony);
  }, []);

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Developer Diagnostics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        <Text style={[s.sectionTitle, { color: colors.primary }]}>SYSTEM STATE</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceHighlight }]}>
          <Text style={{ color: colors.textPrimary }}>Network Mode: {state.networkMode}</Text>
          <Text style={{ color: colors.textPrimary }}>Theme: {state.theme}</Text>
          <Text style={{ color: colors.textPrimary }}>Language: {state.language}</Text>
        </View>

        <Text style={[s.sectionTitle, { color: colors.primary }]}>USSD ENGINE</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceHighlight }]}>
          <Text style={{ color: colors.textPrimary }}>Call Permission: {ussdPerms?.callPhone ? 'GRANTED' : 'DENIED'}</Text>
          <Text style={{ color: colors.textPrimary }}>Phone State: {ussdPerms?.readPhoneState ? 'GRANTED' : 'DENIED'}</Text>
          <Text style={{ color: colors.textPrimary }}>SIM Ready: {telephony?.isSimReady ? 'YES' : 'NO'}</Text>
          <Text style={{ color: colors.textPrimary }}>Operator: {telephony?.simOperator || 'Unknown'}</Text>
        </View>

        <Text style={[s.sectionTitle, { color: colors.primary }]}>PAYMENT MANAGER</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceHighlight }]}>
          <Text style={{ color: colors.textPrimary }}>Current State: {PaymentManager.getState()}</Text>
          <Text style={{ color: colors.textPrimary }}>Active Txn: {PaymentManager.getActiveTxnId() || 'None'}</Text>
          <Text style={{ color: colors.textPrimary }}>Is Locked: {PaymentManager.isLocked() ? 'YES' : 'NO'}</Text>
        </View>

        <TouchableOpacity 
          style={[s.resetBtn, { backgroundColor: colors.error }]}
          onPress={() => PaymentManager.reset()}
        >
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>FORCE RESET PAYMENT ENGINE</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginTop: 24, marginBottom: 8, letterSpacing: 1 },
  card: { padding: 16, borderRadius: 12, gap: 8 },
  resetBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 }
});
