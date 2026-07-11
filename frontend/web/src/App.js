import React from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import './index.css';
import './family-shell.css';
import './child-shell.css';
import { AuthProvider } from './contexts/AuthContext';
import { ChildAuthProvider } from './contexts/ChildAuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { LEGACY_SCHOOL_PATHS } from './config/familyNavigation';
import ParentRoute from './components/family/ParentRoute';
import FamilyShell from './components/family/FamilyShell';
import ChildRoute from './components/child/ChildRoute';
import ChildShell from './components/child/ChildShell';
import Login from './pages/Login';
import Register from './pages/Register';
import FamilySetupPage from './pages/family/FamilySetupPage';
import TodayPage from './pages/family/TodayPage';
import TasksPage from './pages/family/TasksPage';
import GrowthLogsPage from './pages/family/GrowthLogsPage';
import MistakesPage from './pages/family/MistakesPage';
import ReportsPage from './pages/family/ReportsPage';
import RemindersPage from './pages/family/RemindersPage';
import RewardsPage from './pages/family/RewardsPage';
import ChildPinLoginPage from './pages/child/ChildPinLoginPage';
import ChildTodayPage from './pages/child/ChildTodayPage';
import ChildTaskPage from './pages/child/ChildTaskPage';
import ChildMistakesPage from './pages/child/ChildMistakesPage';
import ChildAchievementsPage from './pages/child/ChildAchievementsPage';
import ChildProfilePage from './pages/child/ChildProfilePage';

const ParentFamilyBoundary = () => (
  <FamilyProvider>
    <Outlet />
  </FamilyProvider>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route element={<ParentRoute />}>
      <Route element={<ParentFamilyBoundary />}>
        <Route path="/family/setup" element={<FamilySetupPage />} />
        <Route path="/app" element={<FamilyShell />}>
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="logs" element={<GrowthLogsPage />} />
          <Route path="mistakes" element={<MistakesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="rewards" element={<RewardsPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="/child/login" element={<ChildPinLoginPage />} />
    <Route element={<ChildRoute />}>
      <Route path="/child" element={<ChildShell />}>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<ChildTodayPage />} />
        <Route path="tasks/:taskId" element={<ChildTaskPage />} />
        <Route path="mistakes" element={<ChildMistakesPage />} />
        <Route path="achievements" element={<ChildAchievementsPage />} />
        <Route path="me" element={<ChildProfilePage />} />
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
      <ChildAuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </ChildAuthProvider>
    </AuthProvider>
  </ConfigProvider>
);

export default App;
