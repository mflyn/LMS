import React, { createContext } from 'react';

// 创建认证上下文
export const AuthContext = createContext({
  signIn: async () => {},
  signOut: async () => {},
  switchRole: async () => {},
  showRoleSelector: () => {},
  token: null,
  role: null,
  isAuthenticated: false,
});

// AuthProvider 组件被移除
/*
export const AuthProvider = ({ children }) => {
  // 实际实现在App.js中
  return (
    <AuthContext.Provider value={{}}>
      {children}
    </AuthContext.Provider>
  );
};
*/

// 自定义Hook，用于在组件中访问认证上下文
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    // 这个错误检查仍然有用，确保 AuthContext.Provider 在上层被正确使用
    throw new Error('useAuth must be used within an AuthContext.Provider'); 
  }
  // 可以添加更具体的检查，例如 context.signIn 是否存在，以确保获取到的是 App.js 中提供的完整 context
  if (typeof context.signIn !== 'function') {
    throw new Error('AuthContext seems to be missing expected signIn function. Ensure App.js provides the correct context value.');
  }
  return context;
};