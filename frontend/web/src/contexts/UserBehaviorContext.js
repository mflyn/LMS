import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

// 创建用户行为上下文
const UserBehaviorContext = createContext();

// 自定义Hook，用于在组件中使用用户行为上下文
export const useUserBehavior = () => {
  const context = useContext(UserBehaviorContext);
  if (!context) {
    throw new Error('useUserBehavior must be used within a UserBehaviorProvider');
  }
  return context;
};

// 用户行为上下文提供者组件
export const UserBehaviorProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 记录页面访问
  const trackPageView = useCallback(async (page, title) => {
    try {
      await axios.post('/api/analytics/user-behavior/track', {
        actionType: 'page_view',
        location: { page, title },
        timestamp: new Date().toISOString(),
        success: true
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }, []);
  
  // 记录用户操作
  const trackUserAction = useCallback(async (actionType, location, metadata = {}) => {
    try {
      await axios.post('/api/analytics/user-behavior/track', {
        actionType,
        location,
        metadata,
        timestamp: new Date().toISOString(),
        success: true
      });
    } catch (error) {
      console.error(`Failed to track ${actionType}:`, error);
    }
  }, []);
  
  // 记录资源访问
  const trackResourceAccess = useCallback(async (resourceId, resourceType, actionType) => {
    try {
      await axios.post('/api/analytics/user-behavior/track', {
        actionType,
        location: { resourceId, resourceType },
        timestamp: new Date().toISOString(),
        success: true
      });
    } catch (error) {
      console.error(`Failed to track resource ${actionType}:`, error);
    }
  }, []);
  
  // 提供的上下文值
  const value = {
    loading,
    error,
    trackPageView,
    trackUserAction,
    trackResourceAccess
  };
  
  return (
    <UserBehaviorContext.Provider value={value}>
      {children}
    </UserBehaviorContext.Provider>
  );
};

export default UserBehaviorContext;