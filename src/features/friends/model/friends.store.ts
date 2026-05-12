// src/features/friends/model/friends.store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FriendsApi } from '../api/friends.api';

export type Friend = {
  uniqueId: string;
  username: string;
  avatarUrl: string | null;
  raw: any;
};

type State = {
  friends: Friend[];
  requestsRaw: any | null;
  loading: boolean;
  error?: string;
};

type Actions = {
  fetchAll: () => Promise<void>;
  search: (q: string) => Promise<any[]>;
  send: (uniqueId: string) => Promise<void>;
  remove: (uniqueId: string) => Promise<void>;
  addLocal: (friend: Friend) => void;
  editFriend: (uniqueId: string, updates: Partial<Friend>) => void;
  clearAll: () => void;
};

export const useFriendsStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      friends: [],
      requestsRaw: null,
      loading: false,

      async fetchAll() {
        set({ loading: true, error: undefined });
        try {
          const [friendsRaw, requestsRaw] = await Promise.all([
            FriendsApi.list(),
            FriendsApi.requests(),
          ]);
          const normalizedFriends: Friend[] = friendsRaw.map((item: any) => {
            const raw = item.raw ?? item;
            const rawUser = raw.user ?? raw;
            const avatarUrl = item.avatarUrl ?? raw.avatarUrl ?? rawUser?.avatarUrl ?? null;
            const uniqueId = item.uniqueId ?? raw.uniqueId ?? rawUser?.uniqueId;
            const username = item.username ?? raw.username ?? rawUser?.username;

            return {
              uniqueId,
              username,
              avatarUrl,
              raw,
            };
          });

          set({ friends: normalizedFriends, requestsRaw });
        } catch (e: any) {
          set({ error: e?.message || 'Failed to load friends' });
          // Keep existing friends on error
        } finally {
          set({ loading: false });
        }
      },

  async search(q) {
    try {
      return await FriendsApi.search(q);
    } catch {
      // Return empty on error
      return [];
    }
  },

  async send(uniqueId) {
    try {
      await FriendsApi.sendRequest(uniqueId);
      await get().fetchAll();
    } catch (e: any) {
      set({ error: e?.message || 'Failed to send request' });
    }
  },

  async remove(uniqueId) {
    try {
      await FriendsApi.remove(uniqueId);
    } catch {
      // Remove locally even if API fails
    }
    // Remove from local state
    set({ friends: get().friends.filter(f => f.uniqueId !== uniqueId) });
  },

  addLocal(friend: Friend) {
    // Local-only friends are disabled to keep the list strictly server-synced.
    return;
  },

  editFriend(uniqueId: string, updates: Partial<Friend>) {
    set({
      friends: get().friends.map(f =>
        f.uniqueId === uniqueId ? { ...f, ...updates } : f
      ),
    });
  },

  clearAll() {
    set({ friends: [], requestsRaw: null });
  },
    }),
    {
      name: 'friends-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ friends: state.friends }),
    }
  )
);
