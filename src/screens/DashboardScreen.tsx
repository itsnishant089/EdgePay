// ─── Dashboard Screen 3.0 ──────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Image, Animated, AppState
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionList } from '../components/TransactionList';
import { useStore, getDisplayBalance } from '../store/useStore';
import { parseSmsForBalance } from '../engine/BalanceSmsParser';
import { formatCurrency } from '../utils/formatters';
import { translations } from '../utils/i18n';
import { syncGoalAmount, syncHomeWidget, syncBalanceWidget } from '../engine/WidgetService';
import { useTheme, spacing, borderRadius, typography, shadows, gradients } from '../theme';
import { PinScreen, triggerPinError } from '../components/PinScreen';
import { GoalModal } from '../components/GoalModal';
import { hashPin, authenticate, isBiometricAvailable } from '../engine/BiometricService';
import {
  hasNotificationAccess,
  isSmsAvailable,
  onSmsReceived,
  openNotificationAccessSettings,
  readRecentSms,
} from '../engine/SmsService';
import Tts from 'react-native-tts';
import { AvatarCircle } from '../components/AvatarCircle';
import { SmartSearchModal } from '../components/SmartSearchModal';
import { Contact, Transaction, BalanceSource } from '../types';
import { TAB_BAR_HEIGHT, HDFC_BALANCE_REFRESH_MS } from '../utils/constants';
import { normalizePhoneForPayment } from '../utils/phoneUtils';
import { requestHdfcBalanceSms, pollHdfcBalanceSms, handleIncomingBalanceSms, scanInboxForBalance } from '../engine/BalanceService';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();

  const user = useStore(state => state.user);
  const transactions = useStore(state => state.transactions);
  const networkMode = useStore(state => state.networkMode);
  const language = useStore(state => state.language);
  const setUser = useStore(state => state.setUser);
  const settings = useStore(state => state.settings);
  const setSettings = useStore(state => state.setSettings);
  const toggleTheme = useStore(state => state.toggleTheme);
  const setLanguage = useStore(state => state.setLanguage);
  
  const balanceSource = settings.balanceSource || 'WALLET';
  const displayBalance = getDisplayBalance(user, balanceSource);
  
  const [refreshing, setRefreshing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showPinVerify, setShowPinVerify] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updateTick, setUpdateTick] = useState(0);
  
  const contacts = useStore(state => state.contacts || []);
  const favContacts = useMemo(() => contacts.filter((c: Contact) => c.isFavorite), [contacts]);
  
  const t = translations[language] || translations.en;
  const pinHash = useStore(state => state.settings.pinHash);

  useEffect(() => {
    const wallet = user.walletBalance ?? user.balance ?? 0;
    const bank = user.bankBalance ?? 0;
    if (user.goalAmount > 0) {
      syncGoalAmount(user.goalAmount, wallet);
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todaySpent = transactions
      .filter(tx => tx.timestamp >= start.getTime() && tx.status === 'SUCCESS')
      .reduce((sum, tx) => sum + tx.amount, 0);
    syncHomeWidget(wallet, bank).catch(() => {});
    syncBalanceWidget(wallet, bank, todaySpent).catch(() => {});
  }, [user.goalAmount, user.balance, user.walletBalance, user.bankBalance, transactions]);

  useEffect(() => {
    if (!lastUpdated) return;
    const timer = setInterval(() => setUpdateTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  const applyBankBalance = useCallback((bal: number, reveal = false) => {
    setUser({ bankBalance: bal, balance: balanceSource === 'BANK' ? bal : user.walletBalance });
    setLastUpdated(new Date());
    if (reveal) setIsRevealed(true);
  }, [balanceSource, setUser, user.walletBalance]);

  const fetchBalanceManually = useCallback(async (revealAfter = true) => {
    if (balanceSource === 'WALLET') {
      if (revealAfter) {
        setIsRevealed(true);
        setLastUpdated(new Date());
      }
      setRefreshing(false);
      setIsFetchingBalance(false);
      return;
    }

    if (!settings.autoBalanceRefresh && !settings.autoBalanceOnAppOpen) {
      Alert.alert(
        'Balance Fetch Disabled',
        'HDFC balance fetch is turned off. Enable "Auto Balance Refresh" or "Fetch Balance on App Open" in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => navigation.navigate('Account') },
        ],
      );
      setRefreshing(false);
      setIsFetchingBalance(false);
      return;
    }

    setIsFetchingBalance(true);
    setRefreshing(true);

    if (user.bank === 'HDFC') {
      try {
        const missingNotificationAccess = !(await hasNotificationAccess());
        const sent = await requestHdfcBalanceSms({ force: true, reason: 'manual' });
        if (!sent) {
          setIsFetchingBalance(false);
          setRefreshing(false);
          return;
        }
        const sinceMs = Date.now() - 10_000;
        await pollHdfcBalanceSms(
          (bal) => {
            applyBankBalance(bal, revealAfter);
            setRefreshing(false);
            setIsFetchingBalance(false);
          },
          () => {
            setIsFetchingBalance(false);
            setRefreshing(false);
            if (revealAfter && missingNotificationAccess) {
              Alert.alert(
                'Enable RCS Balance Capture',
                'HDFC is replying in Google Messages / RCS chat. Turn on Notification Access once so EdgePay can read that balance reply and update your app balance.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Open Settings',
                    onPress: () => {
                      openNotificationAccessSettings().catch(err => {
                        console.warn('[BalanceFetch] Failed to open notification access:', err);
                      });
                    },
                  },
                ],
              );
            } else if (revealAfter) {
              Alert.alert('Balance Check', 'Waiting for HDFC SMS reply. Pull down to retry in a moment.');
            }
          },
          { sinceMs },
        );
      } catch (err) {
        console.warn('[BalanceFetch] Error sending SMS to HDFC:', err);
        setIsFetchingBalance(false);
        setRefreshing(false);
        Alert.alert('Error', 'Failed to send balance request to HDFC.');
      }
      return;
    }

    if (user.bank === 'SBI') {
      try {
        const messages = await readRecentSms(10);
        let foundBalance = null;
        for (const msg of messages) {
          const cleanSender = msg.sender.toUpperCase();
          if (cleanSender.includes('SBIPSG') || cleanSender.includes('SBI')) {
            const bal = parseSmsForBalance(msg.body);
            if (bal !== null) {
              foundBalance = bal;
              break;
            }
          }
        }

        if (foundBalance !== null) {
          applyBankBalance(foundBalance, revealAfter);
        } else if (revealAfter) {
          Alert.alert('No Message Found', 'Could not find a recent balance message from SBI in your inbox.');
        }
      } catch (err) {
        console.warn('[BalanceFetch] Error reading SMS:', err);
      } finally {
        setIsFetchingBalance(false);
        setRefreshing(false);
      }
    } else {
      try {
        const { dialUssdCode } = require('../engine/USSDService');
        const { buildBalanceCheckCommand } = require('../engine/USSDBuilder');
        await dialUssdCode(buildBalanceCheckCommand());
        Alert.alert('Balance Check', 'Follow the USSD prompts on your screen to view balance.');
      } catch (err) {
        console.warn('USSD Balance Error', err);
        Alert.alert('Error', 'Could not open USSD balance check. Try again from Account Services.');
      } finally {
        setIsFetchingBalance(false);
        setRefreshing(false);
      }
    }
  }, [user.bank, balanceSource, applyBankBalance, settings.autoBalanceRefresh, settings.autoBalanceOnAppOpen, navigation]);

  // When app open fetch completes, pick up balance from inbox
  useEffect(() => {
    if (balanceSource !== 'BANK' || user.bank !== 'HDFC') return;
    let cancelled = false;
    const check = async () => {
      const bal = await scanInboxForBalance(Date.now() - 15 * 60_000);
      if (!cancelled && bal !== null) {
        applyBankBalance(bal, isRevealed);
        setIsFetchingBalance(false);
        setRefreshing(false);
      }
    };
    check();
    const t = setInterval(check, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [balanceSource, user.bank, applyBankBalance, isRevealed]);
  useEffect(() => {
    if (balanceSource !== 'BANK' || user.bank !== 'HDFC' || !isSmsAvailable()) return;
    if (!settings.autoBalanceRefresh) return;

    const refreshInBackground = () => {
      if (AppState.currentState !== 'active') return;
      requestHdfcBalanceSms({ reason: 'auto-refresh' }).catch(() => {});
    };

    const interval = setInterval(refreshInBackground, HDFC_BALANCE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [balanceSource, user.bank, settings.autoBalanceRefresh]);

  useEffect(() => {
    if (!isSmsAvailable()) return;
    const sub = onSmsReceived((sms) => {
      const bal = handleIncomingBalanceSms(sms);
      if (bal !== null && balanceSource === 'BANK') {
        applyBankBalance(bal, isRevealed);
        setIsFetchingBalance(false);
        setRefreshing(false);
      }
    });
    return () => sub.remove();
  }, [balanceSource, applyBankBalance, isRevealed]);

  const handleCheckBalance = async () => {
    const biometricAvailable = await isBiometricAvailable();
    if (biometricAvailable) {
      const success = await authenticate('Verify to view balance');
      if (success) {
        fetchBalanceManually(true);
        return;
      }
      if (pinHash) {
        setShowPinVerify(true);
        return;
      }
    } else if (pinHash) {
      setShowPinVerify(true);
      return;
    }
    fetchBalanceManually(true);
  };

  const announceBalance = useCallback(async () => {
    if (!isRevealed) {
      handleCheckBalance();
      return;
    }
    const rupees = Math.floor(displayBalance);
    const paise = Math.round((displayBalance - rupees) * 100);
    const label = balanceSource === 'WALLET'
      ? 'Edge Wallet balance'
      : `${user.bank || 'Bank'} account balance`;
    let speech = `${label} is ${rupees} rupees`;
    if (paise > 0) speech += ` and ${paise} paise`;
    try {
      await Tts.stop();
      Tts.speak(speech);
    } catch (_) {}
  }, [isRevealed, displayBalance, balanceSource, user.bank, handleCheckBalance]);

  const toggleBalanceSource = () => {
    if (settings.autoSwitchPaymentMode !== false) {
      Alert.alert('Auto-Switch Active', 'Turn off Auto-Switch Wallet / Bank in Settings to toggle manually.');
      return;
    }
    const next: BalanceSource = balanceSource === 'WALLET' ? 'BANK' : 'WALLET';
    setSettings({ balanceSource: next });
    setUser({ balance: getDisplayBalance(user, next) });
    if (next === 'WALLET') {
      setIsRevealed(false);
      setLastUpdated(new Date());
    } else {
      setIsRevealed(false);
      fetchBalanceManually(false);
    }
  };

  const onPinVerified = (pin: string) => {
    if (hashPin(pin) === pinHash) {
      setShowPinVerify(false);
      fetchBalanceManually(true);
    } else {
      triggerPinError('Invalid PIN');
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

  const onRefresh = useCallback(() => {
    if (!isRevealed) {
      handleCheckBalance();
    } else {
      fetchBalanceManually();
    }
  }, [isRevealed, fetchBalanceManually]);

  const recentTxns = useMemo(() => (transactions || []).slice(0, 5), [transactions]);
  const isGsm = networkMode === 'GSM';

  const { spentToday, receivedToday, insight } = useMemo(() => {
    const todayStr = new Date().toDateString();
    let spent = 0;
    let received = 0;
    
    // Simplified category checking for insights
    let maxCategory = 'food';
    let maxCategoryAmount = 0;
    
    (transactions || []).forEach(t => {
      if (new Date(t.timestamp).toDateString() === todayStr) {
        if (t.status === 'RECEIVED') {
          received += t.amount;
        } else if (t.status === 'SUCCESS' || t.status === 'SENT') {
          spent += t.amount;
          if (t.amount > maxCategoryAmount) {
            maxCategoryAmount = t.amount;
            maxCategory = t.receiverName?.toLowerCase().includes('food') ? 'food' : 'shopping';
          }
        }
      }
    });
    
    const insightStr = spent > 0 ? `You've spent ₹${spent} on ${maxCategory} today.` : "No spending today, great job saving!";
    
    return { spentToday: spent, receivedToday: received, insight: insightStr };
  }, [transactions]);

  const dateStr = new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'hi-IN', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={s.headerLeft}>
          <Image source={require('../../assets/EdgePay_Icon.png')} style={s.headerLogo} />
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>EdgePay</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            style={[s.sourceToggle, { backgroundColor: colors.surfaceHighlight, borderColor: colors.borderLight }]}
            onPress={toggleBalanceSource}
          >
            <Icon name={balanceSource === 'WALLET' ? 'wallet-outline' : 'bank-outline'} size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
              {balanceSource === 'WALLET' ? 'WALLET' : 'USSD'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLanguageChange}>
            <Icon name="format-letter-case" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme}>
            <Icon name={theme === 'dark' ? 'weather-sunny' : 'weather-night'} size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('NotificationCenter')}>
            <Icon name="bell-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View style={s.content}>
          {/* Welcome Header */}
          <View style={s.welcomeRow}>
            <View>
              <Text style={[s.dateText, { color: colors.textSecondary }]}>{dateStr}</Text>
              <Text style={[s.welcomeTitle, { color: colors.textPrimary }]}>
                {language === 'en' ? '👋 Hello,' : '👋 नमस्ते,'} {user.name?.split(' ')[0] || 'User'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Account')}>
              <AvatarCircle name={user.name || 'User'} size={44} fontSize={16} />
            </TouchableOpacity>
          </View>

          {/* Visible Search Bar */}
          <TouchableOpacity 
            style={[s.searchBar, { backgroundColor: colors.surfaceHighlight, borderColor: colors.borderLight }]} 
            onPress={() => setShowSearch(true)}
            activeOpacity={0.8}
          >
            <Icon name="magnify" size={22} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, marginLeft: 12, fontSize: 15, fontWeight: '500' }}>Search transactions, contacts...</Text>
          </TouchableOpacity>

          {/* Bank / Wallet Card */}
          <TouchableOpacity activeOpacity={0.95} onPress={() => !isRevealed && handleCheckBalance()}>
            <LinearGradient
              colors={gradients.primary}
              style={[s.bankCard, shadows.cardHover]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={s.cardTop}>
                <View style={s.bankInfo}>
                  <View style={s.bankIconWrap}>
                    <Icon name="bank" size={16} color={colors.primary} />
                  </View>
                  <Text style={s.bankName}>
                    {balanceSource === 'WALLET' ? 'Edge Wallet' : (user.bank || 'Linked Bank')}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: isGsm ? 'rgba(255,59,48,0.2)' : 'rgba(52,199,89,0.2)' }]}>
                  <View style={[s.statusDot, { backgroundColor: isGsm ? '#FF3B30' : '#34C759' }]} />
                  <Text style={[s.statusText, { color: isGsm ? '#FFD4D2' : '#D4F5D6' }]}>
                    {balanceSource === 'WALLET' ? 'WALLET' : (isGsm ? 'OFFLINE' : 'BANK')}
                  </Text>
                </View>
              </View>

              <View style={s.cardMiddle}>
                <Text style={s.balanceLabel}>TOTAL BALANCE</Text>
                <View style={s.balanceRow}>
                  <Text style={s.balanceAmount}>
                    {isFetchingBalance
                      ? 'Fetching...'
                      : (isRevealed
                        ? formatCurrency(displayBalance)
                        : '₹ ••••••')}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    if (isRevealed) setIsRevealed(false);
                    else handleCheckBalance();
                  }} style={s.eyeBtn}>
                    <Icon name={isRevealed ? 'eye-off-outline' : 'eye-outline'} size={24} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.cardBottom}>
                {lastUpdated && isRevealed ? (
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' }}>
                    Updated {Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000))} sec ago{updateTick >= 0 ? '' : ''}
                  </Text>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <TouchableOpacity onPress={announceBalance} style={s.speakerBtn} activeOpacity={0.7}>
                  <Icon name="volume-high" size={24} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Quick Actions Grid */}
          <View style={s.actionsGrid}>
            <ActionBtn icon="qrcode-scan" label="Scan QR" onPress={() => navigation.navigate('QRScan')} themeColors={colors} />
            <ActionBtn icon="account-cash" label="Pay Contact" onPress={() => navigation.navigate('Contacts')} themeColors={colors} />
            <ActionBtn icon="text-box-outline" label="Passbook" onPress={() => navigation.navigate('History')} themeColors={colors} />
            
            <ActionBtn icon="chart-donut" label="Expenses" onPress={() => navigation.navigate('ExpenseTracker')} themeColors={colors} />
            <ActionBtn icon="bank-outline" label="Services" onPress={() => navigation.navigate('Services')} themeColors={colors} />
            <ActionBtn icon="cog-outline" label="Settings" onPress={() => navigation.navigate('Account')} themeColors={colors} />
          </View>

          {/* Budget & Goals (Compact) */}
          <View style={s.budgetSection}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Financial Goals & Insights</Text>
            </View>
            
            <View style={[s.insightCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.borderLight }]}>
               <Icon name="lightbulb-on" size={20} color={colors.warning} style={{marginRight: 12}} />
               <Text style={[s.insightText, { color: colors.textSecondary }]}>{insight}</Text>
            </View>
            
            <View style={s.budgetCardsRow}>
              <View style={[s.budgetCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.borderLight }]}>
                <Text style={[s.budgetLabel, { color: colors.textSecondary }]}>Spent Today</Text>
                <Text style={[s.budgetAmount, { color: colors.error }]}>₹{formatCurrency(spentToday).replace('₹', '')}</Text>
              </View>
              <View style={[s.budgetCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.borderLight }]}>
                <Text style={[s.budgetLabel, { color: colors.textSecondary }]}>Savings Goal</Text>
                <Text style={[s.budgetAmount, { color: colors.primary }]}>₹{formatCurrency(user.goalAmount || 0).replace('₹', '')}</Text>
              </View>
            </View>
          </View>
          
          {/* Favorite Contacts */}
          {favContacts.length > 0 && (
            <View style={s.favContactsSection}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary, marginLeft: 16, marginBottom: 12 }]}>Favorite Contacts</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                {favContacts.map((c: Contact) => (
                  <TouchableOpacity key={c.id} style={s.favContactItem} onPress={() => navigation.navigate('SendMoney', { receiver: normalizePhoneForPayment(c.phone), name: c.name, mode: 'pay' })}>
                    <AvatarCircle name={c.name} photo={c.photo} size={56} />
                    <Text style={[s.favContactName, { color: colors.textPrimary }]} numberOfLines={1}>{c.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Recent Transactions */}
          <View style={s.txnSection}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            </View>
            {recentTxns.length > 0 ? (
              <TransactionList transactions={recentTxns} scrollEnabled={false} />
            ) : (
              <View style={[s.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="receipt-outline" size={40} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '500' }}>No recent transactions</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modals & Overlays */}
      <SmartSearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectContact={(c: Contact) => {
          setShowSearch(false);
          navigation.navigate('ContactProfile', { contact: c });
        }}
        onSelectTransaction={(t: Transaction) => {
          setShowSearch(false);
          // Could navigate to transaction details, for now navigate to history
          navigation.navigate('History');
        }}
      />

      <GoalModal
        visible={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        currentGoal={user.goalAmount}
        onSave={(amt) => setUser({ goalAmount: amt })}
        themeColors={colors}
      />

      <PinScreen
        visible={showPinVerify}
        mode="verify"
        title="Check Balance"
        subtitle="Enter your 4-digit PIN"
        onComplete={onPinVerified}
        onCancel={() => setShowPinVerify(false)}
      />
    </View>
  );
};

const ActionBtn = ({ icon, label, onPress, themeColors }: any) => (
  <TouchableOpacity style={s.actionBtnWrap} activeOpacity={0.7} onPress={onPress}>
    <View style={[s.actionIcon, { backgroundColor: themeColors.surfaceHighlight }]}>
      <Icon name={icon} size={28} color={themeColors.primary} />
    </View>
    <Text style={[s.actionLabel, { color: themeColors.textSecondary }]}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 28, height: 28, borderRadius: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  headerRight: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 28 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  welcomeTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 4 },
  sourceToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  
  bankCard: { borderRadius: 24, padding: 24, elevation: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  bankInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bankIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  bankName: { color: '#FFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  
  cardMiddle: { marginBottom: 30 },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceAmount: { color: '#FFF', fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  eyeBtn: { padding: 8 },
  
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  speakerBtn: { padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  upiId: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', letterSpacing: 1 },
  
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 },
  actionBtnWrap: { width: '22%', alignItems: 'center', gap: 8 },
  actionIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  
  budgetSection: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  budgetCardsRow: { flexDirection: 'row', gap: 12 },
  budgetCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1 },
  budgetLabel: { fontSize: 13, marginBottom: 8 },
  budgetAmount: { fontSize: 20, fontWeight: '700' },
  
  insightCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  insightText: { flex: 1, fontSize: 14, fontWeight: '500' },
  
  favContactsSection: { marginTop: 24 },
  favContactItem: { alignItems: 'center', width: 64 },
  favContactName: { marginTop: 8, fontSize: 13, fontWeight: '500', textAlign: 'center' },
  
  txnSection: { marginTop: 24, paddingHorizontal: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed' },
});
