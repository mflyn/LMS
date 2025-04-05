import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useNetwork } from '../../../src/contexts/NetworkContext';
import enhancedApi from '../../../src/services/enhancedApi';

export default function HomeworkScreen() {
  const [homeworks, setHomeworks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { isOfflineMode, syncPendingData } = useNetwork();

  useEffect(() => {
    fetchHomeworks();
  }, []);

  const fetchHomeworks = async () => {
    setLoading(true);
    setError(null);
    try {
      // 使用enhancedApi获取作业列表（支持离线模式）
      const homeworksData = await enhancedApi.homework.getAll({ studentId: user.id });
      setHomeworks(homeworksData);
      
      // 如果是离线模式，显示提示
      if (isOfflineMode) {
        Alert.alert(
          '离线模式',
          '您正在查看缓存的作业数据，部分内容可能不是最新的',
          [{ text: '确定', style: 'default' }]
        );
      }
    } catch (err) {
      console.error('获取作业列表失败', err);
      setError('获取作业列表失败，请稍后再试');
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
    
    fetchHomeworks();
  };

  const handleSubmitHomework = async (homeworkId) => {
    // 在实际应用中，这里应该导航到作业提交页面
    Alert.alert(
      '提交作业',
      '确定要提交此作业吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定', 
          onPress: async () => {
            try {
              const submission = {
                studentId: user.id,
                submissionContent: '作业内容示例',
                submissionDate: new Date().toISOString()
              };
              
              // 使用enhancedApi提交作业（支持离线模式）
              await enhancedApi.homework.submit(homeworkId, submission);
              
              if (isOfflineMode) {
                Alert.alert('成功', '作业已保存，将在网络恢复后自动提交');
              } else {
                Alert.alert('成功', '作业已提交');
              }
              
              fetchHomeworks(); // 刷新列表
            } catch (error) {
              Alert.alert('错误', '提交作业失败，请稍后再试');
              console.error('提交作业失败', error);
            }
          }
        }
      ]
    );
  };

  const renderHomeworkItem = ({ item }) => {
    const isOverdue = new Date(item.dueDate) < new Date();
    const isPending = item.status === 'pending';
    
    return (
      <View style={styles.homeworkItem}>
        <View style={styles.homeworkHeader}>
          <Text style={styles.homeworkSubject}>{item.subject}</Text>
          <View style={[styles.statusBadge, 
            item.status === 'completed' ? styles.completedBadge : 
            isOverdue ? styles.overdueBadge : styles.pendingBadge
          ]}>
            <Text style={styles.statusText}>
              {item.status === 'completed' ? '已完成' : 
               isOverdue ? '已逾期' : '待完成'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.homeworkTitle}>{item.title}</Text>
        <Text style={styles.homeworkDescription} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.homeworkFooter}>
          <Text style={styles.dueDate}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            {' '}截止日期: {new Date(item.dueDate).toLocaleDateString()}
          </Text>
          
          {isPending && !isOverdue && (
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={() => handleSubmitHomework(item._id)}
            >
              <Text style={styles.submitButtonText}>提交</Text>
            </TouchableOpacity>
          )}
          
          {item.status === 'completed' && (
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreLabel}>得分:</Text>
              <Text style={styles.scoreValue}>{item.score || '待评分'}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的作业</Text>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <Text>加载中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchHomeworks}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : homeworks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无作业</Text>
        </View>
      ) : (
        <FlatList
          data={homeworks}
          renderItem={renderHomeworkItem}
          keyExtractor={item => item._id}
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
  homeworkItem: {
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
  homeworkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  homeworkSubject: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pendingBadge: {
    backgroundColor: '#e6f7ff',
  },
  completedBadge: {
    backgroundColor: '#d9f7be',
  },
  overdueBadge: {
    backgroundColor: '#fff2e8',
  },
  statusText: {
    fontSize: 12,
    color: '#333',
  },
  homeworkTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  homeworkDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  homeworkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  dueDate: {
    fontSize: 12,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#1890ff',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 5,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#52c41a',
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
});