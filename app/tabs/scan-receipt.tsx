// app/tabs/scan-receipt.tsx — capture a receipt, confirm it, watch the AI analyse it.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BarChart3,
  Camera,
  Check,
  FileText,
  Image as ImageIcon,
  QrCode,
  PencilLine,
  RotateCcw,
  Search,
  Sparkles,
  X,
  Zap,
  ZapOff,
} from '@tamagui/lucide-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { useReceiptSessionStore, type CapturedReceiptImage } from '@/features/receipt/model/receipt-session.store';
import { useAppStore } from '@/shared/lib/stores/app-store';
import { DEFAULT_LANGUAGE } from '@/shared/config/languages';
import { useGlassPalette, type GlassPalette } from '@/shared/ui/glass/GlassKit';
import CodeSheet from '@/features/scanner/CodeSheet';
import { CODE_TYPES, classifyCode, formatName, normalizeType, type RawCode } from '@/features/scanner/codes';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ZOOMS = [
  { label: '1x', value: 0 },
  { label: '2x', value: 0.25 },
  { label: '3x', value: 0.5 },
];

const getDefaultSessionName = () => {
  const now = new Date();
  const pad = (v: number) => v.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

/** Frame geometry, shared by the overlay and the crop so they always agree. */
function useFrame() {
  const { width, height } = useWindowDimensions();
  const w = Math.min(width * 0.76, 420);
  const h = w * 1.36;
  return { width, height, w, h, left: (width - w) / 2, top: (height - h) / 2.25 };
}

/** Codes found in a saved photo (on-device, no network). */
async function readCodesFromPhoto(uri: string): Promise<RawCode[]> {
  try {
    const results = await scanFromURLAsync(uri, [...CODE_TYPES]);
    const seen = new Set<string>();
    return results
      .filter((r) => r?.data && !seen.has(r.data) && seen.add(r.data))
      .map((r) => ({ type: normalizeType(r.type), data: String(r.data) }));
  } catch {
    return [];
  }
}

type Stage = 'camera' | 'confirm' | 'analyzing';

export default function ScanReceiptScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { p } = useGlassPalette();
  const frame = useFrame();
  const [perm, requestPerm] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const parsing = useReceiptSessionStore((s) => s.parsing);
  const parseReceipt = useReceiptSessionStore((s) => s.parseReceipt);
  const parseError = useReceiptSessionStore((s) => s.parseError);
  const setCapture = useReceiptSessionStore((s) => s.setCapture);
  const clearCapture = useReceiptSessionStore((s) => s.clearCapture);
  const setSessionNameStore = useReceiptSessionStore((s) => s.setSessionName);
  const storedSessionName = useReceiptSessionStore((s) => s.session?.sessionName);
  const language = useAppStore((s) => s.language) || DEFAULT_LANGUAGE;

  const [stage, setStage] = useState<Stage>('camera');
  const [sessionName, setSessionName] = useState(() => storedSessionName || getDefaultSessionName());
  const [isAutoName, setIsAutoName] = useState(() => !storedSessionName);
  const [pending, setPending] = useState<CapturedReceiptImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [flash, setFlash] = useState(false);
  // QR / barcodes: seen live by the camera, or found in the captured photo
  const [liveCode, setLiveCode] = useState<RawCode | null>(null);
  const [sheetCode, setSheetCode] = useState<RawCode | null>(null);
  const [photoCodes, setPhotoCodes] = useState<RawCode[]>([]);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDismissed = useRef<{ data: string; at: number } | null>(null);

  const onBarcode = useCallback((r: { type: string; data: string }) => {
    if (!r?.data) return;
    const d = lastDismissed.current;
    if (d && d.data === r.data && Date.now() - d.at < 4000) return;
    setLiveCode((prev) => (prev && prev.data === r.data ? prev : { type: normalizeType(r.type), data: String(r.data) }));
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => setLiveCode(null), 2500); // gone from view → chip goes away
  }, []);
  useEffect(() => () => {
    if (liveTimer.current) clearTimeout(liveTimer.current);
  }, []);

  const openCode = useCallback((c: RawCode) => {
    setSheetCode(c);
    setLiveCode(null);
  }, []);
  const closeCode = useCallback(() => {
    if (sheetCode) lastDismissed.current = { data: sheetCode.data, at: Date.now() };
    setSheetCode(null);
  }, [sheetCode]);

  useEffect(() => {
    if (isFocused && !perm?.granted && perm?.canAskAgain !== false) requestPerm();
  }, [isFocused, perm?.granted, perm?.canAskAgain, requestPerm]);

  useFocusEffect(
    useCallback(() => {
      if (storedSessionName || !isAutoName) return;
      setSessionName(getDefaultSessionName());
    }, [storedSessionName, isAutoName]),
  );

  useEffect(() => () => clearCapture(), [clearCapture]);

  // ---------- capture: crop exactly what is inside the frame ----------
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || busy || parsing) return;
    try {
      setBusy(true);
      setError(null);
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false, skipProcessing: true });
      if (!picture?.uri) throw new Error(t('scanReceipt.errors.captureFailed'));

      const picW = picture.width || frame.width;
      const picH = picture.height || frame.height;
      const actions: any[] = [];
      // The preview "covers" the screen: map the on-screen frame back into the photo.
      if (picH >= picW) {
        const scale = Math.max(frame.width / picW, frame.height / picH);
        const offX = (picW * scale - frame.width) / 2;
        const offY = (picH * scale - frame.height) / 2;
        const pad = 0.04 * frame.w; // keep a little margin around the frame
        const x = Math.max(0, Math.round((frame.left - pad + offX) / scale));
        const y = Math.max(0, Math.round((frame.top - pad + offY) / scale));
        const w = Math.min(picW - x, Math.round((frame.w + pad * 2) / scale));
        const h = Math.min(picH - y, Math.round((frame.h + pad * 2) / scale));
        if (w > 50 && h > 50) actions.push({ crop: { originX: x, originY: y, width: w, height: h } });
      }
      actions.push({ resize: { width: 1280 } });
      const out = await manipulateAsync(picture.uri, actions, { compress: 0.5, format: SaveFormat.JPEG, base64: true });
      if (!out?.base64) throw new Error(t('scanReceipt.errors.prepareFailed'));

      const photoUri = out.uri ?? picture.uri;
      setPending({ uri: photoUri, base64: out.base64, mimeType: 'image/jpeg', width: out.width, height: out.height });
      setPhotoCodes([]);
      setStage('confirm');
      readCodesFromPhoto(photoUri).then(setPhotoCodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('scanReceipt.errors.captureGeneric'));
    } finally {
      setBusy(false);
    }
  }, [busy, parsing, frame, t]);

  // ---------- gallery: same base64 path as the camera (no multipart upload) ----------
  const ensureGalleryPermission = useCallback(async () => {
    const current = mediaPermission ?? (await ImagePicker.getMediaLibraryPermissionsAsync());
    if (current.granted) return true;
    const next = current.canAskAgain ? await requestMediaPermission() : current;
    if (next.granted) return true;
    Alert.alert(t('scanReceipt.galleryPermissionTitle'), t('scanReceipt.galleryPermissionMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.openSettings'), onPress: () => void Linking.openSettings() },
    ]);
    return false;
  }, [mediaPermission, requestMediaPermission, t]);

  const handleGallery = useCallback(async () => {
    if (busy || parsing) return;
    if (!(await ensureGalleryPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.9, selectionLimit: 1 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    try {
      setBusy(true);
      setError(null);
      const asset = result.assets[0];
      const out = await manipulateAsync(asset.uri, [{ resize: { width: Math.min(asset.width || 1280, 1280) } }], {
        compress: 0.55,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!out?.base64) throw new Error(t('scanReceipt.errors.prepareFailed'));
      const photoUri = out.uri ?? asset.uri;
      setPending({ uri: photoUri, base64: out.base64, mimeType: 'image/jpeg', width: out.width, height: out.height });
      setPhotoCodes([]);
      setStage('confirm');
      // the original (full-size) pick scans more reliably than the resized copy
      void (async () => {
        const found = await readCodesFromPhoto(asset.uri);
        setPhotoCodes(found.length ? found : await readCodesFromPhoto(photoUri));
      })();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('scanReceipt.errors.galleryFailed'));
    } finally {
      setBusy(false);
    }
  }, [busy, parsing, ensureGalleryPermission, t]);

  // ---------- analyse ----------
  const analyze = useCallback(async () => {
    if (!pending) return;
    const name = sessionName.trim() || getDefaultSessionName();
    setSessionNameStore(name);
    setCapture(pending);
    setAnalysisDone(false);
    setAnalysisError(null);
    setStage('analyzing');
    try {
      await parseReceipt({ sessionName: name, language, image: { data: pending.base64, mimeType: pending.mimeType } });
      setAnalysisDone(true);
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : t('scanReceipt.errors.sendFailed'));
    }
  }, [pending, sessionName, language, setSessionNameStore, setCapture, parseReceipt, t]);

  const onAnalysisFinished = useCallback(() => {
    setStage('camera');
    setPending(null);
    router.push('/tabs/sessions/review-items' as any);
  }, [router]);

  const retake = useCallback(() => {
    setPending(null);
    setPhotoCodes([]);
    setAnalysisError(null);
    setStage('camera');
  }, []);

  const goManual = useCallback(() => {
    setSessionNameStore(sessionName.trim() || getDefaultSessionName());
    router.push('/tabs/sessions/participants');
  }, [sessionName, setSessionNameStore, router]);

  const shownError = error || (stage === 'camera' ? parseError : null);

  return (
    <View style={styles.root}>
      {isFocused && perm?.granted && stage !== 'analyzing' ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          zoom={ZOOMS[zoom].value}
          enableTorch={flash}
          barcodeScannerSettings={{ barcodeTypes: [...CODE_TYPES] }}
          onBarcodeScanned={stage === 'camera' && !sheetCode ? onBarcode : undefined}
        />
      ) : (
        <LinearGradient colors={['#0B1022', '#05070F']} style={StyleSheet.absoluteFill} />
      )}

      {stage === 'camera' && (
        <>
          <FrameOverlay p={p} frame={frame} active={!!perm?.granted && isFocused} />

          {/* top bar */}
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <GlassCircle onPress={() => router.back()} label="Back">
              <ArrowLeft size={22} color="#FFFFFF" />
            </GlassCircle>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{t('scanReceipt.scanReceipt', 'Scan Receipt')}</Text>
              <Text style={styles.subtitle}>{t('scanReceipt.subtitle', 'Capture your bill')}</Text>
            </View>
            <GlassCircle onPress={() => setFlash((f) => !f)} label="Flash" active={flash} accent={p.accentGradient[1]}>
              {flash ? <Zap size={20} color="#FFFFFF" /> : <ZapOff size={20} color="#FFFFFF" />}
            </GlassCircle>
          </View>

          {/* a QR / barcode is in view */}
          {liveCode && !sheetCode && (
            <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(160)} style={[styles.codeChipWrap, { top: frame.top + frame.h + 14 }]}>
              <Pressable onPress={() => openCode(liveCode)} style={[styles.codeChip, { borderColor: p.accentGradient[1] }]} accessibilityRole="button">
                <View style={[styles.codeChipIcon, { backgroundColor: `${p.accentGradient[1]}44` }]}>
                  <QrCode size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.codeChipText} numberOfLines={1}>
                  {t('scanner.found', { format: formatName(liveCode.type), defaultValue: `${formatName(liveCode.type)} found` })}
                </Text>
                <Text style={[styles.codeChipAction, { color: p.accentGradient[0] }]}>{t('scanner.view', 'View')}</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* hint */}
          {perm?.granted && !liveCode && (
            <Animated.View entering={FadeInDown.duration(400).delay(150)} style={[styles.hintWrap, { top: Math.max(insets.top + 76, frame.top - 74) }]}>
              <View style={[styles.hint, { borderColor: `${p.accentGradient[1]}88` }]}>
                <View style={[styles.hintIcon, { backgroundColor: `${p.accentGradient[1]}33` }]}>
                  <FileText size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.hintText}>{t('scanReceipt.hint', 'Place the receipt inside the frame')}</Text>
              </View>
              <View style={[styles.hintArrow, { borderTopColor: 'rgba(12,16,34,0.78)' }]} />
            </Animated.View>
          )}

          {/* permission */}
          {perm && !perm.granted && (
            <View style={[styles.permCard, { top: frame.top + frame.h * 0.2 }]}>
              <View style={[styles.permIcon, { backgroundColor: `${p.accentGradient[1]}33` }]}>
                <Camera size={30} color="#FFFFFF" />
              </View>
              <Text style={styles.permTitle}>{t('scanReceipt.cameraAccessTitle')}</Text>
              <Text style={styles.permText}>{t('scanReceipt.cameraAccessMessage')}</Text>
              <Pressable onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} style={styles.permBtnWrap}>
                <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.permBtn}>
                  <Text style={styles.permBtnText}>{t('scanReceipt.enableCamera')}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {/* bottom controls */}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
            {shownError ? (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.errorToast}>
                <Text style={styles.errorText} numberOfLines={3}>{shownError}</Text>
                <Pressable onPress={() => setError(null)} hitSlop={10}>
                  <X size={16} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
            ) : null}

            <View style={styles.nameRow}>
              <View style={styles.namePill}>
                <PencilLine size={14} color="rgba(255,255,255,0.75)" />
                <TextInput
                  value={sessionName}
                  onChangeText={(v) => {
                    setIsAutoName(false);
                    setSessionName(v);
                  }}
                  placeholder={t('scanReceipt.sessionName')}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={styles.nameInput}
                  selectionColor={p.accentGradient[1]}
                  underlineColorAndroid="transparent"
                />
              </View>
            </View>

            <ZoomPicker p={p} value={zoom} onChange={setZoom} />

            <View style={styles.controls}>
              <SideAction label={t('scanReceipt.gallery', 'Gallery')} onPress={handleGallery} disabled={busy || parsing}>
                <ImageIcon size={24} color="#FFFFFF" />
              </SideAction>
              <Shutter p={p} busy={busy} disabled={busy || parsing || !perm?.granted} onPress={handleCapture} />
              <SideAction label={t('scanReceipt.manual', 'Manual')} onPress={goManual} disabled={busy || parsing}>
                <PencilLine size={24} color="#FFFFFF" />
              </SideAction>
            </View>
          </View>
        </>
      )}

      {stage === 'confirm' && pending && (
        <ConfirmStage
          p={p}
          image={pending}
          topInset={insets.top}
          bottomInset={insets.bottom}
          title={t('scanReceipt.confirmReceipt', 'Is this your receipt?')}
          retakeLabel={t('scanReceipt.retake', 'Retake')}
          analyzeLabel={t('scanReceipt.scanWithAi', 'Scan with AI')}
          codes={photoCodes}
          onOpenCode={openCode}
          onRetake={retake}
          onAnalyze={analyze}
        />
      )}

      {stage === 'analyzing' && pending && (
        <AnalyzingStage
          p={p}
          image={pending}
          topInset={insets.top}
          bottomInset={insets.bottom}
          done={analysisDone}
          error={analysisError}
          onFinished={onAnalysisFinished}
          codes={photoCodes}
          onOpenCode={openCode}
          onRetry={analyze}
          onRetake={retake}
          onBack={retake}
        />
      )}
      {sheetCode && (
        <CodeSheet code={sheetCode} bottomInset={insets.bottom} accent={p.accentGradient[1]} accentB={p.accentGradient[0]} onClose={closeCode} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// camera chrome
// ---------------------------------------------------------------------------
function GlassCircle({
  children,
  onPress,
  label,
  active,
  accent,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  active?: boolean;
  accent?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.glassCircle, active && accent ? { backgroundColor: `${accent}66`, borderColor: accent } : null]}
    >
      {children}
    </Pressable>
  );
}

