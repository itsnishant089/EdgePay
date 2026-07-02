// ─── Amount Input Component ──────────────────────────────────────────

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TextInput, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme, spacing, borderRadius, typography } from '../theme';

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  currency?: string;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
  returnKeyType?: TextInput['props']['returnKeyType'];
  onSubmitEditing?: () => void;
}

export const AmountInput = forwardRef<TextInput, AmountInputProps>(({
  value,
  onChangeText,
  currency = '₹',
  placeholder = '0',
  autoFocus = false,
  editable = true,
  returnKeyType = 'done',
  onSubmitEditing,
}, ref) => {
  const inputRef = useRef<TextInput>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isFocused, setIsFocused] = useState(false);
  const { colors } = useTheme();

  // Expose the inner TextInput ref to the parent
  useImperativeHandle(ref, () => inputRef.current as TextInput);

  useEffect(() => {
    if (value) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [value, scaleAnim]);

  const handleChange = (text: string) => {
    // Only allow numbers and decimal
    const cleaned = text.replace(/[^0-9.]/g, '');
    // Prevent more than one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) return;
    onChangeText(cleaned);
  };

  return (
    <View style={[styles.outerContainer, { borderColor: isFocused ? colors.primary : colors.border }]}>
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: colors.surfaceElevated, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Text style={[styles.currency, { color: colors.textTertiary }]}>{currency}</Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.textPrimary }]}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={colors.primary}
          accessibilityLabel="Amount input"
          maxLength={10}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  currency: {
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 42,
    fontWeight: '700',
    padding: 0,
    lineHeight: 50,
    letterSpacing: -1,
  },
});
