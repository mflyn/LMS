import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Tabs, Button, Form, Badge, Modal, Input, Select, DatePicker, Typography, List, Avatar, Tag, message, Spin, Alert, Divider, Space, Tooltip, PageHeader } from 'antd';
import { 
  MessageOutlined, 
  VideoCameraOutlined, 
  NotificationOutlined, 
  PlusOutlined, 
  UserOutlined, 
  FileOutlined, 
  ClockCircleOutlined, 
  EnvironmentOutlined,
  TeamOutlined,
  LinkOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import moment from 'moment';
import VideoMeeting from '../components/meeting/VideoMeeting';

// Import new Tab components
import MessagesTab from './interaction/MessagesTab';
import MeetingsTab from './interaction/MeetingsTab';
import AnnouncementsTab from './interaction/AnnouncementsTab';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const Interaction = () => {
  const { currentUser, userRole } = useAuth();
  const [messagesData, setMessagesData] = useState([]);
  const [meetingsData, setMeetingsData] = useState([]);
  const [announcementsData, setAnnouncementsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTabKey, setActiveTabKey] = useState('messages');
  
  // 新消息表单状态
  const [newMessage, setNewMessage] = useState({
    receiver: '',
    content: '',
    attachments: []
  });
  
  // 新会议表单状态
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    parent: '',
    student: '',
    startTime: null,
    endTime: null,
    location: '',
    meetingType: 'offline',
    meetingLink: ''
  });
  
  // 在线会议状态
  const [activeVideoMeeting, setActiveVideoMeeting] = useState(null);
  const [showVideoMeeting, setShowVideoMeeting] = useState(false);
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [meetingInviteLink, setMeetingInviteLink] = useState('');
  const [availableOnlineMeetings, setAvailableOnlineMeetings] = useState([]);
  const [showJoinMeetingModal, setShowJoinMeetingModal] = useState(false);
  const [joinMeetingId, setJoinMeetingId] = useState('');
  
  // 新公告表单状态
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    classId: '',
    important: false,
    attachments: []
  });
  
  // 模态框状态
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailType, setDetailType] = useState('');
  
  // Centralized data fetching logic
  const fetchMessages = useCallback(async () => {
    // TODO: Replace with actual API call
    // Simulating API call from original Interaction.js
    const mockMessages = [
        { id: 1, sender: { id: 'teacher1', name: '李老师', avatar: null, role: 'teacher' }, receiver: { id: 'parent1', name: '张小明家长', avatar: null, role: 'parent' }, content: '您好，张小明最近在课堂上表现很积极，希望能继续保持！', attachments: [], createdAt: '2023-10-15 14:30', read: true },
        { id: 2, sender: { id: 'parent1', name: '张小明家长' }, receiver: { id: 'teacher1', name: '李老师' }, content: '谢谢老师的鼓励！', attachments: [], createdAt: '2023-10-15 15:45', read: false },
      ];
    return mockMessages;
  }, []);

  const fetchMeetings = useCallback(async () => {
    // TODO: Replace with actual API call
    const mockMeetings = [
        { id: 1, title: '期中考试家长会', description: '讨论期中考试情况和后续学习计划', teacher: { id: 'teacher1', name: '李老师' }, parent: { id: 'parent1', name: '张小明家长' }, student: { id: 'student1', name: '张小明' }, startTime: '2023-10-20 18:30', endTime: '2023-10-20 19:30', location: '三年级2班教室', meetingType: 'offline', status: 'scheduled' },
        { id: 2, title: '在线辅导计划', description: '讨论在线辅导计划', teacher: { id: 'teacher1', name: '李老师' }, parent: { id: 'parent1', name: '张小明家长' }, student: { id: 'student1', name: '张小明' }, startTime: '2023-10-22 19:00', endTime: '2023-10-22 20:00', meetingType: 'online', meetingLink: 'https://example.com/meeting123', status: 'scheduled' },
      ];
    return mockMeetings;
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    // TODO: Replace with actual API call
    const mockAnnouncements = [
        { id: 1, title: '期中考试安排', content: '期中考试将于10月25日至10月27日进行。', publisher: { id: 'teacher1', name: '李老师', role: 'teacher' }, classId: 'class1', className: '三年级2班', publishTime: '2023-10-15 10:00', important: true, attachments: [] },
      ];
    return mockAnnouncements;
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [msgData, mtgData, annData] = await Promise.all([
        fetchMessages(),
        fetchMeetings(),
        fetchAnnouncements(),
      ]);
      setMessagesData(msgData);
      setMeetingsData(mtgData);
      setAnnouncementsData(annData);
    } catch (err) {
      console.error("Failed to load interaction data:", err);
      setError("数据加载失败，请稍后刷新重试。");
    } finally {
      setLoading(false);
    }
  }, [fetchMessages, fetchMeetings, fetchAnnouncements]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefreshTab = (tabKey) => {
    // This function allows individual tabs to trigger a refresh of their specific data,
    // or a full refresh if simpler.
    switch(tabKey) {
        case 'messages':
            fetchMessages().then(setMessagesData).catch(err => setError("刷新消息失败"));
            break;
        case 'meetings':
            fetchMeetings().then(setMeetingsData).catch(err => setError("刷新会议失败"));
            break;
        case 'announcements':
            fetchAnnouncements().then(setAnnouncementsData).catch(err => setError("刷新公告失败"));
            break;
        default:
            loadAllData(); // Fallback to reload all
    }
  }

  // 发送消息
  const handleSendMessage = async () => {
    if (!newMessage.receiver || !newMessage.content) {
      message.error('请填写接收者和消息内容');
      return;
    }
    
    try {
      // 模拟API调用
      // await axios.post('/api/interaction/messages', newMessage);
      
      message.success('消息发送成功');
      setShowMessageModal(false);
      setNewMessage({
        receiver: '',
        content: '',
        attachments: []
      });
      
      // 刷新消息列表
      await fetchMessages();
    } catch (error) {
      console.error('发送消息失败:', error);
      message.error('发送消息失败，请稍后重试');
    }
  };
  
  // 创建会议
  const handleCreateMeeting = async () => {
    if (!newMeeting.title || !newMeeting.parent || !newMeeting.startTime || !newMeeting.endTime) {
      message.error('请填写会议标题、家长、开始时间和结束时间');
      return;
    }
    
    if (newMeeting.meetingType === 'online' && !newMeeting.meetingLink) {
      message.error('请填写线上会议链接');
      return;
    }
    
    if (newMeeting.meetingType === 'offline' && !newMeeting.location) {
      message.error('请填写线下会议地点');
      return;
    }
    
    try {
      // 模拟API调用
      // await axios.post('/api/interaction/meetings', newMeeting);
      
      message.success('会议创建成功');
      setShowMeetingModal(false);
      setNewMeeting({
        title: '',
        description: '',
        parent: '',
        student: '',
        startTime: null,
        endTime: null,
        location: '',
        meetingType: 'offline',
        meetingLink: ''
      });
      
      // 刷新会议列表
      await fetchMeetings();
    } catch (error) {
      console.error('创建会议失败:', error);
      message.error('创建会议失败，请稍后重试');
    }
  };
  
  // 发布公告
  const handlePublishAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content || !newAnnouncement.classId) {
      message.error('请填写公告标题、内容和班级');
      return;
    }
    
    try {
      // 模拟API调用
      // await axios.post('/api/interaction/announcements', newAnnouncement);
      
      message.success('公告发布成功');
      setShowAnnouncementModal(false);
      setNewAnnouncement({
        title: '',
        content: '',
        classId: '',
        important: false,
        attachments: []
      });
      
      // 刷新公告列表
      await fetchAnnouncements();
    } catch (error) {
      console.error('发布公告失败:', error);
      message.error('发布公告失败，请稍后重试');
    }
  };
  
  // 查看详情
  const handleViewDetail = (item, type) => {
    setDetailItem(item);
    setDetailType(type);
    setShowDetailModal(true);
  };
  
  // 渲染消息列表
  const renderMessages = () => {
    return (
      <Card 
        title="消息列表" 
        extra={
          userRole === 'teacher' && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setShowMessageModal(true)}
            >
              发送消息
            </Button>
          )
        }
      >
        <List
          itemLayout="horizontal"
          dataSource={messagesData}
          renderItem={item => {
            const isReceived = item.receiver.id === (currentUser?.id || 0);
            return (
              <List.Item
                actions={[<a key="view" onClick={() => handleViewDetail(item, 'message')}>查看详情</a>]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={
                    <>
                      {isReceived ? (
                        <>
                          <Tag color="blue">收到</Tag>
                          <Text strong>来自: {item.sender.name}</Text>
                        </>
                      ) : (
                        <>
                          <Tag color="green">发送</Tag>
                          <Text strong>发给: {item.receiver.name}</Text>
                        </>
                      )}
                      {!item.read && isReceived && <Badge color="red" style={{ marginLeft: 8 }} />}
                    </>
                  }
                  description={
                    <>
                      <Paragraph ellipsis={{ rows: 2 }}>{item.content}</Paragraph>
                      <Text type="secondary">{item.createdAt}</Text>
                      {item.attachments.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <FileOutlined /> {item.attachments.length} 个附件
                        </div>
                      )}
                    </>
                  }
                />
              </List.Item>
            );
          }}
          locale={{ emptyText: '暂无消息' }}
        />
      </Card>
    );
  };
  
  // 渲染会议列表
  const renderMeetings = () => {
    return (
      <Card 
        title="会议安排" 
        extra={
          userRole === 'teacher' && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setShowMeetingModal(true)}
            >
              创建会议
            </Button>
          )
        }
      >
        <List
          itemLayout="horizontal"
          dataSource={meetingsData}
          renderItem={item => (
            <List.Item
              actions={[<a key="view" onClick={() => handleViewDetail(item, 'meeting')}>查看详情</a>]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar 
                    icon={<VideoCameraOutlined />} 
                    style={{ backgroundColor: item.meetingType === 'online' ? '#1890ff' : '#52c41a' }} 
                  />
                }
                title={
                  <>
                    <Text strong>{item.title}</Text>
                    <Tag 
                      color={item.status === 'completed' ? 'default' : 'processing'} 
                      style={{ marginLeft: 8 }}
                    >
                      {item.status === 'completed' ? '已结束' : '待进行'}
                    </Tag>
                  </>
                }
                description={
                  <>
                    <div>
                      <ClockCircleOutlined style={{ marginRight: 8 }} />
                      {item.startTime} - {item.endTime}
                    </div>
                    {item.meetingType === 'offline' ? (
                      <div>
                        <EnvironmentOutlined style={{ marginRight: 8 }} />
                        {item.location}
                      </div>
                    ) : (
                      <div>
                        <Tag color="blue">线上会议</Tag>
                      </div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary">
                        {userRole === 'teacher' ? `家长: ${item.parent.name}` : `老师: ${item.teacher.name}`}
                        {item.student && ` | 学生: ${item.student.name}`}
                      </Text>
                    </div>
                  </>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无会议安排' }}
        />
      </Card>
    );
  };
  
  // 渲染公告列表
  const renderAnnouncements = () => {
    return (
      <Card 
        title="公告通知" 
        extra={
          userRole === 'teacher' && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setShowAnnouncementModal(true)}
            >
              发布公告
            </Button>
          )
        }
      >
        <List
          itemLayout="horizontal"
          dataSource={announcementsData}
          renderItem={item => (
            <List.Item
              actions={[<a key="view" onClick={() => handleViewDetail(item, 'announcement')}>查看详情</a>]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar 
                    icon={<NotificationOutlined />} 
                    style={{ backgroundColor: item.important ? '#f5222d' : '#1890ff' }} 
                  />
                }
                title={
                  <>
                    <Text strong>{item.title}</Text>
                    {item.important && <Tag color="red" style={{ marginLeft: 8 }}>重要</Tag>}
                  </>
                }
                description={
                  <>
                    <Paragraph ellipsis={{ rows: 2 }}>{item.content}</Paragraph>
                    <div>
                      <Text type="secondary">{item.publishTime}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        发布人: {item.publisher.name}
                      </Text>
                      <Tag style={{ marginLeft: 8 }}>{item.className}</Tag>
                    </div>
                    {item.attachments.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <FileOutlined /> {item.attachments.length} 个附件
                      </div>
                    )}
                  </>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无公告' }}
        />
      </Card>
    );
  };
  
  // 渲染详情模态框
  const renderDetailModal = () => {
    if (!detailItem) return null;
    
    let title = '';
    let content = null;
    
    switch (detailType) {
      case 'message':
        title = '消息详情';
        content = (
          <div>
            <Paragraph>
              <Text strong>{detailItem.sender.name}</Text> 发送给 <Text strong>{detailItem.receiver.name}</Text>
            </Paragraph>
            <Paragraph>
              <Text type="secondary">{detailItem.createdAt}</Text>
            </Paragraph>
            <Divider />
            <Paragraph>{detailItem.content}</Paragraph>
            {detailItem.attachments.length > 0 && (
              <>
                <Divider orientation="left">附件</Divider>
                <List
                  dataSource={detailItem.attachments}
                  renderItem={attachment => (
                    <List.Item>
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                        <FileOutlined /> {attachment.name}
                      </a>
                    </List.Item>
                  )}
                />
              </>
            )}
          </div>
        );
        break;
      case 'meeting':
        title = '会议详情';
        content = (
          <div>
            <Title level={4}>{detailItem.title}</Title>
            <Paragraph>
              <Tag color={detailItem.status === 'completed' ? 'default' : 'processing'}>
                {detailItem.status === 'completed' ? '已结束' : '待进行'}
              </Tag>
              <Tag color={detailItem.meetingType === 'online' ? 'blue' : 'green'}>
                {detailItem.meetingType === 'online' ? '线上会议' : '线下会议'}
              </Tag>
            </Paragraph>
            <Paragraph>{detailItem.description}</Paragraph>
            <Divider />
            <Paragraph>
              <ClockCircleOutlined style={{ marginRight: 8 }} />
              时间: {detailItem.startTime} - {detailItem.endTime}
            </Paragraph>
            {detailItem.meetingType === 'offline' ? (
              <Paragraph>
                <EnvironmentOutlined style={{ marginRight: 8 }} />
                地点: {detailItem.location}
              </Paragraph>
            ) : (
              <Paragraph>
                <VideoCameraOutlined style={{ marginRight: 8 }} />
                会议链接: <a href={detailItem.meetingLink} target="_blank" rel="noopener noreferrer">{detailItem.meetingLink}</a>
              </Paragraph>
            )}
            <Divider />
            <Paragraph>
              <UserOutlined style={{ marginRight: 8 }} />
              老师: {detailItem.teacher.name}
            </Paragraph>
            <Paragraph>
              <UserOutlined style={{ marginRight: 8 }} />
              家长: {detailItem.parent.name}
            </Paragraph>
            {detailItem.student && (
              <Paragraph>
                <UserOutlined style={{ marginRight: 8 }} />
                学生: {detailItem.student.name}
              </Paragraph>
            )}
          </div>
        );
        break;
      case 'announcement':
        title = '公告详情';
        content = (
          <div>
            <Title level={4}>
              {detailItem.title}
              {detailItem.important && <Tag color="red" style={{ marginLeft: 8 }}>重要</Tag>}
            </Title>
            <Paragraph>
              <Text type="secondary">发布时间: {detailItem.publishTime}</Text>
            </Paragraph>
            <Paragraph>
              <Text type="secondary">发布人: {detailItem.publisher.name}</Text>
              <Tag style={{ marginLeft: 8 }}>{detailItem.className}</Tag>
            </Paragraph>
            <Divider />
            <Paragraph>{detailItem.content}</Paragraph>
            {detailItem.attachments.length > 0 && (
              <>
                <Divider orientation="left">附件</Divider>
                <List
                  dataSource={detailItem.attachments}
                  renderItem={attachment => (
                    <List.Item>
                      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                        <FileOutlined /> {attachment.name}
                      </a>
                    </List.Item>
                  )}
                />
              </>
            )}
          </div>
        );
        break;
      default:
        break;
    }
    
    return (
      <Modal
        title={title}
        visible={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {content}
      </Modal>
    );
  };
  
  // 渲染发送消息模态框
  const renderSendMessageModal = () => {
    return (
      <Modal
        title="发送消息"
        visible={showMessageModal}
        onCancel={() => setShowMessageModal(false)}
        onOk={handleSendMessage}
        okText="发送"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="接收者" required>
            <Select
              placeholder="选择接收者"
              value={newMessage.receiver}
              onChange={value => setNewMessage({ ...newMessage, receiver: value })}
            >
              <Option value="201">张小明家长</Option>
              <Option value="202">王小红家长</Option>
              <Option value="203">李小华家长</Option>
            </Select>
          </Form.Item>
          <Form.Item label="消息内容" required>
            <TextArea
              rows={4}
              placeholder="请输入消息内容"
              value={newMessage.content}
              onChange={e => setNewMessage({ ...newMessage, content: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="附件">
            <Button icon={<FileOutlined />}>上传附件</Button>
            <Text type="secondary" style={{ marginLeft: 8 }}>暂不支持附件上传</Text>
          </Form.Item>
        </Form>
      </Modal>
    );
  };
  
  // 渲染创建会议模态框
  const renderCreateMeetingModal = () => {
    return (
      <Modal
        title="创建会议"
        visible={showMeetingModal}
        onCancel={() => setShowMeetingModal(false)}
        onOk={handleCreateMeeting}
        okText="创建"
        cancelText="取消"
        width={700}
      >
        <Form layout="vertical">
          <Form.Item label="会议标题" required>
            <Input
              placeholder="请输入会议标题"
              value={newMeeting.title}
              onChange={e => setNewMeeting({ ...newMeeting, title: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="会议描述">
            <TextArea
              rows={3}
              placeholder="请输入会议描述"
              value={newMeeting.description}
              onChange={e => setNewMeeting({ ...newMeeting, description: e.target.value })}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="家长" required>
                <Select
                  placeholder="选择家长"
                  value={newMeeting.parent}
                  onChange={value => setNewMeeting({ ...newMeeting, parent: value })}
                >
                  <Option value="201">张小明家长</Option>
                  <Option value="202">王小红家长</Option>
                  <Option value="203">李小华家长</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="学生">
                <Select
                  placeholder="选择学生"
                  value={newMeeting.student}
                  onChange={value => setNewMeeting({ ...newMeeting, student: value })}
                >
                  <Option value="301">张小明</Option>
                  <Option value="302">王小红</Option>
                  <Option value="303">李小华</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="会议时间" required>
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  placeholder="开始时间"
                  value={newMeeting.startTime ? moment(newMeeting.startTime) : null}
                  onChange={value => setNewMeeting({ ...newMeeting, startTime: value ? value.format('YYYY-MM-DD HH:mm') : null })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label=" " required>
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  placeholder="结束时间"
                  value={newMeeting.endTime ? moment(newMeeting.endTime) : null}
                  onChange={value => setNewMeeting({ ...newMeeting, endTime: value ? value.format('YYYY-MM-DD HH:mm') : null })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="会议类型" required>
            <Select
              value={newMeeting.meetingType}
              onChange={value => setNewMeeting({ ...newMeeting, meetingType: value })}
            >
              <Option value="offline">线下会议</Option>
              <Option value="online">线上会议</Option>
            </Select>
          </Form.Item>
          {newMeeting.meetingType === 'offline' ? (
            <Form.Item label="会议地点" required>
              <Input
                placeholder="请输入会议地点"
                value={newMeeting.location}
                onChange={e => setNewMeeting({ ...newMeeting, location: e.target.value })}
              />
            </Form.Item>
          ) : (
            <div>
              <Alert
                message="在线会议信息"
                description="系统将自动生成会议链接，创建会议后可以分享给参与者。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </div>
          )}
        </Form>
      </Modal>
    );
  };
  
  // 渲染发布公告模态框
  const renderPublishAnnouncementModal = () => {
    return (
      <Modal
        title="发布公告"
        visible={showAnnouncementModal}
        onCancel={() => setShowAnnouncementModal(false)}
        onOk={handlePublishAnnouncement}
        okText="发布"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="公告标题" required>
            <Input
              placeholder="请输入公告标题"
              value={newAnnouncement.title}
              onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="班级" required>
            <Select
              placeholder="选择班级"
              value={newAnnouncement.classId}
              onChange={value => setNewAnnouncement({ ...newAnnouncement, classId: value })}
            >
              <Option value="3-2">三年级2班</Option>
              <Option value="3-3">三年级3班</Option>
              <Option value="all">全校通知</Option>
            </Select>
          </Form.Item>
          <Form.Item label="公告内容" required>
            <TextArea
              rows={4}
              placeholder="请输入公告内容"
              value={newAnnouncement.content}
              onChange={e => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Form.Item name="important" valuePropName="checked" noStyle>
                <input 
                  type="checkbox" 
                  checked={newAnnouncement.important}
                  onChange={e => setNewAnnouncement({ ...newAnnouncement, important: e.target.checked })}
                />
              </Form.Item>
              <span>标记为重要</span>
            </Space>
          </Form.Item>
          <Form.Item label="附件">
            <Button icon={<FileOutlined />}>上传附件</Button>
            <Text type="secondary" style={{ marginLeft: 8 }}>暂不支持附件上传</Text>
          </Form.Item>
        </Form>
      </Modal>
    );
  };
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}><Spin size="large" tip="加载交互信息中..." /></div>;
  }

  return (
    <PageHeader title="互动交流中心">
      {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} style={{ marginBottom: 16 }}/>}
      <Tabs activeKey={activeTabKey} onChange={setActiveTabKey}>
        <TabPane 
          tab={<Space><MessageOutlined />消息</Space>} 
          key="messages"
        >
          <MessagesTab 
            initialMessages={messagesData} 
            isLoading={loading} // Could be more granular if tabs load independently
            loadError={error}   // Same as above
            onRefresh={() => handleRefreshTab('messages')} 
          />
        </TabPane>
        <TabPane 
          tab={<Space><VideoCameraOutlined />会议</Space>} 
          key="meetings"
        >
          <MeetingsTab 
            initialMeetings={meetingsData}
            isLoading={loading}
            loadError={error}
            onRefresh={() => handleRefreshTab('meetings')}
          />
        </TabPane>
        <TabPane 
          tab={<Space><NotificationOutlined />公告</Space>} 
          key="announcements"
        >
          <AnnouncementsTab 
            initialAnnouncements={announcementsData}
            isLoading={loading}
            loadError={error}
            onRefresh={() => handleRefreshTab('announcements')}
          />
        </TabPane>
      </Tabs>
      
      {renderDetailModal()}
      {renderSendMessageModal()}
      {renderCreateMeetingModal()}
      {renderPublishAnnouncementModal()}
    </PageHeader>
  );
};

export default Interaction;