/** Dimmed surround, glowing rounded corners and a sweeping scan beam. */
function FrameOverlay({ p, frame, active }: { p: GlassPalette; frame: ReturnType<typeof useFrame>; active: boolean }) {
  const sweep = useSharedValue(0);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    sweep.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
    glow.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(glow);
    };
  }, [active]);
  const beam = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(sweep.value, [0, 1], [0, frame.h - 6]) }] }));
  const cornerGlow = useAnimatedStyle(() => ({ opacity: interpolate(glow.value, [0, 1], [0.75, 1]) }));
  const accent = p.accentGradient[1];
  const shade = 'rgba(3,6,18,0.5)';
  const corner = 34;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: frame.top, backgroundColor: shade }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: frame.top + frame.h, bottom: 0, backgroundColor: shade }} />
      <View style={{ position: 'absolute', left: 0, width: frame.left, top: frame.top, height: frame.h, backgroundColor: shade }} />
      <View style={{ position: 'absolute', right: 0, width: frame.left, top: frame.top, height: frame.h, backgroundColor: shade }} />

      <Animated.View style={[{ position: 'absolute', left: frame.left, top: frame.top, width: frame.w, height: frame.h }, cornerGlow]}>
        {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
          <View
            key={k}
            style={[
              styles.corner,
              {
                width: corner,
                height: corner,
                borderColor: accent,
                shadowColor: accent,
                ...(k[0] === 't' ? { top: -3, borderTopWidth: 5 } : { bottom: -3, borderBottomWidth: 5 }),
                ...(k[1] === 'l' ? { left: -3, borderLeftWidth: 5 } : { right: -3, borderRightWidth: 5 }),
                ...(k === 'tl' ? { borderTopLeftRadius: 22 } : k === 'tr' ? { borderTopRightRadius: 22 } : k === 'bl' ? { borderBottomLeftRadius: 22 } : { borderBottomRightRadius: 22 }),
              },
            ]}
          />
        ))}
        <View style={[StyleSheet.absoluteFill, { borderRadius: 20, borderWidth: 1, borderColor: `${accent}55` }]} />
        {active && (
          <Animated.View style={[styles.beamWrap, beam]}>
            <LinearGradient
              colors={['rgba(0,0,0,0)', `${accent}`, 'rgba(255,255,255,0.95)', `${accent}`, 'rgba(0,0,0,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.beam}
            />
            <LinearGradient colors={[`${accent}00`, `${accent}40`]} style={styles.beamTrail} />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

function ZoomPicker({ p, value, onChange }: { p: GlassPalette; value: number; onChange: (i: number) => void }) {
  return (
    <View style={styles.zoom}>
      {ZOOMS.map((z, i) => {
        const on = i === value;
        return (
          <Pressable key={z.label} onPress={() => onChange(i)} style={styles.zoomItem} accessibilityRole="button" accessibilityState={{ selected: on }}>
            {on && <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />}
            <Text style={[styles.zoomText, on && { color: '#FFFFFF', fontWeight: '800' }]}>{z.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SideAction({ children, label, onPress, disabled }: { children: React.ReactNode; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.side, disabled && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.sideCircle}>{children}</View>
      <Text style={styles.sideText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Shutter({ p, busy, disabled, onPress }: { p: GlassPalette; busy: boolean; disabled: boolean; onPress: () => void }) {
  const pulse = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, []);
  const ring = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0, 1], [0.55, 0]), transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.35]) }] }));
  const body = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <View style={styles.shutterSlot}>
      <Animated.View pointerEvents="none" style={[styles.shutterPulse, { borderColor: p.accentGradient[1] }, ring]} />
      <Animated.View style={body}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          onPressIn={() => (press.value = withTiming(0.92, { duration: 90 }))}
          onPressOut={() => (press.value = withTiming(1, { duration: 160 }))}
          style={[styles.shutterRing, { borderColor: `${p.accentGradient[1]}AA` }, disabled && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
        >
          <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shutter}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Camera size={30} color="#FFFFFF" />}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// confirm
// ---------------------------------------------------------------------------
function ConfirmStage({
  p,
  image,
  topInset,
  bottomInset,
  title,
  retakeLabel,
  analyzeLabel,
  codes,
  onOpenCode,
  onRetake,
  onAnalyze,
}: {
  p: GlassPalette;
  image: CapturedReceiptImage;
  codes: RawCode[];
  onOpenCode: (c: RawCode) => void;
  topInset: number;
  bottomInset: number;
  title: string;
  retakeLabel: string;
  analyzeLabel: string;
  onRetake: () => void;
  onAnalyze: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const ratio = image.width && image.height ? image.height / image.width : 1.36;
  const maxH = height - topInset - bottomInset - 230;
  const w = Math.min(width * 0.78, maxH / ratio);
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[StyleSheet.absoluteFill, styles.confirm]}>
      <LinearGradient colors={['rgba(5,8,20,0.88)', 'rgba(5,8,20,0.96)']} style={StyleSheet.absoluteFill} />
      <Text style={[styles.confirmTitle, { marginTop: topInset + 24 }]}>{title}</Text>
      <Animated.View entering={FadeInDown.duration(350)} style={[styles.confirmImageWrap, { width: w, height: w * ratio, borderColor: `${p.accentGradient[1]}88`, shadowColor: p.accentGradient[1] }]}>
        <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </Animated.View>
      <CodesBanner p={p} codes={codes} onOpen={onOpenCode} bottom={bottomInset + 92} />
      <View style={[styles.confirmButtons, { paddingBottom: bottomInset + 20 }]}>
        <Pressable onPress={onRetake} style={styles.retake}>
          <RotateCcw size={18} color="#FFFFFF" />
          <Text style={styles.retakeText}>{retakeLabel}</Text>
        </Pressable>
        <Pressable onPress={onAnalyze} style={styles.analyzeWrap}>
          <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.analyze}>
            <Sparkles size={18} color="#FFFFFF" />
            <Text style={styles.analyzeText}>{analyzeLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// analysing
// ---------------------------------------------------------------------------
const STEP_KEYS = [
  { key: 'detect', fallback: 'Detecting document', at: 0 },
  { key: 'extract', fallback: 'Extracting text', at: 22 },
  { key: 'categorize', fallback: 'Categorizing items', at: 55 },
  { key: 'prepare', fallback: 'Preparing summary', at: 85 },
];

function AnalyzingStage({
  p,
  image,
  topInset,
  bottomInset,
  done,
  error,
  codes,
  onOpenCode,
  onFinished,
  onRetry,
  onRetake,
  onBack,
}: {
  p: GlassPalette;
  image: CapturedReceiptImage;
  codes: RawCode[];
  onOpenCode: (c: RawCode) => void;
  topInset: number;
  bottomInset: number;
  done: boolean;
  error: string | null;
  onFinished: () => void;
  onRetry: () => void;
  onRetake: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [progress, setProgress] = useState(0);

  // Indeterminate work shown honestly: progress eases toward 92% while the AI
  // works and only completes when the server has actually answered.
  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => {
      setProgress((prev) => {
        const target = done ? 100 : 92;
        const next = prev + (target - prev) * (done ? 0.35 : 0.035);
        return target - next < 0.4 ? target : next;
      });
    }, 80);
    return () => clearInterval(timer);
  }, [done, error]);

  useEffect(() => {
    if (done && progress >= 100) {
      const timer = setTimeout(onFinished, 380);
      return () => clearTimeout(timer);
    }
  }, [done, progress, onFinished]);

  // retry restarts the visible progress
  const lastError = useRef(error);
  useEffect(() => {
    if (lastError.current && !error) setProgress(0);
    lastError.current = error;
  }, [error]);

  // ---- hero motion ----
  const float = useSharedValue(0);
  const spin = useSharedValue(0);
  const scan = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    spin.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false);
    scan.value = withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })), -1, false);
    return () => {
      cancelAnimation(float);
      cancelAnimation(spin);
      cancelAnimation(scan);
    };
  }, []);

  const heroW = Math.min(width * 0.5, 230);
  const ratio = image.width && image.height ? Math.min(1.6, Math.max(1.1, image.height / image.width)) : 1.36;
  const heroH = heroW * ratio;

  const paper = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { translateY: interpolate(float.value, [0, 1], [-8, 8]) },
      { rotateZ: `${interpolate(float.value, [0, 1], [-9, -5])}deg` },
      { rotateY: `${interpolate(float.value, [0, 1], [-10, 6])}deg` },
    ],
  }));
  const beam = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(scan.value, [0, 1], [0, heroH - 4]) }] }));
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }, { scaleY: 0.32 }] }));
  const magnifier = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [6, -10]) }, { rotate: `${interpolate(float.value, [0, 1], [-8, 8])}deg` }],
  }));
  const chipA = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [-6, 6]) }] }));
  const chipB = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [6, -6]) }] }));

  const accent = p.accentGradient[1];
  const pct = Math.round(progress);
  const stepIndex = STEP_KEYS.reduce((acc, s, i) => (progress >= s.at ? i : acc), 0);

  return (
    <Animated.View entering={FadeIn.duration(250)} style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#0A0F24', '#0D0A2A', '#05070F']} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[`${accent}00`, `${accent}22`]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* header */}
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <GlassCircle onPress={onBack} label="Back">
          <ArrowLeft size={22} color="#FFFFFF" />
        </GlassCircle>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{error ? t('scanReceipt.analysis.failedTitle', 'Scan failed') : t('scanReceipt.analysis.title', 'Scanning...')}</Text>
          <Text style={styles.subtitle}>{t('scanReceipt.analysis.subtitle', 'Extracting receipt details')}</Text>
        </View>
        <View style={{ width: 52 }} />
      </View>

      {/* hero */}
      <View style={[styles.heroArea, { height: heroH + 90 }]}>
        <Animated.View pointerEvents="none" style={[styles.orbit, { width: heroW * 1.9, height: heroW * 1.9 }, orbit]}>
          <Svg width={heroW * 1.9} height={heroW * 1.9}>
            <Defs>
              <SvgLinearGradient id="orbit" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={p.accentGradient[0]} stopOpacity={0.1} />
                <Stop offset="50%" stopColor={accent} stopOpacity={1} />
                <Stop offset="100%" stopColor={p.accentGradient[0]} stopOpacity={0.1} />
              </SvgLinearGradient>
            </Defs>
            <Ellipse cx={heroW * 0.95} cy={heroW * 0.95} rx={heroW * 0.9} ry={heroW * 0.9} stroke="url(#orbit)" strokeWidth={5} fill="none" />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.paper, { width: heroW, height: heroH, shadowColor: accent }, paper]}>
          <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={[`${accent}55`, 'rgba(255,255,255,0)', `${p.accentGradient[0]}55`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {!error && (
            <Animated.View style={[styles.paperBeam, beam]}>
              <LinearGradient colors={['rgba(0,0,0,0)', accent, '#FFFFFF', accent, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View style={[styles.chip, { left: width * 0.06, top: heroH * 0.35 }, chipA]}>
          <FileText size={26} color={accent} />
        </Animated.View>
        <Animated.View style={[styles.chip, { right: width * 0.08, top: heroH * 0.72 }, chipB]}>
          <BarChart3 size={26} color={accent} />
        </Animated.View>
        <Animated.View style={[styles.magnifier, { right: width * 0.12, top: heroH * 0.12 }, magnifier]}>
          <Search size={46} color={accent} strokeWidth={2.6} />
        </Animated.View>
      </View>

      {/* status */}
      <View style={[styles.statusArea, { paddingBottom: bottomInset + 24 }]}>
        <View style={[styles.statusCard, { borderColor: `${accent}44` }]}>
          {error ? (
            <View style={[styles.errorBadge]}>
              <X size={26} color="#F87171" />
            </View>
          ) : (
            <ProgressRing progress={progress} color={accent} colorB={p.accentGradient[0]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle} numberOfLines={1}>
              {error ? t('scanReceipt.analysis.failed', "Couldn't read the receipt") : t('scanReceipt.analysis.status', 'Analyzing receipt...')}
            </Text>
            <Text style={styles.statusSub} numberOfLines={2}>
              {error ?? t('scanReceipt.analysis.statusSub', 'Reading text and identifying items')}
            </Text>
          </View>
          {!error && <Text style={[styles.statusPct, { color: accent }]}>{pct}%</Text>}
        </View>

        {error && codes.length > 0 ? (
          <Pressable onPress={() => onOpenCode(codes[0])} style={[styles.codeFound, { borderColor: accent }]} accessibilityRole="button">
            <QrCode size={20} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.codeFoundTitle}>{t('scanner.photoHasCode', 'This photo has a QR / barcode')}</Text>
              <Text style={styles.codeFoundSub} numberOfLines={1}>{t('scanner.tapToRead', 'Tap to read it')}</Text>
            </View>
          </Pressable>
        ) : null}
        {error ? (
          <View style={styles.actionsRow}>
            <Pressable onPress={onRetake} style={styles.retake}>
              <Camera size={18} color="#FFFFFF" />
              <Text style={styles.retakeText}>{t('scanReceipt.retake', 'Retake')}</Text>
            </Pressable>
            <Pressable onPress={onRetry} style={styles.analyzeWrap}>
              <LinearGradient colors={p.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.analyze}>
                <RotateCcw size={18} color="#FFFFFF" />
                <Text style={styles.analyzeText}>{t('scanReceipt.analysis.tryAgain', 'Try again')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.steps}>
            {STEP_KEYS.map((s, i) => {
              const state = i < stepIndex || (done && progress >= 100) ? 'done' : i === stepIndex ? 'active' : 'todo';
              return (
                <StepRow
                  key={s.key}
                  label={t(`scanReceipt.analysis.steps.${s.key}`, s.fallback)}
                  state={state}
                  color={accent}
                />
              );
            })}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/** "QR / barcode found in this photo" banner shown on the confirm step. */
function CodesBanner({ p, codes, onOpen, bottom }: { p: GlassPalette; codes: RawCode[]; onOpen: (c: RawCode) => void; bottom: number }) {
  const { t } = useTranslation();
  if (!codes.length) return null;
  const first = codes[0];
  const info = classifyCode(first);
  const label =
    info.kind === 'fiscal'
      ? t('scanner.fiscal.title', 'Fiscal receipt QR')
      : info.kind === 'url'
        ? info.host || t('scanner.url.title', 'Web link')
        : info.kind === 'product'
          ? `${info.format} · ${info.code}`
          : formatName(first.type);
  return (
    <Animated.View entering={FadeInDown.duration(260)} style={[styles.banner, { bottom }]}>
      <Pressable onPress={() => onOpen(first)} style={[styles.bannerInner, { borderColor: `${p.accentGradient[1]}99` }]} accessibilityRole="button">
        <View style={[styles.codeChipIcon, { backgroundColor: `${p.accentGradient[1]}44` }]}>
          <QrCode size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.codeChipText} numberOfLines={1}>{t('scanner.photoHasCode', 'This photo has a QR / barcode')}</Text>
          <Text style={styles.bannerSub} numberOfLines={1}>{label}{codes.length > 1 ? `  +${codes.length - 1}` : ''}</Text>
        </View>
        <Text style={[styles.codeChipAction, { color: p.accentGradient[0] }]}>{t('scanner.view', 'View')}</Text>
      </Pressable>
    </Animated.View>
  );
}

function ProgressRing({ progress, color, colorB }: { progress: number; color: string; colorB: string }) {
  const size = 58;
  const r = 24;
  const c = 2 * Math.PI * r;
  const v = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(progress / 100, { duration: 200 });
  }, [progress]);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, []);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - Math.max(0.08, v.value)) }));
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, rot]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colorB} />
            <Stop offset="100%" stopColor={color} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={5} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </Animated.View>
  );
}

