import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Input, Button, Spinner } from 'tamagui';
import { ChevronLeft, Shield, RefreshCcw, Save } from '@tamagui/lucide-icons';

import { apiClient } from '@/features/auth/api';

type AdminOverview = {
  usersTotal: number;
  activeUsers7d: number;
  sessionsTotal: number;
  topItems: { name: string; count: number }[];
};

type AdminUser = {
  id: number;
  email: string;
  username: string;
  uniqueId: string;
  createdAt: string;
  avatarUrl?: string | null;
  sessionsCount: number;
  lastActiveAt?: string | null;
  topItems: { name: string; count: number }[];
};

export default function AdminPanelScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editing, setEditing] = useState<Record<number, { username: string; email: string }>>({});

  const headers = useMemo(
    () => ({ 'x-admin-password': password.trim() }),
    [password]
  );

  const loadData = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Admin password is required');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/admin/unlock', {}, { headers });
      const [overviewRes, usersRes] = await Promise.all([
        apiClient.get<AdminOverview>('/admin/overview', { headers }),
        apiClient.get<AdminUser[]>('/admin/users', { headers }),
      ]);

      setAuthorized(true);
      setOverview(overviewRes.data);
      setUsers(usersRes.data);
      setEditing(
        usersRes.data.reduce<Record<number, { username: string; email: string }>>((acc, user) => {
          acc[user.id] = { username: user.username, email: user.email };
          return acc;
        }, {})
      );
    } catch (error: any) {
      setAuthorized(false);
      const message = error?.message || 'Admin login failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async (userId: number) => {
    const payload = editing[userId];
    if (!payload) return;

    try {
      await apiClient.patch(`/admin/users/${userId}`, payload, { headers });
      Alert.alert('Saved', 'User updated');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update user');
    }
  };

  return (
    <YStack f={1} bg="$background">
      <YStack px="$4" pt="$4" pb="$3" borderBottomWidth={1} borderBottomColor="$gray5" gap="$3">
        <XStack ai="center" gap="$2">
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color="#2C3D4F" />
          </Pressable>
          <Shield size={18} color="#2ECC71" />
          <Text fontSize={18} fontWeight="700">Admin Panel</Text>
        </XStack>

        {!authorized && (
          <XStack gap="$2">
            <Input
              f={1}
              secureTextEntry
              placeholder="Admin password"
              value={password}
              onChangeText={setPassword}
            />
            <Button bg="#2ECC71" color="white" onPress={loadData} disabled={loading}>
              {loading ? <Spinner color="white" size="small" /> : 'Open'}
            </Button>
          </XStack>
        )}

        {authorized && (
          <Pressable onPress={loadData}>
            <XStack ai="center" gap="$2" px="$2" py="$1.5" bg="#2ECC711A" br={10} alignSelf="flex-start">
              <RefreshCcw size={14} color="#2ECC71" />
              <Text color="#2ECC71" fontSize={12} fontWeight="700">Refresh</Text>
            </XStack>
          </Pressable>
        )}
      </YStack>

      {authorized ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
          <YStack gap="$3">
            <XStack gap="$2">
              <YStack f={1} p="$3" br={12} bg="$color1" borderWidth={1} borderColor="$gray5">
                <Text fontSize={11} color="$gray10">Users</Text>
                <Text fontSize={20} fontWeight="700">{overview?.usersTotal || 0}</Text>
              </YStack>
              <YStack f={1} p="$3" br={12} bg="$color1" borderWidth={1} borderColor="$gray5">
                <Text fontSize={11} color="$gray10">Active 7d</Text>
                <Text fontSize={20} fontWeight="700">{overview?.activeUsers7d || 0}</Text>
              </YStack>
              <YStack f={1} p="$3" br={12} bg="$color1" borderWidth={1} borderColor="$gray5">
                <Text fontSize={11} color="$gray10">Sessions</Text>
                <Text fontSize={20} fontWeight="700">{overview?.sessionsTotal || 0}</Text>
              </YStack>
            </XStack>

            <YStack p="$3" br={12} bg="$color1" borderWidth={1} borderColor="$gray5" gap="$2">
              <Text fontSize={14} fontWeight="700">Top products (7 days)</Text>
              {(overview?.topItems || []).slice(0, 8).map((item) => (
                <XStack key={item.name} ai="center" jc="space-between">
                  <Text fontSize={13}>{item.name}</Text>
                  <Text fontSize={13} color="$gray10">{item.count}</Text>
                </XStack>
              ))}
            </YStack>

            <Text fontSize={14} fontWeight="700">Users</Text>
            {users.map((user) => (
              <YStack key={user.id} p="$3" br={12} bg="$color1" borderWidth={1} borderColor="$gray5" gap="$2.5">
                <Text fontSize={12} color="$gray10">#{user.id} {user.uniqueId}</Text>
                <Input
                  value={editing[user.id]?.username || ''}
                  onChangeText={(value) =>
                    setEditing((prev) => ({
                      ...prev,
                      [user.id]: {
                        ...(prev[user.id] || { username: '', email: '' }),
                        username: value,
                      },
                    }))
                  }
                />
                <Input
                  value={editing[user.id]?.email || ''}
                  onChangeText={(value) =>
                    setEditing((prev) => ({
                      ...prev,
                      [user.id]: {
                        ...(prev[user.id] || { username: '', email: '' }),
                        email: value,
                      },
                    }))
                  }
                />
                <XStack ai="center" jc="space-between">
                  <Text fontSize={11} color="$gray10">
                    Sessions: {user.sessionsCount} | Last active: {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : 'N/A'}
                  </Text>
                  <Button size="$2" icon={Save} onPress={() => saveUser(user.id)}>
                    Save
                  </Button>
                </XStack>
              </YStack>
            ))}
          </YStack>
        </ScrollView>
      ) : (
        <YStack f={1} ai="center" jc="center" px="$6" gap="$2">
          <Shield size={44} color="#2ECC71" />
          <Text textAlign="center" color="$gray10">
            Tap hidden trigger in Settings 5 times, then enter admin password.
          </Text>
        </YStack>
      )}
    </YStack>
  );
}
