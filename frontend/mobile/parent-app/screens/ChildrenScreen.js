import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useNetwork } from '../../../src/contexts/NetworkContext';
import enhancedApi from '../../../src/services/enhancedApi';

export default function ChildrenScreen() {
  const [children, setChildren] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isOfflineMode, syncPendingData } = useNetwork();

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    setLoading(true);
    setError(null);
    try {
      // 使用enhancedApi获取孩子列表（支持离线模式）
      const childrenData = await enhancedApi.auth.getChildren(user.id);
      setChildren(childrenData);
      
      // 如果是离线模式，显示提示
      if (isOfflineMode) {
        Alert.alert(
          '离线模式',
          '您正在查看缓存的数据，部分内容可能不是最新的',
          [{ text: '确定', style: 'default' }]
        );
      }
    } catch (err) {
      console.error('获取孩子列表失败', err);
      setError('获取孩子列表失败，请稍后再试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    // 如果网络已恢复，尝试同步离线数据
    if (!isOfflineMode) {
      try {
        await syncPendingData();
      } catch (error) {
        console.error('同步离线数据失败', error);
      }
    }
    
    fetchChildren();
  };

  const handleChildPress = (child) => {
    navigation.navigate('ChildDetail', { childId: child.id });
  };

  const renderChildItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.childItem} 
        onPress={() => handleChildPress(item)}
      >
        <Image 
          source={item.avatar ? { uri: item.avatar } : require('../../../src/assets/default-avatar.png')} 
          style={styles.avatar}
        />
        
        <View style={styles.childInfo}>
          <Text style={styles.childName}>{item.name}</Text>
          <Text style={styles.childClass}>{item.grade} {item.class}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>平均分</Text>
              <Text style={styles.statValue}>{item.averageScore || '暂无'}</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>完成率</Text>
              <Text style={styles.statValue}>{item.completionRate ? `${Math.round(item.completionRate * 100)}%` : '暂无'}</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>待完成</Text>
              <Text style={styles.statValue}>{item.pendingHomework || 0}</Text>
            </View>
          </View>
        </View>
        
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的孩子</Text>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <Text>加载中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchChildren}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : children.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无关联的孩子</Text>
          <Text style={styles.emptySubText}>请联系学校管理员添加关联</Text>
        </View>
      ) : (
        <FlatList
          data={children}
          renderItem={renderChildItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 10,
  },
  childItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  childInfo: {
    flex: 1,
    marginLeft: 15,
  },
  childName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  childClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4d4f',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#1890ff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
  },
  emptySubText: {
    marginTop: 5,
    color: '#bbb',
    fontSize: 14,
  },
});