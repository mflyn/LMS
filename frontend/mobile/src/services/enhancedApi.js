/**
 * 增强版API服务
 * 支持离线模式的API调用
 */

import api from './api';
import offlineStorage from './offlineStorage';

/**
 * 创建支持离线模式的API请求
 * @param {Function} apiCall - 原始API调用函数
 * @param {string} cacheKey - 缓存键
 * @param {Object} options - 配置选项
 * @returns {Promise<any>} API响应数据
 */
const withOfflineSupport = async (apiCall, cacheKey, options = {}) => {
  const { forceRefresh = false, syncOnConnect = true } = options;
  
  try {
    // 检查网络连接
    const isConnected = await offlineStorage.isConnected();
    
    // 如果有网络连接且需要强制刷新，直接从API获取数据
    if (isConnected && forceRefresh) {
      const response = await apiCall();
      await offlineStorage.saveData(cacheKey, response.data);
      return response.data;
    }
    
    // 尝试从缓存获取数据
    const cachedData = await offlineStorage.getData(cacheKey);
    
    // 如果有网络连接，尝试从API获取最新数据
    if (isConnected) {
      try {
        const response = await apiCall();
        await offlineStorage.saveData(cacheKey, response.data);
        return response.data;
      } catch (error) {
        // API请求失败，如果有缓存数据则使用缓存
        if (cachedData) {
          console.log(`API请求失败，使用缓存数据: ${cacheKey}`);
          return cachedData;
        }
        throw error;
      }
    } else {
      // 离线模式，使用缓存数据
      if (cachedData) {
        console.log(`离线模式，使用缓存数据: ${cacheKey}`);
        return cachedData;
      }
      throw new Error('无网络连接且无缓存数据');
    }
  } catch (error) {
    console.error(`增强API调用失败: ${cacheKey}`, error);
    throw error;
  }
};

/**
 * 增强版API服务
 */
const enhancedApi = {
  // 用户相关
  auth: {
    login: (credentials) => api.auth.login(credentials),
    register: (userData) => api.auth.register(userData),
    logout: () => api.auth.logout(),
    getProfile: () => withOfflineSupport(
      () => api.auth.getProfile(),
      'user_profile'
    ),
    updateProfile: (data) => api.auth.updateProfile(data),
  },
  
  // 通知相关
  notifications: {
    getAll: () => withOfflineSupport(
      () => api.notifications.getAll(),
      'notifications_all'
    ),
    getById: (id) => withOfflineSupport(
      () => api.notifications.getById(id),
      `notification_${id}`
    ),
    markAsRead: (id) => api.notifications.markAsRead(id),
    markAllAsRead: () => api.notifications.markAllAsRead(),
    deleteNotification: (id) => api.notifications.deleteNotification(id),
  },
  
  // 学习进度相关
  progress: {
    getStudentProgress: (studentId) => withOfflineSupport(
      () => api.progress.getStudentProgress(studentId),
      `progress_student_${studentId}`
    ),
    getSubjectProgress: (studentId, subjectId) => withOfflineSupport(
      () => api.progress.getSubjectProgress(studentId, subjectId),
      `progress_student_${studentId}_subject_${subjectId}`
    ),
    updateProgress: (progressData) => {
      // 如果离线，存储到待同步队列
      return offlineStorage.isConnected().then(isConnected => {
        if (isConnected) {
          return api.progress.updateProgress(progressData);
        } else {
          // 存储到待同步队列
          return offlineStorage.saveData(
            `sync_progress_${Date.now()}`,
            { type: 'updateProgress', data: progressData }
          ).then(() => ({ data: { success: true, offlineSync: true } }));
        }
      });
    },
  },
  
  // 作业相关
  homework: {
    getAll: (filters) => withOfflineSupport(
      () => api.homework.getAll(filters),
      `homework_all_${JSON.stringify(filters || {})}`
    ),
    getById: (id) => withOfflineSupport(
      () => api.homework.getById(id),
      `homework_${id}`
    ),
    submit: (homeworkId, submission) => {
      // 如果离线，存储到待同步队列
      return offlineStorage.isConnected().then(isConnected => {
        if (isConnected) {
          return api.homework.submit(homeworkId, submission);
        } else {
          // 存储到待同步队列
          return offlineStorage.saveData(
            `sync_homework_submit_${Date.now()}`,
            { type: 'submitHomework', homeworkId, submission }
          ).then(() => ({ data: { success: true, offlineSync: true } }));
        }
      });
    },
    getSubmissions: (homeworkId) => withOfflineSupport(
      () => api.homework.getSubmissions(homeworkId),
      `homework_${homeworkId}_submissions`
    ),
  },
  
  // 数据分析相关
  analytics: {
    getStudentPerformance: (studentId) => withOfflineSupport(
      () => api.analytics.getStudentPerformance(studentId),
      `analytics_student_${studentId}_performance`
    ),
    getClassPerformance: (classId) => withOfflineSupport(
      () => api.analytics.getClassPerformance(classId),
      `analytics_class_${classId}_performance`
    ),
  },
  
  // 同步所有待同步的数据
  syncPendingData: async () => {
    try {
      const isConnected = await offlineStorage.isConnected();
      if (!isConnected) {
        throw new Error('无网络连接');
      }
      
      // 获取所有待同步的数据
      const keys = await AsyncStorage.getAllKeys();
      const syncKeys = keys.filter(key => key.startsWith('sync_'));
      
      // 依次同步每个待同步项
      for (const key of syncKeys) {
        const syncItem = await offlineStorage.getData(key, false);
        if (!syncItem) continue;
        
        try {
          // 根据类型执行不同的同步操作
          switch (syncItem.type) {
            case 'updateProgress':
              await api.progress.updateProgress(syncItem.data);
              break;
            case 'submitHomework':
              await api.homework.submit(syncItem.homeworkId, syncItem.submission);
              break;
            default:
              console.warn(`未知的同步类型: ${syncItem.type}`);
          }
          
          // 同步成功后删除该项
          await offlineStorage.removeData(key);
        } catch (error) {
          console.error(`同步数据失败: ${key}`, error);
          // 继续同步其他项
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('同步待同步数据失败', error);
      throw error;
    }
  },
};

export default enhancedApi;