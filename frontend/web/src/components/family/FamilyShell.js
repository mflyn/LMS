import React, { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
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
    return <main className="family-route-state"><FamilyPageState state="retryable_error" onRetry={retry} /></main>;
  }

  return (
    <div className="family-shell">
      <header className="family-header">
        <div>
          <p className="family-eyebrow">家庭成长追踪</p>
          <strong>{family?.familyName || '我的家庭'}</strong>
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
          onClick={() => setMobileNavigationOpen((open) => !open)}
        >
          导航
        </button>
        <nav
          aria-label="家长导航"
          className={`family-navigation ${mobileNavigationOpen ? 'is-open' : ''}`}
        >
          {PARENT_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              onClick={() => setMobileNavigationOpen(false)}
            >
              {item.label}
            </NavLink>
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
