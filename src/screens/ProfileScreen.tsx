import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, typography, spacing } from '../theme';
import { testSoundboxAnnouncement, updateSoundboxConfig, stopSoundboxAnnouncement, isSoundboxSpeaking } from '../engine/PaymentSoundbox';
import { useStore } from '../store/useStore';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatCurrency } from '../utils/formatters';

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useStore(state => state.user);
  
  const isMerchantMode = user.isMerchantMode || false;
  const setUser = useStore(state => state.setUser);
  const setSettings = useStore(state => state.setSettings);
  const tapCount = React.useRef(0);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeLang, setActiveLang] = React.useState<'en' | 'hi' | null>(null);

  React.useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const toggleTestAnnouncement = (lang: 'en' | 'hi') => {
    if (activeLang === lang || isSoundboxSpeaking()) {
      stopSoundboxAnnouncement();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setActiveLang(null);
      return;
    }

    stopSoundboxAnnouncement();
    setSettings({ soundboxLanguage: lang, isSoundboxEnabled: true });
    updateSoundboxConfig({ language: lang, enabled: true });
    setActiveLang(lang);
    testSoundboxAnnouncement(lang, 500);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!isSoundboxSpeaking()) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setActiveLang(null);
      }
    }, 250);
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        <View style={s.avatarContainer}>
          <AvatarCircle name={user.name || 'User'} size={120} fontSize={40} />
          <Text style={[s.userName, { color: colors.textPrimary }]}>{user.name}</Text>
          <Text style={[s.userPhone, { color: colors.textSecondary }]}>{user.phone}</Text>
        </View>

        <View style={s.statsGrid}>
          <View style={[s.statCard, { backgroundColor: colors.surfaceHighlight }]}>
            <Icon name="arrow-down-bold" size={24} color={colors.success} style={{ marginBottom: 8 }} />
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Total Received</Text>
            <Text style={[s.statValue, { color: colors.textPrimary }]}>{formatCurrency(user.walletBalance ?? user.balance)}</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.surfaceHighlight }]}>
            <Icon name="arrow-up-bold" size={24} color={colors.error} style={{ marginBottom: 8 }} />
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Total Spent</Text>
            <Text style={[s.statValue, { color: colors.textPrimary }]}>{formatCurrency(user.spentThisMonth)}</Text>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: colors.surfaceHighlight }]}>
          <View style={s.sectionHeader}>
            <Icon name="volume-high" size={24} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Test Announcement</Text>
          </View>
          <Text style={[s.sectionDesc, { color: colors.textSecondary, marginBottom: 12 }]}>
            Tap to speak a sample credit alert. Tap again to stop instantly. Tap again to restart from the beginning.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={[s.testBtn, {
                backgroundColor: activeLang === 'en' ? colors.primary : colors.primaryLight,
                borderColor: colors.primary,
              }]}
              onPress={() => toggleTestAnnouncement('en')}
            >
              <Text style={{ color: activeLang === 'en' ? '#FFF' : colors.primary, fontWeight: '700' }}>
                {activeLang === 'en' ? 'Stop English' : 'English'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.testBtn, {
                backgroundColor: activeLang === 'hi' ? colors.primary : colors.primaryLight,
                borderColor: colors.primary,
              }]}
              onPress={() => toggleTestAnnouncement('hi')}
            >
              <Text style={{ color: activeLang === 'hi' ? '#FFF' : colors.primary, fontWeight: '700' }}>
                {activeLang === 'hi' ? 'Stop Hindi' : 'Hindi'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: colors.surfaceHighlight }]}>
          <View style={s.sectionHeader}>
            <Icon name="storefront" size={24} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Merchant Mode</Text>
            <Switch
              value={isMerchantMode}
              onValueChange={(val) => setUser({ isMerchantMode: val })}
              trackColor={{ false: colors.borderLight, true: colors.primary }}
            />
          </View>
          <Text style={[s.sectionDesc, { color: colors.textSecondary }]}>
            Enable this to switch your dashboard to Merchant view, tailored for accepting payments and managing a shop.
          </Text>
        </View>

        <Text style={[s.achievementsTitle, { color: colors.textPrimary }]}>Achievements</Text>
        <View style={[s.achievementCard, { backgroundColor: colors.surfaceHighlight }]}>
          <View style={[s.achievementIconWrap, { backgroundColor: 'rgba(255, 215, 0, 0.1)' }]}>
            <Icon name="star-circle" size={32} color="#FFD700" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.achievementName, { color: colors.textPrimary }]}>Early Adopter</Text>
            <Text style={[s.achievementDesc, { color: colors.textSecondary }]}>Joined EdgePay 4.0 Beta</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={{ marginTop: 40, alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => {
            tapCount.current += 1;
            if (tapCount.current >= 7) {
              tapCount.current = 0;
              navigation.navigate('Diagnostics');
            }
          }}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600' }}>EdgePay Core v4.0.0</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 4 }}>Build 2409</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3 },
  
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  userName: { ...typography.h2, marginTop: 16 },
  userPhone: { fontSize: 16, marginTop: 4, fontWeight: '500' },
  upiBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 12, gap: 4 },
  upiText: { fontSize: 14, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  statCard: { flex: 1, padding: 16, borderRadius: 20, alignItems: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },

  section: { padding: 20, borderRadius: 20, marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  sectionDesc: { fontSize: 14, lineHeight: 20 },
  testBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },

  achievementsTitle: { ...typography.h3, marginBottom: 16 },
  achievementCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, gap: 16 },
  achievementIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  achievementName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  achievementDesc: { fontSize: 14 },
});
