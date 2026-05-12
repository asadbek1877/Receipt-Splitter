// app/tabs/scan-receipt.tsx — Receipt scanner with zoom, flashlight & improved design
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, StyleSheet, View,
  Animated as RNAnimated, Pressable, Dimensions,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { YStack, XStack, Button, Paragraph, Input, Text, Spinner, Circle } from 'tamagui';
import {
  ChevronLeft, AlertTriangle, Camera as CameraIcon,
  Scan, Zap, Receipt, ZoomIn, ZoomOut, Flashlight, X,
  Focus, Users as UsersIcon, Plus,
} from '@tamagui/lucide-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useReceiptSessionStore,
  CapturedReceiptImage,
} from '@/features/receipt/model/receipt-session.store';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { useThemeColors } from '@/shared/lib/stores/theme-store';
import { DEFAULT_LANGUAGE } from '@/shared/config/languages';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_FRAME_WIDTH = SCREEN_WIDTH * 0.78;
const SCAN_FRAME_HEIGHT = SCAN_FRAME_WIDTH * 1.4;

const getDefaultSessionName = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${date} ${time}`;
};

function guessMime(uri?: string): string {
  if (!uri) return 'image/jpeg';
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

// Zoom levels
const ZOOM_LEVELS = [0, 0.25, 0.5, 0.75, 1.0];
const ZOOM_LABELS = ['1×', '1.5×', '2×', '3×', '4×'];

export default function ScanReceiptScreen() {
  const [perm, requestPerm] = useCameraPermissions();
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  const cameraRef = useRef<CameraView | null>(null);

  const parsing = useReceiptSessionStore((s) => s.parsing);
  const parseReceipt = useReceiptSessionStore((s) => s.parseReceipt);
  const parseError = useReceiptSessionStore((s) => s.parseError);
  const setCapture = useReceiptSessionStore((s) => s.setCapture);
  const clearCapture = useReceiptSessionStore((s) => s.clearCapture);
  const storedCapture = useReceiptSessionStore((s) => s.capture);
  const setSessionNameStore = useReceiptSessionStore((s) => s.setSessionName);
  const storedSessionName = useReceiptSessionStore((s) => s.session?.sessionName);
  const storeParticipants = useReceiptSessionStore((s) => s.participants);
  const appLanguage = useAppStore((s) => s.language);
  const isDark = useAppStore((s) => s.theme === 'dark');

  const [sessionName, setSessionName] = useState(() => storedSessionName || getDefaultSessionName());
  const [isAutoName, setIsAutoName] = useState(() => !storedSessionName);
  const [localError, setLocalError] = useState<string | null>(null);
  // Captured photo waiting for user confirmation before sending to AI
  const [pendingCapture, setPendingCapture] = useState<CapturedReceiptImage | null>(null);
  const [pendingName, setPendingName] = useState<string>('');

  // Zoom & Flash state
  const [zoomLevel, setZoomLevel] = useState(0); // index into ZOOM_LEVELS
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);

  // Scan line animation
  const scanLineAnim = useRef(new RNAnimated.Value(0)).current;

  const language = appLanguage || DEFAULT_LANGUAGE;

  // Primary color from theme
  const accentColor = themeColors.primary;
  const accentColorDim = `${accentColor}99`;

  useEffect(() => {
    if (isFocused && !perm?.granted) requestPerm();
  }, [isFocused, perm?.granted, requestPerm]);

  useEffect(() => {
    if (storedSessionName) {
      setIsAutoName(false);
      setSessionName((prev) => (prev === storedSessionName ? prev : storedSessionName));
    } else {
      setIsAutoName(true);
    }
  }, [storedSessionName]);

  useFocusEffect(
    useCallback(() => {
      if (storedSessionName) return;
      if (!isAutoName) return;
      const freshName = getDefaultSessionName();
      setSessionName((prev) => (prev === freshName ? prev : freshName));
    }, [storedSessionName, isAutoName])
  );

  useEffect(() => () => clearCapture(), [clearCapture]);

  // Animated scan line
  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        RNAnimated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scanLineAnim]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_FRAME_HEIGHT - 4],
  });

  // Step 1: take photo and show confirmation preview
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || parsing) return;

    try {
      setLocalError(null);
      console.log('[ReceiptScan] Starting capture...');
      
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: true,
      });

      if (!picture?.uri) {
        throw new Error('Could not capture the receipt photo. Please try again.');
      }
      console.log('[ReceiptScan] Picture captured:', picture.uri, `(${picture.width}x${picture.height})`);

      // Calculate crop area based on frame position on screen
      const frameLeft = (SCREEN_WIDTH - SCAN_FRAME_WIDTH) / 2;
      const frameTop = (SCREEN_HEIGHT - SCAN_FRAME_HEIGHT) / 2.15; // Adjust based on actual layout
      
      // Map screen coordinates to image coordinates
      const scaleX = (picture.width || SCREEN_WIDTH) / SCREEN_WIDTH;
      const scaleY = (picture.height || SCREEN_HEIGHT) / SCREEN_HEIGHT;
      
      const cropLeft = Math.round(frameLeft * scaleX);
      const cropTop = Math.round(frameTop * scaleY);
      const cropWidth = Math.round(SCAN_FRAME_WIDTH * scaleX);
      const cropHeight = Math.round(SCAN_FRAME_HEIGHT * scaleY);
      
      console.log('[ReceiptScan] Crop area:', { cropLeft, cropTop, cropWidth, cropHeight });

      const targetWidth = Math.min(cropWidth, 1280);
      const manipActions = [
        {
          crop: {
            originX: cropLeft,
            originY: cropTop,
            width: cropWidth,
            height: cropHeight,
          },
        },
        { resize: { width: targetWidth } },
      ];
      
      const manipResult = await manipulateAsync(
        picture.uri,
        manipActions,
        { compress: 0.45, format: SaveFormat.JPEG, base64: true }
      );

      if (!manipResult?.base64) {
        throw new Error('Failed to prepare the receipt photo for upload.');
      }

      const preparedName = sessionName.trim() || getDefaultSessionName();
      const capture: CapturedReceiptImage = {
        uri: manipResult.uri ?? picture.uri,
        base64: manipResult.base64,
        mimeType: 'image/jpeg',
        width: manipResult.width ?? cropWidth,
        height: manipResult.height ?? cropHeight,
      };

      console.log('[ReceiptScan] Cropped image size:', { width: manipResult.width, height: manipResult.height, base64Length: manipResult.base64.length });

      setPendingCapture(capture);
      setPendingName(preparedName);
    } catch (error) {
      console.error('[ReceiptScan] Capture error:', error);
      const message = error instanceof Error ? error.message : 'Something went wrong while capturing';
      setLocalError(message);
    }
  }, [cameraRef, parsing, sessionName]);

  // Step 2a: user confirms — send to AI
  const handleConfirmScan = useCallback(async () => {
    if (!pendingCapture || parsing) return;

    try {
      setLocalError(null);
      setSessionNameStore(pendingName);
      setCapture(pendingCapture);
      setPendingCapture(null);

      console.log('[ReceiptScan] Calling parseReceipt...');
      await parseReceipt({
        sessionName: pendingName,
        language,
        image: {
          data: pendingCapture.base64,
          mimeType: pendingCapture.mimeType,
        },
      });

      console.log('[ReceiptScan] Navigating to review screen...');
      router.push('/tabs/sessions/review-items' as any);
    } catch (error) {
      console.error('[ReceiptScan] Error:', error);
      const message = error instanceof Error ? error.message : 'Something went wrong while sending the receipt';
      setLocalError(message);
    }
  }, [pendingCapture, parsing, pendingName, setSessionNameStore, setCapture, parseReceipt, language, router]);

  // Step 2b: user retakes the photo
  const handleRetake = useCallback(() => {
    setPendingCapture(null);
    setPendingName('');
  }, []);

  const goToParticipants = useCallback(() => {
    const preparedName = sessionName.trim() || getDefaultSessionName();
    setSessionNameStore(preparedName);
    router.push('/tabs/sessions/participants');
  }, [sessionName, setSessionNameStore, router]);

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSessionNameChange = useCallback((value: string) => {
    setIsAutoName(false);
    setSessionName(value);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleFlash = useCallback(() => {
    setFlashEnabled((prev) => !prev);
  }, []);

  const disableAction = parsing || !perm?.granted || !!pendingCapture;
  const errorMessage = localError || parseError;

  return (
    <View style={S.root}>
      {/* ===== CAMERA VIEW ===== */}
      <View style={S.cameraWrap}>
        {isFocused && perm?.granted ? (
          <>
            <CameraView
              ref={cameraRef}
              style={S.camera}
              facing="back"
              zoom={ZOOM_LEVELS[zoomLevel]}
              enableTorch={flashEnabled}
            />

            {/* Scan Frame Overlay */}
            <View style={S.scanOverlay}>
              {/* Top dark area */}
              <View style={S.overlayTop} />

              {/* Middle row: left dark | frame | right dark */}
              <View style={S.overlayMiddle}>
                <View style={S.overlaySide} />
                <View style={[S.scanFrame, { borderColor: accentColorDim }]}>
                  {/* Corners */}
                  <View style={[S.corner, S.cornerTL, { borderColor: accentColor }]} />
                  <View style={[S.corner, S.cornerTR, { borderColor: accentColor }]} />
                  <View style={[S.corner, S.cornerBL, { borderColor: accentColor }]} />
                  <View style={[S.corner, S.cornerBR, { borderColor: accentColor }]} />

                  {/* Animated scan line */}
                  <RNAnimated.View
                    style={[
                      S.scanLine,
                      {
                        backgroundColor: accentColor,
                        transform: [{ translateY: scanLineTranslateY }],
                      },
                    ]}
                  />

                  {/* Grid lines (subtle) */}
                  <View style={[S.gridLineH, { top: '33%', backgroundColor: `${accentColor}15` }]} />
                  <View style={[S.gridLineH, { top: '66%', backgroundColor: `${accentColor}15` }]} />
                  <View style={[S.gridLineV, { left: '33%', backgroundColor: `${accentColor}15` }]} />
                  <View style={[S.gridLineV, { left: '66%', backgroundColor: `${accentColor}15` }]} />
                </View>
                <View style={S.overlaySide} />
              </View>

              {/* Bottom dark area with hint */}
              <View style={S.overlayBottom}>
                <Animated.View entering={FadeIn.delay(300).duration(400)}>
                  <View style={[S.scanHintBadge, { backgroundColor: accentColor }]}>  
                    <Focus size={14} color="#FFF" />
                    <Text style={S.scanHintText}>Position receipt inside frame</Text>
                  </View>
                </Animated.View>
              </View>
            </View>
          </>
        ) : (
          <YStack f={1} ai="center" jc="center" gap="$4" bg="rgba(15,23,42,0.95)">
            {!perm ? (
              <ActivityIndicator color="white" size="large" />
            ) : (
              <Animated.View entering={FadeIn.duration(400)}>
                <YStack ai="center" gap="$4" p="$6">
                  <View style={[S.permIconWrap, { borderColor: accentColor }]}>
                    <CameraIcon size={48} color={accentColor} />
                  </View>
                  <Text color="white" fontSize={18} fontWeight="700" textAlign="center">
                    Camera Access Required
                  </Text>
                  <Text color="$gray8" fontSize={14} textAlign="center" px="$4">
                    Allow camera access to scan your receipts and split bills with friends
                  </Text>
                  <Pressable onPress={requestPerm}>
                    <View style={[S.permButton, { backgroundColor: accentColor }]}>
                      <CameraIcon size={18} color="#FFF" />
                      <Text color="white" fontWeight="700" fontSize={15}>Enable Camera</Text>
                    </View>
                  </Pressable>
                </YStack>
              </Animated.View>
            )}
          </YStack>
        )}

        {/* Processing Overlay */}
        {parsing && (
          <View style={S.processingOverlay}>
            <Animated.View entering={FadeIn.duration(300)}>
              <View style={[S.processingCard, { borderColor: `${accentColor}40` }]}>
                <Spinner size="large" color={accentColor} />
                <Text mt="$3" color="white" fontWeight="700" fontSize={17}>
                  Processing receipt...
                </Text>
                <Text mt="$1" color="$gray9" fontSize={13}>
                  AI is reading receipt products
                </Text>
                <View style={[S.processingProgress, { backgroundColor: `${accentColor}30` }]}>
                  <View style={[S.processingProgressBar, { backgroundColor: accentColor }]} />
                </View>
              </View>
            </Animated.View>
          </View>
        )}
      </View>

      {/* ===== PHOTO CONFIRMATION OVERLAY ===== */}
      {pendingCapture && !parsing && (
        <Animated.View entering={FadeIn.duration(300)} style={S.confirmOverlay}>
          <Image
            source={{ uri: pendingCapture.uri }}
            style={S.confirmImage}
            resizeMode="contain"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(15,23,42,0.92)', 'rgba(15,23,42,1)']}
            style={S.confirmGradient}
          />
          <YStack style={S.confirmActions} gap="$3" px="$4" pb={insets.bottom + 16}>
            <Text color="white" fontSize={17} fontWeight="700" textAlign="center">
              Чек тасвири тўғрими? / Is this your receipt?
            </Text>
            <XStack gap="$3">
              <Pressable style={S.cancelBtn} onPress={handleRetake}>
                <X size={18} color="white" />
                <Text color="white" fontWeight="600" fontSize={14}>Qayta olish</Text>
              </Pressable>
              <Pressable
                style={[S.scanBtn, { backgroundColor: accentColor }]}
                onPress={handleConfirmScan}
              >
                <Scan size={20} color="white" />
                <Text color="white" fontWeight="800" fontSize={15}>AI билан скан қил</Text>
              </Pressable>
            </XStack>
          </YStack>
        </Animated.View>
      )}

      {/* ===== TOP HEADER ===== */}
      <View style={[S.header, { paddingTop: insets.top + 8 }]}>
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFill}
        />
        <XStack ai="center" jc="space-between" px="$4" py="$2">
          <Pressable onPress={goBack} style={S.headerBtn}>
            <ChevronLeft size={22} color="white" />
          </Pressable>

          <XStack ai="center" gap="$2">
            <Receipt size={18} color={accentColor} />
            <Text color="white" fontWeight="700" fontSize={17}>
              Scanner
            </Text>
          </XStack>

          {/* Flash toggle */}
          <Pressable onPress={toggleFlash} style={[S.headerBtn, flashEnabled && { backgroundColor: `${accentColor}40` }]}>
            <Flashlight size={20} color={flashEnabled ? accentColor : 'white'} />
          </Pressable>
        </XStack>
      </View>

      {/* Zoom controls hidden - minimal UI */}

      {/* ===== BOTTOM ACTION PANEL - MINIMAL ===== */}
      <Animated.View entering={SlideInDown.delay(100).springify()} style={S.bottomPanel}>
        <LinearGradient
          colors={['rgba(15,23,42,0)', 'rgba(15,23,42,0.92)', 'rgba(15,23,42,0.98)']}
          style={StyleSheet.absoluteFill}
        />
        <YStack px="$4" pb={insets.bottom + 16} pt="$3" gap="$2">
          {/* Compact session name input */}
          <Input
            value={sessionName}
            onChangeText={handleSessionNameChange}
            placeholder="Session name"
            height={40}
            borderRadius={10}
            px={12}
            backgroundColor="rgba(255,255,255,0.06)"
            color="white"
            borderWidth={0.5}
            borderColor={`${accentColor}40`}
            fontSize={13}
            focusStyle={{
              borderColor: accentColor,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          />

          {/* One main action button */}
          <Pressable
            style={[
              S.scanBtn,
              { 
                backgroundColor: accentColor, 
                opacity: disableAction ? 0.5 : 1,
                height: 52,
                borderRadius: 12,
              }
            ]}
            onPress={handleCapture}
            disabled={disableAction}
          >
            <YStack f={1} ai="center" jc="center" w="100%">
              {parsing ? (
                <>
                  <Spinner size="small" color="#FFF" />
                  <Text color="white" fontWeight="700" fontSize={13} mt="$1">Processing...</Text>
                </>
              ) : (
                <>
                  <Scan size={22} color="white" />
                  <Text color="white" fontWeight="800" fontSize={15}>Scan Receipt</Text>
                </>
              )}
            </YStack>
          </Pressable>

          {/* Error message if any */}
          {errorMessage && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <YStack gap="$1.5" bg="rgba(239,68,68,0.15)" px="$3" py="$2" br={10}
                borderWidth={1} borderColor="rgba(239,68,68,0.4)">
                <XStack ai="center" gap="$2">
                  <AlertTriangle size={16} color="#ef4444" />
                  <Text color="#ef4444" fontWeight="600" fontSize={12}>
                    {errorMessage}
                  </Text>
                  <Pressable onPress={() => setLocalError(null)} style={{ marginLeft: 'auto' }}>
                    <X size={14} color="#ef4444" />
                  </Pressable>
                </XStack>
              </YStack>
            </Animated.View>
          )}
        </YStack>
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },

  // Camera
  cameraWrap: { flex: 1, backgroundColor: '#0f172a' },
  camera: { flex: 1 },

  // Header
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 20,
  },
  headerBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Scan overlay
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scanFrame: {
    width: SCAN_FRAME_WIDTH,
    height: SCAN_FRAME_HEIGHT,
    position: 'relative',
    borderWidth: 1,
    borderRadius: 4,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    paddingTop: 16,
  },

  // Corners
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 4,
  },
  cornerTL: {
    top: -2, left: -2,
    borderRightWidth: 0, borderBottomWidth: 0,
    borderTopLeftRadius: 14,
  },
  cornerTR: {
    top: -2, right: -2,
    borderLeftWidth: 0, borderBottomWidth: 0,
    borderTopRightRadius: 14,
  },
  cornerBL: {
    bottom: -2, left: -2,
    borderRightWidth: 0, borderTopWidth: 0,
    borderBottomLeftRadius: 14,
  },
  cornerBR: {
    bottom: -2, right: -2,
    borderLeftWidth: 0, borderTopWidth: 0,
    borderBottomRightRadius: 14,
  },

  // Scan line
  scanLine: {
    position: 'absolute',
    left: 8, right: 8,
    height: 2,
    borderRadius: 1,
    opacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },

  // Grid lines
  gridLineH: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
  },
  gridLineV: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 1,
  },

  // Hint badge
  scanHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scanHintText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },

  // Permission
  permIconWrap: {
    width: 100, height: 100,
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  permButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },

  // Processing
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  processingCard: {
    backgroundColor: 'rgba(30,41,59,0.95)',
    padding: 36,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    minWidth: 240,
  },
  processingProgress: {
    width: 180,
    height: 4,
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden',
  },
  processingProgressBar: {
    width: '60%',
    height: '100%',
    borderRadius: 2,
  },

  // Side controls (zoom)
  sideControls: {
    position: 'absolute',
    right: 16,
    top: '35%',
    zIndex: 15,
    alignItems: 'center',
    gap: 8,
  },
  sideBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  zoomBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 40,
    alignItems: 'center',
  },

  // Bottom panel
  bottomPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 20,
  },

  // Action buttons
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  scanBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
  },
  errorBtn: {
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  preview: {
    width: 32, height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // Photo confirmation overlay
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: '#0f172a',
  },
  confirmImage: {
    flex: 1,
    width: '100%',
  },
  confirmGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 240,
  },
  confirmActions: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
});
