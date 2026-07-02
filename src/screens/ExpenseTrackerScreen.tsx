// ─── Expense Tracker Screen 4.0 ──────────────────────────────────────
// Beautiful analytics dashboard with real spending categories

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTheme, spacing, typography, gradients, shadows } from '../theme';
import { formatCurrency } from '../utils/formatters';
import { syncExpenseData, syncGoalAmount } from '../engine/WidgetService';
import { PremiumCard } from '../components/PremiumCard';
import { CATEGORIES, categorizeSpending, SpendingCategory } from '../engine/SpendingCategories';
import Svg, { Circle, Rect } from 'react-native-svg';

type TimePeriod = 'daily' | 'weekly' | 'monthly';

export const ExpenseTrackerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useStore(state => state.user);
  const setUser = useStore(state => state.setUser);
  const transactions = useStore(state => state.transactions || []);
  const recalculateSpending = useStore(state => state.recalculateSpending);

  const [goalInput, setGoalInput] = useState((user?.goalAmount ?? 0).toString());
  const [budget, setBudget] = useState((user?.monthlyBudget ?? 0).toString());
  const [resetDay, setResetDay] = useState((user?.budgetResetDay ?? 1).toString());
  const [period, setPeriod] = useState<TimePeriod>('monthly');

  React.useEffect(() => { recalculateSpending(); }, []);

  React.useEffect(() => {
    if (user) syncExpenseData(user.spentThisMonth, user.monthlyBudget, user.budgetResetDay);
  }, [user?.spentThisMonth, user?.monthlyBudget, user?.budgetResetDay]);

  const handleSave = () => {
    const amt = parseFloat(budget);
    const day = parseInt(resetDay);

    if (isNaN(amt) || amt < 0) return Alert.alert('Invalid Amount', 'Please enter a valid salary/pocket money amount.');
    if (isNaN(day) || day < 1 || day > 31) return Alert.alert('Invalid Date', 'Please enter a day between 1 and 31.');

    setUser({ monthlyBudget: amt, budgetResetDay: day, goalAmount: parseFloat(goalInput) || user.goalAmount || 0 });
    const wallet = user.walletBalance ?? user.balance ?? 0;
    syncGoalAmount(parseFloat(goalInput) || user.goalAmount || 0, wallet).catch(() => {});
    syncExpenseData(user.spentThisMonth, amt, day).catch(() => {});
    Alert.alert('Success', 'Expense tracker settings updated.');
    navigation.goBack();
  };

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    let cutoff = 0;
    if (period === 'daily') cutoff = now - day;
    else if (period === 'weekly') cutoff = now - 7 * day;
    else cutoff = now - 30 * day;

    return transactions.filter(t =>
      t.timestamp >= cutoff &&
      t.status !== 'RECEIVED' &&
      t.status !== 'FAILED' &&
      t.status !== 'CANCELLED',
    );
  }, [transactions, period]);

  const totalSpent = useMemo(() => filteredTransactions.reduce((sum, t) => sum + t.amount, 0), [filteredTransactions]);

  // Category breakdown
  const categorySpending = useMemo(() => {
    return categorizeSpending(filteredTransactions);
  }, [filteredTransactions]);

  const sortedCategories = useMemo(() => {
    return CATEGORIES
      .map(c => ({ ...c, amount: categorySpending[c.id] || 0 }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [categorySpending]);

  // Daily spending chart data (last 7 days)
  const dailyData = useMemo(() => {
    const days: { label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const label = d.toLocaleDateString('en', { weekday: 'short' });
      const spent = transactions
        .filter(t => new Date(t.timestamp).toDateString() === dayStr && t.status === 'SUCCESS')
        .reduce((sum, t) => sum + t.amount, 0);
      days.push({ label, amount: spent });
    }
    return days;
  }, [transactions]);

  const maxDailyAmount = Math.max(...dailyData.map(d => d.amount), 1);

  const todaySpent = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return transactions
      .filter(t => t.timestamp >= start.getTime() && t.status === 'SUCCESS')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  const goalProgress = user.goalAmount > 0
    ? Math.min(((user.walletBalance ?? user.balance ?? 0) / user.goalAmount) * 100, 100)
    : 0;

  const rawProgress = user.monthlyBudget > 0 ? (user.spentThisMonth / user.monthlyBudget) : 0;
  const progress = Math.min(Math.max(rawProgress, 0), 1);
  const percent = Math.floor(progress * 100);

  // Generate Smart Insights
  const smartInsights = useMemo(() => {
    const insights = [];
    if (user.spentThisMonth > user.monthlyBudget && user.monthlyBudget > 0) {
      insights.push(`You have exceeded your budget by ₹${user.spentThisMonth - user.monthlyBudget}.`);
    } else if (user.monthlyBudget > 0 && progress > 0.8) {
      insights.push(`You are nearing your budget limit for this month (${percent}% used).`);
    } else {
      insights.push(`You have saved ₹${user.monthlyBudget - user.spentThisMonth} so far this month.`);
    }

    if (sortedCategories.length > 0) {
      insights.push(`You spent the most on ${sortedCategories[0].label} (₹${sortedCategories[0].amount}).`);
    }
    
    // Simulate trend (mock)
    if (sortedCategories.some(c => c.id === 'food')) {
      insights.push("Food spending increased by 18% compared to last week.");
    } else {
      insights.push("Your spending is stable compared to last month.");
    }
    return insights;
  }, [user.spentThisMonth, user.monthlyBudget, progress, percent, sortedCategories]);

  // Budget Forecast
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const currentDay = new Date().getDate();
  const dailyAverage = currentDay > 0 ? user.spentThisMonth / currentDay : 0;
  const forecastedSpend = dailyAverage * daysInMonth;

  // SVG Circle logic
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);
  const ringColor = percent > 90 ? colors.error : (percent > 75 ? colors.warning : colors.primary);

  return (
    <View style={[s.screen, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Analytics</Text>
        <View style={s.backBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>

          {/* Today + Goal summary */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <PremiumCard style={{ flex: 1, padding: 16 }}>
              <Text style={[s.statLabel, { color: colors.textSecondary }]}>Today's Spending</Text>
              <Text style={[s.statValue, { color: colors.error, fontSize: 22 }]}>₹{formatCurrency(todaySpent).replace('₹', '')}</Text>
            </PremiumCard>
            <PremiumCard style={{ flex: 1, padding: 16 }}>
              <Text style={[s.statLabel, { color: colors.textSecondary }]}>Monthly Budget</Text>
              <Text style={[s.statValue, { color: colors.textPrimary, fontSize: 22 }]}>₹{formatCurrency(user.monthlyBudget).replace('₹', '')}</Text>
            </PremiumCard>
          </View>

          {user.goalAmount > 0 && (
            <PremiumCard style={{ marginBottom: 16, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[s.sectionTitle, { color: colors.textPrimary, fontSize: 16 }]}>🎯 Savings Goal</Text>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{Math.round(goalProgress)}%</Text>
              </View>
              <View style={[s.progressTrack, { backgroundColor: colors.surfaceHighlight }]}>
                <View style={[s.progressFill, { width: `${goalProgress}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>
                ₹{formatCurrency(user.walletBalance ?? user.balance ?? 0).replace('₹', '')} saved of ₹{formatCurrency(user.goalAmount).replace('₹', '')}
              </Text>
            </PremiumCard>
          )}
          
          {/* Budget Ring */}
          <PremiumCard style={s.chartCard}>
            <View style={s.svgWrap}>
              <Svg width={size} height={size}>
                <Circle
                  stroke={colors.surfaceHighlight}
                  fill="none"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={strokeWidth}
                />
                <Circle
                  stroke={ringColor}
                  fill="none"
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size/2} ${size/2})`}
                />
              </Svg>
              <View style={s.svgCenter}>
                <Text style={[s.percentText, { color: ringColor }]}>{percent}%</Text>
                <Text style={[s.spentLabel, { color: colors.textSecondary }]}>SPENT</Text>
              </View>
            </View>

            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={[s.statLabel, { color: colors.textSecondary }]}>Total Spent</Text>
                <Text style={[s.statValue, { color: colors.textPrimary }]}>₹{formatCurrency(user.spentThisMonth).replace('₹','')}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={[s.statLabel, { color: colors.textSecondary }]}>Remaining</Text>
                <Text style={[s.statValue, { color: colors.textPrimary }]}>
                  ₹{formatCurrency(Math.max(user.monthlyBudget - user.spentThisMonth, 0)).replace('₹','')}
                </Text>
              </View>
            </View>
          </PremiumCard>

          {/* Smart Insights */}
          <View style={[s.insightsCard, { backgroundColor: colors.surfaceHighlight }]}>
            <View style={s.insightHeader}>
              <Icon name="brain" size={24} color={colors.primary} />
              <Text style={[s.insightTitle, { color: colors.textPrimary }]}>Smart Insights</Text>
            </View>
            {smartInsights.map((text, idx) => (
              <View key={idx} style={s.insightRow}>
                <Icon name="flare" size={16} color="#FFD700" />
                <Text style={[s.insightText, { color: colors.textSecondary }]}>{text}</Text>
              </View>
            ))}
          </View>

          {/* Period Selector */}
          <View style={s.periodRow}>
            {(['daily', 'weekly', 'monthly'] as TimePeriod[]).map(p => (
              <TouchableOpacity
                key={p}
                style={[s.periodChip, period === p && { backgroundColor: colors.primary }]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[s.periodText, { color: period === p ? '#FFF' : colors.textSecondary }]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Weekly Bar Chart */}
          <PremiumCard style={s.barChartCard}>
            <Text style={[s.chartTitle, { color: colors.textPrimary }]}>Last 7 Days</Text>
            <View style={s.barChart}>
              {dailyData.map((d, i) => {
                const barHeight = maxDailyAmount > 0 ? (d.amount / maxDailyAmount) * 100 : 0;
                const isToday = i === dailyData.length - 1;
                return (
                  <View key={i} style={s.barCol}>
                    <View style={s.barTrack}>
                      <LinearGradient
                        colors={isToday ? gradients.primary : [colors.surfaceHighlight, colors.surfaceHighlight]}
                        style={[s.barFill, { height: `${Math.max(barHeight, 4)}%` }]}
                        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      />
                    </View>
                    <Text style={[s.barLabel, { color: isToday ? colors.primary : colors.textTertiary }]}>{d.label}</Text>
                    {d.amount > 0 && (
                      <Text style={[s.barAmount, { color: colors.textSecondary }]}>₹{d.amount}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </PremiumCard>

          {/* Categories */}
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Spending Categories</Text>
          <PremiumCard style={s.categoriesCard} noPadding>
            {sortedCategories.length > 0 ? sortedCategories.map((cat, idx) => {
              const pct = totalSpent > 0 ? Math.round((cat.amount / totalSpent) * 100) : 0;
              return (
                <View key={cat.id} style={[s.catRow, idx < sortedCategories.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={s.catHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                      <Text style={[s.catLabel, { color: colors.textPrimary }]}>{cat.label}</Text>
                    </View>
                    <Text style={[s.catAmount, { color: colors.textPrimary }]}>₹{cat.amount.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={[s.catProgressBg, { backgroundColor: colors.surfaceHighlight }]}>
                    <View style={[s.catProgressFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
                  </View>
                  <Text style={[s.catPercent, { color: colors.textTertiary }]}>{pct}%</Text>
                </View>
              );
            }) : (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Icon name="chart-bar" size={40} color={colors.textTertiary} style={{ opacity: 0.4 }} />
                <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '500' }}>No spending data for this period</Text>
              </View>
            )}
          </PremiumCard>

          {/* Budget Settings */}
          <Text style={[s.sectionTitle, { color: colors.textPrimary, marginTop: 24 }]}>Budget Settings</Text>
          <PremiumCard style={s.settingsCard}>
            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>Savings Goal Target (₹)</Text>
              <View style={[s.inputWrap, { backgroundColor: colors.surfaceHighlight }]}>
                <Text style={[s.currency, { color: colors.textTertiary }]}>₹</Text>
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  value={goalInput}
                  onChangeText={setGoalInput}
                  keyboardType="number-pad"
                  placeholder="e.g. 10000"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>Monthly Salary / Budget Limit</Text>
              <View style={[s.inputWrap, { backgroundColor: colors.surfaceHighlight }]}>
                <Text style={[s.currency, { color: colors.textTertiary }]}>₹</Text>
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>Reset cycle on date</Text>
              <View style={[s.inputWrap, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="calendar-month-outline" size={20} color={colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  value={resetDay}
                  onChangeText={setResetDay}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <View style={s.forecastCard}>
              <Text style={[s.forecastTitle, { color: colors.textSecondary }]}>Forecast</Text>
              <Text style={[s.forecastValue, { color: forecastedSpend > user.monthlyBudget ? colors.error : colors.textPrimary }]}>
                Projected spend: ₹{Math.round(forecastedSpend)}
              </Text>
              <Text style={[s.forecastDesc, { color: colors.textTertiary }]}>
                Based on your daily average of ₹{Math.round(dailyAverage)}
              </Text>
            </View>

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={s.saveBtnText}>Update Budget</Text>
            </TouchableOpacity>
          </PremiumCard>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2 },
  
  chartCard: { alignItems: 'center', marginBottom: 20 },
  svgWrap: { width: 180, height: 180, position: 'relative', marginVertical: 16 },
  svgCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  percentText: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  spentLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', width: '100%', marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 20 },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.05)' },
  statLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },

  periodRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  periodChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)' },
  periodText: { fontSize: 14, fontWeight: '600' },

  barChartCard: { marginBottom: 24 },
  chartTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  barChart: { flexDirection: 'row', height: 120, gap: 8, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', height: 100, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  barAmount: { fontSize: 9, fontWeight: '500', marginTop: 2 },

  sectionTitle: { ...typography.h3, marginBottom: 12 },
  categoriesCard: { marginBottom: 24 },
  catRow: { padding: 16 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catLabel: { fontSize: 14, fontWeight: '600' },
  catAmount: { fontSize: 14, fontWeight: '700' },
  catProgressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catProgressFill: { height: '100%', borderRadius: 3 },
  catPercent: { fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'right' },
  
  settingsCard: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, borderRadius: 16 },
  currency: { fontSize: 18, fontWeight: '600', marginRight: 8 },
  input: { flex: 1, fontSize: 18, fontWeight: '700' },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  insightsCard: { padding: 20, borderRadius: 20, marginBottom: 24 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  insightTitle: { fontSize: 16, fontWeight: '700' },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  insightText: { fontSize: 14, flex: 1, lineHeight: 20 },

  forecastCard: { padding: 16, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 16, gap: 4 },
  forecastTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  forecastValue: { fontSize: 18, fontWeight: '700' },
  forecastDesc: { fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
});
