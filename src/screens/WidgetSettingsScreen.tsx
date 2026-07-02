import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, typography } from '../theme';
import { PremiumCard } from '../components/PremiumCard';
import { useStore } from '../store/useStore';
import { 
  hasOverlayPermission, 
  requestOverlayPermission, 
  startPaymentWidget, 
  stopPaymentWidget,
  showQuickPayWidget,
  showFinanceWidget,
  hideFloatingWidgets
} from '../engine/WidgetService';

export const WidgetSettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [soundboxEnabled, setSoundboxEnabled] = useState(false);
  const [autoHide, setAutoHide] = useState(true);

  const toggleSoundbox = async () => {
    const hasPerm = await hasOverlayPermission();
    if (!hasPerm) {
      await requestOverlayPermission();
      return;
    }
    
    if (soundboxEnabled) {
      await stopPaymentWidget();
      setSoundboxEnabled(false);
    } else {
      await startPaymentWidget();
      setSoundboxEnabled(true);
    }
  };

  const renderSettingRow = (icon: string, title: string, subtitle: string, RightComponent: React.ReactNode) => (
    <View style={[s.settingRow, { borderBottomColor: colors.borderLight }]}>
      <View style={[s.iconBg, { backgroundColor: colors.surfaceHighlight }]}>
        <Icon name={icon} size={24} color={colors.primary} />
      </View>
      <View style={s.settingTextWrap}>
        <Text style={[s.settingTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[s.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      {RightComponent}
    </View>
  );

  return (
    <View style={[s.screen, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Widget Ecosystem</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>Floating Overlays</Text>
        
        <PremiumCard style={s.card}>
          {renderSettingRow(
            'speaker-wireless',
            'Floating Soundbox',
            'Live payment announcements',
            <Switch 
              value={soundboxEnabled} 
              onValueChange={toggleSoundbox} 
              trackColor={{ true: colors.primary }}
            />
          )}
          
          <TouchableOpacity onPress={() => showQuickPayWidget()}>
            {renderSettingRow(
              'lightning-bolt',
              'Quick Pay Widget',
              'Instant access to pay contacts',
              <Icon name="chevron-right" size={24} color={colors.textTertiary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => showFinanceWidget()}>
            {renderSettingRow(
              'chart-donut',
              'Finance Dashboard',
              'Floating budget & goals tracker',
              <Icon name="chevron-right" size={24} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        </PremiumCard>

        <Text style={[s.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>Preferences</Text>
        
        <PremiumCard style={s.card}>
          {renderSettingRow(
            'eye-off',
            'Auto Hide Overlays',
            'Collapse widget after 5 seconds',
            <Switch 
              value={autoHide} 
              onValueChange={setAutoHide} 
              trackColor={{ true: colors.primary }}
            />
          )}
        </PremiumCard>

        <TouchableOpacity 
          style={[s.testBtn, { backgroundColor: colors.surfaceHighlight }]}
          onPress={() => hideFloatingWidgets()}
        >
          <Text style={[s.testBtnText, { color: colors.primary }]}>Hide All Floating Widgets</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2 },
  
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  card: { padding: 0 },
  
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  iconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  settingTextWrap: { flex: 1, marginRight: 16 },
  settingTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  settingSubtitle: { fontSize: 13 },
  
  testBtn: { marginTop: 32, padding: 16, borderRadius: 16, alignItems: 'center' },
  testBtnText: { fontSize: 16, fontWeight: '600' }
});
