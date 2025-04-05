import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Row, Col, Avatar, Space, Typography, Tooltip, message } from 'antd';
import { 
  AudioOutlined, 
  AudioMutedOutlined, 
  VideoCameraOutlined, 
  VideoCameraAddOutlined,
  MessageOutlined,
  UserOutlined,
  SettingOutlined,
  CloseOutlined,
  FullscreenOutlined,
  ShareAltOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

const VideoMeeting = ({ meetingId, participants, onClose }) => {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  
  // 模拟参与者数据
  const [meetingParticipants, setMeetingParticipants] = useState(
    participants || [
      { id: 1, name: '李老师', role: 'teacher', isHost: true },
      { id: 2, name: '张小明家长', role: 'parent' },
      { id: 3, name: '王小红家长', role: 'parent' }
    ]
  );

  // 初始化视频会议
  useEffect(() => {
    // 在实际项目中，这里应该连接到视频会议服务
    // 例如使用WebRTC、Agora或其他视频会议SDK
    
    // 模拟获取本地媒体流
    const initLocalStream = async () => {
      try {
        // 在实际项目中，这里应该请求用户的摄像头和麦克风权限
        // const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // setLocalStream(stream);
        
        // 模拟成功获取本地流
        console.log('模拟初始化本地媒体流');
        setLocalStream({});
        message.success('成功加入会议');
      } catch (error) {
        console.error('获取本地媒体流失败:', error);
        message.error('无法访问摄像头或麦克风');
      }
    };
    
    initLocalStream();
    
    // 清理函数
    return () => {
      if (localStream) {
        // 在实际项目中，这里应该关闭所有媒体轨道
        // localStream.getTracks().forEach(track => track.stop());
        console.log('清理本地媒体流');
      }
    };
  }, []);
  
  // 切换音频状态
  const toggleAudio = () => {
    // 在实际项目中，这里应该控制本地音频轨道
    // if (localStream) {
    //   const audioTrack = localStream.getAudioTracks()[0];
    //   if (audioTrack) {
    //     audioTrack.enabled = !isAudioMuted;
    //   }
    // }
    
    setIsAudioMuted(!isAudioMuted);
    message.info(`麦克风已${!isAudioMuted ? '静音' : '取消静音'}`);
  };
  
  // 切换视频状态
  const toggleVideo = () => {
    // 在实际项目中，这里应该控制本地视频轨道
    // if (localStream) {
    //   const videoTrack = localStream.getVideoTracks()[0];
    //   if (videoTrack) {
    //     videoTrack.enabled = !isVideoOff;
    //   }
    // }
    
    setIsVideoOff(!isVideoOff);
    message.info(`摄像头已${!isVideoOff ? '关闭' : '开启'}`);
  };
  
  // 切换全屏状态
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };
  
  // 切换屏幕共享
  const toggleScreenSharing = async () => {
    // 在实际项目中，这里应该实现屏幕共享功能
    // try {
    //   if (!isScreenSharing) {
    //     const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    //     // 处理屏幕共享流
    //   } else {
    //     // 停止屏幕共享
    //   }
    // } catch (error) {
    //   console.error('屏幕共享失败:', error);
    // }
    
    setIsScreenSharing(!isScreenSharing);
    message.info(`屏幕共享已${!isScreenSharing ? '开启' : '停止'}`);
  };
  
  // 发送聊天消息
  const sendChatMessage = () => {
    if (!newMessage.trim()) return;
    
    const message = {
      id: Date.now(),
      sender: { id: 1, name: '李老师', role: 'teacher' },
      content: newMessage,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setChatMessages([...chatMessages, message]);
    setNewMessage('');
  };
  
  // 结束会议
  const endMeeting = () => {
    // 在实际项目中，这里应该断开与会议服务器的连接
    message.success('会议已结束');
    if (onClose) onClose();
  };
  
  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>在线家长会 - {meetingId || '会议室'}</Title>
          <Space>
            <Text type="secondary">时长: 00:45:30</Text>
            <Button type="text" icon={<CloseOutlined />} onClick={endMeeting} />
          </Space>
        </div>
      }
      bodyStyle={{ padding: '12px', height: isFullScreen ? '90vh' : '70vh' }}
      style={{ width: '100%' }}
    >
      <Row gutter={[16, 16]} style={{ height: '100%' }}>
        <Col span={18} style={{ height: '100%' }}>
          <div style={{ height: '85%', background: '#f0f2f5', borderRadius: '8px', padding: '16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
            {/* 主视频区域 */}
            <div style={{ width: '100%', height: '70%', background: '#000', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              {isVideoOff ? (
                <Avatar size={64} icon={<UserOutlined />} />
              ) : (
                <div style={{ color: '#fff', textAlign: 'center' }}>
                  <VideoCameraOutlined style={{ fontSize: '48px' }} />
                  <div>视频预览区域</div>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px', color: '#fff' }}>
                李老师 {isAudioMuted && <AudioMutedOutlined />}
              </div>
            </div>
            
            {/* 参与者视频网格 */}
            <div style={{ width: '100%', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {meetingParticipants.filter(p => p.id !== 1).map(participant => (
                <div key={participant.id} style={{ width: '160px', height: '120px', background: '#333', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                  <Avatar size={40} icon={<UserOutlined />} />
                  <div style={{ position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.5)', padding: '2px 5px', borderRadius: '4px', color: '#fff', fontSize: '12px' }}>
                    {participant.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* 会议控制栏 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <Tooltip title={isAudioMuted ? "取消静音" : "静音"}>
              <Button 
                type="primary" 
                shape="circle" 
                icon={isAudioMuted ? <AudioMutedOutlined /> : <AudioOutlined />} 
                onClick={toggleAudio}
                danger={isAudioMuted}
              />
            </Tooltip>
            <Tooltip title={isVideoOff ? "开启视频" : "关闭视频"}>
              <Button 
                type="primary" 
                shape="circle" 
                icon={isVideoOff ? <VideoCameraAddOutlined /> : <VideoCameraOutlined />} 
                onClick={toggleVideo}
                danger={isVideoOff}
              />
            </Tooltip>
            <Tooltip title={isScreenSharing ? "停止共享" : "屏幕共享"}>
              <Button 
                type="primary" 
                shape="circle" 
                icon={<ShareAltOutlined />} 
                onClick={toggleScreenSharing}
                danger={isScreenSharing}
              />
            </Tooltip>
            <Tooltip title={isFullScreen ? "退出全屏" : "全屏"}>
              <Button 
                type="primary" 
                shape="circle" 
                icon={<FullscreenOutlined />} 
                onClick={toggleFullScreen}
              />
            </Tooltip>
            <Tooltip title="设置">
              <Button 
                type="primary" 
                shape="circle" 
                icon={<SettingOutlined />} 
              />
            </Tooltip>
            <Tooltip title="结束会议">
              <Button 
                type="primary" 
                shape="circle" 
                icon={<CloseOutlined />} 
                danger
                onClick={endMeeting}
              />
            </Tooltip>
          </div>
        </Col>
        
        {/* 侧边栏：参与者列表和聊天 */}
        <Col span={6} style={{ height: '100%' }}>
          <Card
            style={{ height: '100%', overflow: 'hidden' }}
            tabList={[
              { key: 'participants', tab: '参与者' },
              { key: 'chat', tab: '聊天' },
            ]}
            activeTabKey="participants"
          >
            <div style={{ height: '100%', overflowY: 'auto' }}>
              {/* 参与者列表 */}
              <List
                dataSource={meetingParticipants}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={<span>{item.name} {item.isHost && <Tag color="blue">主持人</Tag>}</span>}
                      description={item.role === 'teacher' ? '教师' : '家长'}
                    />
                  </List.Item>
                )}
              />
              
              {/* 聊天区域 - 在实际应用中可以通过Tab切换显示 */}
              <div style={{ display: 'none' }}>
                <div style={{ height: 'calc(100% - 50px)', overflowY: 'auto', padding: '8px' }}>
                  {chatMessages.map(msg => (
                    <div key={msg.id} style={{ marginBottom: '12px' }}>
                      <div>
                        <Text strong>{msg.sender.name}</Text>
                        <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>{msg.timestamp}</Text>
                      </div>
                      <div style={{ background: '#f0f2f5', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', marginTop: '8px' }}>
                  <Input 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    onPressEnter={sendChatMessage}
                    placeholder="发送消息..."
                  />
                  <Button type="primary" onClick={sendChatMessage} icon={<MessageOutlined />} style={{ marginLeft: '8px' }} />
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default VideoMeeting;