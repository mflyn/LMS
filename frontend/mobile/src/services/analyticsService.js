/**
 * 用户行为分析服务
 * 用于收集用户操作数据，为个性化推荐提供支持
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Dimensions } from 'react-native';
import offlineStorage from './offlineStorage';
import enhancedApi from './enhancedApi';

// 事件类型常量
const EVENT_TYPES = {
  SCREEN_VIEW: 'screen_view',
  BUTTON_CLICK: 'button_click',
  RESOURCE_VIEW: 'resource_view',
  HOMEWORK_SUBMIT: 'homework_submit',
  SEARCH: 'search',
  ERROR: 'error',
  FEATURE_USE: 'feature_use',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
};

// 本地存储键
const ANALYTICS_QUEUE_KEY = 'analytics_event_queue';
const ANALYTICS_USER_PREFS_KEY = 'analytics_user_preferences';

// 设备信息
const deviceInfo = {
  platform: Platform.OS,
  version: Platform.Version,
  screenWidth: Dimensions.get('window').width,
  screenHeight: Dimensions.get('window').height,
};

/**
 * 用户行为分析服务
 */
const analyticsService = {
  /**
   * 初始化分析服务
   * @param {Object} options - 配置选项
   * @returns {Promise<void>}
   */
  init: async (options = {}) => {
    try {
      // 记录会话开始事件
      await analyticsService.trackEvent(EVENT_TYPES.SESSION_START, {
        timestamp: new Date().toISOString(),
      });
      
      // 设置定期同步
      if (options.autoSync) {
        // 每5分钟尝试同步一次数据
        setInterval(() => {
          analyticsService.syncEvents();
        }, 5 * 60 * 1000);
      }
    } catch (error) {
      console.error('初始化分析服务失败:', error);
    }
  },
  
  /**
   * 记录用户事件
   * @param {string} eventType - 事件类型
   * @param {Object} eventData - 事件数据
   * @returns {Promise<void>}
   */
  trackEvent: async (eventType, eventData = {}) => {
    try {
      const event = {
        eventType,
        eventData: {
          ...eventData,
          deviceInfo,
        },
        timestamp: new Date().toISOString(),
      };
      
      // 获取现有队列
      const queueString = await AsyncStorage.getItem(ANALYTICS_QUEUE_KEY);
      const queue = queueString ? JSON.parse(queueString) : [];
      
      // 添加新事件到队列
      queue.push(event);
      
      // 保存更新后的队列
      await AsyncStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(queue));
      
      // 如果队列长度超过阈值，尝试同步
      if (queue.length >= 20) {
        analyticsService.syncEvents();
      }
    } catch (error) {
      console.error('记录事件失败:', error);
    }
  },
  
  /**
   * 记录屏幕访问
   * @param {string} screenName - 屏幕名称
   * @param {Object} params - 屏幕参数
   * @returns {Promise<void>}
   */
  trackScreenView: async (screenName, params = {}) => {
    return analyticsService.trackEvent(EVENT_TYPES.SCREEN_VIEW, {
      screenName,
      params,
    });
  },
  
  /**
   * 记录按钮点击
   * @param {string} buttonId - 按钮ID
   * @param {string} screenName - 屏幕名称
   * @returns {Promise<void>}
   */
  trackButtonClick: async (buttonId, screenName) => {
    return analyticsService.trackEvent(EVENT_TYPES.BUTTON_CLICK, {
      buttonId,
      screenName,
    });
  },
  
  /**
   * 记录资源查看
   * @param {string} resourceId - 资源ID
   * @param {string} resourceType - 资源类型
   * @returns {Promise<void>}
   */
  trackResourceView: async (resourceId, resourceType) => {
    return analyticsService.trackEvent(EVENT_TYPES.RESOURCE_VIEW, {
      resourceId,
      resourceType,
    });
  },
  
  /**
   * 记录作业提交
   * @param {string} homeworkId - 作业ID
   * @returns {Promise<void>}
   */
  trackHomeworkSubmit: async (homeworkId) => {
    return analyticsService.trackEvent(EVENT_TYPES.HOMEWORK_SUBMIT, {
      homeworkId,
    });
  },
  
  /**
   * 记录搜索操作
   * @param {string} query - 搜索关键词
   * @param {string} category - 搜索类别
   * @returns {Promise<void>}
   */
  trackSearch: async (query, category) => {
    return analyticsService.trackEvent(EVENT_TYPES.SEARCH, {
      query,
      category,
    });
  },
  
  /**
   * 记录错误
   * @param {string} errorMessage - 错误信息
   * @param {string} errorCode - 错误代码
   * @returns {Promise<void>}
   */
  trackError: async (errorMessage, errorCode) => {
    return analyticsService.trackEvent(EVENT_TYPES.ERROR, {
      errorMessage,
      errorCode,
    });
  },
  
  /**
   * 同步事件数据到服务器
   * @returns {Promise<boolean>} 是否同步成功
   */
  syncEvents: async () => {
    try {
      // 检查网络连接
      const isConnected = await offlineStorage.isConnected();
      if (!isConnected) return false;
      
      // 获取事件队列
      const queueString = await AsyncStorage.getItem(ANALYTICS_QUEUE_KEY);
      if (!queueString) return true;
      
      const queue = JSON.parse(queueString);
      if (queue.length === 0) return true;
      
      // 发送事件数据到服务器
      await enhancedApi.analytics.sendEvents(queue);
      
      // 清空队列
      await AsyncStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify([]));
      
      return true;
    } catch (error) {
      console.error('同步事件数据失败:', error);
      return false;
    }
  },
  
  /**
   * 获取用户偏好设置
   * @returns {Promise<Object>} 用户偏好设置
   */
  getUserPreferences: async () => {
    try {
      const prefsString = await AsyncStorage.getItem(ANALYTICS_USER_PREFS_KEY);
      return prefsString ? JSON.parse(prefsString) : {};
    } catch (error) {
      console.error('获取用户偏好设置失败:', error);
      return {};
    }
  },
  
  /**
   * 更新用户偏好设置
   * @param {Object} preferences - 用户偏好设置
   * @returns {Promise<void>}
   */
  updateUserPreferences: async (preferences) => {
    try {
      // 获取现有偏好设置
      const currentPrefs = await analyticsService.getUserPreferences();
      
      // 合并新的偏好设置
      const updatedPrefs = { ...currentPrefs, ...preferences };
      
      // 保存更新后的偏好设置
      await AsyncStorage.setItem(ANALYTICS_USER_PREFS_KEY, JSON.stringify(updatedPrefs));
      
      // 同步到服务器
      const isConnected = await offlineStorage.isConnected();
      if (isConnected) {
        await enhancedApi.analytics.updateUserPreferences(updatedPrefs);
      }
    } catch (error) {
      console.error('更新用户偏好设置失败:', error);
    }
  },
  
  /**
   * 清除所有分析数据
   * @returns {Promise<void>}
   */
  clearAllData: async () => {
    try {
      await AsyncStorage.removeItem(ANALYTICS_QUEUE_KEY);
      await AsyncStorage.removeItem(ANALYTICS_USER_PREFS_KEY);
    } catch (error) {
      console.error('清除分析数据失败:', error);
    }
  },
};

export { EVENT_TYPES };
export default analyticsService;