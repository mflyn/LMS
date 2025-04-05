/**
 * UI组件库
 * 提供通用UI组件，如骨架屏、下拉刷新、无限滚动等
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';

/**
 * 骨架屏组件 - 用于数据加载时显示占位内容
 */
export const SkeletonLoader = ({ type = 'default', count = 1, style }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <View style={[styles.skeletonCard, style]}>
            <View style={styles.skeletonHeader}>
              <View style={styles.skeletonCircle} />
              <View style={styles.skeletonLine} />
            </View>
            <View style={styles.skeletonBody}>
              <View style={styles.skeletonFullLine} />
              <View style={styles.skeletonFullLine} />
              <View style={[styles.skeletonFullLine, { width: '70%' }]} />
            </View>
          </View>
        );
      case 'list':
        return (
          <View style={[styles.skeletonListItem, style]}>
            <View style={styles.skeletonCircle} />
            <View style={styles.skeletonContent}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '60%' }]} />
            </View>
          </View>
        );
      case 'text':
        return (
          <View style={[styles.skeletonTextContainer, style]}>
            <View style={styles.skeletonFullLine} />
            <View style={[styles.skeletonFullLine, { width: '80%' }]} />
            <View style={[styles.skeletonFullLine, { width: '60%' }]} />
          </View>
        );
      default:
        return <View style={[styles.skeletonDefault, style]} />;
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ marginBottom: 8 }}>
          {renderSkeleton()}
        </View>
      ))}
    </View>
  );
};

/**
 * 下拉刷新组件 - 包装RefreshControl，提供统一的样式和行为
 */
export const PullToRefresh = ({ refreshing, onRefresh, children, ...props }) => {
  return React.cloneElement(children, {
    refreshControl: (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        colors={['#3498db']}
        tintColor="#3498db"
        {...props}
      />
    ),
  });
};

/**
 * 无限滚动列表 - 支持加载更多功能的FlatList
 */
export const InfiniteScrollList = ({
  data,
  renderItem,
  onEndReached,
  loading,
  loadingMore,
  onRefresh,
  refreshing,
  ListEmptyComponent,
  ...props
}) => {
  // 渲染底部加载指示器
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#3498db" />
        <Text style={styles.loadingMoreText}>加载更多...</Text>
      </View>
    );
  };

  // 渲染空列表组件
  const renderEmpty = () => {
    if (loading) return null;
    
    if (ListEmptyComponent) {
      return ListEmptyComponent;
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>暂无数据</Text>
      </View>
    );
  };

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(item, index) => item.id?.toString() || index.toString()}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.2}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498db']}
            tintColor="#3498db"
          />
        ) : undefined
      }
      {...props}
    />
  );
};

/**
 * 加载指示器组件 - 用于显示加载状态
 */
export const LoadingIndicator = ({ size = 'large', color = '#3498db', text, fullscreen = false }) => {
  if (fullscreen) {
    return (
      <View style={styles.fullscreenLoading}>
        <ActivityIndicator size={size} color={color} />
        {text && <Text style={styles.loadingText}>{text}</Text>}
      </View>
    );
  }
  
  return (
    <View style={styles.loading}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.loadingText}>{text}</Text>}
    </View>
  );
};

/**
 * 离线模式指示器 - 显示当前处于离线模式
 */
export const OfflineIndicator = ({ style }) => {
  return (
    <View style={[styles.offlineContainer, style]}>
      <Text style={styles.offlineText}>离线模式</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // 骨架屏样式
  skeletonDefault: {
    height: 100,
    backgroundColor: '#E1E9EE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  skeletonCard: {
    backgroundColor: '#E1E9EE',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D0D8DC',
    marginRight: 12,
  },
  skeletonLine: {
    height: 12,
    width: '40%',
    backgroundColor: '#D0D8DC',
    borderRadius: 4,
  },
  skeletonBody: {
    marginTop: 8,
  },
  skeletonFullLine: {
    height: 12,
    width: '100%',
    backgroundColor: '#D0D8DC',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonListItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#E1E9EE',
    borderRadius: 4,
    alignItems: 'center',
  },
  skeletonContent: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonTextContainer: {
    padding: 12,
    backgroundColor: '#E1E9EE',
    borderRadius: 4,
  },
  // 加载更多样式
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  // 空列表样式
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // 加载指示器样式
  loading: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fullscreenLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 999,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  // 离线模式指示器样式
  offlineContainer: {
    backgroundColor: '#f8d7da',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: '#721c24',
    fontSize: 14,
    fontWeight: '500',
  },
});