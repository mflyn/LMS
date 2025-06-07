import React, { createContext, useState, useContext, useEffect } from 'react';
import { message } from 'antd';
import axios from 'axios';

// 创建认证上下文
const AuthContext = createContext();

// 认证提供者组件
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // 初始化时检查本地存储中的令牌
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          // 设置axios默认请求头
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // 验证令牌并获取用户信息
          const response = await axios.get('/api/users/profile');
          setCurrentUser(response.data.user);
          setUserRole(response.data.user.role);
          setToken(storedToken);
        } catch (error) {
          console.error('验证令牌失败:', error);
          // 令牌无效，清除本地存储
          localStorage.removeItem('token');
          setCurrentUser(null);
          setUserRole(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // 登录函数
  const login = async (username, password, role) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password, role });
      const { token, user } = response.data;
      
      // 保存令牌到本地存储
      localStorage.setItem('token', token);
      
      // 设置axios默认请求头
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // 更新状态
      setCurrentUser(user);
      setUserRole(user.role);
      setToken(token);
      
      message.success('登录成功！');
      return true;
    } catch (error) {
      console.error('登录失败:', error);
      message.error(error.response?.data?.message || '登录失败，请检查用户名和密码');
      return false;
    }
  };

  // 注册函数
  const register = async (userData) => {
    try {
      const response = await axios.post('/api/auth/register', userData);
      message.success('注册成功！请登录');
      return true;
    } catch (error) {
      console.error('注册失败:', error);
      message.error(error.response?.data?.message || '注册失败，请稍后再试');
      return false;
    }
  };

  // 登出函数
  const logout = () => {
    // 清除本地存储中的令牌
    localStorage.removeItem('token');
    
    // 清除axios默认请求头
    delete axios.defaults.headers.common['Authorization'];
    
    // 更新状态
    setCurrentUser(null);
    setUserRole(null);
    setToken(null);
    
    message.success('已成功登出！');
  };

  // 提供上下文值
  const value = {
    currentUser,
    userRole,
    loading,
    token,
    login,
    register,
    logout,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 自定义钩子，方便在组件中使用认证上下文
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};