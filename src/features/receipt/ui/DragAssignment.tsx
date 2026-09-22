import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ShoppingBag } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';

export type DragParticipant = {
  uniqueId: string;
  username: string;
};

export type DragAssignableItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
  imageUri?: string | null;
  thumbnailUrl?: string | null;
  price: number;
  quantity: number;
  totalPrice?: number;
};

export type DropZoneRects = number[];

type DraggableProductCardProps = {
  item: DragAssignableItem;
  currency: string;
  dropZoneRects: SharedValue<DropZoneRects>;
  activeDropIndex: SharedValue<number>;
  onAssign: (productId: string, participantIndex: number) => void;
};

type ParticipantDropDockProps = {
  participants: DragParticipant[];
  dropZoneRects: SharedValue<DropZoneRects>;
  activeDropIndex: SharedValue<number>;
  bottomInset: number;
};

const avatarColors = ['#0D9488', '#2563EB', '#7C3AED', '#EA580C', '#DB2777', '#059669'];

const formatMoney = (currency: string, value: number) =>
  `${currency} ${Math.round(value).toLocaleString('en-US')}`;

const getImageUri = (item: DragAssignableItem) =>
  item.imageUrl || item.imageUri || item.thumbnailUrl || null;

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

function findDropZoneIndex(x: number, y: number, rects: DropZoneRects) {
  'worklet';
  for (let index = 0; index < rects.length; index += 4) {
    const zoneX = rects[index] ?? 0;
    const zoneY = rects[index + 1] ?? 0;
    const zoneWidth = rects[index + 2] ?? 0;
    const zoneHeight = rects[index + 3] ?? 0;
    if (
      zoneWidth > 0 &&
      zoneHeight > 0 &&
      x >= zoneX &&
      x <= zoneX + zoneWidth &&
      y >= zoneY &&
      y <= zoneY + zoneHeight
    ) {
      return index / 4;
    }
  }
  return -1;
}

export function DraggableProductCard({
  item,
  currency,
  dropZoneRects,
  activeDropIndex,
  onAssign,
}: DraggableProductCardProps) {
  const { t } = useTranslation();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragActive = useSharedValue(0);
  const opacity = useSharedValue(1);
  const exitScale = useSharedValue(1);
  const shimmerProgress = useSharedValue(0);
  const [imageLoading, setImageLoading] = useState(Boolean(getImageUri(item)));
  const [imageFailed, setImageFailed] = useState(false);

  const total = item.totalPrice ?? item.price * item.quantity;
  const imageUri = imageFailed ? null : getImageUri(item);

  useEffect(() => {
    shimmerProgress.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
  }, [shimmerProgress]);

  const assignOnJS = useCallback(
    (productId: string, participantIndex: number) => {
      onAssign(productId, participantIndex);
    },
    [onAssign]
  );

  const gesture = Gesture.Pan()
    .activateAfterLongPress(260)
    .onStart(() => {
      dragActive.value = withTiming(1, { duration: 120 });
      activeDropIndex.value = -1;
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      activeDropIndex.value = findDropZoneIndex(
        event.absoluteX,
        event.absoluteY,
        dropZoneRects.value
      );
    })
    .onEnd(() => {
      const targetIndex = activeDropIndex.value;
      activeDropIndex.value = -1;
      dragActive.value = withTiming(0, { duration: 120 });

      if (targetIndex >= 0) {
        translateX.value = withTiming(0, { duration: 140 });
        translateY.value = withTiming(0, { duration: 140 });
        exitScale.value = withTiming(0.72, { duration: 190 });
        opacity.value = withTiming(0, { duration: 190 }, (finished) => {
          if (finished) {
            runOnJS(assignOnJS)(item.id, targetIndex);
          }
        });
        return;
      }

      translateX.value = withSpring(0, { damping: 17, stiffness: 180 });
      translateY.value = withSpring(0, { damping: 17, stiffness: 180 });
    })
    .onFinalize(() => {
      activeDropIndex.value = -1;
      dragActive.value = withTiming(0, { duration: 120 });
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-180, 0, 180],
      [-2.4, 0, 2.4],
      Extrapolation.CLAMP
    );

    return {
      opacity: opacity.value,
      zIndex: dragActive.value > 0 ? 30 : 1,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: exitScale.value * (1 + dragActive.value * 0.035) },
        { rotate: `${rotate * dragActive.value}deg` },
      ],
      shadowOpacity: 0.08 + dragActive.value * 0.12,
      shadowRadius: 18 + dragActive.value * 10,
      elevation: dragActive.value > 0 ? 10 : 3,
    };
  });

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmerProgress.value, [0, 1], [-42, 72]),
      },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.productCard, animatedStyle]}>
        <View style={styles.productImageWrap}>
          {imageUri ? (
            <>
              <Image
                source={{ uri: imageUri, cache: 'force-cache' }}
                style={styles.productImage}
                resizeMode="cover"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageFailed(true);
                }}
              />
              {imageLoading && (
                <View style={styles.imageSkeleton}>
                  <Animated.View style={[styles.imageShimmer, shimmerStyle]} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.imageFallback}>
              <ShoppingBag size={22} color="#0F766E" />
            </View>
          )}
        </View>
        <View style={styles.productCopy}>
          <Text numberOfLines={1} style={styles.productTitle}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.productMeta}>
            {t('orders.itemDragInstruction', { quantity: item.quantity })}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.productAmount}>
          {formatMoney(currency, total)}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

