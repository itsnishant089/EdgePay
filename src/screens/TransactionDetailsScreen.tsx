import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, typography } from '../theme';
import { formatCurrency } from '../utils/formatters';
import { getTransactionAmountSign, getTransactionLabel, isIncomingTransaction } from '../utils/transactionDisplay';

export const TransactionDetailsScreen: React.FC<{ navigation: any, route: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { transaction } = route.params;

  if (!transaction) return null;

  const isSuccess = transaction.status === 'SUCCESS' || transaction.status === 'RECEIVED';
  const isFailed = transaction.status === 'FAILED';
  const incoming = isIncomingTransaction(transaction);
  const color = isFailed ? colors.error : isSuccess ? (incoming ? colors.success : colors.textPrimary) : '#FF9F0A';
  const sign = getTransactionAmountSign(transaction);

  const date = new Date(transaction.timestamp);

  const TimelineNode = ({ title, desc, icon, isLast, isActive }: any) => (
    <View style={s.nodeWrap}>
      <View style={s.nodeLeft}>
        <View style={[s.nodeIconWrap, { backgroundColor: isActive ? color + '20' : colors.surfaceHighlight }]}>
          <Icon name={icon} size={20} color={isActive ? color : colors.textTertiary} />
        </View>
        {!isLast && <View style={[s.nodeLine, { backgroundColor: isActive ? color : colors.borderLight }]} />}
      </View>
      <View style={s.nodeContent}>
        <Text style={[s.nodeTitle, { color: isActive ? colors.textPrimary : colors.textSecondary }]}>{title}</Text>
        <Text style={[s.nodeDesc, { color: colors.textTertiary }]}>{desc}</Text>
      </View>
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Transaction</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        
        {/* Header Hero */}
        <View style={s.hero}>
          <View style={[s.mainIcon, { backgroundColor: color + '15' }]}>
            <Icon name={isSuccess ? "check" : isFailed ? "close" : "clock-outline"} size={48} color={color} />
          </View>
          <Text style={[s.amount, { color: colors.textPrimary }]}>
            {sign}{formatCurrency(transaction.amount)}
          </Text>
          <Text style={[s.status, { color }]}>{transaction.status}</Text>
          <Text style={[s.receiver, { color: colors.textSecondary }]}>{getTransactionLabel(transaction)}</Text>
        </View>

        <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Timeline</Text>
        <View style={[s.timelineCard, { backgroundColor: colors.surfaceHighlight }]}>
          <TimelineNode 
            title="Payment Initiated" 
            desc={date.toLocaleTimeString()} 
            icon="cellphone" 
            isActive={true} 
          />
          <TimelineNode 
            title="Bank Processing" 
            desc="Encrypted via USSD/SMS" 
            icon="bank-transfer" 
            isActive={transaction.status !== 'FAILED'} 
          />
          <TimelineNode 
            title="Network Confirmation" 
            desc={transaction.method} 
            icon="check-network" 
            isActive={transaction.status !== 'FAILED' && transaction.status !== 'PENDING'} 
          />
          <TimelineNode 
            title={isFailed ? "Transaction Failed" : "Completed Successfully"} 
            desc={isFailed ? transaction.responseMessage || "Network Error" : "Money deposited"} 
            icon={isFailed ? "close-circle" : "check-circle"} 
            isActive={isSuccess || isFailed} 
            isLast={true} 
          />
        </View>

        <View style={[s.detailsCard, { backgroundColor: colors.surfaceHighlight }]}>
          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: colors.textSecondary }]}>Reference ID</Text>
            <Text style={[s.detailValue, { color: colors.textPrimary }]}>{transaction.id}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: colors.textSecondary }]}>Method</Text>
            <Text style={[s.detailValue, { color: colors.textPrimary }]}>{transaction.method} Offline</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={[s.detailLabel, { color: colors.textSecondary }]}>Date</Text>
            <Text style={[s.detailValue, { color: colors.textPrimary }]}>{date.toLocaleDateString()}</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3 },
  
  hero: { alignItems: 'center', marginBottom: 40 },
  mainIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  amount: { fontSize: 40, fontWeight: '900', marginBottom: 4 },
  status: { fontSize: 16, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  receiver: { fontSize: 16, fontWeight: '500' },

  sectionTitle: { ...typography.h3, marginBottom: 16 },
  
  timelineCard: { padding: 24, borderRadius: 20, marginBottom: 24 },
  nodeWrap: { flexDirection: 'row', minHeight: 70 },
  nodeLeft: { width: 40, alignItems: 'center' },
  nodeIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  nodeLine: { position: 'absolute', top: 36, bottom: -4, width: 2, zIndex: 1 },
  nodeContent: { flex: 1, marginLeft: 16, paddingTop: 6 },
  nodeTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  nodeDesc: { fontSize: 13 },

  detailsCard: { padding: 20, borderRadius: 20, gap: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600' },
});
