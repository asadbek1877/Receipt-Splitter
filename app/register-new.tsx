// app/register-new.tsx
import React, { useState } from 'react';
import { YStack, XStack, Text, View, Button as TamaguiButton } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { TextInput, Pressable } from 'react-native';
import { Eye, EyeOff, Facebook, Globe, Twitter } from '@tamagui/lucide-icons';
import Svg, { Circle, Path, G } from 'react-native-svg';

const GoogleIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill="none" stroke="#EA4335" strokeWidth="1.5" />
    <Path
      d="M12 7 A5 5 0 0 1 17 12"
      fill="none"
      stroke="#EA4335"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

export default function RegisterNewScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleNext = () => {
    if (email && password) {
      router.push('/login');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF5F9' }}>
      <LinearGradient
        colors={['#FFF5F9', '#FFEFF5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <YStack flex={1} pt="$4" pb="$6" px="$4">
          {/* Header */}
          <Animated.View entering={FadeIn.duration(500)}>
            <Text
              fontSize={18}
              fontWeight="600"
              color="#1A1A1A"
              mb="$4"
            >
              Welcome to Japan!
            </Text>
          </Animated.View>

          {/* Red Sun Circle - positioned absolutely */}
          <View
            position="absolute"
            top={120}
            right={-40}
            width={200}
            height={200}
          >
            <Svg width={200} height={200} viewBox="0 0 200 200">
              <Circle
                cx="100"
                cy="100"
                r="90"
                fill="#E91E63"
                opacity={0.85}
              />
              <Circle
                cx="100"
                cy="100"
                r="85"
                fill="#F06292"
                opacity={0.5}
              />
            </Svg>
          </View>

          {/* White Card */}
          <Animated.View
            entering={SlideInUp.delay(200).springify()}
            style={{
              flex: 1,
              marginTop: 'auto',
            }}
          >
            <LinearGradient
              colors={['#FFFFFF', '#FAFAFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                paddingHorizontal: 24,
                paddingTop: 32,
                paddingBottom: 24,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: -4 },
                elevation: 8,
              }}
            >
              <YStack gap="$4" pb="$6">
                {/* Title */}
                <Text
                  fontSize={22}
                  fontWeight="700"
                  color="#1A1A1A"
                >
                  Sign Up
                </Text>

                {/* Email Input */}
                <YStack gap="$2">
                  <Text fontSize={12} fontWeight="500" color="#666">
                    Email
                  </Text>
                  <TextInput
                    placeholder="example@gmail.com"
                    placeholderTextColor="#BDBDBD"
                    value={email}
                    onChangeText={setEmail}
                    style={{
                      height: 48,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: '#E0E0E0',
                      paddingHorizontal: 16,
                      fontSize: 14,
                      color: '#1A1A1A',
                      fontFamily: 'System',
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </YStack>

                {/* Password Input */}
                <YStack gap="$2">
                  <Text fontSize={12} fontWeight="500" color="#666">
                    Password
                  </Text>
                  <XStack
                    alignItems="center"
                    borderRadius={16}
                    borderWidth={1.5}
                    borderColor="#E0E0E0"
                    paddingHorizontal={16}
                    height={48}
                    backgroundColor="white"
                  >
                    <TextInput
                      placeholder="••••••••"
                      placeholderTextColor="#BDBDBD"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: '#1A1A1A',
                        fontFamily: 'System',
                      }}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={8}
                    >
                      {showPassword ? (
                        <Eye size={18} color="#999" />
                      ) : (
                        <EyeOff size={18} color="#999" />
                      )}
                    </Pressable>
                  </XStack>
                </YStack>

                {/* Next Button */}
                <TamaguiButton
                  width="100%"
                  height={52}
                  borderRadius={26}
                  backgroundColor="#1A1A1A"
                  color="white"
                  fontWeight="600"
                  fontSize={16}
                  marginTop="$2"
                  onPress={handleNext}
                  pressStyle={{ opacity: 0.85, scale: 0.98 }}
                  shadowColor="#000"
                  shadowOpacity={0.12}
                  shadowRadius={12}
                  shadowOffset={{ width: 0, height: 6 }}
                  elevation={6}
                >
                  Next
                </TamaguiButton>

                {/* Social Login */}
                <YStack gap="$3" marginTop="$4">
                  <Text
                    fontSize={12}
                    color="#999"
                    textAlign="center"
                  >
                    Or continue with
                  </Text>

                  <XStack
                    gap="$4"
                    justifyContent="center"
                    alignItems="center"
                  >
                    {/* Facebook */}
                    <Pressable
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#1877F2',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Facebook size={24} color="white" />
                    </Pressable>

                    {/* Google */}
                    <Pressable
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#EA4335',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <GoogleIcon />
                    </Pressable>

                    {/* Twitter */}
                    <Pressable
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#1DA1F2',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Twitter size={24} color="white" />
                    </Pressable>
                  </XStack>
                </YStack>

                {/* Sign In Link */}
                <YStack marginTop="$2" alignItems="center">
                  <XStack gap="$1">
                    <Text fontSize={13} color="#666">
                      Already have an account?
                    </Text>
                    <Pressable onPress={() => router.push('/login')}>
                      <Text
                        fontSize={13}
                        fontWeight="600"
                        color="#E91E63"
                      >
                        Sign in
                      </Text>
                    </Pressable>
                  </XStack>
                </YStack>
              </YStack>
            </LinearGradient>
          </Animated.View>
        </YStack>
      </LinearGradient>
    </SafeAreaView>
  );
}
