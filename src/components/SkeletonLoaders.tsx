import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme, borderRadius } from '../theme';

const { width } = Dimensions.get('window');

export const SkeletonBox: React.FC<{ width?: number | string, height?: number | string, style?: any, rounded?: boolean }> = ({ 
  width = '100%', 
  height = 20, 
  style, 
  rounded = true 
}) => {
  const { colors } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [opacityAnim]);

  return (
    <Animated.View 
      style={[
        { 
          width, 
          height, 
          backgroundColor: colors.borderLight, 
          borderRadius: rounded ? borderRadius.md : 0,
          opacity: opacityAnim 
        }, 
        style
      ]} 
    />
  );
};

export const SkeletonTransactionList: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={s.txnRow}>
          <SkeletonBox width={48} height={48} rounded style={{ borderRadius: 24 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox width="60%" height={16} />
            <SkeletonBox width="30%" height={12} />
          </View>
          <SkeletonBox width="20%" height={18} />
        </View>
      ))}
    </View>
  );
};

export const SkeletonDashboardHero: React.FC = () => {
  return (
    <View style={s.heroCard}>
      <SkeletonBox width="40%" height={14} style={{ marginBottom: 12 }} />
      <SkeletonBox width="70%" height={48} style={{ marginBottom: 24 }} />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <SkeletonBox width="30%" height={32} style={{ borderRadius: 16 }} />
        <SkeletonBox width="30%" height={32} style={{ borderRadius: 16 }} />
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  txnRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 16, gap: 16 },
  heroCard: { padding: 24, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.02)', marginBottom: 24 },
});
