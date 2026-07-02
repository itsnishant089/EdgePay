// ─── Lock Screen 3.0 ───────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { authenticate, isBiometricAvailable } from '../engine/BiometricService';
import { useTheme } from '../theme';
import { hashPin } from '../engine/BiometricService';

export const LockScreen: React.FC = () => {
  const { colors } = useTheme();
  const setAuthenticated = useStore(state => state.setAuthenticated);
  const settings = useStore(state => state.settings);
  const user = useStore(state => state.user);

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (settings.isBiometricEnabled) {
      handleBiometric();
    }
  }, []);

  const handleBiometric = async () => {
    const available = await isBiometricAvailable();
    if (available) {
      const success = await authenticate('Unlock EdgePay');
      if (success) setAuthenticated(true);
    }
  };

  const handleKeyPress = (key: string) => {
    if (error) setError(false);
    
    if (key === 'del') {
      setPin(prev => prev.slice(0, -1));
    } else if (pin.length < 4) {
      const newPin = pin + key;
      setPin(newPin);
      
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const verifyPin = (currentPin: string) => {
    if (hashPin(currentPin) === settings.pinHash) {
      setAuthenticated(true);
    } else {
      setError(true);
      setTimeout(() => setPin(''), 1000);
    }
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <Image source={require('../../assets/EdgePay_Icon.png')} style={s.logo} />
        <Text style={[s.title, { color: colors.textPrimary }]}>Welcome back,</Text>
        <Text style={[s.name, { color: colors.textPrimary }]}>{user.name?.split(' ')[0]}</Text>
      </View>

      <View style={s.dotsContainer}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              s.dot,
              { 
                backgroundColor: pin.length > i ? colors.primary : colors.surfaceHighlight,
                borderColor: error ? colors.error : 'transparent',
                borderWidth: error ? 2 : 0
              }
            ]}
          />
        ))}
      </View>

      {error && <Text style={[s.errorText, { color: colors.error }]}>Incorrect PIN</Text>}

      <View style={s.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, i) => (
          <View key={i} style={s.row}>
            {row.map(key => (
              <TouchableOpacity
                key={key}
                style={[s.key, { backgroundColor: colors.surfaceHighlight }]}
                onPress={() => handleKeyPress(key)}
              >
                <Text style={[s.keyText, { color: colors.textPrimary }]}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={s.row}>
          <TouchableOpacity
            style={s.key}
            onPress={handleBiometric}
            disabled={!settings.isBiometricEnabled}
          >
            {settings.isBiometricEnabled && <Icon name="fingerprint" size={32} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.key, { backgroundColor: colors.surfaceHighlight }]}
            onPress={() => handleKeyPress('0')}
          >
            <Text style={[s.keyText, { color: colors.textPrimary }]}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.key}
            onPress={() => handleKeyPress('del')}
          >
            <Icon name="backspace-outline" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 64, height: 64, borderRadius: 16, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: '500', marginBottom: 4 },
  name: { fontSize: 32, fontWeight: '800' },
  dotsContainer: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  errorText: { fontSize: 14, fontWeight: '600', marginBottom: 20 },
  keypad: { width: '100%', maxWidth: 320, gap: 16, marginTop: 40 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  key: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 28, fontWeight: '600' },
});
