import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme';

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const { colors } = useTheme();
  
  // Animation Values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Run animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 10,
        useNativeDriver: true,
      })
    ]).start();

    // Navigate after delay
    const timer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, onFinish]);

  return (
    <View style={s.container}>
      <LinearGradient 
        colors={[colors.background, colors.surfaceHighlight]} 
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View 
        style={[
          s.logoContainer, 
          { 
            opacity: fadeAnim, 
            transform: [{ scale: scaleAnim }] 
          }
        ]}
      >
        <View style={s.logoWrap}>
          <Image source={require('../../assets/EdgePay_Icon.png')} style={{ width: 100, height: 100, borderRadius: 32 }} />
        </View>
        <Text style={[s.appName, { color: colors.textPrimary }]}>EdgePay</Text>
        <Text style={[s.slogan, { color: colors.textSecondary }]}>Offline Payments for India</Text>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoContainer: { alignItems: 'center' },
  logoWrap: { width: 100, height: 100, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#007AFF', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 10 }, shadowRadius: 20, elevation: 10 },
  logoText: { color: '#FFF', fontSize: 40, fontWeight: '900', letterSpacing: -2 },
  appName: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 8 },
  slogan: { fontSize: 16, fontWeight: '500', opacity: 0.8 },
});
