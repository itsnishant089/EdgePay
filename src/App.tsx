// ─── EdgePay 3.0 Main App ──────────────────────────────────────────────

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  StatusBar, View, Text, StyleSheet, AppState, TouchableOpacity,
  Image, Animated, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { DashboardScreen } from './screens/DashboardScreen';
import { SendMoneyScreen } from './screens/SendMoneyScreen';
import { QRScanScreen } from './screens/QRScanScreen';
import { TransactionHistoryScreen } from './screens/TransactionHistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SetupScreen } from './screens/SetupScreen';
import { LockScreen } from './screens/LockScreen';
import { AccountServicesScreen } from './screens/AccountServicesScreen';
import { UpiPaymentScreen } from './screens/UpiPaymentScreen';
import { ExpenseTrackerScreen } from './screens/ExpenseTrackerScreen';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen';
import { WidgetSettingsScreen } from './screens/WidgetSettingsScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { ContactProfileScreen } from './screens/ContactProfileScreen';
import { SplashScreen } from './screens/SplashScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SecurityCenterScreen } from './screens/SecurityCenterScreen';
import { NotificationCenterScreen } from './screens/NotificationCenterScreen';
import { MerchantDashboardScreen } from './screens/MerchantDashboardScreen';
import { TransactionDetailsScreen } from './screens/TransactionDetailsScreen';
import { MerchantQRScreen } from './screens/MerchantQRScreen';

import { useStore, initializeStore } from './store/useStore';
import { useNetworkMonitor } from './engine/NetworkDetector';
import { useColorScheme } from 'react-native';
import {
  startSmsListener, checkSmsPermissions, isSmsAvailable,
  onSmsReceived,
} from './engine/SmsService';
import { checkUssdPermissions, isUssdAvailable } from './engine/USSDService';
import { requestHdfcBalanceSms, pollHdfcBalanceSms, handleIncomingBalanceSms } from './engine/BalanceService';
import { PaymentManager } from './engine/PaymentManager';
import { startPendingTransactionMonitor } from './engine/PendingTransactionMonitor';
import { startSoundbox, stopSoundbox, updateSoundboxConfig } from './engine/PaymentSoundbox';
import { isWidgetAvailable, startPaymentWidget } from './engine/WidgetService';
import { getAutoBalanceSource } from './utils/paymentMode';
import { translations } from './utils/i18n';
import { LanguageModal } from './components/LanguageModal';
import { useTheme, spacing, shadows } from './theme';


const Tab = createBottomTabNavigator();

