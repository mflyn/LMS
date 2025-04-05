import React from 'react';
import { Layout, Menu, Dropdown, Avatar, Badge, Button, Space } from 'antd';
import { UserOutlined, BellOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const { Header } = Layout;

const AppHeader = () => {
  const navigate = useNavigate();
  const { currentUser, userRole, logout } = useAuth();

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
    <Menu>
      <Menu.Item key="notification1">
        <div>
          <div><strong>作业提醒</strong></div>
          <div>数学作业已布置，请按时完成</div>
          <div style={{ fontSize: '12px', color: '#999' }}>10分钟前</div>
        </div>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="notification2">
        <div>
          <div><strong>考试通知</strong></div>
          <div>下周一将进行期中考试</div>
          <div style={{ fontSize: '12px', color: '#999' }}>1小时前</div>
        </div>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="notification3">
        <div>
          <div><strong>系统通知</strong></div>
          <div>您的账号信息已更新</div>
          <div style={{ fontSize: '12px', color: '#999' }}>昨天</div>
        </div>
      </Menu.Item>
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
      <div className="logo" style={{ fontSize: '18px', fontWeight: 'bold' }}>
        小学生学习追踪系统
      </div>
      
      <Space size="large">
        <Dropdown overlay={notificationMenu} trigger={['click']} placement="bottomRight">
          <Badge count={3} overflowCount={99}>
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