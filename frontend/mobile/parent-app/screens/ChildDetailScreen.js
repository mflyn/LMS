import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useNetwork } from '../../../src/contexts/NetworkContext';
import enhancedApi from '../../../src/services/enhancedApi';

const screenWidth = Dimensions.get('window').width;

export default function ChildDetailScreen() {
  const [childData, setChildData] = useState(null);
  const [homeworkData, setHomeworkData] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'homework', 'grades'
  
  const route = useRoute();
  const navigation = useNavigation();
  const { childId } = route.params;
  const { isOfflineMode, syncPendingData } = useNetwork();

  useEffect(() => {
    fetchChildData();
  }, []);

  const fetchChildData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 获取孩子基本信息（支持离线模式）
      const childData = await enhancedApi.auth.getUserById(childId);
      setChildData(childData);
      
      // 获取孩子的作业信息（支持离线模式）
      const homeworkData = await enhancedApi.homework.getAll({ studentId: childId });
      setHomeworkData(homeworkData);
      
      // 获取孩子的学习进度数据（支持离线模式）
      const progressData = await enhancedApi.analytics.getStudentPerformance(childId);
      setProgressData(progressData);
      
      // 如果是离线模式，显示提示
      if (isOfflineMode) {
        Alert.alert(
          '离线模式',
          '您正在查看缓存的数据，部分内容可能不是最新的',
          [{ text: '确定', style: 'default' }]
        );
      }
    } catch (err) {
      console.error('获取孩子数据失败', err);
      setError('获取数据失败，请稍后再试');
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
    
    fetchChildData();
  };

  const handleHomeworkPress = (homework) => {
    navigation.navigate('HomeworkDetail', { homeworkId: homework.id, childId });
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

  const renderOverviewTab = () => {
    return (
      <View>
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
            <Text style={styles.statValue}>{progressData?.weakPoints?.length || '0'}</Text>
            <Text style={styles.statLabel}>薄弱知识点</Text>
          </View>
        </View>

        {progressData?.weakPoints && progressData.weakPoints.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>需要加强的知识点</Text>
            {progressData.weakPoints.map((point, index) => (
              <View key={index} style={styles.weakPointItem}>
                <Ionicons name="alert-circle-outline" size={20} color="#ff4d4f" />
                <Text style={styles.weakPointText}>{point.name} - {point.subject}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderHomeworkTab = () => {
    if (homeworkData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无作业数据</Text>
        </View>
      );
    }

    return (
      <View>
        {homeworkData.map((homework, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.homeworkItem}
            onPress={() => handleHomeworkPress(homework)}
          >
            <View style={styles.homeworkHeader}>
              <View style={styles.subjectBadge}>
                <Text style={styles.badgeText}>{homework.subject}</Text>
              </View>
              <Text style={styles.homeworkDate}>{new Date(homework.dueDate).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.homeworkTitle}>{homework.title}</Text>
            <View style={styles.homeworkFooter}>
              <Text style={styles.homeworkStatus}>
                状态: 
                <Text style={{
                  color: homework.status === 'completed' ? '#52c41a' : 
                         homework.status === 'pending' ? '#faad14' : '#ff4d4f'
                }}>
                  {homework.status === 'completed' ? '已完成' : 
                   homework.status === 'pending' ? '进行中' : '未完成'}
                </Text>
              </Text>
              {homework.score !== undefined && (
                <Text style={styles.homeworkScore}>得分: {homework.score}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderGradesTab = () => {
    if (!progressData || !progressData.recentGrades || progressData.recentGrades.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无成绩数据</Text>
        </View>
      );
    }

    return (
      <View>
        {progressData.recentGrades.map((grade, index) => (
          <View key={index} style={styles.gradeItem}>
            <View style={styles.gradeHeader}>
              <View style={[styles.subjectBadge, { backgroundColor: getSubjectColor(grade.subject) }]}>
                <Text style={styles.badgeText}>{grade.subject}</Text>
              </View>
              <Text style={styles.gradeDate}>{new Date(grade.date).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.gradeTitle}>{grade.title}</Text>
            <View style={styles.gradeScoreContainer}>
              <Text style={[styles.gradeScore, {
                color: grade.score >= 90 ? '#52c41a' : 
                       grade.score >= 60 ? '#faad14' : '#ff4d4f'
              }]}>{grade.score}</Text>
              <Text style={styles.gradeMaxScore}>/ {grade.maxScore}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // 根据科目返回不同的颜色
  const getSubjectColor = (subject) => {
    const colors = {
      '语文': '#1890ff',
      '数学': '#722ed1',
      '英语': '#13c2c2',
      '科学': '#52c41a',
      '历史': '#fa8c16',
      '地理': '#eb2f96',
      '物理': '#faad14',
      '化学': '#a0d911',
      '生物': '#1890ff',
    };
    return colors[subject] || '#1890ff';
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890ff" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#ff4d4f" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchChildData}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.profileHeader}>
        <Image 
          source={childData?.avatar ? { uri: childData.avatar } : require('../../../src/assets/default-avatar.png')} 
          style={styles.avatar}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.childName}>{childData?.name || '未知'}</Text>
          <Text style={styles.childClass}>{childData?.grade} {childData?.class}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>学号: {childData?.studentId || '未知'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'overview' && styles.activeTabButton]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>学习概览</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'homework' && styles.activeTabButton]}
          onPress={() => setActiveTab('homework')}
        >
          <Text style={[styles.tabText, activeTab === 'homework' && styles.activeTabText]}>作业</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'grades' && styles.activeTabButton]}
          onPress={() => setActiveTab('grades')}
        >
          <Text style={[styles.tabText, activeTab === 'grades' && styles.activeTabText]}>成绩</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'homework' && renderHomeworkTab()}
        {activeTab === 'grades' && renderGradesTab()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    color: '#ff4d4f',
    textAlign: 'center',
    marginBottom: 15,
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
  profileHeader: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
  },
  profileInfo: {
    marginLeft: 15,
    justifyContent: 'center',
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  childClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#1890ff',
    fontSize: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#1890ff',
  },
  tabText: {
    color: '#666',
  },
  activeTabText: {
    color: '#1890ff',
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1890ff',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  weakPointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    padding: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  weakPointText: {
    marginLeft: 10,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
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
  subjectBadge: {
    backgroundColor: '#1890ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  homeworkDate: {
    color: '#999',
    fontSize: 12,
  },
  homeworkTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  homeworkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  homeworkStatus: {
    fontSize: 14,
    color: '#666',
  },
  homeworkScore: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  gradeItem: {
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
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gradeDate: {
    color: '#999',
    fontSize: 12,
  },
  gradeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  gradeScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  gradeScore: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  gradeMaxScore: {
    fontSize: 16,
    color: '#999',
    marginLeft: 2,
  },
});