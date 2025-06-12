import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './index.css';

// 导入上下文提供者
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// 导入页面组件
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Interaction from './pages/Interaction';
import Resources from './pages/Resources';
import Analytics from './pages/Analytics';

// 导入布局组件
import AppHeader from './components/layout/AppHeader';
import AppSidebar from './components/layout/AppSidebar';

const { Content } = Layout;

// 受保护的路由组件
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div>加载中...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// 主应用组件
const AppContent = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        {isAuthenticated && <AppHeader />}
        <Layout>
          {isAuthenticated && <AppSidebar />}
          <Layout>
            <Content
              className="app-content"
            >
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/interaction" element={
                  <ProtectedRoute>
                    <Interaction />
                  </ProtectedRoute>
                } />
                <Route path="/resources" element={
                  <ProtectedRoute>
                    <Resources />
                  </ProtectedRoute>
                } />
                <Route path="/analytics" element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/courses" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/assignments" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/progress" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/children" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/performance" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/communication" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/classes" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/students" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/grades" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/homework" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/parent-communication" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/classes-admin" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/courses-admin" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/system" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Router>
  );
};

const App = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;