import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../api/client';
import type { User } from '../types/models';

interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, displayName: string, password: string) => Promise<void>;
    loadMe: () => Promise<void>;
    updateProfile: (data: Partial<Pick<User, 'displayName' | 'homeCountry' | 'homeCurrency'>>) => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            isAuthenticated: false,

            login: async (username: string, password: string) => {
                const result = await api.login({ username, password });
                set({ token: result.token, user: result.user, isAuthenticated: true });
            },

            register: async (username: string, displayName: string, password: string) => {
                const result = await api.register({ username, displayName, password });
                set({ token: result.token, user: result.user, isAuthenticated: true });
            },

            loadMe: async () => {
                const token = get().token;
                if (!token) {
                    set({ user: null, isAuthenticated: false });
                    return;
                }
                try {
                    const user = await api.getMe();
                    set({ user, isAuthenticated: true });
                } catch {
                    set({ token: null, user: null, isAuthenticated: false });
                }
            },

            updateProfile: async (data) => {
                const user = await api.updateMe(data);
                set({ user, isAuthenticated: true });
            },

            logout: () => {
                set({ token: null, user: null, isAuthenticated: false });
            },
        }),
        {
            name: 'travelmap-auth',
        }
    )
);
