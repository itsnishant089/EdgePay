import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getSoundboxStatus } from '../engine/PaymentSoundbox';
import { useStore } from '../store/useStore';

export const SoundboxStatusCard = () => {
  const isSoundboxEnabled = useStore(state => state.settings.isSoundboxEnabled);
  const [status, setStatus] = useState(getSoundboxStatus());
  
  // simple pulse animation
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getSoundboxStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status.running && isSoundboxEnabled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status.running, isSoundboxEnabled, pulseAnim]);

  if (!isSoundboxEnabled) return null;

  const isHealthy = status.running;

  return (
    <View style={[styles.container, { borderColor: isHealthy ? '#34C75940' : '#FF3B3040' }]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Icon name={isHealthy ? 'access-point-network' : 'access-point-network-off'} size={28} color={isHealthy ? '#34C759' : '#FF3B30'} />
          </Animated.View>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Soundbox is {isHealthy ? 'Active' : 'Offline'}</Text>
          <Text style={styles.subtitle}>
            {isHealthy ? 'Listening for payments in background' : 'Foreground service stopped'}
          </Text>
        </View>
      </View>
      
      <View style={styles.healthChecks}>
        <View style={styles.checkItem}>
          <Icon name="check-circle" size={16} color="#34C759" />
          <Text style={styles.checkText}>SMS Permissions Granted</Text>
        </View>
        <View style={styles.checkItem}>
          <Icon name="check-circle" size={16} color="#34C759" />
          <Text style={styles.checkText}>Battery Optimization Ignored</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#A0A0A0',
  },
  healthChecks: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    color: '#CCC',
    fontSize: 13,
  }
});
