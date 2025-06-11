import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../types';

interface AuthState {
  // 状态
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  showRoleSelection: boolean;
  
  // 动作
  signIn: (token: string, userData?: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
  showRoleSelector: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  updateProfile: (profile: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      // 初始状态
      user: null,
      token: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      showRoleSelection: false,

      // 登录
      signIn: async (token, userData = {}) => {
        try {
          set((state) => {
            state.token = token;
            state.isAuthenticated = true;
            state.showRoleSelection = false;
            state.error = null;
            
            if (userData.role) {
              state.role = userData.role;
              state.user = userData as User;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : '登录失败';
          });
          throw error;
        }
      },

      // 登出
      signOut: async () => {
        try {
          set((state) => {
            state.user = null;
            state.token = null;
            state.role = null;
            state.isAuthenticated = false;
            state.showRoleSelection = false;
            state.error = null;
          });
        } catch (error) {
          console.error('登出失败:', error);
        }
      },

      // 切换角色
      switchRole: async (newRole) => {
        try {
          set((state) => {
            state.role = newRole;
            if (state.user) {
              state.user.role = newRole;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : '切换角色失败';
          });
          throw error;
        }
      },

      // 显示角色选择器
      showRoleSelector: () => {
        set((state) => {
          state.showRoleSelection = true;
        });
      },

      // 设置用户
      setUser: (user) => {
        set((state) => {
          state.user = user;
          state.role = user.role;
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
    })),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 