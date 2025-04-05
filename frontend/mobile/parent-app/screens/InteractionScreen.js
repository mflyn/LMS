import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../src/contexts/AuthContext';
import api from '../../../src/services/api';

export default function InteractionScreen() {
  const [activeTab, setActiveTab] = useState('announcements'); // 'announcements', 'messages', 'meetings'
  const [announcements, setAnnouncements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  const navigation = useNavigation();
  const { user } = useAuth();

  useEffect(() => {
    fetchInteractionData();
  }, []);

  const fetchInteractionData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 获取公告信息
      const announcementsResponse = await api.get('/interaction/announcements');
      setAnnouncements(announcementsResponse.data);
      
      // 获取消息信息
      const messagesResponse = await api.get(`/interaction/messages?userId=${user.id}`);
      setMessages(messagesResponse.data);
      
      // 获取会议信息
      const meetingsResponse = await api.get('/interaction/meetings');
      setMeetings(meetingsResponse.data);
    } catch (err) {
      console.error('获取互动数据失败', err);
      setError('获取数据失败，请稍后再试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchInteractionData();
  };

  const handleMeetingPress = (meeting) => {
    navigation.navigate('Meeting', { meetingId: meeting.id });
  };

  const renderAnnouncementsTab = () => {
    if (announcements.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="megaphone-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无公告</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.announcementItem}>
            <View style={styles.announcementHeader}>
              <Text style={styles.announcementTitle}>{item.title}</Text>
              <Text style={styles.announcementDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.announcementContent}>{item.content}</Text>
            <View style={styles.announcementFooter}>
              <Text style={styles.announcementAuthor}>发布者: {item.author}</Text>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    );
  };

  const renderMessagesTab = () => {
    if (messages.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无消息</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.messageItem}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageSender}>{item.sender.name}</Text>
              <Text style={styles.messageDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.messageContent}>{item.content}</Text>
            {item.reply && (
              <View style={styles.replyContainer}>
                <Text style={styles.replyLabel}>回复:</Text>
                <Text style={styles.replyContent}>{item.reply}</Text>
              </View>
            )}
            {!item.reply && (
              <View style={styles.replyInputContainer}>
                <TextInput
                  style={styles.replyInput}
                  placeholder="输入回复..."
                  multiline
                />
                <TouchableOpacity style={styles.sendButton}>
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    );
  };

  const renderMeetingsTab = () => {
    if (meetings.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>暂无会议</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={meetings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.meetingItem}
            onPress={() => handleMeetingPress(item)}
          >
            <View style={styles.meetingHeader}>
              <Text style={styles.meetingTitle}>{item.title}</Text>
              <View style={[styles.meetingStatus, {
                backgroundColor: 
                  new Date(item.date) > new Date() ? '#e6f7ff' : 
                  new Date(item.date) < new Date() ? '#f5f5f5' : '#f6ffed'
              }]}>
                <Text style={[styles.meetingStatusText, {
                  color: 
                    new Date(item.date) > new Date() ? '#1890ff' : 
                    new Date(item.date) < new Date() ? '#999' : '#52c41a'
                }]}>
                  {new Date(item.date) > new Date() ? '即将开始' : 
                   new Date(item.date) < new Date() ? '已结束' : '进行中'}
                </Text>
              </View>
            </View>
            <View style={styles.meetingInfo}>
              <View style={styles.meetingInfoItem}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.meetingInfoText}>
                  {new Date(item.date).toLocaleDateString()} {item.time}
                </Text>
              </View>
              <View style={styles.meetingInfoItem}>
                <Ionicons name="person-outline" size={16} color="#666" />
                <Text style={styles.meetingInfoText}>{item.organizer}</Text>
              </View>
              {item.location && (
                <View style={styles.meetingInfoItem}>
                  <Ionicons name="location-outline" size={16} color="#666" />
                  <Text style={styles.meetingInfoText}>{item.location}</Text>
                </View>
              )}
            </View>
            <Text style={styles.meetingDescription}>{item.description}</Text>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    );
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchInteractionData}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'announcements' && styles.activeTabButton]}
          onPress={() => setActiveTab('announcements')}
        >
          <Text style={[styles.tabText, activeTab === 'announcements' && styles.activeTabText]}>公告</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'messages' && styles.activeTabButton]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>消息</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'meetings' && styles.activeTabButton]}
          onPress={() => setActiveTab('meetings')}
        >
          <Text style={[styles.tabText, activeTab === 'meetings' && styles.activeTabText]}>家长会</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'announcements' && renderAnnouncementsTab()}
        {activeTab === 'messages' && renderMessagesTab()}
        {activeTab === 'meetings' && renderMeetingsTab()}
      </View>
    </View>
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
    flex: 1,
    padding: 10,
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
  // 公告样式
  announcementItem: {
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
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  announcementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  announcementDate: {
    color: '#999',
    fontSize: 12,
  },
  announcementContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
    lineHeight: 20,
  },
  announcementFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  announcementAuthor: {
    fontSize: 12,
    color: '#666',
  },
  // 消息样式
  messageItem: {
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
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageDate: {
    color: '#999',
    fontSize: 12,
  },
  messageContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
    lineHeight: 20,
  },
  replyContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  replyLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  replyContent: {
    fontSize: 14,
    color: '#333',
  },
  replyInputContainer: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#1890ff',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 会议样式
  meetingItem: {
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
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  meetingStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meetingStatusText: {
    fontSize: 12,
  },
  meetingInfo: {
    marginBottom: 10,
  },
  meetingInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  meetingInfoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  meetingDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});