function ParticipantDropTarget({
  participant,
  index,
  dropZoneRects,
  activeDropIndex,
}: {
  participant: DragParticipant;
  index: number;
  dropZoneRects: SharedValue<DropZoneRects>;
  activeDropIndex: SharedValue<number>;
}) {
  const ref = useRef<View>(null);
  const color = avatarColors[index % avatarColors.length];

  const measureDropZone = useCallback(() => {
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        const next = [...dropZoneRects.value];
        const offset = index * 4;
        next[offset] = x;
        next[offset + 1] = y;
        next[offset + 2] = width;
        next[offset + 3] = height;
        dropZoneRects.value = next;
      });
    });
  }, [dropZoneRects, index]);

  useEffect(() => {
    measureDropZone();
  }, [measureDropZone]);

  const animatedStyle = useAnimatedStyle(() => {
    const active = activeDropIndex.value === index;
    return {
      transform: [
        {
          scale: withSpring(active ? 1.2 : 1, {
            damping: 15,
            stiffness: 240,
          }),
        },
      ],
      backgroundColor: active ? '#DCFCE7' : '#FFFFFF',
      borderColor: active ? '#22C55E' : '#E5E7EB',
      shadowOpacity: active ? 0.18 : 0.08,
      shadowRadius: active ? 18 : 12,
      elevation: active ? 8 : 3,
    };
  });

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      onLayout={measureDropZone}
      style={[styles.dropTarget, animatedStyle]}
    >
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{getInitials(participant.username)}</Text>
      </View>
      <Text numberOfLines={1} style={styles.avatarLabel}>{participant.username}</Text>
    </Animated.View>
  );
}

export function ParticipantDropDock({
  participants,
  dropZoneRects,
  activeDropIndex,
  bottomInset,
}: ParticipantDropDockProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.dock, { paddingBottom: bottomInset + 10 }]}>
      <Text style={styles.dockLabel}>{t('orders.dropOnParticipant')}</Text>
      <View style={styles.dropTargets}>
        {participants.map((participant, index) => (
          <ParticipantDropTarget
            key={participant.uniqueId}
            participant={participant}
            index={index}
            dropZoneRects={dropZoneRects}
            activeDropIndex={activeDropIndex}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  productCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  productImageWrap: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ECFDF5',
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  imageFallback: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFF7EE',
  },
  imageSkeleton: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#EEF2F7',
  },
  imageShimmer: {
    width: 24,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  productCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  productTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  productMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  productAmount: {
    minWidth: 88,
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: 'rgba(248,250,252,0.98)',
  },
  dockLabel: {
    marginBottom: 8,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  dropTargets: {
    flexDirection: 'row',
    gap: 10,
  },
  dropTarget: {
    width: 74,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  avatarLabel: {
    maxWidth: 64,
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
  },
});
