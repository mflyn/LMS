import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Notification } from '../types';

interface AppState {
  // UI状态
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  language: 'zh' | 'en';
  
  // 通知状态
  notifications: Notification[];
  unreadCount: number;
  
  // 加载状态
  globalLoading: boolean;
  
  // 错误状态
  globalError: string | null;
  
  // 动作
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'zh' | 'en') => void;
  
  // 通知相关动作
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  
  // 全局状态动作
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  clearGlobalError: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    immer((set, get) => ({
      // 初始状态
      sidebarCollapsed: false,
      theme: 'light',
      language: 'zh',
      notifications: [],
      unreadCount: 0,
      globalLoading: false,
      globalError: null,

      // 侧边栏动作
      toggleSidebar: () => {
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        });
      },

      setSidebarCollapsed: (collapsed) => {
        set((state) => {
          state.sidebarCollapsed = collapsed;
        });
      },

      // 主题设置
      setTheme: (theme) => {
        set((state) => {
          state.theme = theme;
        });
      },

      // 语言设置
      setLanguage: (language) => {
        set((state) => {
          state.language = language;
        });
      },

      // 添加通知
      addNotification: (notification) => {
        set((state) => {
          const newNotification: Notification = {
            ...notification,
            id: Date.now().toString(),
            read: false,
            createdAt: new Date().toISOString(),
          };
          state.notifications.unshift(newNotification);
          state.unreadCount = state.notifications.filter(n => !n.read).length;
        });
      },

      // 移除通知
      removeNotification: (id) => {
        set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id);
          state.unreadCount = state.notifications.filter(n => !n.read).length;
        });
      },

      // 标记通知为已读
      markNotificationAsRead: (id) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === id);
          if (notification && !notification.read) {
            notification.read = true;
            state.unreadCount = state.notifications.filter(n => !n.read).length;
          }
        });
      },

      // 标记所有通知为已读
      markAllNotificationsAsRead: () => {
        set((state) => {
          state.notifications.forEach(notification => {
            notification.read = true;
          });
          state.unreadCount = 0;
        });
      },

      // 清除所有通知
      clearAllNotifications: () => {
        set((state) => {
          state.notifications = [];
          state.unreadCount = 0;
        });
      },

      // 设置全局加载状态
      setGlobalLoading: (loading) => {
        set((state) => {
          state.globalLoading = loading;
        });
      },

      // 设置全局错误
      setGlobalError: (error) => {
        set((state) => {
          state.globalError = error;
        });
      },

      // 清除全局错误
      clearGlobalError: () => {
        set((state) => {
          state.globalError = null;
        });
      },
    })),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        language: state.language,
      }),
    }
  )
); 