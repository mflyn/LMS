import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useNetwork } from '../../../src/contexts/NetworkContext';
import enhancedApi from '../../../src/services/enhancedApi';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [subjectData, setSubjectData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isOfflineMode, syncPendingData } = useNetwork();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 获取学习进度数据（支持离线模式）
      const progressData = await enhancedApi.analytics.getStudentPerformance(user.id);
      
      // 获取各科目成绩数据（支持离线模式）
      const subjectsData = await enhancedApi.analytics.getClassPerformance(user.classId);
      
      setProgressData(progressData);
      setSubjectData(subjectsData);
      
      // 如果是离线模式，显示提示
      if (isOfflineMode) {
        Alert.alert(
          '离线模式',
          '您正在查看缓存的数据，部分内容可能不是最新的',
          [{ text: '确定', style: 'default' }]
        );
      }
    } catch (err) {
      console.error('获取仪表盘数据失败', err);
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
    
    fetchDashboardData();
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
    if (!subjectData || !subjectData.subjectScores) {
      return {
        labels: ['语文', '数学', '英语', '科学'],
        datasets: [{ data: [0, 0, 0, 0] }]
      };
    }

    return {
      labels: subjectData.subjectScores.map(item => item.subject),
      datasets: [{
        data: subjectData.subjectScores.map(item => item.averageScore)
      }]
    };
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>学习进度</Text>
        <TouchableOpacity 
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <Text>加载中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDashboardData}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
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
              <Text style={styles.statValue}>{subjectData?.overallAverage || '0'}</Text>
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
});