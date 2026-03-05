import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loginApi, meApi } from '@/api/authApi';
import { AuthUser } from '@/types/edu';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(`${base64}${padding}`);
}

function getTokenExpireAt(token: string) {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return Date.now() + TOKEN_TTL_MS;
    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as { exp?: number };
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
    return Date.now() + TOKEN_TTL_MS;
  } catch {
    return Date.now() + TOKEN_TTL_MS;
  }
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  tokenExpireAt: number | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
  isSessionValid: () => boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  refreshMe: () => Promise<AuthUser | null>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      tokenExpireAt: null,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      setSession: (token, user) =>
        set({
          token,
          user,
          tokenExpireAt: getTokenExpireAt(token),
        }),
      clearSession: () =>
        set({
          token: null,
          user: null,
          tokenExpireAt: null,
        }),
      isSessionValid: () => {
        const { token, tokenExpireAt } = get();
        if (!token || !tokenExpireAt) return false;
        return Date.now() < tokenExpireAt;
      },
      login: async (username, password) => {
        const response = await loginApi(username, password);
        get().setSession(response.token, response.user);
        return response.user;
      },
      refreshMe: async () => {
        const { token, isSessionValid } = get();
        if (!token || !isSessionValid()) return null;
        try {
          const response = await meApi(token);
          set({ user: response.user });
          return response.user;
        } catch {
          get().clearSession();
          return null;
        }
      },
    }),
    {
      name: 'teaching-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        tokenExpireAt: state.tokenExpireAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.setHydrated(true);
      },
    }
  )
);
