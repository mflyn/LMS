import { createLazyComponent, CustomLoadingComponent } from '../utils/LazyLoader';

// 家长端屏幕懒加载
export const LazyParentDashboard = createLazyComponent(
  () => import('../parent-app/screens/DashboardScreen'),
  <CustomLoadingComponent message="正在加载学习概览..." />
);

export const LazyChildrenScreen = createLazyComponent(
  () => import('../parent-app/screens/ChildrenScreen'),
  <CustomLoadingComponent message="正在加载孩子信息..." />
);

export const LazyInteractionScreen = createLazyComponent(
  () => import('../parent-app/screens/InteractionScreen'),
  <CustomLoadingComponent message="正在加载家校互动..." />
);

export const LazyParentProfileScreen = createLazyComponent(
  () => import('../parent-app/screens/ProfileScreen'),
  <CustomLoadingComponent message="正在加载个人信息..." />
);

export const LazyNotificationsScreen = createLazyComponent(
  () => import('../parent-app/screens/NotificationsScreen'),
  <CustomLoadingComponent message="正在加载通知..." />
);

export const LazyHomeworkDetailScreen = createLazyComponent(
  () => import('../parent-app/screens/HomeworkDetailScreen'),
  <CustomLoadingComponent message="正在加载作业详情..." />
);

export const LazyChildDetailScreen = createLazyComponent(
  () => import('../parent-app/screens/ChildDetailScreen'),
  <CustomLoadingComponent message="正在加载孩子详情..." />
);

export const LazyMeetingScreen = createLazyComponent(
  () => import('../parent-app/screens/MeetingScreen'),
  <CustomLoadingComponent message="正在加载家长会..." />
);

// 学生端屏幕懒加载
export const LazyStudentDashboard = createLazyComponent(
  () => import('../student-app/screens/DashboardScreen'),
  <CustomLoadingComponent message="正在加载学习进度..." />
);

export const LazyHomeworkScreen = createLazyComponent(
  () => import('../student-app/screens/HomeworkScreen'),
  <CustomLoadingComponent message="正在加载作业..." />
);

export const LazyResourcesScreen = createLazyComponent(
  () => import('../student-app/screens/ResourcesScreen'),
  <CustomLoadingComponent message="正在加载学习资源..." />
);

export const LazyResourceDetailScreen = createLazyComponent(
  () => import('../student-app/screens/ResourceDetailScreen'),
  <CustomLoadingComponent message="正在加载资源详情..." />
);

export const LazyStudentProfileScreen = createLazyComponent(
  () => import('../student-app/screens/ProfileScreen'),
  <CustomLoadingComponent message="正在加载个人信息..." />
);

export const LazyStudentNotificationsScreen = createLazyComponent(
  () => import('../student-app/screens/NotificationsScreen'),
  <CustomLoadingComponent message="正在加载通知..." />
);

// 通用屏幕懒加载
export const LazyLoginScreen = createLazyComponent(
  () => import('../screens/LoginScreen'),
  <CustomLoadingComponent message="正在加载登录页面..." />
);

export const LazyRoleSelectionScreen = createLazyComponent(
  () => import('../screens/RoleSelectionScreen'),
  <CustomLoadingComponent message="正在加载角色选择..." />
); 