// ─── Premium Floating Tab Bar ────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors, theme } = useTheme();
  const language = useStore(s => s.language);
  const t = translations[language] || translations.en;
  const insets = useSafeAreaInsets();

  if (!state?.routes) return null;

  const TAB_MAP: Record<string, { activeIcon: string; inactiveIcon: string; label: string }> = {
    Dashboard: { activeIcon: 'home-variant', inactiveIcon: 'home-variant-outline', label: 'Home' },
    SendMoney: { activeIcon: 'swap-horizontal-bold', inactiveIcon: 'swap-horizontal', label: 'Pay' },
    QRScan: { activeIcon: 'qrcode-scan', inactiveIcon: 'qrcode-scan', label: 'Scan' },
    History: { activeIcon: 'clock', inactiveIcon: 'clock-outline', label: 'Activity' },
    Account: { activeIcon: 'account-circle', inactiveIcon: 'account-circle-outline', label: 'Profile' },
  };

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.tabBarContainer, { backgroundColor: colors.surface }, shadows.card]}>
        {(state?.routes || []).map((route: any, index: number) => {
          const isFocused = state.index === index;
          const config = TAB_MAP[route.name];
          if (!config) return null;

          const isCenter = route.name === 'QRScan';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              if (route.name === 'SendMoney') {
                navigation.navigate('SendMoney', { mode: 'pay' });
              } else {
                navigation.navigate(route.name);
              }
            }
          };

          if (isCenter) {
            return (
              <TouchableOpacity key={route.key} onPress={onPress} style={styles.centerBtnWrap} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#007AFF', '#5856D6']}
                  style={[styles.centerBtn, shadows.button]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Icon name="qrcode-scan" size={26} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.tabItem} activeOpacity={0.7}>
              <Icon name={isFocused ? config.activeIcon : config.inactiveIcon} size={22} color={isFocused ? colors.primary : colors.textTertiary} />
              <Text style={[styles.tabLabel, { color: isFocused ? colors.primary : colors.textTertiary }]}>{config.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── App Content ─────────────────────────────────────────────────────
function AppContent() {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();

  const isOnboarded = useStore(state => state.user.isOnboarded);
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const language = useStore(state => state.language);
  const isMerchantMode = useStore(state => state.user.isMerchantMode);

  const setNetworkMode = useStore(state => state.setNetworkMode);
  const networkMode = useStore(state => state.networkMode);
  const setSmsPermissions = useStore(state => state.setSmsPermissions);
  const setUssdPermissions = useStore(state => state.setUssdPermissions);

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initializeStore().catch(console.error);
  }, []);

  useNetworkMonitor(setNetworkMode);

  const autoSwitchPaymentMode = useStore(state => state.settings.autoSwitchPaymentMode);
  const setSettings = useStore(state => state.setSettings);

  // Auto-switch wallet (online) ↔ bank/USSD (offline) for balance display
  useEffect(() => {
    if (autoSwitchPaymentMode === false) return;
    const source = getAutoBalanceSource(networkMode);
    const current = useStore.getState().settings.balanceSource;
    if (current !== source) {
      setSettings({ balanceSource: source });
    }
  }, [networkMode, autoSwitchPaymentMode, setSettings]);

  // Read soundbox settings from store
  const soundboxEnabled = useStore(state => state.settings.isSoundboxEnabled);
  const soundboxLanguage = useStore(state => state.settings.soundboxLanguage);

  useEffect(() => {
    if (!isOnboarded) return;
    let mounted = true;

    const init = async () => {
      if (!mounted) return;
      if (isSmsAvailable()) {
        const smsPerms = await checkSmsPermissions();
        setSmsPermissions(smsPerms);
        if (smsPerms.receive) {
          await startSmsListener();
          await startSoundbox({
            enabled: soundboxEnabled ?? true,
            language: soundboxLanguage || (language as any),
            announceCredits: true,
            announceDebits: false,
            speechRate: 0.5,
          });

          if (isWidgetAvailable()) {
            const widgetEnabled = useStore.getState().settings.isWidgetEnabled;
            if (widgetEnabled !== false) {
              startPaymentWidget({
                language: soundboxLanguage || (language as any),
                announceCredits: true,
                announceDebits: false,
              }).catch(console.warn);
            }
          }
        }
      }
      if (isUssdAvailable()) {
        const ussdPerms = await checkUssdPermissions();
        setUssdPermissions(ussdPerms);
      }
      
      useStore.getState().checkAndResetBudget();
      useStore.getState().recalculateSpending();
      PaymentManager.healthCheck().catch(console.warn);
    };
    init();

    return () => {
      mounted = false;
      stopSoundbox();
    };
  }, [isOnboarded, setSmsPermissions, setUssdPermissions]);

  // Keep soundbox config in sync with settings changes
  useEffect(() => {
    updateSoundboxConfig({
      enabled: soundboxEnabled ?? true,
      language: soundboxLanguage || 'en',
    });
  }, [soundboxEnabled, soundboxLanguage]);

  // Auto-fetch HDFC bank balance on app open (if enabled in settings)
  useEffect(() => {
    if (!isOnboarded || !isAuthenticated) return;
    const { user, settings, setUser } = useStore.getState();
    if (!settings.autoBalanceOnAppOpen) return;
    if (settings.balanceSource !== 'BANK' || user.bank !== 'HDFC' || !isSmsAvailable()) return;

    let cleanupPoll: (() => void) | undefined;
    (async () => {
      try {
        const smsPerms = await checkSmsPermissions();
        if (!smsPerms.send || !smsPerms.receive) return;
        const sent = await requestHdfcBalanceSms({ reason: 'app-open' });
        if (!sent) return;
        const sinceMs = Date.now() - 10_000;
        cleanupPoll = await pollHdfcBalanceSms((bal) => {
          setUser({
            bankBalance: bal,
            balance: settings.balanceSource === 'BANK' ? bal : user.walletBalance,
          });
        }, undefined, { sinceMs });
      } catch (err) {
        console.warn('[App] HDFC balance auto-fetch failed:', err);
      }
    })();

    return () => cleanupPoll?.();
  }, [isOnboarded, isAuthenticated]);

  useEffect(() => {
    if (!isOnboarded || !isAuthenticated) return;
    return startPendingTransactionMonitor();
  }, [isOnboarded, isAuthenticated]);

  // Listen for incoming balance/payment SMS globally
  useEffect(() => {
    if (!isOnboarded || !isSmsAvailable()) return;
    const sub = onSmsReceived((sms) => {
      const bal = handleIncomingBalanceSms(sms);
      if (bal === null) return;
      const { settings, setUser } = useStore.getState();
      if (settings.balanceSource === 'BANK') {
        setUser({ bankBalance: bal, balance: bal });
      }
    });
    return () => sub.remove();
  }, [isOnboarded]);

  // Navigation Theme
  const navTheme = useMemo(() => ({
    dark: theme === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.primary,
    },
    fonts: DefaultTheme.fonts,
  }), [theme, colors]);

  if (showSplash) return <SplashScreen onFinish={() => setShowSplash(false)} />;
  if (!isOnboarded) return <SetupScreen />;
  if (!isAuthenticated) return <LockScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

        <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
          <Tab.Screen name="Dashboard" component={isMerchantMode ? MerchantDashboardScreen : DashboardScreen} />
          <Tab.Screen name="SendMoney" component={SendMoneyScreen} />
          <Tab.Screen name="QRScan" component={QRScanScreen} />
          <Tab.Screen name="History" component={TransactionHistoryScreen} />
          <Tab.Screen name="Account" component={SettingsScreen} />
          <Tab.Screen name="Services" component={AccountServicesScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="UpiPayment" component={UpiPaymentScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="WidgetSettings" component={WidgetSettingsScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="Contacts" component={ContactsScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="ContactProfile" component={ContactProfileScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="SecurityCenter" component={SecurityCenterScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="NotificationCenter" component={NotificationCenterScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="MerchantDashboard" component={MerchantDashboardScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="MerchantQR" component={MerchantQRScreen} options={{ tabBarButton: () => null }} />
          <Tab.Screen name="TransactionDetails" component={TransactionDetailsScreen} options={{ tabBarButton: () => null }} />
        </Tab.Navigator>
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  const theme = useStore(state => state.theme);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
  },
  tabBarContainer: {
    flexDirection: 'row', alignItems: 'center', height: 64,
    borderRadius: 24, paddingHorizontal: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  centerBtnWrap: { top: -18, marginHorizontal: 4 },
  centerBtn: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
});
