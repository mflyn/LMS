import React, { useState, useEffect, useMemo } from 'react';
import { StatusBar, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './src/contexts/AuthContext';
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';
import analyticsService from './src/services/analyticsService';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { navigationRef } from './src/services/NavigationService';

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

// 主应用组件
const MainApp = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  
  // 认证上下文 - 使用 useMemo 优化
  const authContext = useMemo(() => ({
    signIn: async (token) => {
      try {
        await AsyncStorage.setItem('userToken', token);
        setUserToken(token);
        // 记录登录事件
        analyticsService.trackEvent('user_login', { timestamp: new Date().toISOString() });
      } catch (e) {
        console.error('保存token失败:', e);
      }
    },
    signOut: async () => {
      try {
        await AsyncStorage.removeItem('userToken');
        setUserToken(null);
        // 记录登出事件
        analyticsService.trackEvent('user_logout', { timestamp: new Date().toISOString() });
      } catch (e) {
        console.error('移除token失败:', e);
      }
    },
    token: userToken,
  }), [userToken]); // 依赖 userToken，当 userToken 变化时重新计算
  
  // 检查是否已登录
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        setUserToken(token);
      } catch (e) {
        console.error('获取token失败:', e);
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
      });
      analyticsService.stopAutoSync();
    };
  }, []);
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }
  
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
});