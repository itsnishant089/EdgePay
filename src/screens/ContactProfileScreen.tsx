// ─── Contact Profile Screen 4.0 ────────────────────────────────────
// Full contact profile with payment history, request money, repeat payment

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, typography, gradients } from '../theme';
import { AvatarCircle } from '../components/AvatarCircle';
import { PremiumCard } from '../components/PremiumCard';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatters';
import LinearGradient from 'react-native-linear-gradient';
import type { Transaction } from '../types';

export const ContactProfileScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { contact } = route.params;
  const transactions = useStore(state => state.transactions || []);

  // Find payment history with this contact
  const paymentHistory = useMemo(() => {
    const phone = contact.phone.replace(/\D/g, '');
    return transactions
      .filter(t => {
        const txnReceiver = t.receiver?.replace(/\D/g, '') || '';
        return txnReceiver === phone || txnReceiver.endsWith(phone) || phone.endsWith(txnReceiver);
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  }, [transactions, contact.phone]);

  const totalPaid = useMemo(() => 
    paymentHistory
      .filter(t => t.status === 'SUCCESS')
      .reduce((sum, t) => sum + t.amount, 0),
    [paymentHistory]
  );

  const lastPayment = paymentHistory.length > 0 ? paymentHistory[0] : null;

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isSuccess = item.status === 'SUCCESS';
    const date = new Date(item.timestamp);
    return (
      <View style={[s.txnRow, { borderBottomColor: colors.borderLight }]}>
        <View style={[s.txnIcon, { backgroundColor: isSuccess ? colors.success + '15' : colors.error + '15' }]}>
          <Icon 
            name={isSuccess ? 'arrow-up-bold' : 'close'} 
            size={16} 
            color={isSuccess ? colors.success : colors.error} 
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.txnAmount, { color: colors.textPrimary }]}>₹{item.amount.toLocaleString('en-IN')}</Text>
          <Text style={[s.txnDate, { color: colors.textTertiary }]}>
            {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[s.txnStatusBadge, { backgroundColor: isSuccess ? colors.success + '15' : colors.error + '15' }]}>
          <Text style={[s.txnStatusText, { color: isSuccess ? colors.success : colors.error }]}>{item.status}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Dynamic Header Background */}
      <View style={[s.headerBg, { backgroundColor: colors.surfaceHighlight }]} />

      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={s.backBtn}>
          <Icon name="dots-vertical" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 100 }}>
        <View style={s.profileWrap}>
          <AvatarCircle name={contact.name} photo={contact.photo} size={100} fontSize={36} />
          <Text style={[s.name, { color: colors.textPrimary }]}>{contact.name}</Text>
          <Text style={[s.phone, { color: colors.textSecondary }]}>{contact.phone}</Text>
          
          <View style={[s.upiBadge, { backgroundColor: colors.surfaceHighlight }]}>
            <Text style={[s.upiText, { color: colors.textSecondary }]}>{contact.upiId || 'Not on EdgePay yet'}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        {paymentHistory.length > 0 && (
          <View style={s.statsContainer}>
            <View style={[s.statCard, { backgroundColor: colors.surfaceHighlight }]}>
              <Text style={[s.statLabel, { color: colors.textSecondary }]}>Total Paid</Text>
              <Text style={[s.statAmount, { color: colors.primary }]}>₹{totalPaid.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.surfaceHighlight }]}>
              <Text style={[s.statLabel, { color: colors.textSecondary }]}>Transactions</Text>
              <Text style={[s.statAmount, { color: colors.textPrimary }]}>{paymentHistory.length}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={s.actionsRow}>
          <TouchableOpacity 
            style={s.actionBtn}
            onPress={() => navigation.navigate('SendMoney', { receiver: contact.phone, name: contact.name })}
          >
            <LinearGradient colors={gradients.primary} style={s.actionIconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Icon name="currency-inr" size={28} color="#FFF" />
            </LinearGradient>
            <Text style={[s.actionLabel, { color: colors.textPrimary }]}>Pay</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={s.actionBtn}
            onPress={() => navigation.navigate('SendMoney', { receiver: contact.phone, name: contact.name, mode: 'request' })}
          >
            <View style={[s.actionIconWrap, { backgroundColor: colors.surfaceHighlight }]}>
              <Icon name="arrow-down-bold" size={28} color={colors.primary} />
            </View>
            <Text style={[s.actionLabel, { color: colors.textPrimary }]}>Request</Text>
          </TouchableOpacity>
          
          {lastPayment && (
            <TouchableOpacity 
              style={s.actionBtn}
              onPress={() => navigation.navigate('SendMoney', { 
                receiver: contact.phone, 
                name: contact.name,
                amount: lastPayment.amount,
              })}
            >
              <View style={[s.actionIconWrap, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="repeat" size={28} color={colors.primary} />
              </View>
              <Text style={[s.actionLabel, { color: colors.textPrimary }]}>Repeat</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={s.actionBtn}>
            <View style={[s.actionIconWrap, { backgroundColor: colors.surfaceHighlight }]}>
              <Icon name="share-variant" size={28} color={colors.primary} />
            </View>
            <Text style={[s.actionLabel, { color: colors.textPrimary }]}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Payment History */}
        <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Payment History</Text>
        
        <PremiumCard style={s.historyCard} noPadding>
          {paymentHistory.length > 0 ? (
            paymentHistory.map((txn, idx) => (
              <View key={txn.id}>
                {renderTransaction({ item: txn })}
              </View>
            ))
          ) : (
            <View style={s.emptyHistory}>
              <Icon name="receipt-outline" size={40} color={colors.textTertiary} />
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>No previous transactions with {contact.name.split(' ')[0]}</Text>
            </View>
          )}
        </PremiumCard>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  
  profileWrap: { alignItems: 'center', marginTop: 20 },
  name: { fontSize: 26, fontWeight: '800', marginTop: 20, marginBottom: 4 },
  phone: { fontSize: 16, fontWeight: '500' },
  upiBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 12 },
  upiText: { fontSize: 13, fontWeight: '600' },
  
  statsContainer: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 8 },
  statCard: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statAmount: { fontSize: 22, fontWeight: '800' },
  
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginVertical: 32 },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  
  sectionTitle: { ...typography.h3, marginBottom: 16 },
  historyCard: { minHeight: 100 },
  
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  txnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txnAmount: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  txnDate: { fontSize: 12 },
  txnStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  txnStatusText: { fontSize: 11, fontWeight: '700' },
  
  emptyHistory: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { marginTop: 12, fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
