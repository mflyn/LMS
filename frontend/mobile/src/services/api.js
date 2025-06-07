import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as NavigationService from './NavigationService'; // 导入 NavigationService
import config from '../config/env'; // 导入环境配置

// 创建axios实例
const api = axios.create({
  baseURL: config.API_BASE_URL, // 从配置读取 baseURL
  timeout: config.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response;
      
      if (status === 401) {
        // 未授权，清除token并重定向到登录页
        AsyncStorage.removeItem('userToken');
        Alert.alert('会话已过期', '请重新登录');
        NavigationService.resetRoot('Login'); // 添加导航逻辑
      } else if (status === 403) {
        Alert.alert('权限不足', '您没有权限执行此操作');
      } else if (status === 500) {
        Alert.alert('服务器错误', '服务器发生错误，请稍后再试');
      } else {
        Alert.alert('错误', data.message || '发生未知错误');
      }
    } else if (error.request) {
      // 请求发出但没有收到响应
      Alert.alert('网络错误', '无法连接到服务器，请检查网络连接');
    } else {
      // 请求设置时发生错误
      Alert.alert('错误', '请求设置错误');
    }
    
    return Promise.reject(error);
  }
);

// API服务
const apiService = {
  // 用户相关
  auth: {
    login: (credentials) => api.post('/auth/login', credentials),
    register: (userData) => api.post('/auth/register', userData),
    logout: () => api.post('/auth/logout'),
    getProfile: () => api.get('/auth/profile'),
    updateProfile: (data) => api.put('/auth/profile', data),
  },
  
  // 通知相关
  notifications: {
    getAll: () => api.get('/notifications'),
    getById: (id) => api.get(`/notifications/${id}`),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put('/notifications/read-all'),
    deleteNotification: (id) => api.delete(`/notifications/${id}`),
  },
  
  // 学习进度相关
  progress: {
    getStudentProgress: (studentId) => api.get(`/progress/student/${studentId}`),
    getSubjectProgress: (studentId, subjectId) => api.get(`/progress/student/${studentId}/subject/${subjectId}`),
    updateProgress: (progressData) => api.post('/progress', progressData),
  },
  
  // 作业相关
  homework: {
    getAll: (filters) => api.get('/homework', { params: filters }),
    getById: (id) => api.get(`/homework/${id}`),
    submit: (homeworkId, submission) => api.post(`/homework/${homeworkId}/submit`, submission),
    getSubmissions: (homeworkId) => api.get(`/homework/${homeworkId}/submissions`),
  },
  
  // 数据分析相关
  analytics: {
    getStudentPerformance: (studentId) => api.get(`/analytics/student/${studentId}/performance`),
    getClassPerformance: (classId) => api.get(`/analytics/class/${classId}/performance`),
    getMistakeRecords: (studentId) => api.get(`/analytics/student/${studentId}/mistakes`),
  },
  
  // 家校互动相关
  interaction: {
    getMessages: (filters) => api.get('/interaction/messages', { params: filters }),
    sendMessage: (message) => api.post('/interaction/messages', message),
    getAnnouncements: () => api.get('/interaction/announcements'),
  },
  
  // 学习资源相关
  resources: {
    getAll: (filters) => api.get('/resources', { params: filters }),
    getById: (id) => api.get(`/resources/${id}`),
    downloadResource: (id) => api.get(`/resources/${id}/download`, { responseType: 'blob' }),
    getRecommended: (filters) => api.get('/recommendations/recommended', { params: filters }),
    getPersonalized: (filters) => api.get('/recommendations/personalized', { params: filters }),
    rateResource: (resourceId, reviewData) => api.post('/recommendations/reviews', { resource: resourceId, ...reviewData }),
    getReviews: (resourceId) => api.get(`/recommendations/reviews/${resourceId}`),
  },
};

export default apiService;