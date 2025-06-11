import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button, Badge, Divider, IconButton } from 'react-native-paper';
import apiService from '../services/api';

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 获取通知列表
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.notifications.getAll();
      setNotifications(response.data);
    } catch (err) {
      setError('获取通知失败');
      console.error('获取通知失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 下拉刷新
  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // 标记通知为已读
  const markAsRead = async (id) => {
    try {
      await apiService.notifications.markAsRead(id);
      // 更新本地通知状态
      setNotifications(notifications.map(notification => 
        notification._id === id ? { ...notification, read: true } : notification
      ));
    } catch (err) {
      console.error('标记通知已读失败:', err);
    }
  };

  // 标记所有通知为已读
  const markAllAsRead = async () => {
    try {
      await apiService.notifications.markAllAsRead();
      // 更新所有本地通知状态为已读
      setNotifications(notifications.map(notification => ({ ...notification, read: true })));
    } catch (err) {
      console.error('标记所有通知已读失败:', err);
    }
  };

  // 获取通知类型对应的颜色
  const getNotificationColor = (type) => {
    const colors = {
      info: '#2196F3',
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336'
    };
    return colors[type] || colors.info;
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 组件挂载时获取通知
  useEffect(() => {
    fetchNotifications();
  }, []);

  // 渲染通知项
  const renderNotificationItem = ({ item }) => (
    <Card 
      style={[styles.notificationCard, item.read ? styles.readNotification : styles.unreadNotification]}
      onPress={() => markAsRead(item._id)}
    >
      <Card.Content>
        <View style={styles.notificationHeader}>
          <View style={styles.typeContainer}>
            <Badge 
              style={[styles.typeBadge, { backgroundColor: getNotificationColor(item.type) }]}
            />
            <Text style={styles.notificationType}>
              {item.type === 'info' ? '信息' : 
               item.type === 'success' ? '成功' : 
               item.type === 'warning' ? '警告' : '错误'}
            </Text>
          </View>
          {!item.read && (
            <Badge style={styles.unreadBadge}>新</Badge>
          )}
        </View>
        <Paragraph style={styles.message}>{item.message}</Paragraph>
        <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>通知中心</Title>
        {notifications.some(n => !n.read) && (
          <Button 
            mode="text" 
            onPress={markAllAsRead}
            style={styles.markAllButton}
          >
            全部标为已读
          </Button>
        )}
      </View>
      <Divider />
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={fetchNotifications} style={styles.retryButton}>
            重试
          </Button>
        </View>
      )}
      
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无通知</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
  },
  markAllButton: {
    marginLeft: 'auto',
  },
  listContainer: {
    padding: 16,
  },
  notificationCard: {
    marginBottom: 12,
    borderRadius: 8,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  readNotification: {
    opacity: 0.8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    marginRight: 6,
  },
  notificationType: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  unreadBadge: {
    backgroundColor: '#f44336',
  },
  message: {
    fontSize: 16,
    marginVertical: 8,
    lineHeight: 22,
  },
  date: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#f44336',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
});

export default NotificationsScreen;