import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';
import io from 'socket.io-client';

// 创建WebSocket上下文
const WebSocketContext = createContext();

// WebSocket提供者组件
export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { currentUser, token } = useAuth();

  // 初始化WebSocket连接
  useEffect(() => {
    if (currentUser && token) {
      // 创建Socket.IO连接
      const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5007';
      const socketInstance = io(socketUrl, {
        auth: {
          token
        },
        transports: ['websocket', 'polling']
      });

      // 设置Socket.IO事件处理
      socketInstance.on('connect', () => {
        console.log('WebSocket连接成功');
        setConnected(true);
        
        // 加入用户特定的频道
        if (currentUser._id) {
          socketInstance.emit('join', currentUser._id);
        }
      });

      socketInstance.on('disconnect', () => {
        console.log('WebSocket连接断开');
        setConnected(false);
      });

      socketInstance.on('connect_error', (error) => {
        console.error('WebSocket连接错误:', error);
        setConnected(false);
      });

      // 保存Socket实例
      setSocket(socketInstance);

      // 清理函数
      return () => {
        if (socketInstance) {
          socketInstance.disconnect();
        }
      };
    }
  }, [currentUser, token]);

  // 提供上下文值
  const value = {
    socket,
    connected,
    // 订阅事件的辅助函数
    subscribe: (event, callback) => {
      if (socket) {
        socket.on(event, callback);
        return () => socket.off(event, callback);
      }
      return () => {};
    },
    // 发送事件的辅助函数
    emit: (event, data) => {
      if (socket && connected) {
        socket.emit(event, data);
      }
    }
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// 自定义Hook，用于在组件中使用WebSocket上下文
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket必须在WebSocketProvider内部使用');
  }
  return context;
};