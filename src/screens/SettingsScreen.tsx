import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { useTheme, typography } from '../theme';
import { AvatarCircle } from '../components/AvatarCircle';
import { PremiumCard } from '../components/PremiumCard';
import { testSoundboxAnnouncement, updateSoundboxConfig } from '../engine/PaymentSoundbox';

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

  const handleSoundboxLanguage = (lang: 'en' | 'hi') => {
    setSettings({ soundboxLanguage: lang });
    updateSoundboxConfig({ language: lang });
    Alert.alert('Soundbox Language', lang === 'en' ? 'English announcements enabled.' : 'हिंदी घोषणाएँ सक्षम।');
  };

  const handleSoundboxTest = async (lang: 'en' | 'hi') => {
    setSettings({ soundboxLanguage: lang });
    updateSoundboxConfig({ language: lang, enabled: true });
    await testSoundboxAnnouncement(lang, 1);
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
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const SettingRow = ({ icon, label, value, onPress, isSwitch, switchValue, onSwitchChange }: any) => (
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
      {isSwitch ? (
        <Switch value={switchValue} onValueChange={onSwitchChange} trackColor={{ false: colors.borderLight, true: colors.primary }} />
      ) : (
        <Icon name="chevron-right" size={24} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {/* Profile Card */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Profile')}>
          <PremiumCard style={s.profileCard} noPadding>
            <View style={s.profileInner}>
              <AvatarCircle name={user.name || 'User'} size={60} fontSize={24} />
              <View style={s.profileInfo}>
                <Text style={[s.profileName, { color: colors.textPrimary }]}>{user.name}</Text>
                <Text style={[s.profileUpi, { color: colors.textSecondary }]}>{user.phone}@edgepay</Text>
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
              Alert.alert('Soundbox', val ? 'Soundbox is now enabled.' : 'Soundbox is now disabled.');
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
            icon="play-circle-outline"
            label="Test English Announcement"
            onPress={() => handleSoundboxTest('en')}
          />
          <SettingRow
            icon="play-circle-outline"
            label="Test Hindi Announcement"
            onPress={() => handleSoundboxTest('hi')}
          />
          <SettingRow icon="widgets" label="Widgets" onPress={() => navigation.navigate('WidgetSettings')} />
        </View>

        <Text style={[s.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>Balance & HDFC</Text>
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SettingRow
            icon="refresh-auto"
            label="Auto Balance Refresh"
            value="Every 6 minutes"
            isSwitch
            switchValue={settings.autoBalanceRefresh !== false}
            onSwitchChange={(val: boolean) => {
              setSettings({ autoBalanceRefresh: val });
              Alert.alert(
                'Auto Balance Refresh',
                val
                  ? 'HDFC balance will refresh every 6 minutes while the app is open.'
                  : 'Background balance refresh is now off.',
              );
            }}
          />
          <SettingRow
            icon="cellphone-arrow-down"
            label="Fetch Balance on App Open"
            isSwitch
            switchValue={settings.autoBalanceOnAppOpen !== false}
            onSwitchChange={(val: boolean) => {
              setSettings({ autoBalanceOnAppOpen: val });
              Alert.alert(
                'Fetch on App Open',
                val
                  ? 'HDFC balance will be fetched when you open the app.'
                  : 'Balance will not be fetched automatically on app open.',
              );
            }}
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
          <SettingRow icon="eye-off-outline" label="Privacy" onPress={() => Alert.alert('Privacy', 'Your data is strictly offline and encrypted. Privacy center coming soon.')} />
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
