// ─── Transaction Card Component 3.0 ──────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Transaction } from '../types';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';
import { getTransactionAmountSign, isIncomingTransaction } from '../utils/transactionDisplay';
import { useTheme, spacing, borderRadius } from '../theme';
import { AvatarCircle } from './AvatarCircle';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface TransactionCardProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
  compact?: boolean;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction, onPress, compact = false,
}) => {
  const { colors } = useTheme();
  const { amount, receiver, receiverName, status, timestamp, method } = transaction;
  const displayName = receiverName || receiver;
  const sign = getTransactionAmountSign(transaction);
  const incoming = isIncomingTransaction(transaction);

  const getStatusColor = () => {
    switch (status) {
      case 'SUCCESS': return incoming ? colors.success : colors.textPrimary;
      case 'RECEIVED': return colors.success;
      case 'FAILED': return colors.error;
      case 'PENDING': return colors.warning;
      case 'CANCELLED': return colors.textTertiary;
      default: return colors.primary;
    }
  };

  const statusColor = getStatusColor();
  const amountColor = incoming ? colors.success : (status === 'FAILED' ? colors.error : colors.textPrimary);

  return (
    <TouchableOpacity
      style={[styles.container, compact && styles.containerCompact, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
      onPress={() => onPress?.(transaction)}
      activeOpacity={0.7}
    >
      <AvatarCircle name={displayName} size={compact ? 40 : 48} fontSize={compact ? 14 : 16} />

      <View style={styles.details}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[
            styles.amount,
            { color: amountColor },
            status === 'CANCELLED' && { color: colors.textTertiary, textDecorationLine: 'line-through' as const },
          ]}>
            {sign}{formatCurrency(amount)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.metaRow}>
            {status !== 'SUCCESS' && status !== 'SENT' && status !== 'RECEIVED' && (
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
              </View>
            )}

            <Text style={[styles.time, { color: colors.textTertiary }]}>{formatRelativeTime(timestamp)}</Text>

            {transaction.upiId && (
              <View style={[styles.methodBadge, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="at" size={10} color={colors.textSecondary} />
                <Text style={[styles.methodText, { color: colors.textSecondary }]}>UPI</Text>
              </View>
            )}

            {method === 'WALLET' && (
              <View style={[styles.methodBadge, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="wallet-outline" size={10} color={colors.textSecondary} />
                <Text style={[styles.methodText, { color: colors.textSecondary }]}>WALLET</Text>
              </View>
            )}

            {method === 'USSD' && !transaction.upiId && (
              <View style={[styles.methodBadge, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="cellphone-wireless" size={10} color={colors.textSecondary} />
                <Text style={[styles.methodText, { color: colors.textSecondary }]}>USSD</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.xl, borderWidth: 1, gap: spacing.md },
  containerCompact: { padding: spacing.sm, borderRadius: borderRadius.lg },
  details: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: spacing.sm, letterSpacing: -0.2 },
  amount: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 12, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  methodBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 2 },
  methodText: { fontSize: 10, fontWeight: '700' },
});
