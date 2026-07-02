// ─── Smart Search Modal ─────────────────────────────────────────────
// Global search across contacts, transactions, UPI IDs, amounts, dates

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
  Modal, Animated, Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTheme, spacing, typography } from '../theme';
import { AvatarCircle } from './AvatarCircle';
import { formatCurrency } from '../utils/formatters';
import type { Contact, Transaction } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
  onSelectTransaction: (txn: Transaction) => void;
}

type SearchResult = {
  type: 'contact' | 'transaction';
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  data: any;
};

export const SmartSearchModal: React.FC<Props> = ({ visible, onClose, onSelectContact, onSelectTransaction }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const contacts = useStore(state => state.contacts || []);
  const transactions = useStore(state => state.transactions || []);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }).start();
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      slideAnim.setValue(0);
      setQuery('');
    }
  }, [visible]);

  const results = useMemo((): SearchResult[] => {
    if (query.length < 2) return [];
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    // Search contacts
    contacts.forEach((c: Contact) => {
      if (c.name.toLowerCase().includes(q) || c.phone.includes(q)) {
        items.push({
          type: 'contact',
          id: `c-${c.id}`,
          title: c.name,
          subtitle: c.phone,
          icon: 'account',
          data: c,
        });
      }
    });

    // Search transactions
    transactions.forEach((t: Transaction) => {
      const receiverMatch = t.receiver?.toLowerCase().includes(q);
      const nameMatch = t.receiverName?.toLowerCase().includes(q);
      const amountMatch = String(t.amount).includes(q);
      const dateStr = new Date(t.timestamp).toLocaleDateString();
      const dateMatch = dateStr.includes(q);

      if (receiverMatch || nameMatch || amountMatch || dateMatch) {
        items.push({
          type: 'transaction',
          id: `t-${t.id}`,
          title: t.receiverName || t.receiver,
          subtitle: `₹${t.amount} • ${dateStr} • ${t.status}`,
          icon: t.status === 'SUCCESS' ? 'check-circle' : 'clock-outline',
          data: t,
        });
      }
    });

    return items.slice(0, 30); // Cap at 30 results
  }, [query, contacts, transactions]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  const renderItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={[s.resultRow, { borderBottomColor: colors.borderLight }]}
      onPress={() => {
        if (item.type === 'contact') onSelectContact(item.data);
        else onSelectTransaction(item.data);
      }}
      activeOpacity={0.7}
    >
      {item.type === 'contact' ? (
        <AvatarCircle name={item.title} size={40} />
      ) : (
        <View style={[s.iconWrap, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name={item.icon} size={20} color={item.data.status === 'SUCCESS' ? colors.success : colors.warning} />
        </View>
      )}
      <View style={s.resultInfo}>
        <Text style={[s.resultTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[s.resultSub, { color: colors.textSecondary }]} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.overlay, { paddingTop: insets.top }]}>
        <Animated.View style={[s.container, { backgroundColor: colors.background, transform: [{ translateY }] }]}>
          {/* Search Bar */}
          <View style={[s.searchBar, { backgroundColor: colors.surfaceHighlight }]}>
            <Icon name="magnify" size={22} color={colors.textTertiary} />
            <TextInput
              ref={inputRef}
              style={[s.searchInput, { color: colors.textPrimary }]}
              placeholder="Search contacts, payments, UPI..."
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Results */}
          {query.length < 2 ? (
            <View style={s.emptyState}>
              <Icon name="magnify" size={48} color={colors.textTertiary} style={{ opacity: 0.4 }} />
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>Search contacts, transactions, UPI IDs, amounts...</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={s.emptyState}>
              <Icon name="file-search-outline" size={48} color={colors.textTertiary} style={{ opacity: 0.4 }} />
              <Text style={[s.emptyText, { color: colors.textSecondary }]}>No results for "{query}"</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, paddingHorizontal: 16, height: 52, borderRadius: 26, gap: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 16 },
  
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  resultSub: { fontSize: 13 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 15, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
});
