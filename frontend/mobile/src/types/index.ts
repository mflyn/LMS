// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  profile?: UserProfile;
}

export type UserRole = 'parent' | 'student' | 'teacher';

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
}

// 认证相关类型
export interface AuthContextType {
  signIn: (token: string, userData?: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
  showRoleSelector: () => void;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
}

// 网络相关类型
export interface NetworkContextType {
  isConnected: boolean;
  isOfflineMode: boolean;
  connectionType: string | null;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 导航相关类型
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  RoleSelection: undefined;
};

export type ParentStackParamList = {
  ParentMain: undefined;
  Notifications: undefined;
  HomeworkDetail: { homeworkId: string };
  ChildDetail: { childId: string };
  Meeting: { meetingId?: string };
};

export type StudentStackParamList = {
  StudentMain: undefined;
  ResourceDetail: { resourceId: string };
  Notifications: undefined;
}; 