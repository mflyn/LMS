import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ScrollView, Dimensions } from 'react-native';
import { Button, Card, Title, Paragraph, IconButton, Dialog, Portal, TextInput } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import apiService from '../services/api';

const VideoMeetingScreen = ({ navigation }) => {
  const meetingId = navigation.getParam('meetingId');
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const webViewRef = useRef(null);

  // 获取会议详情
  const fetchMeetingDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.interaction.getMeetingById(meetingId);
      setMeeting(response.data);
    } catch (err) {
      setError('获取会议详情失败');
      console.error('获取会议详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 创建会议房间
  const createRoom = async () => {
    try {
      const response = await apiService.interaction.createMeetingRoom({
        meetingId: meetingId,
        roomName: meeting.title
      });
      setRoomId(response.data.roomId);
      setIsJoined(true);
    } catch (err) {
      Alert.alert('创建会议房间失败', err.message || '请稍后再试');
      console.error('创建会议房间失败:', err);
    }
  };

  // 加入会议房间
  const joinRoom = async () => {
    try {
      const response = await apiService.interaction.joinMeetingRoom(meetingId);
      setRoomId(response.data.roomId);
      setIsJoined(true);
    } catch (err) {
      Alert.alert('加入会议房间失败', err.message || '请稍后再试');
      console.error('加入会议房间失败:', err);
    }
  };

  // 发送消息
  const sendMessage = () => {
    if (!messageText.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      sender: '我',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    setChatMessages([...chatMessages, newMessage]);
    setMessageText('');

    // 发送消息到WebRTC信令服务器
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'chat',
        message: messageText
      }));
    }
  };

  // 处理WebView消息
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'chat') {
        const newMessage = {
          id: Date.now().toString(),
          sender: data.sender,
          content: data.message,
          timestamp: new Date().toISOString()
        };
        setChatMessages([...chatMessages, newMessage]);
      }
    } catch (err) {
      console.error('处理WebView消息失败:', err);
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 组件挂载时获取会议详情
  useEffect(() => {
    fetchMeetingDetail();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={fetchMeetingDetail} style={styles.retryButton}>
          重试
        </Button>
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.centerContainer}>
        <Text>会议不存在</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isJoined ? (
        <Card style={styles.meetingCard}>
          <Card.Content>
            <Title style={styles.meetingTitle}>{meeting.title}</Title>
            <Paragraph style={styles.meetingDesc}>{meeting.description}</Paragraph>
            
            <View style={styles.meetingInfo}>
              <Text style={styles.meetingInfoItem}>开始时间: {formatDate(meeting.startTime)}</Text>
              <Text style={styles.meetingInfoItem}>结束时间: {formatDate(meeting.endTime)}</Text>
              <Text style={styles.meetingInfoItem}>会议类型: {meeting.meetingType}</Text>
              <Text style={styles.meetingInfoItem}>状态: {meeting.status}</Text>
              <Text style={styles.meetingInfoItem}>参与人: </Text>
              <Text style={styles.participantItem}>教师: {meeting.teacher.name}</Text>
              <Text style={styles.participantItem}>家长: {meeting.parent.name}</Text>
              <Text style={styles.participantItem}>学生: {meeting.student.name}</Text>
            </View>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" onPress={joinRoom} disabled={meeting.status === '已取消'}>
              加入会议
            </Button>
            <Button mode="outlined" onPress={() => navigation.goBack()}>
              返回
            </Button>
          </Card.Actions>
        </Card>
      ) : (
        <View style={styles.meetingContainer}>
          <View style={styles.videoContainer}>
            <WebView
              ref={webViewRef}
              source={{ uri: `https://meeting.example.com/room/${roomId}` }}
              style={styles.webView}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              onMessage={handleWebViewMessage}
            />
          </View>
          
          <View style={styles.controlsContainer}>
            <IconButton
              icon="camera"
              size={30}
              onPress={() => {
                webViewRef.current?.postMessage(JSON.stringify({ type: 'toggleVideo' }));
              }}
            />
            <IconButton
              icon="microphone"
              size={30}
              onPress={() => {
                webViewRef.current?.postMessage(JSON.stringify({ type: 'toggleAudio' }));
              }}
            />
            <IconButton
              icon="chat"
              size={30}
              onPress={() => setChatVisible(true)}
            />
            <IconButton
              icon="phone-hangup"
              size={30}
              color="#F44336"
              onPress={() => {
                Alert.alert(
                  '结束会议',
                  '确定要离开会议吗？',
                  [
                    { text: '取消', style: 'cancel' },
                    { 
                      text: '确定', 
                      onPress: () => {
                        setIsJoined(false);
                        navigation.goBack();
                      } 
                    },
                  ]
                );
              }}
            />
          </View>
          
          <Portal>
            <Dialog visible={chatVisible} onDismiss={() => setChatVisible(false)}>
              <Dialog.Title>聊天</Dialog.Title>
              <Dialog.Content>
                <ScrollView style={styles.chatContainer}>
                  {chatMessages.map((msg) => (
                    <View key={msg.id} style={[styles.chatBubble, msg.sender === '我' ? styles.outgoingMessage : styles.incomingMessage]}>
                      <Text style={styles.senderName}>{msg.sender}</Text>
                      <Text style={styles.messageContent}>{msg.content}</Text>
                      <Text style={styles.messageTime}>{formatDate(msg.timestamp)}</Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={messageText}
                    onChangeText={setMessageText}
                    placeholder="输入消息..."
                  />
                  <Button mode="contained" onPress={sendMessage} disabled={!messageText.trim()}>
                    发送
                  </Button>
                </View>
              </Dialog.Content>
            </Dialog>
          </Portal>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  meetingCard: {
    elevation: 4,
  },
  meetingTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  meetingDesc: {
    marginBottom: 16,
  },
  meetingInfo: {
    marginTop: 8,
  },
  meetingInfoItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  participantItem: {
    fontSize: 14,
    marginLeft: 16,
    marginBottom: 2,
  },
  errorText: {
    color: '#F44336',
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 8,
  },
  meetingContainer: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  chatContainer: {
    maxHeight: Dimensions.get('window').height * 0.4,
  },
  chatBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    maxWidth: '80%',
  },
  incomingMessage: {
    backgroundColor: '#E3F2FD',
    alignSelf: 'flex-start',
  },
  outgoingMessage: {
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-end',
  },
  senderName: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 2,
  },
  messageContent: {
    fontSize: 14,
  },
  messageTime: {
    fontSize: 10,
    color: '#666',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  input: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
  },
});

export default VideoMeetingScreen;