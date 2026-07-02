import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { shadows } from '../theme';

interface PremiumCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'soft' | 'card' | 'cardHover';
  noPadding?: boolean;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  style,
  elevation = 'card',
  noPadding = false,
}) => {
  const shadowStyle = shadows[elevation] || shadows.card;

  return (
    <View style={[styles.card, shadowStyle, noPadding && { padding: 0 }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
});
