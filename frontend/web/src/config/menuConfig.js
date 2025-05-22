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
  // HomeOutlined, // HomeOutlined 未在当前菜单项中使用，暂时注释
} from '@ant-design/icons';

export const commonMenuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '仪表盘',
    path: '/dashboard'
  },
  {
    key: '/interaction',
    icon: <MessageOutlined />,
    label: '家校互动',
    path: '/interaction'
  },
  {
    key: '/resources',
    icon: <ReadOutlined />,
    label: '学习资源',
    path: '/resources'
  },
  {
    key: '/analytics',
    icon: <BarChartOutlined />,
    label: '数据分析',
    path: '/analytics'
  }
];

export const studentMenuItems = [
  {
    key: '/courses',
    icon: <BookOutlined />,
    label: '我的课程',
    path: '/courses'
  },
  {
    key: '/assignments',
    icon: <FileTextOutlined />,
    label: '作业管理',
    path: '/assignments'
  },
  {
    key: '/progress', // 会覆盖 commonItems 中的 /analytics
    icon: <BarChartOutlined />,
    label: '学习进度',
    path: '/progress'
  }
];

export const parentMenuItems = [
  {
    key: '/children',
    icon: <TeamOutlined />,
    label: '我的孩子',
    path: '/children'
  },
  {
    key: '/performance', // 会覆盖 commonItems 中的 /analytics
    icon: <BarChartOutlined />,
    label: '学习表现',
    path: '/performance'
  },
  {
    key: '/communication',
    icon: <MessageOutlined />,
    label: '家校沟通',
    path: '/communication'
  },
  {
    key: '/notifications',
    icon: <BellOutlined />,
    label: '通知消息',
    path: '/notifications'
  }
];

export const teacherMenuItems = [
  {
    key: '/classes',
    icon: <TeamOutlined />,
    label: '班级管理',
    path: '/classes'
  },
  {
    key: '/students',
    icon: <UserOutlined />,
    label: '学生管理',
    path: '/students'
  },
  {
    key: '/grades',
    icon: <FileTextOutlined />,
    label: '成绩录入',
    path: '/grades'
  },
  {
    key: '/homework',
    icon: <ScheduleOutlined />,
    label: '作业布置',
    path: '/homework'
  },
  {
    key: '/parent-communication',
    icon: <MessageOutlined />,
    label: '家长沟通',
    path: '/parent-communication'
  }
];

export const adminMenuItems = [
  {
    key: '/users',
    icon: <UserOutlined />,
    label: '用户管理',
    path: '/users'
  },
  {
    key: '/classes-admin',
    icon: <TeamOutlined />,
    label: '班级管理 (管理端)',
    path: '/classes-admin'
  },
  {
    key: '/courses-admin',
    icon: <BookOutlined />,
    label: '课程管理 (管理端)',
    path: '/courses-admin'
  },
  {
    key: '/system',
    icon: <SettingOutlined />,
    label: '系统设置',
    path: '/system'
  },
  {
    key: '/reports', // 会覆盖 commonItems 中的 /analytics
    icon: <BarChartOutlined />,
    label: '统计报表',
    path: '/reports'
  }
];

// 定义哪些角色特定key会覆盖commonItem的key
// 格式: { roleSpecificKey: commonKeyToOverride }
export const overridesByRoleKeyConfig = {
  student: { '/progress': '/analytics' },
  parent: { '/performance': '/analytics' },
  // teacher: {}, // 教师目前没有覆盖项, 无需定义
  admin: { '/reports': '/analytics' }
}; 