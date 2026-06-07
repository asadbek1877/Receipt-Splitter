import React, { useState } from 'react';
import { Image, StyleSheet, ActivityIndicator } from 'react-native';
import { View, Text } from 'tamagui';

interface UserAvatarProps {
  uri?: string | null;
  label: string;
  size?: number;
  textSize?: number;
  backgroundColor?: string;
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});

export function UserAvatar({
  uri,
  label,
  size = 48,
  textSize,
  backgroundColor = '$gray5',
}: UserAvatarProps) {
  const radius = size / 2;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Check if URI is valid
  const validUri = uri && uri.trim() !== '' && !error;

  const handleLoadStart = () => setLoading(true);
  const handleLoadEnd = () => setLoading(false);
  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  return (
    <View
      w={size}
      h={size}
      br={radius}
      overflow="hidden"
      ai="center"
      jc="center"
      backgroundColor={backgroundColor}
    >
      {validUri ? (
        <>
          <Image
            source={{ uri, cache: 'reload' }}
            style={styles.image}
            resizeMode="cover"
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
          />
          {loading && (
            <View position="absolute" ai="center" jc="center" w="100%" h="100%">
              <ActivityIndicator size="small" color="#E91E63" />
            </View>
          )}
        </>
      ) : (
        <Text fontSize={textSize ?? Math.round(size / 2.5)} fontWeight="700">
          {label}
        </Text>
      )}
    </View>
  );
}

export default UserAvatar;
