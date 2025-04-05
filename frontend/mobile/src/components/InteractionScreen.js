import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Button, Divider, List, Avatar, FAB, Badge } from 'react-native-paper';
import apiService from '../services/api';

const InteractionScreen = ({ navigation }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 获取互动数据
  const fetchInteractionData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 获取公告
      const announcementsResponse = await apiService.interaction.getAnnouncements();
      setAnnouncements(announcementsResponse.data);
      
      // 获取消息
      const messagesResponse = await apiService.interaction.getMessages();
      setMessages(messagesResponse.data);
      
      // 获取会议
      const meetingsResponse = await apiService.interaction.getMeetings();
      setMeetings(meetingsResponse.data);
    } catch (err) {
      setError('获取互动数据失败');
      console.error('获取互动数据失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 下拉刷新
  const onRefresh = () => {
    setRefreshing(true);
    fetchInteractionData();
  };

  // 查看会议详情
  const viewMeetingDetail = (meetingId) => {
    navigation.navigate('VideoMeeting', { meetingId });
  };

  // 查看所有会议
  const viewAllMeetings = () => {
    navigation.navigate('MeetingList');
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 组件挂载时获取互动数据
  useEffect(() => {
    fetchInteractionData();
  }, []);

  // 渲染公告项
  const renderAnnouncementItem = ({ item }) => (
    <Card style={styles.card} onPress={() => {}}>
      <Card.Content>
        <Title style={styles.cardTitle}>{item.title}</Title>
        <Paragraph numberOfLines={2}>{item.content}</Paragraph>
        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
          <Text style={styles.cardAuthor}>发布人: {item.author.name}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  // 渲染消息项
  const renderMessageItem = ({ item }) => (
    <List.Item
      title={item.sender.name}
      description={item.content}
      left={props => <Avatar.Text {...props} size={40} label={item.sender.name.substring(0, 1)} />}
      right={props => (
        <View style={styles.messageRight}>
          <Text style={styles.messageDate}>{formatDate(item.createdAt)}</Text>
          {!item.read && <Badge style={styles.unreadBadge}>新</Badge>}
        </View>
      )}
      style={styles.messageItem}
    />
  );

  // 渲染会议项
  const renderMeetingItem = ({ item }) => (
    <Card style={styles.meetingCard} onPress={() => viewMeetingDetail(item._id)}>
      <Card.Content>
        <View style={styles.meetingHeader}>
          <Title style={styles.meetingTitle}>{item.title}</Title>
          <Badge style={[styles.statusBadge, { backgroundColor: item.status === '已确认' ? '#4CAF50' : item.status === '待确认' ? '#FF9800' : '#F44336' }]}>
            {item.status}
          </Badge>
        </View>
        <Paragraph style={styles.meetingDesc}>{item.description}</Paragraph>
        <Divider style={styles.divider} />
        <View style={styles.meetingInfo}>
          <Text style={styles.meetingInfoItem}>时间: {formatDate(item.startTime)}</Text>
          <Text style={styles.meetingInfoItem}>类型: {item.meetingType}</Text>
          <Text style={styles.meetingInfoItem}>参与人: {item.teacher.name}, {item.parent.name}</Text>
        </View>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => viewMeetingDetail(item._id)}>进入会议</Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button mode="contained" onPress={fetchInteractionData} style={styles.retryButton}>
              重试
            </Button>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Title style={styles.sectionTitle}>最新公告</Title>
            <Button mode="text">查看全部</Button>
          </View>
          {announcements.length > 0 ? (
            <FlatList
              data={announcements.slice(0, 3)}
              renderItem={renderAnnouncementItem}
              keyExtractor={item => item._id}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>暂无公告</Text>
          )}
        </View>

        <Divider style={styles.sectionDivider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Title style={styles.sectionTitle}>最近消息</Title>
            <Button mode="text">查看全部</Button>
          </View>
          {messages.length > 0 ? (
            <FlatList
              data={messages.slice(0, 5)}
              renderItem={renderMessageItem}
              keyExtractor={item => item._id}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>暂无消息</Text>
          )}
        </View>

        <Divider style={styles.sectionDivider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Title style={styles.sectionTitle}>近期会议</Title>
            <Button mode="text" onPress={viewAllMeetings}>查看全部</Button>
          </View>
          {meetings.length > 0 ? (
            <FlatList
              data={meetings.slice(0, 3)}
              renderItem={renderMeetingItem}
              keyExtractor={item => item._id}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>暂无会议</Text>
          )}
        </View>
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('MeetingList')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#f0f0f0',
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cardDate: {
    fontSize: 12,
    color: '#666',
  },
  cardAuthor: {
    fontSize: 12,
    color: '#666',
  },
  messageItem: {
    paddingVertical: 8,
  },
  messageRight: {
    alignItems: 'flex-end',
  },
  messageDate: {
    fontSize: 12,
    color: '#666',
  },
  unreadBadge: {
    marginTop: 4,
  },
  meetingCard: {
    marginBottom: 12,
    elevation: 2,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meetingTitle: {
    fontSize: 16,
    flex: 1,
  },
  statusBadge: {
    marginLeft: 8,
  },
  meetingDesc: {
    marginVertical: 8,
  },
  divider: {
    marginVertical: 8,
  },
  meetingInfo: {
    marginTop: 4,
  },
  meetingInfoItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    padding: 16,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#4a90e2',
  },
});

export default InteractionScreen;