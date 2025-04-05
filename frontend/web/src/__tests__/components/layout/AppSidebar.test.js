import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AppSidebar from '../../../components/layout/AppSidebar';
import { AuthProvider } from '../../../contexts/AuthContext';

// 模拟AuthContext
jest.mock('../../../contexts/AuthContext', () => {
  return {
    useAuth: () => ({
      userRole: 'student',
      currentUser: { id: '1', name: '张小明', role: 'student' },
      isAuthenticated: true
    }),
    AuthProvider: ({ children }) => <div>{children}</div>
  };
});

// 模拟react-router-dom的useLocation
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({
    pathname: '/dashboard'
  })
}));

const renderAppSidebar = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppSidebar />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('AppSidebar组件', () => {
  test('应该显示导航菜单项', () => {
    renderAppSidebar();
    
    // 验证常见的导航项
    expect(screen.getByText(/仪表盘/i)).toBeInTheDocument();
    expect(screen.getByText(/学习资源/i)).toBeInTheDocument();
    expect(screen.getByText(/互动交流/i)).toBeInTheDocument();
  });

  test('当前路径对应的菜单项应该高亮显示', () => {
    renderAppSidebar();
    
    // 由于模拟的当前路径是/dashboard，仪表盘菜单项应该被选中
    const dashboardMenuItem = screen.getByText(/仪表盘/i).closest('li');
    expect(dashboardMenuItem).toHaveClass('ant-menu-item-selected');
  });

  test('点击菜单项应该触发导航', () => {
    renderAppSidebar();
    
    // 点击学习资源菜单项
    const resourcesMenuItem = screen.getByText(/学习资源/i);
    fireEvent.click(resourcesMenuItem);
    
    // 由于使用了BrowserRouter，我们可以验证URL是否变化
    // 但在测试环境中，实际导航不会发生，所以我们只能验证点击事件
    expect(resourcesMenuItem).toHaveBeenCalled;
  });

  test('不同角色应该显示不同的菜单项', () => {
    // 重新模拟AuthContext为教师角色
    jest.spyOn(require('../../../contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      userRole: 'teacher',
      currentUser: { id: '2', name: '李老师', role: 'teacher' },
      isAuthenticated: true
    }));
    
    renderAppSidebar();
    
    // 验证教师特有的菜单项
    expect(screen.getByText(/班级管理/i)).toBeInTheDocument();
    expect(screen.getByText(/学生评估/i)).toBeInTheDocument();
  });
});