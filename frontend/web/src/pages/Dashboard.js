import React, { useEffect } from 'react';
import { Alert, Spin, Button } from 'antd';
import { 
  ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import StudentDashboard from './dashboards/StudentDashboard';
import ParentDashboard from './dashboards/ParentDashboard';
import TeacherDashboard from './dashboards/TeacherDashboard';
import AdminDashboard from './dashboards/AdminDashboard';
import { useDashboardData } from '../hooks/useDashboardData';

const Dashboard = () => {
  const { userRole, currentUser } = useAuth();
  const { dashboardData, loading, error, refreshData } = useDashboardData(userRole, currentUser);
  
  // 根据用户角色渲染不同的仪表盘内容
  const renderDashboardContent = () => {
    switch (userRole) {
      case 'student':
        return <StudentDashboard studentData={dashboardData.student} currentUser={currentUser} />;
      case 'parent':
        return <ParentDashboard parentData={dashboardData.parent} currentUser={currentUser} />;
      case 'teacher':
        return <TeacherDashboard teacherData={dashboardData.teacher} currentUser={currentUser} />;
      case 'admin':
        return <AdminDashboard adminData={dashboardData.admin} currentUser={currentUser} />;
      default:
        return <div>未知用户角色</div>;
    }
  };

  // 刷新仪表盘数据
  const handleRefreshData = () => {
    refreshData();
  };

  return (
    <div className="dashboard-content">
      {error && (
        <Alert 
          message="加载数据失败" 
          description={error.message || String(error)} 
          type="error" 
          showIcon 
          closable 
          action={
            <Button size="small" type="primary" onClick={handleRefreshData}>
              重试
            </Button>
          }
        />
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button 
              onClick={handleRefreshData} 
              loading={loading}
              icon={<ReloadOutlined />}
            >
              刷新数据
            </Button>
          </div>
          {renderDashboardContent()}
        </>
      )}
    </div>
  );
};

export default Dashboard;