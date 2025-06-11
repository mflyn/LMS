// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  profile?: UserProfile;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'parent' | 'student' | 'teacher' | 'admin';

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  address?: string;
}

// 认证相关类型
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 学生相关类型
export interface Student {
  id: string;
  name: string;
  grade: string;
  class: string;
  avatar?: string;
  parentId?: string;
  performance?: StudentPerformance;
}

export interface StudentPerformance {
  overallGrade: number;
  subjects: SubjectPerformance[];
  attendance: number;
  homeworkCompletion: number;
}

export interface SubjectPerformance {
  subject: string;
  grade: number;
  trend: 'up' | 'down' | 'stable';
}

// 作业相关类型
export interface Homework {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDate: string;
  status: HomeworkStatus;
  grade?: number;
  feedback?: string;
  attachments?: string[];
}

export type HomeworkStatus = 'pending' | 'submitted' | 'graded' | 'overdue';

// 图表相关类型
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

// 通知相关类型
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

// 表格相关类型
export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex: keyof T;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sorter?: boolean;
  width?: number;
}

// WebSocket相关类型
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

// 路由相关类型
export interface RouteConfig {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
  roles?: UserRole[];
  title?: string;
} 