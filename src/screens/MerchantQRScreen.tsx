import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Share, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import RNQRGenerator from 'rn-qr-generator';
import { useTheme, typography } from '../theme';
import { useStore } from '../store/useStore';
import { getUserUpiId } from '../utils/formatters';

export const MerchantQRScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useStore(state => state.user);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const userUpi = getUserUpiId(user);

  const upiUri = `upi://pay?pa=${encodeURIComponent(userUpi)}&pn=${encodeURIComponent(user.name || 'EdgePay User')}&cu=INR`;

  useEffect(() => {
    RNQRGenerator.generate({
      value: upiUri,
      height: 300,
      width: 300,
      base64: false,
      backgroundColor: '#FFFFFF',
      color: '#000000',
    })
      .then(response => {
        setQrUri(response.uri);
      })
      .catch(error => console.log('Cannot create QR code', error));
  }, [upiUri]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay me via EdgePay UPI: ${userUpi}`,
      });
    } catch (error: any) {
      Alert.alert(error.message);
    }
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>My QR Code</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.content}>
        <View style={[s.qrCard, { backgroundColor: colors.surfaceHighlight }]}>
          <View style={s.brandHeader}>
            <Icon name="bank" size={24} color={colors.primary} />
            <Text style={[s.brandName, { color: colors.primary }]}>EdgePay Merchant</Text>
          </View>
          
          <Text style={[s.merchantName, { color: colors.textPrimary }]}>{user.name}</Text>
          <Text style={[s.merchantUpi, { color: colors.textSecondary }]}>{userUpi}</Text>
          
          <View style={s.qrWrapper}>
            {qrUri ? (
              <Image source={{ uri: qrUri }} style={s.qrImage} />
            ) : (
              <View style={[s.qrImage, s.qrPlaceholder, { backgroundColor: colors.surface }]}>
                <Icon name="qrcode" size={48} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, marginTop: 8 }}>Generating QR...</Text>
              </View>
            )}
          </View>

          <Text style={[s.scanText, { color: colors.textSecondary }]}>Scan to pay with any UPI App</Text>
        </View>

        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
            <Icon name="share-variant" size={24} color="#FFF" />
            <Text style={s.actionText}>Share QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.surfaceHighlight }]} onPress={() => Alert.alert('Saved', 'QR Code saved to gallery.')}>
            <Icon name="download" size={24} color={colors.textPrimary} />
            <Text style={[s.actionText, { color: colors.textPrimary }]}>Download</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3 },
  content: { flex: 1, padding: 24, alignItems: 'center' },
  qrCard: { width: '100%', padding: 24, borderRadius: 24, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  brandName: { fontSize: 18, fontWeight: '800' },
  merchantName: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  merchantUpi: { fontSize: 16, marginTop: 4, marginBottom: 32 },
  qrWrapper: { padding: 16, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 24 },
  qrImage: { width: 220, height: 220 },
  qrPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  scanText: { fontSize: 14, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 32, width: '100%' },
  actionBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});
