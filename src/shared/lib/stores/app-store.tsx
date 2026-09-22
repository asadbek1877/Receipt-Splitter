import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from '@/features/auth/api';
import { getToken, removeToken } from '../utils/token-storage';
import { queryClient } from '@/shared/config/query-client';
import { useSplitterStore } from '@/shared/store/useSplitterStore';
import { useDebtsStore } from '@/features/debts/model/debts.store';
import { useFriendsStore } from '@/features/friends/model/friends.store';
import type { LanguageCode } from '@/shared/config/languages';
import { DEFAULT_LANGUAGE } from '@/shared/config/languages';
import { DEFAULT_CURRENCY } from '@/shared/config/currencies';

const isAuthError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  return /authorization|unauthorized|token expired|expired token|expired/i.test(error.message);
};

const USER_SCOPED_STORAGE_KEYS = [
  'receipt-splitter-storage',
  'debts-storage',
  'friends-storage',
];

async function clearUserScopedClientState() {
  useSplitterStore.getState().resetStore();
  useDebtsStore.getState().clearAll();
  useFriendsStore.getState().clearAll();
  queryClient.clear();

  await Promise.allSettled([
    useSplitterStore.persist.clearStorage(),
    useDebtsStore.persist.clearStorage(),
    useFriendsStore.persist.clearStorage(),
    AsyncStorage.multiRemove(USER_SCOPED_STORAGE_KEYS),
  ]);
}

export interface User {
  id: number;
  email: string;
  username: string;
  uniqueId: string;
  avatarUrl: string | null;
}

interface AppStore {
  // Auth state
  token: string | null;
  user: User | null;
  isLoading: boolean;
  
  // App settings
  theme: 'light' | 'dark';
  language: LanguageCode;
  currency: string;
  
  // Actions
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: LanguageCode) => void;
  setCurrency: (currency: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      token: null,
      user: null,
      isLoading: false,
      theme: 'light',
      language: DEFAULT_LANGUAGE,
      currency: DEFAULT_CURRENCY,

      // Auth actions
      setToken: (token: string) => {
        set({ token });
      },

      setUser: (user: User) => {
        const previousUserId = get().user?.uniqueId;
        if (previousUserId && previousUserId !== user.uniqueId) {
          void clearUserScopedClientState();
        }
        set({ user });
      },

      setAuth: async (token: string, user: User) => {
        await clearUserScopedClientState();
        set({ token, user });
      },

      logout: async () => {
        try {
          set({ token: null, user: null });
          await removeToken();
          await clearUserScopedClientState();
        } catch (error) {
          console.error('Logout error:', error);
          set({ token: null, user: null });
        }
      },

      initializeAuth: async () => {
        set({ isLoading: true });
        try {
          const token = await getToken();
          if (!token) {
            set({ token: null, user: null });
            await clearUserScopedClientState();
            return;
          }

          set({ token });

          try {
            const currentUser = await getCurrentUser(token);
            set({ user: currentUser });
          } catch (error) {
            if (isAuthError(error)) {
              set({ token: null, user: null });
              await removeToken();
              await clearUserScopedClientState();
              return;
            }

            console.error('Current user fetch error:', error);
            set({ user: null });
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ token: null, user: null });
        } finally {
          set({ isLoading: false });
        }
      },

      // App settings actions
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        currency: state.currency,
        // Не сохраняем токен и пользователя в AsyncStorage, 
        // так как токен сохраняется отдельно в SecureStore
      }),
    }
  )
);

// Provider component for initialization
import { ReactNode, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { onUnauthorized } from '@/shared/api/auth-events';

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const initializeAuth = useAppStore((s) => s.initializeAuth);
  const logout = useAppStore((s) => s.logout);
  const router = useRouter();
  
  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const unsubscribe = onUnauthorized(async () => {
      await logout();
      router.replace('/');
    });
    return unsubscribe;
  }, [logout, router]);
  
  return <>{children}</>;
}
