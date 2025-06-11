import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

// 懒加载包装器
export const createLazyComponent = (importFunc, fallbackComponent = null) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <Suspense fallback={fallbackComponent || <DefaultLoadingComponent />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

// 默认加载组件
const DefaultLoadingComponent = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#4a90e2" />
    <Text style={styles.loadingText}>正在加载...</Text>
  </View>
);

// 自定义加载组件
export const CustomLoadingComponent = ({ message = '正在加载...', size = 'large' }) => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size={size} color="#4a90e2" />
    <Text style={styles.loadingText}>{message}</Text>
  </View>
);

// 错误边界组件
export class LazyLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LazyLoad Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>加载失败</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || '组件加载时发生错误'}
          </Text>
          <Text 
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            重试
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    fontSize: 16,
    color: '#4a90e2',
    fontWeight: 'bold',
    padding: 10,
  },
}); 