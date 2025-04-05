import React, { createContext } from 'react';

// 创建认证上下文
export const AuthContext = createContext({
  signIn: async () => {},
  signOut: async () => {},
  token: null,
});

// 认证上下文提供者组件
export const AuthProvider = ({ children }) => {
  // 实际实现在App.js中
  return (
    <AuthContext.Provider value={{}}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义Hook，用于在组件中访问认证上下文
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};