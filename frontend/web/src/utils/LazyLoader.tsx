import React, { Suspense, lazy, ComponentType } from 'react';
import { Spin, Alert, Button } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

// 懒加载包装器
export const createLazyComponent = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallbackComponent?: React.ReactNode
) => {
  const LazyComponent = lazy(importFunc);
  
  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={fallbackComponent || <DefaultLoadingComponent />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

// 默认加载组件
const DefaultLoadingComponent: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '200px',
    flexDirection: 'column'
  }}>
    <Spin 
      indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} 
      size="large" 
    />
    <div style={{ marginTop: 16, color: '#666' }}>正在加载...</div>
  </div>
);

// 自定义加载组件
interface CustomLoadingProps {
  message?: string;
  size?: 'small' | 'default' | 'large';
  height?: string | number;
}

export const CustomLoadingComponent: React.FC<CustomLoadingProps> = ({ 
  message = '正在加载...', 
  size = 'large',
  height = '200px'
}) => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height,
    flexDirection: 'column'
  }}>
    <Spin 
      indicator={<LoadingOutlined style={{ fontSize: size === 'large' ? 24 : 16 }} spin />} 
      size={size} 
    />
    <div style={{ marginTop: 16, color: '#666' }}>{message}</div>
  </div>
);

// 页面级加载组件
export const PageLoadingComponent: React.FC<CustomLoadingProps> = ({ 
  message = '正在加载页面...' 
}) => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    flexDirection: 'column'
  }}>
    <Spin 
      indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} 
      size="large" 
    />
    <div style={{ marginTop: 24, fontSize: 16, color: '#666' }}>{message}</div>
  </div>
);

// 错误边界组件
interface LazyLoadErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class LazyLoadErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  LazyLoadErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): LazyLoadErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyLoad Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          padding: '20px'
        }}>
          <Alert
            message="加载失败"
            description={this.state.error?.message || '组件加载时发生错误'}
            type="error"
            showIcon
            action={
              <Button size="small" danger onClick={this.handleRetry}>
                重试
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// 路由懒加载高阶组件
export const withLazyLoading = <T extends ComponentType<any>>(
  Component: T,
  loadingMessage?: string
) => {
  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={<PageLoadingComponent message={loadingMessage} />}>
      <Component {...props} />
    </Suspense>
  );
}; 