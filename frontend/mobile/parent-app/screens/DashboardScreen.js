import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../src/contexts/AuthContext';
import api from '../../../src/services/api';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();
  const { user } = useAuth();

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChild) {
      fetchChildData(selectedChild.id);
    }
  }, [selectedChild]);

  const fetchChildren = async () => {
    setLoading(true);
    setError(null);
    try {
      // 获取家长关联的孩子列表
      const response = await api.get(`/users/${user.id}/children`);
      setChildren(response.data);
      
      // 默认选择第一个孩子
      if (response.data.length > 0 && !selectedChild) {
        setSelectedChild(response.data[0]);
      }
    } catch (err) {
      console.error('获取孩子列表失败', err);
      setError('获取数据失败，请稍后再试');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchChildData = async (childId) => {
    setLoading(true);
    setError(null);
    try {
      // 获取孩子的学习进度数据
      const progressResponse = await api.get(`/analytics/progress/student/${childId}`);
      setProgressData(progressResponse.data);
    } catch (err) {
      console.error('获取孩子学习数据失败', err);
      setError('获取数据失败，请稍后再试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedChild) {
      fetchChildData(selectedChild.id);
    } else {
      fetchChildren();
    }
  };

  // 处理进度数据以适应图表格式
  const getProgressChartData = () => {
    if (!progressData || !progressData.weeklyProgress) {
      return {
        labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
        datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
      };
    }

    return {
      labels: progressData.weeklyProgress.map(item => item.day),
      datasets: [{
        data: progressData.weeklyProgress.map(item => item.completionRate * 100)
      }]
    };
  };

  // 处理科目数据以适应图表格式
  const getSubjectChartData = () => {
    if (!progressData || !progressData.subjectScores) {
      return {
        labels: ['语文', '数学', '英语', '科学'],
        datasets: [{ data: [0, 0, 0, 0] }]
      };
    }

    return {
      labels: progressData.subjectScores.map(item => item.subject),
      datasets: [{
        data: progressData.subjectScores.map(item => item.score)
      }]
    };
  };

  const renderChildSelector = () => {
    return (
      <View style={styles.childSelectorContainer}>
        <Text style={styles.selectorLabel}>选择孩子:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {children.map(child => (
            <TouchableOpacity
              key={child.id}
              style={[styles.childItem, selectedChild?.id === child.id && styles.selectedChildItem]}
              onPress={() => setSelectedChild(child)}
            >
              <Text style={[styles.childName, selectedChild?.id === child.id && styles.selectedChildName]}>
                {child.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>学习概览</Text>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {renderChildSelector()}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <Text>加载中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : children.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无关联的孩子</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>本周学习进度</Text>
            <LineChart
              data={getProgressChartData()}
              width={screenWidth - 40}
              height={220}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(24, 144, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: '#1890ff',
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>各科目成绩</Text>
            <BarChart
              data={getSubjectChartData()}
              width={screenWidth - 40}
              height={220}
              yAxisSuffix="分"
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
              }}
              style={styles.chart}
            />
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{progressData?.completionRate ? `${Math.round(progressData.completionRate * 100)}%` : '0%'}</Text>
              <Text style={styles.statLabel}>总体完成率</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{progressData?.overallAverage || '0'}</Text>
              <Text style={styles.statLabel}>平均分数</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{progressData?.homeworkCount || '0'}</Text>
              <Text style={styles.statLabel}>待完成作业</Text>
            </View>
          </View>

          {progressData?.weakPoints && progressData.weakPoints.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>需要关注的知识点</Text>
              {progressData.weakPoints.map((point, index) => (
                <View key={index} style={styles.weakPointItem}>
                  <Ionicons name="alert-circle-outline" size={20} color="#ff4d4f" />
                  <Text style={styles.weakPointText}>{point.name} - {point.subject}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('ChildDetail', { childId: selectedChild.id })}
            >
              <Ionicons name="document-text-outline" size={24} color="#fff" style={styles.actionButtonIcon} />
              <Text style={styles.actionButtonText}>查看详细报告</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryActionButton]}
              onPress={() => navigation.navigate('HomeworkDetail', { childId: selectedChild.id })}
            >
              <Ionicons name="book-outline" size={24} color="#fff" style={styles.actionButtonIcon} />
              <Text style={styles.actionButtonText}>查看作业情况</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  notificationButton: {
    padding: 5,
  },
  childSelectorContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectorLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  childItem: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
  },
  selectedChildItem: {
    backgroundColor: '#e6f7ff',
    borderWidth: 1,
    borderColor: '#1890ff',
  },
  childName: {
    fontSize: 14,
    color: '#333',
  },
  selectedChildName: {
    color: '#1890ff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
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
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    margin: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  weakPointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  weakPointText: {
    marginLeft: 10,
    color: '#333',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 10,
    marginTop: 5,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1890ff',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionButton: {
    backgroundColor: '#52c41a',
  },
  actionButtonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});