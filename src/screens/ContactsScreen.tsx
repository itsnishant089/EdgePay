// ─── Contacts Screen 4.0 ───────────────────────────────────────────
// Google Pay style contacts with Favorites, Recent, and Search

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, SectionList, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { useTheme, spacing, typography, gradients } from '../theme';
import { AvatarCircle } from '../components/AvatarCircle';
import { syncLocalContacts } from '../engine/ContactsService';
import LinearGradient from 'react-native-linear-gradient';
import { normalizePhoneForPayment } from '../utils/phoneUtils';
import type { Contact } from '../types';

export const ContactsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const contacts = useStore(state => state.contacts);
  const transactions = useStore(state => state.transactions || []);
  const setContacts = useStore(state => state.setContacts);
  const toggleFavoriteContact = useStore(state => state.toggleFavoriteContact);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(contacts.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (contacts.length === 0) {
      loadContacts();
    }
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    const localContacts = await syncLocalContacts();
    setContacts(localContacts);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const localContacts = await syncLocalContacts();
    setContacts(localContacts);
    setRefreshing(false);
  }, [setContacts]);

  // Favorites
  const favorites = useMemo(() => contacts.filter(c => c.isFavorite), [contacts]);

  // Recent contacts (from recent transactions)
  const recentContacts = useMemo(() => {
    const seen = new Set<string>();
    const recent: Contact[] = [];
    const sortedTxns = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    
    for (const txn of sortedTxns) {
      if (recent.length >= 10) break;
      const match = contacts.find(c => 
        c.phone === txn.receiver || 
        c.phone.replace(/\D/g, '').endsWith(txn.receiver.replace(/\D/g, ''))
      );
      if (match && !seen.has(match.id)) {
        seen.add(match.id);
        recent.push(match);
      }
    }
    return recent;
  }, [contacts, transactions]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const lowerQuery = searchQuery.toLowerCase();
    return contacts.filter(c => 
      c.name.toLowerCase().includes(lowerQuery) || c.phone.includes(lowerQuery)
    );
  }, [contacts, searchQuery]);

  const handlePayContact = (contact: Contact) => {
    navigation.navigate('SendMoney', {
      receiver: normalizePhoneForPayment(contact.phone),
      name: contact.name,
      mode: 'pay',
    });
  };

  const renderHorizontalContact = (item: Contact) => (
    <TouchableOpacity 
      key={item.id}
      style={s.hContactItem}
      onPress={() => handlePayContact(item)}
      activeOpacity={0.7}
    >
      <AvatarCircle name={item.name} photo={item.photo} size={52} />
      <Text style={[s.hContactName, { color: colors.textPrimary }]} numberOfLines={1}>
        {item.name.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={[s.contactRow, { borderBottomColor: colors.borderLight }]}
      onPress={() => navigation.navigate('ContactProfile', { contact: item })}
      activeOpacity={0.7}
    >
      <AvatarCircle name={item.name} photo={item.photo} size={48} />
      <View style={s.contactInfo}>
        <Text style={[s.contactName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[s.contactPhone, { color: colors.textSecondary }]}>{item.phone}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={() => handlePayContact(item)} style={s.paySmallBtn}>
          <Text style={[s.paySmallText, { color: colors.primary }]}>Pay</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={s.favBtn} 
          onPress={() => toggleFavoriteContact(item.id)}
        >
          <Icon name={item.isFavorite ? "star" : "star-outline"} size={22} color={item.isFavorite ? colors.warning : colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const ListHeader = () => (
    <View>
      {/* Favorites Section */}
      {favorites.length > 0 && !searchQuery && (
        <View style={s.horizontalSection}>
          <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>⭐ Favorites</Text>
          <FlatList
            horizontal
            data={favorites}
            keyExtractor={item => `fav-${item.id}`}
            renderItem={({ item }) => renderHorizontalContact(item)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
          />
        </View>
      )}

      {/* Recent Section */}
      {recentContacts.length > 0 && !searchQuery && (
        <View style={s.horizontalSection}>
          <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>🕐 Recent</Text>
          <FlatList
            horizontal
            data={recentContacts}
            keyExtractor={item => `recent-${item.id}`}
            renderItem={({ item }) => renderHorizontalContact(item)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
          />
        </View>
      )}

      {/* All Contacts Header */}
      <View style={s.allContactsHeader}>
        <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>All Contacts ({filteredContacts.length})</Text>
      </View>
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Pay Contacts</Text>
        <TouchableOpacity style={s.backBtn} onPress={onRefresh}>
          <Icon name="refresh" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchContainer}>
        <View style={[s.searchBar, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="magnify" size={20} color={colors.textTertiary} />
          <TextInput
            style={[s.searchInput, { color: colors.textPrimary }]}
            placeholder="Search name or phone number"
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

      {/* Pay to new number */}
      <TouchableOpacity 
        style={[s.newNumberRow, { borderBottomColor: colors.borderLight }]}
        onPress={() => navigation.navigate('SendMoney')}
      >
        <LinearGradient colors={gradients.primary} style={s.newNumberIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Icon name="phone-plus" size={22} color="#FFF" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.contactName, { color: colors.textPrimary }]}>Pay to New Number / UPI</Text>
          <Text style={[s.contactPhone, { color: colors.textSecondary }]}>Enter mobile or UPI ID directly</Text>
        </View>
        <Icon name="chevron-right" size={22} color={colors.textTertiary} />
      </TouchableOpacity>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.loadingText, { color: colors.textSecondary }]}>Syncing Contacts...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={renderContact}
          ListHeaderComponent={ListHeader}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={() => (
            <View style={s.emptyWrap}>
              <Icon name="account-search-outline" size={48} color={colors.textTertiary} />
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No contacts found</Text>
              <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>
                {searchQuery ? 'Try a different search' : 'Allow contacts permission to see your contacts'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2 },
  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48, borderRadius: 24, gap: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  
  newNumberRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  newNumberIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  
  horizontalSection: { paddingVertical: 12 },
  sectionLabel: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 },
  hContactItem: { alignItems: 'center', width: 64 },
  hContactName: { marginTop: 6, fontSize: 12, fontWeight: '500', textAlign: 'center' },
  
  allContactsHeader: { paddingTop: 12 },
  
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  contactPhone: { fontSize: 13 },
  favBtn: { padding: 6 },
  paySmallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  paySmallText: { fontSize: 14, fontWeight: '700' },
  
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, fontWeight: '500' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, fontWeight: '400', textAlign: 'center', paddingHorizontal: 40 },
});
