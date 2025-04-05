import React, { useState, useEffect } from 'react';
import { StatusBar, View, Text, StyleSheet } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './src/contexts/AuthContext';
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';
import analyticsService from './src/services/analyticsService';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
  
  // 认证上下文
  const authContext = {
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
  };
  
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
    
    // 记录应用启动事件
    analyticsService.trackEvent('app_start', {
      timestamp: new Date().toISOString(),
    });
    
    // 应用关闭时记录会话结束事件
    return () => {
      analyticsService.trackEvent('session_end', {
        timestamp: new Date().toISOString(),
      });
    };
  }, []);
  
  if (isLoading) {
    return null; // 或者显示加载指示器
  }
  
  return (
    <AuthContext.Provider value={authContext}>
      <PaperProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
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
});