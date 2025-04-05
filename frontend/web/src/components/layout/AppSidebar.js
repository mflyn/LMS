import React, { useState, useEffect } from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  DashboardOutlined,
  BookOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  TeamOutlined,
  MessageOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  ReadOutlined,
  HomeOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);

  // 根据当前路径设置选中的菜单项
  useEffect(() => {
    const pathName = location.pathname;
    const key = pathName.split('/')[1] || 'dashboard';
    setSelectedKeys([key]);
  }, [location.pathname]);

  // 根据用户角色返回对应的菜单项
  const getMenuItems = () => {
    // 所有角色共享的菜单项
    const commonItems = [
      {
        key: 'dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘',
        onClick: () => navigate('/dashboard')
      },
      {
        key: 'interaction',
        icon: <MessageOutlined />,
        label: '家校互动',
        onClick: () => navigate('/interaction')
      },
      {
        key: 'resources',
        icon: <ReadOutlined />,
        label: '学习资源',
        onClick: () => navigate('/resources')
      },
      {
        key: 'analytics',
        icon: <BarChartOutlined />,
        label: '数据分析',
        onClick: () => navigate('/analytics')
      }
    ];

    // 学生特有的菜单项
    const studentItems = [
      {
        key: 'courses',
        icon: <BookOutlined />,
        label: '我的课程',
        onClick: () => navigate('/courses')
      },
      {
        key: 'assignments',
        icon: <FileTextOutlined />,
        label: '作业管理',
        onClick: () => navigate('/assignments')
      },
      {
        key: 'progress',
        icon: <BarChartOutlined />,
        label: '学习进度',
        onClick: () => navigate('/progress')
      },
      {
        key: 'resources',
        icon: <ReadOutlined />,
        label: '学习资源',
        onClick: () => navigate('/resources')
      }
    ];

    // 家长特有的菜单项
    const parentItems = [
      {
        key: 'children',
        icon: <TeamOutlined />,
        label: '我的孩子',
        onClick: () => navigate('/children')
      },
      {
        key: 'performance',
        icon: <BarChartOutlined />,
        label: '学习表现',
        onClick: () => navigate('/performance')
      },
      {
        key: 'communication',
        icon: <MessageOutlined />,
        label: '家校沟通',
        onClick: () => navigate('/communication')
      },
      {
        key: 'notifications',
        icon: <BellOutlined />,
        label: '通知消息',
        onClick: () => navigate('/notifications')
      }
    ];

    // 教师特有的菜单项
    const teacherItems = [
      {
        key: 'classes',
        icon: <TeamOutlined />,
        label: '班级管理',
        onClick: () => navigate('/classes')
      },
      {
        key: 'students',
        icon: <UserOutlined />,
        label: '学生管理',
        onClick: () => navigate('/students')
      },
      {
        key: 'grades',
        icon: <FileTextOutlined />,
        label: '成绩录入',
        onClick: () => navigate('/grades')
      },
      {
        key: 'homework',
        icon: <ScheduleOutlined />,
        label: '作业布置',
        onClick: () => navigate('/homework')
      },
      {
        key: 'analytics',
        icon: <BarChartOutlined />,
        label: '数据分析',
        onClick: () => navigate('/analytics')
      },
      {
        key: 'parent-communication',
        icon: <MessageOutlined />,
        label: '家长沟通',
        onClick: () => navigate('/parent-communication')
      }
    ];

    // 管理员特有的菜单项
    const adminItems = [
      {
        key: 'users',
        icon: <UserOutlined />,
        label: '用户管理',
        onClick: () => navigate('/users')
      },
      {
        key: 'classes-admin',
        icon: <TeamOutlined />,
        label: '班级管理',
        onClick: () => navigate('/classes-admin')
      },
      {
        key: 'courses-admin',
        icon: <BookOutlined />,
        label: '课程管理',
        onClick: () => navigate('/courses-admin')
      },
      {
        key: 'system',
        icon: <SettingOutlined />,
        label: '系统设置',
        onClick: () => navigate('/system')
      },
      {
        key: 'reports',
        icon: <BarChartOutlined />,
        label: '统计报表',
        onClick: () => navigate('/reports')
      }
    ];

    // 根据用户角色返回对应的菜单项
    switch (userRole) {
      case 'student':
        return [...commonItems, ...studentItems];
      case 'parent':
        return [...commonItems, ...parentItems];
      case 'teacher':
        return [...commonItems, ...teacherItems];
      case 'admin':
        return [...commonItems, ...adminItems];
      default:
        return commonItems;
    }
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={200}
      style={{ background: '#fff' }}
    >
      <Menu
        mode="inline"
        selectedKeys={selectedKeys}
        style={{ height: '100%', borderRight: 0 }}
        items={getMenuItems()}
      />
    </Sider>
  );
};

export default AppSidebar;