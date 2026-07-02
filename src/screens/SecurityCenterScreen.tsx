import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme';
import { useStore } from '../store/useStore';

export const SecurityCenterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const settings = useStore(state => state.settings);
  const setSettings = useStore(state => state.setSettings);
  const user = useStore(state => state.user);

  const [localBiometric, setLocalBiometric] = useState(settings.isBiometricEnabled);

  const toggleBiometric = (val: boolean) => {
    setLocalBiometric(val);
    setSettings({ isBiometricEnabled: val });
  };

  const OptionRow = ({ icon, title, subtitle, value, onToggle, onPress, isDanger }: any) => (
    <TouchableOpacity 
      style={[s.optionRow, { borderBottomColor: colors.borderLight }]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[s.iconWrap, { backgroundColor: isDanger ? colors.error + '15' : colors.primary + '15' }]}>
        <Icon name={icon} size={24} color={isDanger ? colors.error : colors.primary} />
      </View>
      <View style={s.optionTextWrap}>
        <Text style={[s.optionTitle, { color: isDanger ? colors.error : colors.textPrimary }]}>{title}</Text>
        {subtitle && <Text style={[s.optionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {onToggle !== undefined ? (
        <Switch 
          value={value} 
          onValueChange={onToggle} 
          trackColor={{ false: colors.borderLight, true: colors.primary }}
        />
      ) : (
        <Icon name="chevron-right" size={24} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Security Center</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        
        <View style={[s.statusCard, { backgroundColor: colors.success + '10', borderColor: colors.success + '40', borderWidth: 1 }]}>
          <Icon name="shield-check" size={40} color={colors.success} style={{ marginBottom: 12 }} />
          <Text style={[s.statusTitle, { color: colors.success }]}>Your account is protected</Text>
          <Text style={[s.statusDesc, { color: colors.textSecondary }]}>All security features and local encryption are currently active.</Text>
        </View>

        <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Authentication</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceHighlight }]}>
          <OptionRow 
            icon="fingerprint" 
            title="Biometric Login" 
            subtitle="Use fingerprint or Face ID"
            value={localBiometric}
            onToggle={toggleBiometric}
          />
          <OptionRow 
            icon="dialpad" 
            title="Change App PIN" 
            subtitle="Update your 4-digit security PIN"
            onPress={() => {}}
          />
        </View>

        <Text style={[s.sectionTitle, { color: colors.textPrimary, marginTop: 24 }]}>Permissions & Access</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceHighlight }]}>
          <OptionRow 
            icon="message-text-lock" 
            title="SMS Permission" 
            subtitle="Required for offline payments"
            value={true}
            onToggle={() => {}}
          />
          <OptionRow 
            icon="phone-classic" 
            title="USSD Permission" 
            subtitle="Required for balance fetching"
            value={true}
            onToggle={() => {}}
          />
          <OptionRow 
            icon="layers-outline" 
            title="Screen Overlay" 
            subtitle="Draw over other apps for quick pay"
            value={false}
            onToggle={() => {}}
          />
        </View>

        <Text style={[s.sectionTitle, { color: colors.textPrimary, marginTop: 24 }]}>Data & Backup</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceHighlight }]}>
          <OptionRow 
            icon="lock-check" 
            title="Local Encryption" 
            subtitle="AES-256 block active"
            value={true}
            onToggle={() => {}}
          />
          <OptionRow 
            icon="cloud-upload" 
            title="Secure Backup" 
            subtitle="Backup encrypted data to Google Drive"
            onPress={() => {}}
          />
          <OptionRow 
            icon="delete-forever" 
            title="Clear All Data" 
            subtitle="Permanently delete account and local data"
            isDanger
            onPress={() => {}}
          />
        </View>

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  
  statusCard: { padding: 24, borderRadius: 20, alignItems: 'center', marginBottom: 32 },
  statusTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  statusDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, marginLeft: 8 },
  card: { borderRadius: 20, overflow: 'hidden' },
  
  optionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  optionTextWrap: { flex: 1, marginRight: 16 },
  optionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  optionSubtitle: { fontSize: 13 },
});
