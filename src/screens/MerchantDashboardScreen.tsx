import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, typography } from '../theme';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatters';

const { width } = Dimensions.get('window');

export const MerchantDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const user = useStore(state => state.user);
  const transactions = useStore(state => state.transactions || []);
  const soundboxEnabled = useStore(state => state.settings.isSoundboxEnabled);
  const setSettings = useStore(state => state.setSettings);

  // Merchant Stats
  const todayStr = new Date().toDateString();
  const todaysSales = useMemo(() => {
    return transactions.filter(t => 
      new Date(t.timestamp).toDateString() === todayStr && 
      (t.status === 'SUCCESS' || t.status === 'RECEIVED')
    );
  }, [transactions, todayStr]);

  const totalReceivedToday = todaysSales.reduce((sum, t) => sum + t.amount, 0);

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View>
          <Text style={[s.greeting, { color: colors.textSecondary }]}>Merchant Portal</Text>
          <Text style={[s.storeName, { color: colors.textPrimary }]}>{user.name}'s Store</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Icon name="store-cog" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        
        {/* Sales Hero Card */}
        <View style={[s.heroCard, { backgroundColor: colors.primary }]}>
          <Text style={s.heroLabel}>TODAY'S SALES</Text>
          <Text style={s.heroAmount}>₹{formatCurrency(totalReceivedToday)}</Text>
          <View style={s.heroFooter}>
            <View style={s.heroStat}>
              <Icon name="account-group" size={16} color="#FFF" />
              <Text style={s.heroStatText}>{todaysSales.length} Customers</Text>
            </View>
            <View style={s.heroStat}>
              <Icon name="trending-up" size={16} color="#FFF" />
              <Text style={s.heroStatText}>+12% vs Yesterday</Text>
            </View>
          </View>
        </View>

        {/* Quick Tools */}
        <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Merchant Tools</Text>
        <View style={s.toolsGrid}>
          <TouchableOpacity 
            style={[s.toolCard, { backgroundColor: colors.surfaceHighlight }]}
            onPress={() => navigation.navigate('MerchantQR')}
          >
            <View style={[s.toolIconWrap, { backgroundColor: colors.primary + '15' }]}>
              <Icon name="qrcode" size={28} color={colors.primary} />
            </View>
            <Text style={[s.toolLabel, { color: colors.textPrimary }]}>My QR Code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[s.toolCard, { backgroundColor: colors.surfaceHighlight }]}
            onPress={() => navigation.navigate('History')}
          >
            <View style={[s.toolIconWrap, { backgroundColor: '#FF9F0A15' }]}>
              <Icon name="receipt-text" size={28} color="#FF9F0A" />
            </View>
            <Text style={[s.toolLabel, { color: colors.textPrimary }]}>Sales Ledger</Text>
          </TouchableOpacity>
        </View>

        {/* Soundbox Status */}
        <View style={[s.soundboxCard, { backgroundColor: colors.surfaceHighlight }]}>
          <View style={[s.sbIconWrap, { backgroundColor: soundboxEnabled ? colors.success + '20' : colors.error + '20' }]}>
            <Icon name={soundboxEnabled ? "volume-high" : "volume-off"} size={24} color={soundboxEnabled ? colors.success : colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.sbTitle, { color: colors.textPrimary }]}>Soundbox Status</Text>
            <Text style={[s.sbDesc, { color: colors.textSecondary }]}>{soundboxEnabled ? "Active & Listening" : "Currently Muted"}</Text>
          </View>
          <Switch 
            value={soundboxEnabled}
            onValueChange={(val) => setSettings({ isSoundboxEnabled: val })} 
            trackColor={{ false: colors.borderLight, true: colors.success }}
          />
        </View>

        {/* Recent Transactions */}
        <Text style={[s.sectionTitle, { color: colors.textPrimary, marginTop: 16 }]}>Latest Payments</Text>
        {todaysSales.slice(0, 5).map(txn => (
          <View key={txn.id} style={[s.txnRow, { borderBottomColor: colors.borderLight }]}>
            <View style={[s.txnIconWrap, { backgroundColor: colors.success + '15' }]}>
              <Icon name="arrow-down-bold" size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.txnName, { color: colors.textPrimary }]}>{txn.receiverName || txn.receiver}</Text>
              <Text style={[s.txnTime, { color: colors.textSecondary }]}>
                {new Date(txn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={[s.txnAmount, { color: colors.success }]}>+ ₹{formatCurrency(txn.amount)}</Text>
          </View>
        ))}

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16 },
  greeting: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  storeName: { ...typography.h2 },
  
  heroCard: { padding: 24, borderRadius: 24, marginBottom: 32 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  heroAmount: { color: '#FFF', fontSize: 40, fontWeight: '900', marginBottom: 24 },
  heroFooter: { flexDirection: 'row', gap: 16 },
  heroStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  heroStatText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  sectionTitle: { ...typography.h3, marginBottom: 16 },
  toolsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  toolCard: { flex: 1, padding: 20, borderRadius: 20, alignItems: 'center', gap: 12 },
  toolIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 15, fontWeight: '700' },

  soundboxCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 32 },
  sbIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  sbTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sbDesc: { fontSize: 13 },

  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  txnIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  txnName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  txnTime: { fontSize: 13 },
  txnAmount: { fontSize: 16, fontWeight: '800' },
});
