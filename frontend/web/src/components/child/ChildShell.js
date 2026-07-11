import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CHILD_NAV_ITEMS } from '../../config/childNavigation';
import { useChildAuth } from '../../contexts/ChildAuthContext';

const ChildShell = () => {
  const { child } = useChildAuth();

  return (
    <div className="child-shell">
      <header className="child-header">
        <div>
          <p className="child-eyebrow">我的成长空间</p>
          <strong>{child?.name}</strong>
        </div>
      </header>
      <nav className="child-navigation" aria-label="孩子导航">
        {CHILD_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="child-content">
        <Outlet />
      </main>
    </div>
  );
};

export default ChildShell;
