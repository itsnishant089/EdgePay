// ─── Network Indicator Component ─────────────────────────────────────
// Shows current connectivity status (Online vs Offline/USSD mode)

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NetworkMode } from '../types';
import { useTheme, spacing, borderRadius, typography } from '../theme';

interface NetworkIndicatorProps {
  mode: NetworkMode;
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({ mode }) => {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Pulse animation for GSM/USSD mode
    if (mode === 'GSM') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [mode, pulseAnim, fadeAnim]);

  const isGsm = mode === 'GSM';
  const isDetecting = mode === 'DETECTING';

  return (
    <Animated.View
      style={[
        styles.container,
        isGsm && { backgroundColor: colors.gsmBackground, borderColor: colors.gsmBorder },
        isDetecting && { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: colors.border },
        { opacity: fadeAnim },
      ]}
    >
      <View style={styles.dotContainer}>
        {isGsm && (
          <Animated.View
            style={[
              styles.pulse,
              { backgroundColor: colors.gsmActive, transform: [{ scale: pulseAnim }] },
            ]}
          />
        )}
        <View
          style={[
            styles.dot,
            isGsm && { backgroundColor: colors.gsmActive },
            isDetecting && { backgroundColor: colors.textTertiary },
            !isGsm && !isDetecting && { backgroundColor: colors.success },
          ]}
        />
      </View>
      
      <View style={styles.textStack}>
        <View style={styles.row}>
          <Icon 
            name={isDetecting ? 'sync' : isGsm ? 'radiobox-marked' : 'wifi-check'} 
            size={12} 
            color={isDetecting ? colors.textTertiary : isGsm ? colors.gsmActive : colors.success} 
          />
          <Text
            style={[
              styles.label,
              { color: isDetecting ? colors.textTertiary : isGsm ? colors.gsmActive : colors.success }
            ]}
          >
            {isDetecting ? 'Detecting...' : isGsm ? 'Offline' : 'Online'}
          </Text>
        </View>
        {isGsm && (
          <Text style={[styles.sublabel, { color: colors.gsmActive }]}>USSD Payment Mode</Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.2)',
    gap: spacing.sm,
  },
  dotContainer: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 2,
  },
  textStack: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    ...typography.labelSmall,
    fontSize: 10,
    fontWeight: '700',
  },
  sublabel: {
    ...typography.caption,
    opacity: 0.8,
    fontSize: 8,
    lineHeight: 8,
    marginTop: 1,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
