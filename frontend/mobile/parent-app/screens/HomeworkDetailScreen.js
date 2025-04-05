import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../src/contexts/AuthContext';
import api from '../../../src/services/api';
import { LoadingIndicator, ErrorDisplay, Card, ProgressBar } from '../../../src/components/common';

export default function HomeworkDetailScreen() {
  const [homework, setHomework] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const route = useRoute();
  const navigation = useNavigation();
  const { homeworkId, childId } = route.params;
  const { user } = useAuth();

  useEffect(() => {
    fetchHomeworkDetail();
  }, []);

  const fetchHomeworkDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/homework/${homeworkId}`);
      setHomework(response.data);
    } catch (err) {
      console.error('获取作业详情失败', err);
      setError('获取作业详情失败，请稍后再试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemindChild = async () => {
    try {
      await api.post(`/notifications/send`, {
        recipientId: childId,
        title: '作业提醒',
        message: `请记得完成${homework.subject}作业：${homework.title}`,
        type: 'homework_reminder',
        referenceId: homeworkId
      });
      Alert.alert('成功', '已成功发送提醒');
    } catch (err) {
      console.error('发送提醒失败', err);
      Alert.alert('错误', '发送提醒失败，请稍后再试');
    }
  };

  const handleContactTeacher = () => {
    if (homework && homework.teacherId) {
      navigation.navigate('InteractionScreen', { 
        screen: 'Messages',
        params: { teacherId: homework.teacherId }
      });
    } else {
      Alert.alert('提示', '无法获取教师信息');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#52c41a';
      case 'pending':
        return '#faad14';
      case 'overdue':
        return '#ff4d4f';
      default:
        return '#999';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'pending':
        return '进行中';
      case 'overdue':
        return '已逾期';
      default:
        return '未知';
    }
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={fetchHomeworkDetail} />;
  }

  if (!homework) {
    return <ErrorDisplay message="作业不存在" onRetry={fetchHomeworkDetail} />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badgeContainer}>
          <View style={[styles.subjectBadge, { backgroundColor: '#1890ff' }]}>
            <Text style={styles.badgeText}>{homework.subject}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(homework.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(homework.status) }]}>
              {getStatusText(homework.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>{homework.title}</Text>
        <View style={styles.metaInfo}>
          <Text style={styles.teacherInfo}>
            布置老师: {homework.teacher?.name || '未知'}
          </Text>
          <View style={styles.dateContainer}>
            <View style={styles.dateItem}>
              <Ionicons name="calendar-outline" size={14} color="#666" />
              <Text style={styles.dateText}>布置日期: {new Date(homework.assignDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.dateItem}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.dateText}>截止日期: {new Date(homework.dueDate).toLocaleDateString()}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>作业内容</Text>
        <Text style={styles.description}>{homework.description}</Text>
      </View>

      {homework.requirements && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>完成要求</Text>
          {homework.requirements.map((req, index) => (
            <View key={index} style={styles.requirementItem}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#1890ff" />
              <Text style={styles.requirementText}>{req}</Text>
            </View>
          ))}
        </View>
      )}

      {homework.attachments && homework.attachments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>附件</Text>
          {homework.attachments.map((attachment, index) => (
            <TouchableOpacity key={index} style={styles.attachmentItem}>
              <Ionicons 
                name={attachment.type === 'image' ? 'image-outline' : 'document-outline'} 
                size={24} 
                color="#1890ff" 
              />
              <Text style={styles.attachmentName}>{attachment.name}</Text>
              <Ionicons name="download-outline" size={20} color="#1890ff" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {homework.submission && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>提交情况</Text>
          <View style={styles.submissionInfo}>
            <View style={styles.submissionRow}>
              <Text style={styles.submissionLabel}>提交时间:</Text>
              <Text style={styles.submissionValue}>
                {new Date(homework.submission.submittedAt).toLocaleString()}
              </Text>
            </View>
            {homework.submission.comment && (
              <View style={styles.submissionRow}>
                <Text style={styles.submissionLabel}>学生备注:</Text>
                <Text style={styles.submissionValue}>{homework.submission.comment}</Text>
              </View>
            )}
            {homework.submission.attachments && homework.submission.attachments.length > 0 && (
              <View style={styles.submissionAttachments}>
                <Text style={styles.submissionLabel}>提交附件:</Text>
                {homework.submission.attachments.map((attachment, index) => (
                  <TouchableOpacity key={index} style={styles.submissionAttachmentItem}>
                    <Ionicons 
                      name={attachment.type === 'image' ? 'image-outline' : 'document-outline'} 
                      size={20} 
                      color="#1890ff" 
                    />
                    <Text style={styles.submissionAttachmentName}>{attachment.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {homework.feedback && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>老师评价</Text>
          <View style={styles.feedbackContainer}>
            {homework.feedback.score !== undefined && (
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreLabel}>得分</Text>
                <Text style={styles.scoreValue}>{homework.feedback.score}</Text>
                <Text style={styles.scoreTotal}>/ {homework.feedback.totalScore || 100}</Text>
              </View>
            )}
            {homework.feedback.comment && (
              <View style={styles.commentContainer}>
                <Text style={styles.commentLabel}>评语:</Text>
                <Text style={styles.commentText}>{homework.feedback.comment}</Text>
              </View>
            )}
          </View>
        </View>
      )}
      <View style={styles.actionContainer}>
        {homework.status !== 'completed' && (
          <TouchableOpacity style={styles.actionButton} onPress={handleRemindChild}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>提醒完成</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={[styles.actionButton, styles.contactButton]} onPress={handleContactTeacher}>
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>联系老师</Text>
        </TouchableOpacity>
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  subjectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  metaInfo: {
    marginTop: 5,
  },
  teacherInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dateContainer: {
    marginTop: 5,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  requirementText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
  },
  submissionInfo: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 5,
  },
  submissionRow: {
    marginBottom: 10,
  },
  submissionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  submissionValue: {
    fontSize: 14,
    color: '#333',
  },
  submissionAttachments: {
    marginTop: 5,
  },
  submissionAttachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  submissionAttachmentName: {
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
  },
  feedbackContainer: {
    backgroundColor: '#f0f7ff',
    padding: 15,
    borderRadius: 5,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  scoreTotal: {
    fontSize: 14,
    color: '#999',
    marginLeft: 5,
  },
  commentContainer: {
    marginTop: 5,
  },
  commentLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    padding: 15,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1890ff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  contactButton: {
    backgroundColor: '#52c41a',
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontWeight: 'bold',
  },
});

  // 在底部添加操作按钮
  const renderActionButtons = () => {
    return (
      <View style={styles.actionContainer}>
        {homework.status !== 'completed' && (
          <TouchableOpacity style={styles.actionButton} onPress={handleRemindChild}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>提醒完成</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={[styles.actionButton, styles.contactButton]} onPress={handleContactTeacher}>
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>联系老师</Text>
        </TouchableOpacity>
      </View>
    );
  };