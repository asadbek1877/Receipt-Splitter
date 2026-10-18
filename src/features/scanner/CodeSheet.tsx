/**
 * Bottom sheet that explains a scanned QR / barcode: what it is, what is inside,
 * and the safe next actions (open, copy, close). Links are never opened automatically.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Barcode, Check, Copy, ExternalLink, Link2, QrCode, Receipt, ShieldAlert, X } from '@tamagui/lucide-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { classifyCode, formatName, type CodeInfo, type RawCode } from './codes';
import { lookupProduct, type ProductInfo } from './productLookup';

type Props = {
  code: RawCode;
  bottomInset: number;
  accent: string;
  accentB: string;
  onClose: () => void;
};

export default function CodeSheet({ code, bottomInset, accent, accentB, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const info = useMemo<CodeInfo>(() => classifyCode(code), [code]);
  const [copied, setCopied] = useState(false);
  const [product, setProduct] = useState<{ state: 'loading' | 'done' | 'error'; data?: ProductInfo }>({ state: 'loading' });

  useEffect(() => {
    setCopied(false);
    if (info.kind !== 'product') return;
    const controller = new AbortController();
    setProduct({ state: 'loading' });
    lookupProduct(info.code, controller.signal)
      .then((data) => setProduct({ state: 'done', data }))
      .catch(() => !controller.signal.aborted && setProduct({ state: 'error' }));
    return () => controller.abort();
  }, [info]);

  const copyText = info.kind === 'fiscal' || info.kind === 'url' ? info.url : info.kind === 'product' ? info.code : info.text;

  const copy = async () => {
    await Clipboard.setStringAsync(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const open = async () => {
    if (info.kind !== 'fiscal' && info.kind !== 'url') return;
    try {
      await Linking.openURL(info.url);
    } catch {
      Alert.alert(t('scanner.cannotOpen', "Couldn't open the link"), info.url);
    }
  };

  let Icon = QrCode;
  let title = t('scanner.text.title', 'Code content');
  let subtitle = formatName(code.type);
  const rows: { label: string; value: string }[] = [];
  let note: string | null = null;
  let warning: string | null = null;

  if (info.kind === 'fiscal') {
    Icon = Receipt;
    title = t('scanner.fiscal.title', 'Fiscal receipt QR');
    subtitle = info.host;
    rows.push({ label: t('scanner.fiscal.terminal', 'Terminal'), value: info.terminalId });
    rows.push({ label: t('scanner.fiscal.number', 'Receipt no.'), value: info.receiptNo });
    if (info.dateTime) {
      let when = info.dateTime.toLocaleString();
      try {
        when = info.dateTime.toLocaleString(i18n.language, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch {
        /* keep default */
      }
      rows.push({ label: t('scanner.fiscal.date', 'Purchase time'), value: when });
    }
    if (info.fiscalSign) rows.push({ label: t('scanner.fiscal.sign', 'Fiscal sign'), value: info.fiscalSign });
    note = t(
      'scanner.fiscal.note',
      "This code is a link to the shop's official receipt. The items are not stored in the code, and the tax portal only shares them with its own site. Open it to see the items, or photograph the printed receipt to split it here.",
    );
  } else if (info.kind === 'url') {
    Icon = Link2;
    title = t('scanner.url.title', 'Web link');
    subtitle = info.host || formatName(code.type);
    rows.push({ label: t('scanner.url.address', 'Address'), value: info.url });
    warning = info.secure
      ? t('scanner.url.warn', 'Only open links from sources you trust.')
      : t('scanner.url.warnInsecure', 'This link is not encrypted (http). Only open it if you trust the source.');
  } else if (info.kind === 'product') {
    Icon = Barcode;
    title =
      product.state === 'done' && product.data?.found
        ? product.data.name!
        : t('scanner.product.title', 'Product barcode');
    subtitle = info.format;
    rows.push({ label: t('scanner.product.code', 'Code'), value: info.code });
    if (product.state === 'done' && product.data?.found) {
      if (product.data.brands) rows.push({ label: t('scanner.product.brand', 'Brand'), value: product.data.brands });
      if (product.data.quantity) rows.push({ label: t('scanner.product.quantity', 'Size'), value: product.data.quantity });
    }
    if (info.region) rows.push({ label: t('scanner.product.region', 'Code issued in'), value: info.region });
    if (!info.checksumOk) {
      warning = t('scanner.product.badChecksum', 'The check digit does not match. The code may be misread or damaged — scan again.');
    } else if (product.state === 'done' && !product.data?.found) {
      note = t(
        'scanner.product.notFound',
        'This product is not in the public database (local goods often are not). The code itself is valid.',
      );
    } else if (product.state === 'error') {
      note = t('scanner.product.offline', "Couldn't look the product up. Check your connection.");
    }
  } else {
    rows.push({ label: t('scanner.text.content', 'Content'), value: info.text });
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { paddingBottom: bottomInset + 18, borderColor: `${accent}55` }]}
      >
        <View style={styles.grabber} />

        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: `${accent}2E` }]}>
            <Icon size={26} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
          {info.kind === 'product' && product.state === 'loading' ? <ActivityIndicator color="#FFFFFF" /> : null}
          {info.kind === 'product' && product.state === 'done' && product.data?.imageUrl ? (
            <Image source={{ uri: product.data.imageUrl }} style={styles.thumb} />
          ) : null}
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
            <X size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.rows}>
          {rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue} selectable numberOfLines={3}>{r.value}</Text>
            </View>
          ))}
        </View>

        {warning ? (
          <View style={[styles.callout, { backgroundColor: 'rgba(245,158,11,0.14)', borderColor: 'rgba(245,158,11,0.4)' }]}>
            <ShieldAlert size={18} color="#FBBF24" />
            <Text style={[styles.calloutText, { color: '#FDE68A' }]}>{warning}</Text>
          </View>
        ) : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <View style={styles.actions}>
          <Pressable onPress={copy} style={styles.secondary} accessibilityRole="button">
            {copied ? <Check size={18} color="#FFFFFF" /> : <Copy size={18} color="#FFFFFF" />}
            <Text style={styles.secondaryText}>{copied ? t('scanner.copied', 'Copied') : t('scanner.copy', 'Copy')}</Text>
          </Pressable>
          {info.kind === 'fiscal' || info.kind === 'url' ? (
            <Pressable onPress={open} style={styles.primaryWrap} accessibilityRole="button">
              <LinearGradient colors={[accentB, accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                <ExternalLink size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>
                  {info.kind === 'fiscal' ? t('scanner.fiscal.open', 'Open official receipt') : t('scanner.url.open', 'Open link')}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable onPress={onClose} style={styles.primaryWrap} accessibilityRole="button">
              <LinearGradient colors={[accentB, accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                <Text style={styles.primaryText}>{t('scanner.done', 'Done')}</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(3,6,18,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    backgroundColor: 'rgba(12,16,34,0.96)',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#FFFFFF' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  rows: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  rowLabel: { width: 104, color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  rowValue: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  callout: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 14, borderWidth: 1 },
  calloutText: { flex: 1, fontSize: 13, lineHeight: 18 },
  note: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  secondary: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  primaryWrap: { flex: 1.5, borderRadius: 16, overflow: 'hidden' },
  primary: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', flexShrink: 1 },
});
