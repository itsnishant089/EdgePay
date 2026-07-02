import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { useTheme, typography } from '../theme';
import { AvatarCircle } from '../components/AvatarCircle';
import { PremiumCard } from '../components/PremiumCard';
import {
  testSoundboxAnnouncement,
  updateSoundboxConfig,
  stopSoundboxAnnouncement,
  isSoundboxSpeaking,
} from '../engine/PaymentSoundbox';
import { getUserUpiId } from '../utils/formatters';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();

  const user = useStore(state => state.user);
  const settings = useStore(state => state.settings);
  const language = useStore(state => state.language);
  const setLanguage = useStore(state => state.setLanguage);
  const setSettings = useStore(state => state.setSettings);
  const toggleTheme = useStore(state => state.toggleTheme);

  const [devTapCount, setDevTapCount] = useState(0);
  const [activeTestLang, setActiveTestLang] = useState<'en' | 'hi' | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const toggleTestAnnouncement = (lang: 'en' | 'hi') => {
    if (activeTestLang === lang || isSoundboxSpeaking()) {
      stopSoundboxAnnouncement();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setActiveTestLang(null);
      return;
    }

    stopSoundboxAnnouncement();
    setSettings({ soundboxLanguage: lang, isSoundboxEnabled: true });
    updateSoundboxConfig({ language: lang, enabled: true });
    setActiveTestLang(lang);
    testSoundboxAnnouncement(lang, 500);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!isSoundboxSpeaking()) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setActiveTestLang(null);
      }
    }, 250);
  };

  const handleSoundboxLanguage = (lang: 'en' | 'hi') => {
    setSettings({ soundboxLanguage: lang });
    updateSoundboxConfig({ language: lang });
    Alert.alert('Soundbox Language', lang === 'en' ? 'English announcements enabled.' : 'हिंदी घोषणाएँ सक्षम।');
  };

  const handleVersionTap = () => {
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= 7) {
      setDevTapCount(0);
      navigation.navigate('Diagnostics');
    }
  };

  const handleLanguageChange = () => {
    Alert.alert(
      'Select Language',
      '',
      [
        { text: 'English', onPress: () => setLanguage('en') },
        { text: 'हिंदी (Hindi)', onPress: () => setLanguage('hi') },
        { text: 'मराठी (Marathi)', onPress: () => setLanguage('mr') },
        { text: 'اردو (Urdu)', onPress: () => setLanguage('ur') },
        { text: 'বাংলা (Bengali)', onPress: () => setLanguage('bn') },
        { text: 'ಕನ್ನಡ (Kannada)', onPress: () => setLanguage('kn') },
        { text: 'ଓଡ଼ିଆ (Odia)', onPress: () => setLanguage('or') },
        { text: 'ਪੰਜਾਬੀ (Punjabi)', onPress: () => setLanguage('pa') },
        { text: 'ગુજરાતી (Gujarati)', onPress: () => setLanguage('gu') },
        { text: 'தமிழ் (Tamil)', onPress: () => setLanguage('ta') },
        { text: 'తెలుగు (Telugu)', onPress: () => setLanguage('te') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const SettingRow = ({ icon, label, value, onPress, isSwitch, switchValue, onSwitchChange, trailing }: any) => (
    <TouchableOpacity
      style={[s.settingRow, { borderBottomColor: colors.borderLight }]}
      onPress={onPress}
      disabled={isSwitch || !onPress}
      activeOpacity={0.7}
    >
      <View style={[s.iconBox, { backgroundColor: colors.surfaceHighlight }]}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View style={s.settingContent}>
        <Text style={[s.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
        {value && <Text style={[s.settingValue, { color: colors.textTertiary }]}>{value}</Text>}
      </View>
      {trailing || (isSwitch ? (
        <Switch value={switchValue} onValueChange={onSwitchChange} trackColor={{ false: colors.borderLight, true: colors.primary }} />
      ) : (
        <Icon name="chevron-right" size={24} color={colors.textTertiary} />
      ))}
    </TouchableOpacity>
  );

  const userUpi = getUserUpiId(user);

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Profile')}>
          <PremiumCard style={s.profileCard} noPadding>
            <View style={s.profileInner}>
              <AvatarCircle name={user.name || 'User'} size={60} fontSize={24} />
              <View style={s.profileInfo}>
                <Text style={[s.profileName, { color: colors.textPrimary }]}>{user.name}</Text>
                <Text style={[s.profileUpi, { color: colors.textSecondary }]}>{userUpi}</Text>
              </View>
              <Icon name="chevron-right" size={24} color={colors.textTertiary} />
            </View>
          </PremiumCard>
        </TouchableOpacity>

        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>General</Text>
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SettingRow icon="theme-light-dark" label="Theme" value={theme === 'dark' ? 'Dark' : 'Light'} onPress={toggleTheme} />
          <SettingRow icon="translate" label="Language" value={language.toUpperCase()} onPress={handleLanguageChange} />
          <SettingRow
            icon="volume-high"
            label="Soundbox"
            isSwitch
            switchValue={settings.isSoundboxEnabled}
            onSwitchChange={(val: boolean) => {
              setSettings({ isSoundboxEnabled: val });
              updateSoundboxConfig({ enabled: val });
            }}
          />
          <SettingRow
            icon="translate"
            label="Soundbox Language"
            value={settings.soundboxLanguage === 'hi' ? 'Hindi' : 'English'}
            onPress={() => Alert.alert(
              'Soundbox Language',
              'Choose announcement language',
              [
                { text: 'English', onPress: () => handleSoundboxLanguage('en') },
                { text: 'हिंदी (Hindi)', onPress: () => handleSoundboxLanguage('hi') },
                { text: 'Cancel', style: 'cancel' },
              ],
            )}
          />
          <SettingRow
            icon={activeTestLang === 'en' ? 'stop-circle-outline' : 'play-circle-outline'}
            label={activeTestLang === 'en' ? 'Stop English Announcement' : 'Test English Announcement'}
            onPress={() => toggleTestAnnouncement('en')}
            trailing={
              activeTestLang === 'en' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Icon name="play-circle-outline" size={26} color={colors.primary} />
              )
            }
          />
          <SettingRow
            icon={activeTestLang === 'hi' ? 'stop-circle-outline' : 'play-circle-outline'}
            label={activeTestLang === 'hi' ? 'Stop Hindi Announcement' : 'Test Hindi Announcement'}
            onPress={() => toggleTestAnnouncement('hi')}
            trailing={
              activeTestLang === 'hi' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Icon name="play-circle-outline" size={26} color={colors.primary} />
              )
            }
          />
          <SettingRow icon="widgets" label="Widgets" onPress={() => navigation.navigate('WidgetSettings')} />
        </View>

        <Text style={[s.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>Balance & Payment</Text>
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="swap-horizontal"
            label="Auto-Switch Wallet / Bank"
            value={settings.autoSwitchPaymentMode !== false ? 'Online → Wallet · Offline → USSD' : 'Manual toggle mode'}
            isSwitch
            switchValue={settings.autoSwitchPaymentMode !== false}
            onSwitchChange={(val: boolean) => {
              setSettings({ autoSwitchPaymentMode: val });
              Alert.alert(
                'Auto-Switch',
                val
                  ? 'When internet is on, Edge Wallet (simulation) is used. When offline, USSD bank mode is used.'
                  : 'Use the manual WALLET / BANK toggle on the dashboard and send screen.',
              );
            }}
          />
          <SettingRow
            icon="refresh-auto"
            label="Auto Balance Refresh"
            value="Every 6 minutes"
            isSwitch
            switchValue={settings.autoBalanceRefresh !== false}
            onSwitchChange={(val: boolean) => setSettings({ autoBalanceRefresh: val })}
          />
          <SettingRow
            icon="cellphone-arrow-down"
            label="Fetch Balance on App Open"
            isSwitch
            switchValue={settings.autoBalanceOnAppOpen !== false}
            onSwitchChange={(val: boolean) => setSettings({ autoBalanceOnAppOpen: val })}
          />
        </View>

        <Text style={[s.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>Account & Data</Text>
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SettingRow icon="contacts" label="Contacts" onPress={() => navigation.navigate('Contacts')} />
          <SettingRow icon="bell-outline" label="Notifications" onPress={() => navigation.navigate('NotificationCenter')} />
          <SettingRow icon="cloud-upload" label="Backup" onPress={() => Alert.alert('Coming Soon', 'Backup feature is coming in the next update.')} />
        </View>

        <Text style={[s.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>Privacy & Security</Text>
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SettingRow icon="shield-lock-outline" label="Security Center" onPress={() => navigation.navigate('SecurityCenter')} />
          <SettingRow icon="eye-off-outline" label="Privacy" onPress={() => Alert.alert('Privacy', 'Your data is strictly offline and encrypted.')} />
          <SettingRow icon="key-outline" label="Permissions" onPress={() => navigation.navigate('SecurityCenter')} />
        </View>

        <Text style={[s.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>System</Text>
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SettingRow icon="information-outline" label="About EdgePay" onPress={handleVersionTap} value="v4.0.0" />
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 16 },
  headerTitle: { ...typography.h2 },

  profileCard: { marginBottom: 32 },
  profileInner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  profileUpi: { fontSize: 14 },

  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 8 },
  card: { borderRadius: 20, overflow: 'hidden' },

  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '600' },
  settingValue: { fontSize: 14, marginTop: 2 },
});
