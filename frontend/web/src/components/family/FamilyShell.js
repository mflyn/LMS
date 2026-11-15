import React, { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { BellOutlined, BookOutlined, CalendarOutlined, CheckSquareOutlined, GiftOutlined, HomeOutlined, LineChartOutlined, ReadOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { PARENT_NAV_ITEMS } from '../../config/familyNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import ChildSelector from './ChildSelector';
import FamilyPageState from './FamilyPageState';

const FamilyShell = () => {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const { logout, user } = useAuth();
  const { family, familyStatus, retry } = useFamily();

  if (familyStatus === 'needs_family') {
    return <Navigate to="/family/setup" replace />;
  }

  if (familyStatus === 'unknown') {
    return <main className="family-route-state"><FamilyPageState state="loading" /></main>;
  }

  if (familyStatus === 'error') {
    return (
      <main className="family-route-state">
        <FamilyPageState state="retryable_error" onRetry={retry} />
        <button type="button" className="family-button secondary" onClick={logout} style={{ marginTop: 12 }}>
          退出登录
        </button>
      </main>
    );
  }

  return (
    <div className="family-shell home-shell">
      <header className="family-header">
        <div className="home-brand">
          <ReadOutlined aria-hidden="true" />
          <div>
            <p className="family-eyebrow">家庭成长追踪</p>
            <strong>{family?.familyName || '我的家庭'}</strong>
          </div>
        </div>
        <div className="family-header-actions">
          <ChildSelector />
          <span className="family-user-name">{user?.name || '家长'}</span>
          <button type="button" className="family-button secondary" onClick={logout}>退出登录</button>
        </div>
      </header>
      <div className="family-layout">
        <button
          type="button"
          className="family-mobile-nav-toggle"
          aria-label="打开导航"
          aria-expanded={mobileNavigationOpen}
          aria-controls="family-parent-navigation"
          onClick={() => setMobileNavigationOpen((open) => !open)}
        >
          导航
        </button>
        <nav
          id="family-parent-navigation"
          aria-label="家长导航"
          className={`family-navigation ${mobileNavigationOpen ? 'is-open' : ''}`}
        >
          {[
            { label: '日常学习', indexes: [0, 1, 6] },
            { label: '成长回顾', indexes: [2, 3, 4, 5, 7] },
            { label: '家庭', indexes: [8, 9] }
          ].map(group => (
            <div className="home-nav-group" key={group.label || 'navigation'}>
              {group.label && <p className="home-nav-label">{group.label}</p>}
              {group.indexes.map(index => {
                const item = PARENT_NAV_ITEMS[index];
                const Icon = [HomeOutlined, CheckSquareOutlined, BookOutlined, ReadOutlined, CalendarOutlined, LineChartOutlined, BellOutlined, GiftOutlined, UserOutlined, TeamOutlined][index];
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                    onClick={() => setMobileNavigationOpen(false)}
                  >
                    <Icon aria-hidden="true" /><span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <main className="family-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default FamilyShell;
