import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Avatar, Space, Typography, message, Empty } from 'antd';
import { 
  VideoCameraOutlined, 
  UserOutlined,
  CloseOutlined,
  AudioMutedOutlined
} from '@ant-design/icons';
import MeetingControls from './MeetingControls';
import MeetingSidebar from './MeetingSidebar';

const { Text, Title } = Typography;

// 模拟当前用户ID，实际应用中应从AuthContext或其他地方获取
const CURRENT_USER_ID = 1; // Example current user ID

const VideoMeeting = ({ meetingId, participants: initialParticipants, onClose }) => {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [meetingParticipants, setMeetingParticipants] = useState(
    initialParticipants || [
      { id: CURRENT_USER_ID, name: '李老师', role: 'teacher', isHost: true }, // Assuming CURRENT_USER_ID is the host
      { id: 2, name: '张小明家长', role: 'parent' },
      { id: 3, name: '王小红家长', role: 'parent' }
    ]
  );

  useEffect(() => {
    console.log('模拟初始化本地媒体流');
    setLocalStream({}); // Simulate stream object
    message.success('成功加入会议');
    return () => {
      console.log('清理本地媒体流');
    };
  }, []);
  
  const toggleAudio = () => {
    setIsAudioMuted(!isAudioMuted);
    message.info(`麦克风已${!isAudioMuted ? '静音' : '取消静音'}`);
  };
  
  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    message.info(`摄像头已${!isVideoOff ? '关闭' : '开启'}`);
  };
  
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    // Actual fullscreen logic would target the main meeting element
  };
  
  const toggleScreenSharing = async () => {
    setIsScreenSharing(!isScreenSharing);
    message.info(`屏幕共享已${!isScreenSharing ? '开启' : '停止'}`);
  };
  
  const handleNewMessageChange = (e) => {
    setNewMessage(e.target.value);
  };

  const sendChatMessage = () => {
    if (!newMessage.trim()) return;
    const currentUser = meetingParticipants.find(p => p.id === CURRENT_USER_ID) || { name: '未知用户', id: CURRENT_USER_ID };
    const messageData = {
      id: Date.now(),
      sender: { id: currentUser.id, name: currentUser.name }, // Use dynamic sender based on CURRENT_USER_ID
      content: newMessage,
      timestamp: new Date().toLocaleTimeString()
    };
    setChatMessages([...chatMessages, messageData]);
    setNewMessage('');
  };
  
  const endMeeting = () => {
    message.success('会议已结束');
    if (onClose) onClose();
  };

  const handleShowSettings = () => {
    message.info('设置功能待实现');
  };
  
  // Get the current user details for main video display
  const localUser = meetingParticipants.find(p => p.id === CURRENT_USER_ID) || { name: '我' }; 

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>在线家长会 - {meetingId || '会议室'}</Title>
          <Space>
            <Text type="secondary">时长: 00:45:30</Text>
            <Button type="text" icon={<CloseOutlined />} onClick={endMeeting} aria-label="结束会议" />
          </Space>
        </div>
      }
      bodyStyle={{ padding: '12px', height: isFullScreen ? 'calc(100vh - 48px)' : '70vh', display: 'flex' }}
      style={{ width: '100%', height: isFullScreen ? '100vh' : 'auto' }}
    >
      <Row gutter={[16, 16]} style={{ height: '100%', flexGrow: 1 }}>
        <Col span={18} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexGrow: 1, background: '#000', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
            {isScreenSharing ? (
              <div style={{color: '#fff', textAlign: 'center'}}>屏幕共享内容区域...</div>
            ) : isVideoOff ? (
              <Space direction="vertical" align="center">
                <Avatar size={64} icon={<UserOutlined />} />
                <Text style={{color: '#fff'}}>{localUser.name}</Text>
              </Space>
            ) : (
              <div style={{ color: '#fff', textAlign: 'center' }}>
                <VideoCameraOutlined style={{ fontSize: '64px' }} />
                <Text style={{color: '#fff', display:'block'}}>{localUser.name} (视频开启)</Text>
              </div>
            )}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px', color: '#fff' }}>
              {localUser.name} {isAudioMuted && <AudioMutedOutlined />}
            </div>
            
            <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '8px'}}>
              {meetingParticipants.filter(p => p.id !== CURRENT_USER_ID).slice(0, 4).map(participant => (
                <div key={participant.id} style={{ width: '120px', height: '90px', background: '#333', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                  <Avatar size={32} icon={<UserOutlined />} />
                  <div style={{ position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.5)', padding: '2px 5px', borderRadius: '4px', color: '#fff', fontSize: '10px' }}>
                    {participant.name}
                  </div>
                </div>
              ))}
              {meetingParticipants.length > 5 && <Text style={{color: '#fff'}}>+ {meetingParticipants.length - 5} more</Text>}
            </div>
          </div>
          
          <MeetingControls 
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            isFullScreen={isFullScreen}
            toggleAudio={toggleAudio}
            toggleVideo={toggleVideo}
            toggleScreenSharing={toggleScreenSharing}
            toggleFullScreen={toggleFullScreen}
            onShowSettings={handleShowSettings}
            endMeeting={endMeeting}
          />
        </Col>
        
        <Col span={6} style={{ height: '100%' }}>
          <MeetingSidebar 
            participants={meetingParticipants}
            chatMessages={chatMessages}
            newMessage={newMessage}
            onNewMessageChange={handleNewMessageChange}
            onSendMessage={sendChatMessage}
            currentUserId={CURRENT_USER_ID}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default VideoMeeting;