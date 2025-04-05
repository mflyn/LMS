import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../src/contexts/AuthContext';
import api from '../../../src/services/api';

export default function MeetingScreen() {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const route = useRoute();
  const navigation = useNavigation();
  const { meetingId } = route.params;
  const { user } = useAuth();

  useEffect(() => {
    fetchMeetingDetail();
  }, []);

  const fetchMeetingDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/interaction/meetings/${meetingId}`);
      setMeeting(response.data);
    } catch (err) {
      console.error('获取会议详情失败', err);
      setError('获取会议详情失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = async () => {
    setJoining(true);
    try {
      const response = await api.post(`/interaction/meetings/${meetingId}/join`, { userId: user.id });
      
      // 在实际应用中，这里应该处理加入视频会议的逻辑
      // 例如跳转到视频会议页面或打开第三方会议应用
      Alert.alert('成功', '已成功加入会议');
      
      // 假设有一个视频会议页面
      // navigation.navigate('VideoMeeting', { meetingId, meetingData: response.data });
    } catch (err) {
      console.error('加入会议失败', err);
      Alert.alert('错误', '加入会议失败，请稍后再试');
    } finally {
      setJoining(false);
    }
  };

  const getMeetingStatusInfo = () => {
    const now = new Date();
    const meetingDate = new Date(meeting.date);
    
    if (meetingDate > now) {
      // 会议还未开始
      const diffTime = Math.abs(meetingDate - now);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeText = '';
      if (diffDays > 0) {
        timeText = `${diffDays}天${diffHours}小时后开始`;
      } else if (diffHours > 0) {
        timeText = `${diffHours}小时${diffMinutes}分钟后开始`;
      } else {
        timeText = `${diffMinutes}分钟后开始`;
      }
      
      return {
        status: 'upcoming',
        color: '#1890ff',
        backgroundColor: '#e6f7ff',
        text: '即将开始',
        timeText
      };
    } else if (meeting.endTime && new Date(meeting.endTime) < now) {
      // 会议已结束
      return {
        status: 'ended',
        color: '#999',
        backgroundColor: '#f5f5f5',
        text: '已结束',
        timeText: '会议已结束'
      };
    } else {
      // 会议进行中
      return {
        status: 'ongoing',
        color: '#52c41a',
        backgroundColor: '#f6ffed',
        text: '进行中',
        timeText: '会议正在进行中'
      };
    }
  };

  if (loading) {
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchMeetingDetail}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.errorContainer}>
        <Text>会议不存在</Text>
      </View>
    );
  }

  const statusInfo = getMeetingStatusInfo();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.backgroundColor }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
        </View>
        <Text style={styles.title}>{meeting.title}</Text>
        <Text style={styles.timeText}>{statusInfo.timeText}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="calendar-outline" size={20} color="#1890ff" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>日期时间</Text>
            <Text style={styles.infoValue}>
              {new Date(meeting.date).toLocaleDateString()} {meeting.time}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="person-outline" size={20} color="#1890ff" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>组织者</Text>
            <Text style={styles.infoValue}>{meeting.organizer}</Text>
          </View>
        </View>

        {meeting.location && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="location-outline" size={20} color="#1890ff" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>地点</Text>
              <Text style={styles.infoValue}>{meeting.location}</Text>
            </View>
          </View>
        )}

        {meeting.meetingUrl && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="videocam-outline" size={20} color="#1890ff" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>会议链接</Text>
              <Text style={styles.infoValue}>{meeting.meetingUrl}</Text>
            </View>
          </View>
        )}

        {meeting.meetingId && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="key-outline" size={20} color="#1890ff" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>会议ID</Text>
              <Text style={styles.infoValue}>{meeting.meetingId}</Text>
            </View>
          </View>
        )}

        {meeting.password && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#1890ff" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>密码</Text>
              <Text style={styles.infoValue}>{meeting.password}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>会议说明</Text>
        <Text style={styles.description}>{meeting.description}</Text>
      </View>

      {meeting.agenda && meeting.agenda.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>会议议程</Text>
          {meeting.agenda.map((item, index) => (
            <View key={index} style={styles.agendaItem}>
              <Text style={styles.agendaTime}>{item.time}</Text>
              <View style={styles.agendaContent}>
                <Text style={styles.agendaTitle}>{item.title}</Text>
                {item.description && <Text style={styles.agendaDescription}>{item.description}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {meeting.participants && meeting.participants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>参会人员 ({meeting.participants.length})</Text>
          <View style={styles.participantsContainer}>
            {meeting.participants.map((participant, index) => (
              <View key={index} style={styles.participantItem}>
                <Ionicons name="person-circle-outline" size={24} color="#1890ff" />
                <Text style={styles.participantName}>{participant.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {statusInfo.status === 'upcoming' || statusInfo.status === 'ongoing' ? (
        <TouchableOpacity 
          style={[styles.joinButton, joining && styles.joiningButton]}
          onPress={handleJoinMeeting}
          disabled={joining}
        >
          {joining ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={styles.joiningIcon} />
              <Text style={styles.joinButtonText}>加入中...</Text>
            </>
          ) : (
            <>
              <Ionicons name="videocam-outline" size={20} color="#fff" style={styles.joinIcon} />
              <Text style={styles.joinButtonText}>加入会议</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.endedContainer}>
          <Ionicons name="time-outline" size={24} color="#999" />
          <Text style={styles.endedText}>会议已结束</Text>
        </View>
      )}
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
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
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
  infoRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  infoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  agendaItem: {
    flexDirection: 'row',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  agendaTime: {
    width: 80,
    fontSize: 14,
    color: '#1890ff',
    fontWeight: 'bold',
  },
  agendaContent: {
    flex: 1,
  },
  agendaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  agendaDescription: {
    fontSize: 13,
    color: '#666',
  },
  participantsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
    marginBottom: 10,
  },
  participantName: {
    fontSize: 13,
    color: '#333',
    marginLeft: 5,
  },
  joinButton: {
    flexDirection: 'row',
    backgroundColor: '#1890ff',
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joiningButton: {
    backgroundColor: '#40a9ff',
  },
  joinIcon: {
    marginRight: 10,
  },
  joiningIcon: {
    marginRight: 10,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  endedContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  endedText: {
    color: '#999',
    fontSize: 16,
    marginLeft: 10,
  },
});