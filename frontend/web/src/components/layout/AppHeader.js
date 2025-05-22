import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Badge, Button, Space, Spin, Empty } from 'antd';
import { UserOutlined, BellOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const { Header } = Layout;

const AppHeader = () => {
  const navigate = useNavigate();
  const { currentUser, userRole, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // TODO: Replace with actual API call to fetch notifications
    const fetchNotifications = () => {
      setTimeout(() => {
        const mockNotifications = [
          { id: '1', title: '新的课程安排', message: '您的 "趣味数学" 课程已更新，请查看新的时间表。', timestamp: '2024-07-30 10:00', read: false },
          { id: '2', title: '作业提醒', message: ' "科学小实验" 作业即将截止，请尽快提交。', timestamp: '2024-07-29 15:30', read: false },
          { id: '3', title: '系统通知', message: '系统将于今晚23:00进行维护，请提前安排好学习计划。', timestamp: '2024-07-29 09:00', read: true },
        ];
        // Simulate unread notifications based on role for variety
        if (userRole === 'student') {
            mockNotifications.push({ id: '4', title: '成绩发布', message: '你的期中考试成绩已发布。', timestamp: '2024-07-28 12:00', read: false });
        } else if (userRole === 'teacher') {
            mockNotifications.push({ id: '5', title: '新学生加入', message: '王小明同学已加入你的班级。', timestamp: '2024-07-28 11:00', read: false });
        }
        setNotifications(mockNotifications);
      }, 1500); // Simulate network delay
    };

    fetchNotifications();
  }, [userRole]); // Re-fetch if userRole changes, for demonstration

  // 根据用户角色返回对应的显示名称
  const getRoleName = (role) => {
    switch (role) {
      case 'student':
        return '学生';
      case 'parent':
        return '家长';
      case 'teacher':
        return '教师';
      case 'admin':
        return '管理员';
      default:
        return '用户';
    }
  };

  // 用户菜单项
  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />} onClick={() => navigate('/profile')}>
        个人资料
      </Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
        账号设置
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={logout}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  // 通知菜单项
  const notificationMenu = (
    <Menu style={{ width: 300 }}>
      {notifications.length === 0 ? (
        <Menu.Item key="no-notifications" disabled style={{ textAlign: 'center', cursor: 'default' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无新通知" style={{ padding: '10px 0' }}/>
        </Menu.Item>
      ) : (
        notifications.map(notification => (
          <Menu.Item key={notification.id} onClick={() => navigate(`/notifications/${notification.id}`)} style={!notification.read ? { fontWeight: 'bold' } : {}}>
            <div>
              <div><strong>{notification.title}</strong></div>
              <div style={{ whiteSpace: 'normal' }}>{notification.message}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>{notification.timestamp}</div>
            </div>
          </Menu.Item>
        ))
      )}
      <Menu.Divider />
      <Menu.Item key="all">
        <Button type="link" block onClick={() => navigate('/notifications')}>
          查看全部通知
        </Button>
      </Menu.Item>
    </Menu>
  );

  return (
    <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
      <div className="logo">
        小学生学习追踪系统
      </div>
      
      <Space size="large">
        <Dropdown overlay={notificationMenu} trigger={['click']} placement="bottomRight">
          <Badge count={notifications.filter(n => !n.read).length} overflowCount={99}>
            <Button type="text" icon={<BellOutlined style={{ fontSize: '18px' }} />} />
          </Badge>
        </Dropdown>
        
        <Dropdown overlay={userMenu} trigger={['click']} placement="bottomRight">
          <Space>
            <Avatar icon={<UserOutlined />} />
            {currentUser?.name || '用户'}
            <span style={{ color: '#999', marginLeft: '8px' }}>
              ({getRoleName(userRole)})
            </span>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default AppHeader;