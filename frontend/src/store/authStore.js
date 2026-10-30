import { create } from 'zustand';
import { authApi } from '../api/client';

export const useAuthStore = create((set, get) => ({
  user:  null,
  token: null,
  loading: true,

  init: async () => {
    const token = localStorage.getItem('grace_token');
    if (!token) { set({ loading: false }); return; }
    try {
      const { data } = await authApi.me();
      set({ user: data, token, loading: false });
    } catch {
      localStorage.removeItem('grace_token');
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    localStorage.setItem('grace_token', data.token);
    set({ user: data.user, token: data.token });
  },

  logout: async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('grace_token');
    set({ user: null, token: null });
  },

  hasPermission: (key) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return user.permissions?.includes(key) || user.permissions?.includes('*');
  },

  hasRole: (...roles) => {
    const { user } = get();
    return user && roles.includes(user.role);
  },
}));
