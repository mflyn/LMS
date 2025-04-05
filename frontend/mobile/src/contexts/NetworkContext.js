/**
 * 网络连接上下文
 * 提供全局网络状态管理和离线模式支持
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import networkManager from '../services/networkManager';
import enhancedApi from '../services/enhancedApi';

// 创建网络上下文
export const NetworkContext = createContext({
  isConnected: true,
  isOfflineMode: false,
  syncPendingData: async () => {},
});

/**
 * 网络上下文提供器
 */
export const NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // 同步待同步的数据
  const syncPendingData = async () => {
    if (!isConnected || isSyncing) return;
    
    try {
      setIsSyncing(true);
      Alert.alert('同步中', '正在同步离线数据...');
      await enhancedApi.syncPendingData();
      Alert.alert('同步完成', '所有离线数据已成功同步');
    } catch (error) {
      console.error('同步数据失败:', error);
      Alert.alert('同步失败', '同步离线数据失败，请稍后再试');
    } finally {
      setIsSyncing(false);
    }
  };
  
  // 监听网络状态变化
  useEffect(() => {
    // 初始检查网络状态
    networkManager.checkNetworkStatus().then(connected => {
      setIsConnected(connected);
      setIsOfflineMode(!connected);
    });
    
    // 设置网络状态监听
    const unsubscribe = networkManager.initNetworkListener(
      // 连接回调
      async () => {
        setIsConnected(true);
        // 如果之前是离线模式，则自动同步数据
        if (isOfflineMode) {
          setIsOfflineMode(false);
          await syncPendingData();
        }
      },
      // 断开回调
      () => {
        setIsConnected(false);
        setIsOfflineMode(true);
        Alert.alert(
          '网络已断开',
          '应用将以离线模式运行，您可以继续使用应用，数据将在网络恢复后自动同步'
        );
      }
    );
    
    // 组件卸载时取消监听
    return () => {
      unsubscribe();
    };
  }, [isOfflineMode]);
  
  // 提供上下文值
  const contextValue = {
    isConnected,
    isOfflineMode,
    syncPendingData,
  };
  
  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

/**
 * 使用网络上下文的Hook
 */
export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork必须在NetworkProvider内部使用');
  }
  return context;
};