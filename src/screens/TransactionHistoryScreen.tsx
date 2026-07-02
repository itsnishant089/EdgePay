// ─── Transaction History Screen 3.0 ────────────────────────────────

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { TransactionCard } from '../components/TransactionCard';
import { useTheme, typography } from '../theme';

type FilterType = 'ALL' | 'CREDIT' | 'DEBIT' | 'FAILED';

export const TransactionHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const transactions = useStore(state => state.transactions);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      const matchSearch = (txn.receiverName || txn.receiver).toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchFilter = true;
      if (filter === 'CREDIT') matchFilter = txn.status === 'SUCCESS' && txn.amount > 0;
      if (filter === 'DEBIT') matchFilter = txn.status === 'SENT';
      if (filter === 'FAILED') matchFilter = txn.status === 'FAILED';
      
      return matchSearch && matchFilter;
    });
  }, [transactions, searchQuery, filter]);

  // Group by date
  const groupedData = useMemo(() => {
    const groups: { [key: string]: typeof transactions } = {};
    filteredTransactions.forEach(txn => {
      const date = new Date(txn.timestamp);
      // Create a sortable string like "2023-10-15"
      const dateKey = date.toISOString().split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(txn);
    });
    
    // Convert to flat list with header items
    const flattened: any[] = [];
    Object.keys(groups).sort().reverse().forEach(dateKey => {
      const date = new Date(dateKey);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let headerTitle = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      if (dateKey === today.toISOString().split('T')[0]) headerTitle = 'Today';
      else if (dateKey === yesterday.toISOString().split('T')[0]) headerTitle = 'Yesterday';

      flattened.push({ type: 'header', title: headerTitle, id: `header-${dateKey}` });
      groups[dateKey].forEach(txn => {
        flattened.push({ type: 'item', ...txn });
      });
    });
    return flattened;
  }, [filteredTransactions]);

  const FilterChip = ({ type, label }: { type: FilterType, label: string }) => {
    const isSelected = filter === type;
    return (
      <TouchableOpacity
        style={[s.filterChip, { backgroundColor: isSelected ? colors.primary : colors.surfaceHighlight }]}
        onPress={() => setFilter(type)}
      >
        <Text style={[s.filterText, { color: isSelected ? '#FFF' : colors.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Transaction History</Text>
        <TouchableOpacity style={s.backBtn}>
          <Icon name="help-circle-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={s.searchContainer}>
        <View style={[s.searchBar, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="magnify" size={20} color={colors.textTertiary} />
          <TextInput
            style={[s.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by name or UPI ID"
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.filterRow}>
        <FilterChip type="ALL" label="All" />
        <FilterChip type="CREDIT" label="Received" />
        <FilterChip type="DEBIT" label="Sent" />
        <FilterChip type="FAILED" label="Failed" />
      </View>

      <FlatList
        data={groupedData}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={[s.dateHeader, { color: colors.textSecondary }]}>{item.title}</Text>;
          }
          return (
            <View style={{ marginBottom: 12 }}>
              <TransactionCard 
                transaction={item} 
                onPress={() => navigation.navigate('TransactionDetails', { transaction: item })} 
              />
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={s.emptyState}>
            <Icon name="text-box-search-outline" size={48} color={colors.textTertiary} />
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No transactions found</Text>
            <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 8 }}>Try adjusting your filters or search query.</Text>
          </View>
        )}
      />
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48, borderRadius: 24, gap: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: '600' },
  dateHeader: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 16, paddingHorizontal: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
});
