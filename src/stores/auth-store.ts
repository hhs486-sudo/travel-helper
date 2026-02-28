'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { bkend } from '@/lib/bkend';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { accessToken, refreshToken } = await bkend.auth.signin({ email, password });
          localStorage.setItem('bkend_access_token', accessToken);
          localStorage.setItem('bkend_refresh_token', refreshToken);
          const user = await bkend.auth.me();
          set({ user, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        await bkend.auth.signout();
        localStorage.removeItem('bkend_access_token');
        localStorage.removeItem('bkend_refresh_token');
        set({ user: null });
      },

      fetchMe: async () => {
        try {
          const user = await bkend.auth.me();
          set({ user });
        } catch {
          set({ user: null });
        }
      },
    }),
    { name: 'auth-storage', partialize: (state) => ({ user: state.user }) }
  )
);
