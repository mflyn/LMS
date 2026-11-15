import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ReadOutlined } from '@ant-design/icons';
import { CHILD_NAV_ITEMS } from '../../config/childNavigation';
import { useChildAuth } from '../../contexts/ChildAuthContext';
import ChildSwitchButton from './ChildSwitchButton';

const ChildShell = () => {
  const { child } = useChildAuth();

  return (
    <div className="child-shell home-shell">
      <header className="child-header">
        <div>
          <span className="home-child-brand"><ReadOutlined aria-hidden="true" />家庭成长<span className="home-child-identity"><span>{child?.name}</span> · 儿童端</span></span>
        </div>
        <ChildSwitchButton />
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
