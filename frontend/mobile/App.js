import React, { useState, useEffect, useMemo } from 'react';
import { StatusBar, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './src/contexts/AuthContext';
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';
import analyticsService from './src/services/analyticsService';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { navigationRef } from './src/services/NavigationService';

// 导入不同角色的导航器
import MainAppNavigator from './src/navigation/AppNavigator';
import ParentAppNavigator from './parent-app/navigation/AppNavigator';
import StudentAppNavigator from './student-app/navigation/AppNavigator';

// 导入角色选择屏幕
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';

// 用户角色常量
export const USER_ROLES = {
  PARENT: 'parent',
  STUDENT: 'student',
  TEACHER: 'teacher', // 预留教师角色
};

// 离线模式指示器组件
const OfflineBanner = () => {
  const { isOfflineMode } = useNetwork();
  
  if (!isOfflineMode) return null;
  
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineText}>离线模式 - 部分功能可能受限</Text>
    </View>
  );
};

// 根据角色获取对应的导航器
const getNavigatorByRole = (role) => {
  switch (role) {
    case USER_ROLES.PARENT:
      return ParentAppNavigator;
    case USER_ROLES.STUDENT:
      return StudentAppNavigator;
    case USER_ROLES.TEACHER:
    default:
      return MainAppNavigator; // 默认使用主导航器（教师端）
  }
};

// 主应用组件
const MainApp = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  
  // 认证上下文 - 使用 useMemo 优化
  const authContext = useMemo(() => ({
    signIn: async (token, userData = {}) => {
      try {
        await AsyncStorage.setItem('userToken', token);
        if (userData.role) {
          await AsyncStorage.setItem('userRole', userData.role);
          setUserRole(userData.role);
        }
        setUserToken(token);
        setShowRoleSelection(false);
        
        // 记录登录事件
        analyticsService.trackEvent('user_login', { 
          timestamp: new Date().toISOString(),
          role: userData.role || 'unknown'
        });
      } catch (e) {
        console.error('保存用户信息失败:', e);
      }
    },
    signOut: async () => {
      try {
        await AsyncStorage.multiRemove(['userToken', 'userRole']);
        setUserToken(null);
        setUserRole(null);
        setShowRoleSelection(false);
        
        // 记录登出事件
        analyticsService.trackEvent('user_logout', { 
          timestamp: new Date().toISOString(),
          role: userRole || 'unknown'
        });
      } catch (e) {
        console.error('清除用户信息失败:', e);
      }
    },
    switchRole: async (newRole) => {
      try {
        await AsyncStorage.setItem('userRole', newRole);
        setUserRole(newRole);
        
        // 记录角色切换事件
        analyticsService.trackEvent('role_switch', {
          timestamp: new Date().toISOString(),
          fromRole: userRole,
          toRole: newRole
        });
      } catch (e) {
        console.error('切换角色失败:', e);
      }
    },
    showRoleSelector: () => {
      setShowRoleSelection(true);
    },
    token: userToken,
    role: userRole,
    isAuthenticated: !!userToken,
  }), [userToken, userRole]); // 依赖 userToken 和 userRole
  
  // 检查是否已登录和角色信息
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const [token, role] = await AsyncStorage.multiGet(['userToken', 'userRole']);
        const userToken = token[1];
        const userRole = role[1];
        
        setUserToken(userToken);
        setUserRole(userRole);
        
        // 如果已登录但没有角色信息，显示角色选择
        if (userToken && !userRole) {
          setShowRoleSelection(true);
        }
      } catch (e) {
        console.error('获取用户信息失败:', e);
      } finally {
        setIsLoading(false);
      }
    };
    
    bootstrapAsync();
  }, []);
  
  // 初始化分析服务
  useEffect(() => {
    analyticsService.init({ autoSync: true });
    
    // 应用关闭时记录会话结束事件，并停止自动同步
    return () => {
      analyticsService.trackEvent('session_end', {
        timestamp: new Date().toISOString(),
        role: userRole || 'unknown'
      });
      analyticsService.stopAutoSync();
    };
  }, [userRole]);
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
        <Text style={styles.loadingText}>正在加载...</Text>
      </View>
    );
  }

  // 显示角色选择屏幕
  if (showRoleSelection) {
    return (
      <AuthContext.Provider value={authContext}>
        <PaperProvider>
          <StatusBar barStyle="dark-content" />
          <RoleSelectionScreen />
        </PaperProvider>
      </AuthContext.Provider>
    );
  }

  // 根据用户角色选择对应的导航器
  const AppNavigator = userToken && userRole ? getNavigatorByRole(userRole) : MainAppNavigator;
  
  return (
    <AuthContext.Provider value={authContext}>
      <PaperProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer ref={navigationRef}>
          <OfflineBanner />
          <AppNavigator />
        </NavigationContainer>
      </PaperProvider>
    </AuthContext.Provider>
  );
};

// 导出主应用
export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <MainApp />
      </NetworkProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#f8d7da',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  offlineText: {
    color: '#721c24',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});