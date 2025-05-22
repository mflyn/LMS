/**
 * 网络连接状态管理器
 * 用于监控网络状态变化并通知应用其他部分
 */

import NetInfo from '@react-native-community/netinfo';
// useEffect, useState, Alert, enhancedApi 相关的导入不再需要，因为 useNetworkStatus 被移除
// import { useEffect, useState } from 'react';
// import { Alert } from 'react-native';
// import enhancedApi from './enhancedApi';

// 网络状态事件监听器
let netInfoUnsubscribe = null;

/**
 * 网络连接状态管理器
 */
const networkManager = {
  /**
   * 初始化网络状态监听
   * @param {Function} onConnected - 网络连接时的回调
   * @param {Function} onDisconnected - 网络断开时的回调
   * @returns {Function} 取消监听的函数
   */
  initNetworkListener: (onConnected, onDisconnected) => {
    // 如果已经有监听器，先取消
    if (netInfoUnsubscribe) {
      netInfoUnsubscribe();
    }
    
    // 设置新的监听器
    netInfoUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('网络已连接');
        if (onConnected) onConnected();
      } else {
        console.log('网络已断开');
        if (onDisconnected) onDisconnected();
      }
    });
    
    return netInfoUnsubscribe;
  },
  
  /**
   * 取消网络状态监听
   */
  removeNetworkListener: () => {
    if (netInfoUnsubscribe) {
      netInfoUnsubscribe();
      netInfoUnsubscribe = null;
    }
  },
  
  /**
   * 检查当前网络状态
   * @returns {Promise<boolean>} 是否连接到网络
   */
  checkNetworkStatus: async () => {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected && state.isInternetReachable;
    } catch (error) {
      console.error('检查网络状态失败:', error);
      return false;
    }
  },
  
  // syncDataWhenConnected 方法也被移除，因为它是 useNetworkStatus 内部逻辑的一部分
  // 如果 NetworkContext 需要类似功能，应在其内部实现
  /*
  syncDataWhenConnected: async () => {
    try {
      const isConnected = await networkManager.checkNetworkStatus();
      if (!isConnected) return;
      
      console.log('网络已恢复，开始同步离线数据...');
      await enhancedApi.syncPendingData(); // enhancedApi 导入也已移除
      console.log('离线数据同步完成');
    } catch (error) {
      console.error('同步离线数据失败:', error);
    }
  },
  */
};

// useNetworkStatus Hook 被移除
/*
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isFirstConnect, setIsFirstConnect] = useState(true);
  
  useEffect(() => {
    // 初始检查网络状态
    networkManager.checkNetworkStatus().then(connected => {
      setIsConnected(connected);
    });
    
    // 设置网络状态监听
    const unsubscribe = networkManager.initNetworkListener(
      // 连接回调
      () => {
        setIsConnected(true);
        if (!isFirstConnect) {
          // 非首次连接，说明是从离线状态恢复，需要同步数据
          networkManager.syncDataWhenConnected();
          Alert.alert('网络已恢复', '正在同步离线数据...');
        }
        setIsFirstConnect(false);
      },
      // 断开回调
      () => {
        setIsConnected(false);
        setIsFirstConnect(false);
        Alert.alert('网络已断开', '应用将以离线模式运行，部分功能可能受限');
      }
    );
    
    // 组件卸载时取消监听
    return () => {
      unsubscribe();
    };
  }, []);
  
  return { isConnected };
};
*/

export default networkManager;