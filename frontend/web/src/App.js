import React from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import './family-shell.css';
import { AuthProvider } from './contexts/AuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { LEGACY_SCHOOL_PATHS } from './config/familyNavigation';
import ParentRoute from './components/family/ParentRoute';
import FamilyShell from './components/family/FamilyShell';
import Login from './pages/Login';
import Register from './pages/Register';
import FamilySetupPage from './pages/family/FamilySetupPage';
import TodayPage from './pages/family/TodayPage';
import FamilyPlaceholderPage from './pages/family/FamilyPlaceholderPage';

const familyPlaceholderRoutes = [
  { path: 'tasks', title: '任务', description: '成长任务将在 Task 9 接入。' },
  { path: 'logs', title: '记录', description: '成长记录将在 Task 9 接入。' },
  { path: 'mistakes', title: '错题', description: '错题复盘将在 Task 9 接入。' },
  { path: 'reports', title: '周报', description: '成长周报将在 Task 9 接入。' },
  { path: 'reminders', title: '提醒', description: '家庭提醒将在 Task 9 接入。' },
  { path: 'rewards', title: '星星与奖励', description: '星星与奖励将在 Task 9 接入。' }
];

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route element={<ParentRoute />}>
      <Route path="/family/setup" element={<FamilySetupPage />} />
      <Route path="/app" element={<FamilyShell />}>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<TodayPage />} />
        {familyPlaceholderRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<FamilyPlaceholderPage title={route.title} description={route.description} />}
          />
        ))}
      </Route>
    </Route>
    {LEGACY_SCHOOL_PATHS.map((path) => (
      <Route key={path} path={path} element={<Navigate to="/app/today" replace />} />
    ))}
    <Route path="/" element={<Navigate to="/app/today" replace />} />
    <Route path="*" element={<Navigate to="/app/today" replace />} />
  </Routes>
);

const App = () => (
  <ConfigProvider locale={zhCN}>
    <AuthProvider>
      <FamilyProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </FamilyProvider>
    </AuthProvider>
  </ConfigProvider>
);

export default App;
