import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

const AMOUNTS = [100, 200, 500, 1000, 2000];

interface QuickAmountChipsProps {
  onSelect: (amount: number) => void;
  selected?: number;
}

export const QuickAmountChips: React.FC<QuickAmountChipsProps> = ({ onSelect, selected }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {AMOUNTS.map(amt => {
        const isSelected = selected === amt;
        return (
          <TouchableOpacity
            key={amt}
            style={[
              styles.chip,
              { backgroundColor: isSelected ? colors.primary : colors.surfaceHighlight, borderColor: isSelected ? colors.primary : colors.border },
            ]}
            onPress={() => onSelect(amt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: isSelected ? '#FFF' : colors.textSecondary }]}>
              ₹{amt.toLocaleString('en-IN')}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
