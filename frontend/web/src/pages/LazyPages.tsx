import { createLazyComponent, CustomLoadingComponent } from '../utils/LazyLoader';

// 仪表板页面
export const LazyParentDashboard = createLazyComponent(
  () => import('./dashboards/ParentDashboard'),
  <CustomLoadingComponent message="正在加载家长仪表板..." height="100vh" />
);

export const LazyStudentDashboard = createLazyComponent(
  () => import('./dashboards/StudentDashboard'),
  <CustomLoadingComponent message="正在加载学生仪表板..." height="100vh" />
);

export const LazyTeacherDashboard = createLazyComponent(
  () => import('./dashboards/TeacherDashboard'),
  <CustomLoadingComponent message="正在加载教师仪表板..." height="100vh" />
);

// 互动页面
export const LazyInteractionPage = createLazyComponent(
  () => import('./interaction/InteractionPage'),
  <CustomLoadingComponent message="正在加载家校互动..." height="100vh" />
);

export const LazyMeetingPage = createLazyComponent(
  () => import('./interaction/MeetingPage'),
  <CustomLoadingComponent message="正在加载在线会议..." height="100vh" />
);

// 认证页面
export const LazyLoginPage = createLazyComponent(
  () => import('./auth/LoginPage'),
  <CustomLoadingComponent message="正在加载登录页面..." height="100vh" />
);

export const LazyRegisterPage = createLazyComponent(
  () => import('./auth/RegisterPage'),
  <CustomLoadingComponent message="正在加载注册页面..." height="100vh" />
);

// 用户管理页面
export const LazyUserManagement = createLazyComponent(
  () => import('./admin/UserManagement'),
  <CustomLoadingComponent message="正在加载用户管理..." height="100vh" />
);

export const LazyClassManagement = createLazyComponent(
  () => import('./admin/ClassManagement'),
  <CustomLoadingComponent message="正在加载班级管理..." height="100vh" />
);

// 学习资源页面
export const LazyResourcesPage = createLazyComponent(
  () => import('./resources/ResourcesPage'),
  <CustomLoadingComponent message="正在加载学习资源..." height="100vh" />
);

export const LazyResourceDetail = createLazyComponent(
  () => import('./resources/ResourceDetail'),
  <CustomLoadingComponent message="正在加载资源详情..." height="100vh" />
);

// 作业管理页面
export const LazyHomeworkManagement = createLazyComponent(
  () => import('./homework/HomeworkManagement'),
  <CustomLoadingComponent message="正在加载作业管理..." height="100vh" />
);

export const LazyHomeworkDetail = createLazyComponent(
  () => import('./homework/HomeworkDetail'),
  <CustomLoadingComponent message="正在加载作业详情..." height="100vh" />
);

// 成绩管理页面
export const LazyGradeManagement = createLazyComponent(
  () => import('./grades/GradeManagement'),
  <CustomLoadingComponent message="正在加载成绩管理..." height="100vh" />
);

export const LazyGradeAnalysis = createLazyComponent(
  () => import('./grades/GradeAnalysis'),
  <CustomLoadingComponent message="正在加载成绩分析..." height="100vh" />
);

// 设置页面
export const LazySettingsPage = createLazyComponent(
  () => import('./settings/SettingsPage'),
  <CustomLoadingComponent message="正在加载系统设置..." height="100vh" />
);

export const LazyProfilePage = createLazyComponent(
  () => import('./settings/ProfilePage'),
  <CustomLoadingComponent message="正在加载个人资料..." height="100vh" />
);

// 报告页面
export const LazyReportsPage = createLazyComponent(
  () => import('./reports/ReportsPage'),
  <CustomLoadingComponent message="正在加载报告中心..." height="100vh" />
);

export const LazyAnalyticsPage = createLazyComponent(
  () => import('./reports/AnalyticsPage'),
  <CustomLoadingComponent message="正在加载数据分析..." height="100vh" />
);

// 通知页面
export const LazyNotificationsPage = createLazyComponent(
  () => import('./notifications/NotificationsPage'),
  <CustomLoadingComponent message="正在加载通知中心..." height="100vh" />
);

// 错误页面
export const LazyNotFoundPage = createLazyComponent(
  () => import('./error/NotFoundPage'),
  <CustomLoadingComponent message="正在加载页面..." height="100vh" />
);

export const LazyErrorPage = createLazyComponent(
  () => import('./error/ErrorPage'),
  <CustomLoadingComponent message="正在加载错误页面..." height="100vh" />
); 