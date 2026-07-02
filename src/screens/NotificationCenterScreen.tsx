import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, typography } from '../theme';
import { useStore } from '../store/useStore';

export const NotificationCenterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const notifications = useStore(state => state.notifications || []);
  const markAllNotificationsRead = useStore(state => state.markAllNotificationsRead);

  const getIconForType = (type: string) => {
    switch(type) {
      case 'PAYMENT': return { name: 'currency-inr', color: colors.success };
      case 'ALERT': return { name: 'alert-circle', color: colors.error };
      case 'REMINDER': return { name: 'calendar-clock', color: '#FF9F0A' };
      case 'GOAL': return { name: 'bullseye-arrow', color: colors.primary };
      case 'ANNOUNCEMENT': return { name: 'bullhorn', color: '#5AC8FA' };
      default: return { name: 'bell', color: colors.textSecondary };
    }
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        </View>
        <TouchableOpacity onPress={markAllNotificationsRead}>
          <Icon name="check-all" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {notifications.length === 0 ? (
          <View style={s.emptyState}>
            <Icon name="bell-sleep" size={64} color={colors.borderLight} />
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>All caught up!</Text>
            <Text style={[s.emptyDesc, { color: colors.textSecondary }]}>You don't have any new notifications right now.</Text>
          </View>
        ) : (
          notifications.map(notif => {
            const { name, color } = getIconForType(notif.type);
            const date = new Date(notif.timestamp);
            
            return (
              <TouchableOpacity 
                key={notif.id} 
                style={[s.notifCard, { backgroundColor: notif.isRead ? colors.surface : colors.primary + '10' }]}
                activeOpacity={0.7}
              >
                <View style={[s.iconWrap, { backgroundColor: color + '15' }]}>
                  <Icon name={name} size={24} color={color} />
                </View>
                <View style={s.contentWrap}>
                  <Text style={[s.title, { color: colors.textPrimary }]}>{notif.title}</Text>
                  <Text style={[s.message, { color: colors.textSecondary }]} numberOfLines={2}>{notif.message}</Text>
                  <Text style={[s.time, { color: colors.textTertiary }]}>{date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                {!notif.isRead && <View style={[s.unreadDot, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, marginLeft: 8 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 15, textAlign: 'center' },

  notifCard: { flexDirection: 'row', padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center' },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  contentWrap: { flex: 1, marginRight: 8 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  time: { fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