function StepRow({ label, state, color }: { label: string; state: 'done' | 'active' | 'todo'; color: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (state !== 'active') {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [state]);
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(pulse.value, [0, 1], [0.8, 1.15]) }] }));
  return (
    <View style={styles.step}>
      <View
        style={[
          styles.stepBullet,
          state === 'done' && { backgroundColor: color, borderColor: color },
          state === 'active' && { borderColor: color },
        ]}
      >
        {state === 'done' && (
          <Animated.View entering={FadeIn.duration(200)}>
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        )}
        {state === 'active' && <Animated.View style={[styles.stepDot, { backgroundColor: color }, dot]} />}
      </View>
      <Text style={[styles.stepText, state === 'todo' && { color: 'rgba(255,255,255,0.45)' }, state === 'active' && { color: '#FFFFFF', fontWeight: '600' }]}>
        {label}
      </Text>
    </View>
  );
}

const glassDark = 'rgba(12,16,34,0.62)';
const glassBorder = 'rgba(255,255,255,0.18)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05070F' },
  topBar: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 },
  glassCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: glassDark, borderWidth: 1, borderColor: glassBorder, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { alignItems: 'center', flex: 1 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  hintWrap: { position: 'absolute', alignSelf: 'center', alignItems: 'center', zIndex: 4 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, backgroundColor: 'rgba(12,16,34,0.78)' },
  hintIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hintText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', maxWidth: 190 },
  hintArrow: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  corner: { position: 'absolute', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  beamWrap: { position: 'absolute', left: -10, right: -10, top: 0, height: 60, marginTop: -54 },
  beam: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, borderRadius: 2 },
  beamTrail: { position: 'absolute', left: 10, right: 10, bottom: 4, height: 50 },
  permCard: { position: 'absolute', left: 32, right: 32, padding: 22, borderRadius: 24, borderWidth: 1, borderColor: glassBorder, backgroundColor: 'rgba(12,16,34,0.85)', alignItems: 'center', gap: 10 },
  permIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  permTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  permText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtnWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 6, alignSelf: 'stretch' },
  permBtn: { height: 50, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 14 },
  errorToast: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(220,38,38,0.85)' },
  errorText: { color: '#FFFFFF', fontSize: 13, flexShrink: 1 },
  nameRow: { width: '100%', alignItems: 'center' },
  namePill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: glassDark, borderWidth: 1, borderColor: glassBorder, maxWidth: '80%' },
  nameInput: { color: '#FFFFFF', fontSize: 14, minWidth: 140, paddingVertical: 0 },
  zoom: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: glassDark, borderWidth: 1, borderColor: glassBorder },
  zoomItem: { width: 54, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  zoomText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  controls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 18, marginTop: 4 },
  side: { alignItems: 'center', gap: 6, width: 80 },
  sideCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: glassDark, borderWidth: 1, borderColor: glassBorder, alignItems: 'center', justifyContent: 'center' },
  sideText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  shutterSlot: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  shutterPulse: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 3 },
  shutterRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, padding: 6 },
  shutter: { flex: 1, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  confirm: { alignItems: 'center' },
  confirmTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  confirmImageWrap: { marginTop: 20, borderRadius: 22, borderWidth: 2, overflow: 'hidden', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 10, backgroundColor: '#111827' },
  confirmButtons: { position: 'absolute', left: 20, right: 20, bottom: 0, flexDirection: 'row', gap: 12 },
  codeChipWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 6 },
  codeChip: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingLeft: 8, paddingRight: 16, borderRadius: 24, borderWidth: 1.5, backgroundColor: 'rgba(12,16,34,0.88)', maxWidth: '90%' },
  codeChipIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  codeChipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  codeChipAction: { fontSize: 14, fontWeight: '800' },
  banner: { position: 'absolute', left: 20, right: 20 },
  bannerInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5, backgroundColor: 'rgba(12,16,34,0.9)' },
  bannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  codeFound: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, backgroundColor: glassDark, marginBottom: 12 },
  codeFoundTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  codeFoundSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  retake: { flex: 1, height: 56, borderRadius: 18, borderWidth: 1, borderColor: glassBorder, backgroundColor: glassDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  retakeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  analyzeWrap: { flex: 1.4, borderRadius: 18, overflow: 'hidden' },
  analyze: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  analyzeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  heroArea: { marginTop: 130, alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  paper: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#E5E7EB', shadowOpacity: 0.7, shadowRadius: 26, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
  paperBeam: { position: 'absolute', left: -6, right: -6, top: 0, height: 4 },
  chip: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: glassDark, borderWidth: 1, borderColor: glassBorder, alignItems: 'center', justifyContent: 'center' },
  magnifier: { position: 'absolute' },
  statusArea: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, borderWidth: 1, backgroundColor: glassDark, marginBottom: 18 },
  statusTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  statusSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 3 },
  statusPct: { fontSize: 22, fontWeight: '800' },
  errorBadge: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(239,68,68,0.18)', alignItems: 'center', justifyContent: 'center' },
  steps: { gap: 16, paddingHorizontal: 8, paddingBottom: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBullet: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6 },
  stepText: { color: 'rgba(255,255,255,0.75)', fontSize: 16 },
});
