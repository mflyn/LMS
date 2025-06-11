import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { User, UserRole } from '../types';

interface AuthState {
  // 状态
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 动作
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  updateProfile: (profile: Partial<User>) => void;
  switchRole: (role: UserRole) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      // 初始状态
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // 登录
      login: async (credentials) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          // 模拟API调用
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials),
          });

          if (!response.ok) {
            throw new Error('登录失败');
          }

          const data = await response.json();
          
          set((state) => {
            state.user = data.user;
            state.token = data.token;
            state.isAuthenticated = true;
            state.isLoading = false;
            state.error = null;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.error = error instanceof Error ? error.message : '登录失败';
          });
          throw error;
        }
      },

      // 登出
      logout: () => {
        set((state) => {
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;
          state.error = null;
        });
      },

      // 设置用户
      setUser: (user) => {
        set((state) => {
          state.user = user;
          state.isAuthenticated = !!user;
        });
      },

      // 设置token
      setToken: (token) => {
        set((state) => {
          state.token = token;
          state.isAuthenticated = !!token;
        });
      },

      // 设置加载状态
      setLoading: (loading) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      // 设置错误
      setError: (error) => {
        set((state) => {
          state.error = error;
        });
      },

      // 清除错误
      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      // 更新用户资料
      updateProfile: (profile) => {
        set((state) => {
          if (state.user) {
            state.user = { ...state.user, ...profile };
          }
        });
      },

      // 切换角色
      switchRole: (role) => {
        set((state) => {
          if (state.user) {
            state.user.role = role;
          }
        });
      },
    })),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 