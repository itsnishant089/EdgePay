// ─── QR Scan Screen 3.0 ──────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, Dimensions, Platform, AppState
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import {
  Camera, useCameraDevice, useCameraPermission, useCodeScanner,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import RNQRGenerator from 'rn-qr-generator';
import LinearGradient from 'react-native-linear-gradient';
import { parseUPIQR, validateQRData, getReceiverFromQR } from '../utils/qrParser';
import { useStore } from '../store/useStore';
import { translations } from '../utils/i18n';
import { useTheme, spacing } from '../theme';
import type { QRPaymentData } from '../types';

const { width, height } = Dimensions.get('window');
const SCANNER_SIZE = width * 0.75;

export const QRScanScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { language } = useStore();
  const t = translations[language] || translations.en;
  
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const scanLock = useRef(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  
  const isFocused = useIsFocused();
  
  // Track App State
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && isFocused) {
        setIsCameraActive(true);
      } else {
        setIsCameraActive(false);
      }
    });
    return () => subscription.remove();
  }, [isFocused]);

  useEffect(() => {
    setIsCameraActive(isFocused);
    if (isFocused) {
      scanLock.current = false;
    }
  }, [isFocused]);

  useFocusEffect(
    useCallback(() => {
      scanLock.current = false;
      setIsCameraActive(true);
    }, []),
  );

  useEffect(() => { if (!hasPermission) requestPermission(); }, [hasPermission]);

  useEffect(() => {
    if (!isFocused) {
      scanLineAnim.stopAnimation();
      return;
    }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(scanLineAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
      Animated.timing(scanLineAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [isFocused]);

  const processQRValue = useCallback((qrValue: string) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setIsCameraActive(false);

    const parsed = parseUPIQR(qrValue);
    const validation = validateQRData(parsed);
    if (validation.valid && parsed) {
      const { receiver, name } = getReceiverFromQR(parsed);
      navigation.navigate('SendMoney', {
        receiver,
        name: parsed.name || name,
        amount: parsed.amount,
        note: parsed.note,
        mode: 'pay',
      });
    } else {
      scanLock.current = false;
      setIsCameraActive(true);
      Alert.alert('Invalid QR', validation.error || 'Could not parse UPI data from image');
    }
  }, [navigation]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback((codes) => {
      if (scanLock.current || !isCameraActive) return;
      if (codes.length > 0 && codes[0].value) {
        processQRValue(codes[0].value);
      }
    }, [isCameraActive, processQRValue]),
  });

  const handleGalleryUpload = async () => {
    try {
      setIsCameraActive(false);
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
        copyTo: 'cachesDirectory',
        includeBase64: true,
      });
      const asset = result.assets?.[0];
      if (!asset) {
        setIsCameraActive(true);
        return;
      }

      const rawUri = asset.fileCopyUri || asset.uri;
      if (!rawUri) {
        setIsCameraActive(true);
        return;
      }

      const uriCandidates = [
        rawUri,
        rawUri.startsWith('file://') ? rawUri : `file://${rawUri}`,
        rawUri.replace(/^file:\/\//, ''),
      ];

      let decodedValue: string | null = null;
      if (asset.base64) {
        try {
          const decoded = await RNQRGenerator.detect({ base64: asset.base64 });
          if (decoded.values?.length) decodedValue = decoded.values[0];
        } catch (_) {}
      }
      if (!decodedValue) {
        for (const uri of uriCandidates) {
          try {
            const decoded = await RNQRGenerator.detect({ uri });
            if (decoded.values?.length) {
              decodedValue = decoded.values[0];
              break;
            }
          } catch (_) {}
        }
      }

      if (decodedValue) {
        processQRValue(decodedValue);
      } else {
        setIsCameraActive(true);
        scanLock.current = false;
        Alert.alert('No QR Code Found', 'Please select a clear UPI QR code image.');
      }
    } catch (e) {
      console.error(e);
      setIsCameraActive(true);
      scanLock.current = false;
      Alert.alert('Error', 'Failed to read image. Try another photo.');
    }
  };

  if (!device || !hasPermission) {
    return (
      <View style={[s.screen, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
        <Icon name="camera-off" size={48} color="#FFF" style={{ opacity: 0.5, marginBottom: 16 }} />
        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Camera permission required</Text>
        <TouchableOpacity style={{ marginTop: 20, padding: 12, backgroundColor: colors.primary, borderRadius: 8 }} onPress={requestPermission}>
          <Text style={{ color: '#FFF', fontWeight: '700' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCANNER_SIZE - 4]
  });

  return (
    <View style={s.screen}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isCameraActive}
        codeScanner={codeScanner}
        torch={torchOn ? 'on' : 'off'}
      />

      {/* Overlay to dim surroundings */}
      <View style={s.overlay}>
        <View style={s.overlayTop} />
        <View style={s.overlayMiddleRow}>
          <View style={s.overlaySide} />
          <View style={s.scannerCutout}>
            {/* Animated Scan Line */}
            <Animated.View style={[s.scanLine, { transform: [{ translateY }] }]}>
              <LinearGradient colors={['rgba(0,122,255,0)', 'rgba(0,122,255,0.8)', 'rgba(0,122,255,0)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            </Animated.View>
            {/* Corner Markers */}
            <View style={[s.corner, s.topLeft]} />
            <View style={[s.corner, s.topRight]} />
            <View style={[s.corner, s.bottomLeft]} />
            <View style={[s.corner, s.bottomRight]} />
          </View>
          <View style={s.overlaySide} />
        </View>
        <View style={s.overlayBottom} />
      </View>

      {/* Header controls */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={s.titleBadge}>
          <Text style={s.titleText}>Scan any QR to Pay</Text>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={() => setTorchOn(!torchOn)}>
          <Icon name={torchOn ? 'flash' : 'flash-off'} size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <TouchableOpacity style={s.galleryBtn} onPress={handleGalleryUpload} activeOpacity={0.85}>
          <LinearGradient colors={['#007AFF', '#5856D6']} style={s.galleryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Icon name="image-multiple" size={22} color="#FFF" />
            <Text style={s.galleryText}>Upload from Gallery</Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={s.footerRow}>
          <TouchableOpacity style={s.footerBtn} onPress={() => { setIsCameraActive(false); navigation.navigate('SendMoney'); }}>
            <View style={s.footerIconWrap}>
              <Icon name="keyboard" size={24} color="#FFF" />
            </View>
            <Text style={s.footerText}>Enter UPI ID / Mobile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddleRow: { flexDirection: 'row', height: SCANNER_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scannerCutout: { width: SCANNER_SIZE, height: SCANNER_SIZE, backgroundColor: 'transparent' },
  
  scanLine: { width: '100%', height: 4, backgroundColor: '#007AFF', shadowColor: '#007AFF', shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#FFF', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 24 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 24 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 24 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 24 },
  
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  titleBadge: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  titleText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', paddingTop: 16, paddingHorizontal: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12 },
  galleryBtn: { borderRadius: 16, overflow: 'hidden' },
  galleryGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  galleryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'center' },
  footerBtn: { alignItems: 'center', gap: 8 },
  footerIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  footerText: { color: '#FFF', fontSize: 12, fontWeight: '500' },
});
