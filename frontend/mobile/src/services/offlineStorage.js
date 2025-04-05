/**
 * 离线数据存储服务
 * 用于缓存API响应数据，实现离线模式支持
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// 缓存键前缀
const CACHE_PREFIX = 'offline_cache_';
// 缓存过期时间（毫秒）
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

/**
 * 离线存储服务
 */
const offlineStorage = {
  /**
   * 保存数据到缓存
   * @param {string} key - 缓存键
   * @param {any} data - 要缓存的数据
   * @returns {Promise<void>}
   */
  saveData: async (key, data) => {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(
        `${CACHE_PREFIX}${key}`,
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.error('保存缓存数据失败:', error);
    }
  },

  /**
   * 从缓存获取数据
   * @param {string} key - 缓存键
   * @param {boolean} checkExpiry - 是否检查过期时间
   * @returns {Promise<any>} 缓存的数据或null
   */
  getData: async (key, checkExpiry = true) => {
    try {
      const cachedItem = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      
      if (!cachedItem) return null;
      
      const { data, timestamp } = JSON.parse(cachedItem);
      
      // 检查缓存是否过期
      if (checkExpiry && Date.now() - timestamp > CACHE_EXPIRY) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('获取缓存数据失败:', error);
      return null;
    }
  },

  /**
   * 删除缓存数据
   * @param {string} key - 缓存键
   * @returns {Promise<void>}
   */
  removeData: async (key) => {
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('删除缓存数据失败:', error);
    }
  },

  /**
   * 清除所有缓存数据
   * @returns {Promise<void>}
   */
  clearAllData: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('清除所有缓存数据失败:', error);
    }
  },

  /**
   * 检查网络连接状态
   * @returns {Promise<boolean>} 是否连接到网络
   */
  isConnected: async () => {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected;
    } catch (error) {
      console.error('检查网络连接失败:', error);
      return false;
    }
  },

  /**
   * 同步本地缓存数据到服务器
   * @param {Function} syncFunction - 同步函数
   * @returns {Promise<void>}
   */
  syncToServer: async (syncFunction) => {
    try {
      const isConnected = await offlineStorage.isConnected();
      if (!isConnected) {
        Alert.alert('同步失败', '无法连接到网络，请稍后再试');
        return;
      }
      
      await syncFunction();
    } catch (error) {
      console.error('同步数据到服务器失败:', error);
      Alert.alert('同步失败', '同步数据到服务器失败，请稍后再试');
    }
  }
};

export default offlineStorage;