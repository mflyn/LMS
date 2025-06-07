import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Input, Select, DatePicker, Typography, List, Avatar, Tag, message, Spin, Alert, Space, Tooltip, Divider, Empty, Card, Popconfirm, Row, Col } from 'antd';
import { VideoCameraOutlined, PlusOutlined, UserOutlined, ClockCircleOutlined, EnvironmentOutlined, LinkOutlined, CopyOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext'; // Adjusted path
import axios from 'axios';
import moment from 'moment';
import VideoMeeting from '../../components/meeting/VideoMeeting'; // Adjusted path

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const MeetingsTab = ({ initialMeetings, isLoading, loadError, onRefresh }) => {
  const { currentUser, userRole } = useAuth();
  const [meetings, setMeetings] = useState(initialMeetings || []);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [internalError, setInternalError] = useState(loadError);

  const [createMeetingForm] = Form.useForm();

  // Modal states
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Video Meeting States
  const [activeVideoMeeting, setActiveVideoMeeting] = useState(null); // Contains { meetingId, inviteLink, isHost }
  const [showVideoMeetingComponent, setShowVideoMeetingComponent] = useState(false);

  // Mock data for selections - TODO: Fetch dynamically
  const [mockUsers, setMockUsers] = useState([
    { id: 'parent1', name: '张小明家长 (mock)', role: 'parent' },
    { id: 'student1', name: '张小明 (mock)', role: 'student' },
    { id: 'teacher1', name: '李老师 (mock)', role: 'teacher' },
  ]);

  useEffect(() => {
    setMeetings(initialMeetings || []);
  }, [initialMeetings]);

  useEffect(() => {
    setInternalLoading(isLoading);
  }, [isLoading]);

  useEffect(() => {
    setInternalError(loadError);
  }, [loadError]);

  const handleShowCreateMeetingModal = () => {
    createMeetingForm.resetFields();
    createMeetingForm.setFieldsValue({ meetingType: 'offline' }); // Default type
    setShowMeetingModal(true);
  };

  const handleCreateMeeting = async (values) => {
    try {
      message.loading({ content: '正在创建会议...', key: 'createMeeting' });
      // TODO: Replace with actual API call. Handle meetingLink generation logic.
      const meetingData = {
        ...values,
        teacherId: currentUser._id, // Assuming teacher creates meeting
        startTime: values.dateTimeRange ? values.dateTimeRange[0].toISOString() : null,
        endTime: values.dateTimeRange ? values.dateTimeRange[1].toISOString() : null,
      };
      delete meetingData.dateTimeRange; // Remove original picker value
      
      console.log('Creating meeting:', meetingData);
      // Simulate API call that might return the created meeting with an ID and possibly a system-generated link
      const createdMeetingMock = { 
        ...meetingData, 
        id: `mock_${Date.now()}`,
        status: 'scheduled',
        teacher: { id: currentUser._id, name: currentUser.name },
        parent: mockUsers.find(u=>u.id === values.parentId),
        student: mockUsers.find(u=>u.id === values.studentId),
        meetingLink: values.meetingType === 'online' && !values.meetingLink ? `https://system-generated-link.com/mock_${Date.now()}` : values.meetingLink
      };
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowMeetingModal(false);
      createMeetingForm.resetFields();
      message.success({ content: '会议创建成功!', key: 'createMeeting', duration: 2 });
      if (onRefresh) onRefresh(); // Refresh meetings list
    } catch (error) {
      console.error('创建会议失败:', error);
      message.error({ content: '创建会议失败，请重试', key: 'createMeeting', duration: 2 });
    }
  };

  const handleViewDetail = (item) => {
    setDetailItem(item);
    setShowDetailModal(true);
  };

  const startVideoCall = (meeting) => {
    // TODO: Integrate with actual video call service to get a real link or session ID
    // For now, use mock data or existing link
    const inviteLink = meeting.meetingLink || `https://mock-video-call.com/${meeting.id}`;
    setActiveVideoMeeting({ meetingId: meeting.id, inviteLink, isHost: true, title: meeting.title });
    setShowVideoMeetingComponent(true);
    message.info(`会议 "${meeting.title}" 的邀请链接已生成 (模拟): ${inviteLink}`);
  };

  const joinVideoCall = (meeting) => {
    if (!meeting.meetingLink) {
        message.error('此在线会议没有有效的加入链接。');
        return;
    }
    setActiveVideoMeeting({ meetingId: meeting.id, inviteLink: meeting.meetingLink, isHost: false, title: meeting.title });
    setShowVideoMeetingComponent(true);
  };

  const handleEndVideoMeeting = () => {
    setShowVideoMeetingComponent(false);
    setActiveVideoMeeting(null);
    message.success('视频会议已结束');
    // TODO: Potentially update meeting status on backend
  };

  const handleCancelMeeting = async (meetingId) => {
    message.loading({ content: '正在取消会议...', key: `cancelMeeting_${meetingId}` });
    try {
        // TODO: API call to cancel meeting
        console.log('Cancelling meeting:', meetingId);
        await new Promise(resolve => setTimeout(resolve, 500));
        message.success({ content: '会议已取消', key: `cancelMeeting_${meetingId}`, duration: 2 });
        if(onRefresh) onRefresh();
    } catch (err) {
        message.error({ content: '取消会议失败', key: `cancelMeeting_${meetingId}`, duration: 2 });
    }
  };

  const renderMeetingsList = () => {
    if (internalLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin tip="加载会议中..." /></div>;
    if (internalError) return <Alert message="加载会议失败" description={internalError.toString()} type="error" showIcon />;
    if (!meetings || meetings.length === 0) return <Empty description="暂无会议安排" />;

    return (
      <List
        itemLayout="vertical"
        dataSource={meetings}
        renderItem={item => (
          <List.Item
            key={item.id}
            actions={[
              <Button type="link" onClick={() => handleViewDetail(item)}>查看详情</Button>,
              item.meetingType === 'online' && item.status === 'scheduled' && userRole === 'teacher' && (
                <Button type="link" onClick={() => startVideoCall(item)}>开始会议</Button>
              ),
              item.meetingType === 'online' && item.status === 'scheduled' && (
                <Button type="link" onClick={() => joinVideoCall(item)} disabled={!item.meetingLink}>加入会议</Button>
              ),
              item.status === 'scheduled' && userRole === 'teacher' && (
                <Popconfirm title="确定要取消这个会议吗?" onConfirm={() => handleCancelMeeting(item.id)} okText="确定" cancelText="点错了">
                    <Button type="link" danger>取消会议</Button>
                </Popconfirm>
              )
            ].filter(Boolean)}
            extra={
              item.status === 'scheduled' && <Tag color="blue">已安排</Tag> ||
              item.status === 'completed' && <Tag color="green">已完成</Tag> ||
              item.status === 'cancelled' && <Tag>已取消</Tag>
            }
          >
            <List.Item.Meta
              avatar={<Avatar icon={<VideoCameraOutlined />} />}
              title={<Text strong>{item.title}</Text>}
              description={
                <Space direction="vertical" size="small">
                  <Text><ClockCircleOutlined /> {moment(item.startTime).format('YYYY-MM-DD HH:mm')} - {moment(item.endTime).format('HH:mm')}</Text>
                  {item.meetingType === 'offline' ? 
                    <Text><EnvironmentOutlined /> {item.location}</Text> : 
                    <Text><LinkOutlined /> 在线会议 {item.meetingLink && <Tooltip title="复制链接"><CopyOutlined onClick={() => { navigator.clipboard.writeText(item.meetingLink); message.success('链接已复制!');}} style={{cursor: 'pointer'}} /></Tooltip>}</Text>}
                  <Text>参与人: {item.teacher?.name}, {item.parent?.name}{item.student ? `, ${item.student.name}` : ''}</Text>
                </Space>
              }
            />
            <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: '更多' }}>{item.description}</Paragraph>
          </List.Item>
        )}
      />
    );
  };

  const renderCreateMeetingModal = () => (
    <Modal
      title="创建新会议"
      visible={showMeetingModal}
      onCancel={() => setShowMeetingModal(false)}
      footer={null}
      destroyOnClose
      width={600}
    >
      <Form form={createMeetingForm} layout="vertical" onFinish={handleCreateMeeting}>
        <Form.Item name="title" label="会议主题" rules={[{ required: true, message: '请输入会议主题' }]}>
          <Input placeholder="例如：关于XX的期中学习情况沟通" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="parentId" label="选择家长" rules={[{ required: true, message: '请选择家长' }]}>
              <Select placeholder="选择家长">
                {mockUsers.filter(u => u.role === 'parent').map(user => <Option key={user.id} value={user.id}>{user.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="studentId" label="相关学生 (可选)">
              <Select placeholder="选择学生" allowClear>
                {mockUsers.filter(u => u.role === 'student').map(user => <Option key={user.id} value={user.id}>{user.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="dateTimeRange" label="会议时间" rules={[{ required: true, message: '请选择会议时间' }]}>
          <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="meetingType" label="会议类型" initialValue="offline">
          <Select onChange={(value) => createMeetingForm.setFieldsValue({ meetingType: value })}>
            <Option value="offline">线下会议</Option>
            <Option value="online">在线会议</Option>
          </Select>
        </Form.Item>
        {createMeetingForm.getFieldValue('meetingType') === 'offline' ? (
          <Form.Item name="location" label="会议地点" rules={[{ required: true, message: '请输入会议地点' }]}>
            <Input placeholder="例如：三年级二班教室 或 学校会议室A" />
          </Form.Item>
        ) : (
          <Form.Item name="meetingLink" label="在线会议链接 (可选)" help="若不填写，系统将尝试自动生成 (模拟)">
            <Input placeholder="粘贴会议链接，或留空由系统生成" />
          </Form.Item>
        )}
        <Form.Item name="description" label="会议描述/议程">
          <TextArea rows={3} placeholder="简要描述会议内容或议程..." />
        </Form.Item>
        <Form.Item style={{ textAlign: 'right' }}>
          <Button onClick={() => setShowMeetingModal(false)} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" htmlType="submit">创建会议</Button>
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderDetailModal = () => {
    if (!detailItem) return null;
    // Similar structure to MessagesTab detail modal, adapted for meeting details
    return (
      <Modal
        title="会议详情"
        visible={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>关闭</Button>,
        ]}
      >
        <Title level={5}>{detailItem.title}</Title>
        <Paragraph><strong>时间:</strong> {moment(detailItem.startTime).format('YYYY-MM-DD HH:mm')} - {moment(detailItem.endTime).format('HH:mm')}</Paragraph>
        <Paragraph><strong>类型:</strong> {detailItem.meetingType === 'online' ? '在线会议' : '线下会议'}</Paragraph>
        {detailItem.meetingType === 'online' && <Paragraph><strong>链接:</strong> <a href={detailItem.meetingLink} target="_blank" rel="noopener noreferrer">{detailItem.meetingLink}</a></Paragraph>}
        {detailItem.meetingType === 'offline' && <Paragraph><strong>地点:</strong> {detailItem.location}</Paragraph>}
        <Paragraph><strong>参与人:</strong> {detailItem.teacher?.name}, {detailItem.parent?.name}{detailItem.student ? `, ${detailItem.student.name}` : ''}</Paragraph>
        <Divider />
        <Paragraph strong>描述/议程:</Paragraph>
        <Paragraph>{detailItem.description || '暂无详细描述'}</Paragraph>
      </Modal>
    );
  };

  if (showVideoMeetingComponent && activeVideoMeeting) {
    return (
      <VideoMeeting 
        meetingId={activeVideoMeeting.meetingId}
        inviteLink={activeVideoMeeting.inviteLink}
        isHost={activeVideoMeeting.isHost}
        userName={currentUser?.name || '参会者'}
        onLeaveMeeting={handleEndVideoMeeting}
        meetingTitle={activeVideoMeeting.title}
      />
    );
  }

  return (
    <div>
      {userRole === 'teacher' && (
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleShowCreateMeetingModal} 
          style={{ marginBottom: 16 }}
        >
          安排新会议
        </Button>
      )}
      {renderMeetingsList()}
      {renderCreateMeetingModal()}
      {renderDetailModal()}
    </div>
  );
};

export default MeetingsTab; 