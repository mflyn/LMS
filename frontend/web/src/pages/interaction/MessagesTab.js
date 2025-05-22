import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Input, Select, Typography, List, Avatar, Tag, message, Spin, Alert, Space, Tooltip, Empty, Badge } from 'antd';
import { MessageOutlined, UserOutlined, FileOutlined, ClockCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext'; // Adjusted path
import axios from 'axios';
import moment from 'moment';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

const MessagesTab = ({ initialMessages, isLoading, loadError, onRefresh }) => {
  const { currentUser, userRole } = useAuth();
  const [messages, setMessages] = useState(initialMessages || []);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [internalError, setInternalError] = useState(loadError);

  // Form instance for Ant Design Form
  const [sendMessageForm] = Form.useForm();

  // Modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Mock data for user selection - TODO: Fetch dynamically
  const [mockUsers, setMockUsers] = useState([
    { id: 'user1', name: '李老师 (mock)', role: 'teacher' },
    { id: 'user2', name: '张小明家长 (mock)', role: 'parent' },
    { id: 'user3', name: '王小红家长 (mock)', role: 'parent' },
    { id: 'currentUserPlaceholder', name: currentUser?.name || '当前用户', role: userRole },
  ]);

  useEffect(() => {
    setMessages(initialMessages || []);
  }, [initialMessages]);

  useEffect(() => {
    setInternalLoading(isLoading);
  }, [isLoading]);

  useEffect(() => {
    setInternalError(loadError);
  }, [loadError]);

  const handleShowSendMessageModal = () => {
    sendMessageForm.resetFields();
    setShowMessageModal(true);
  };

  const handleSendMessage = async (values) => {
    try {
      message.loading({ content: '正在发送...', key: 'sendMessage' });
      // TODO: Replace with actual API call
      console.log('Sending message:', { 
        senderId: currentUser._id, // Assuming currentUser has _id
        receiverId: values.receiver,
        content: values.content,
        // attachments: values.attachments // Handle attachments later
      });
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setShowMessageModal(false);
      sendMessageForm.resetFields();
      message.success({ content: '消息发送成功!', key: 'sendMessage', duration: 2 });
      if (onRefresh) onRefresh(); // Refresh messages list
    } catch (error) {
      console.error('发送消息失败:', error);
      message.error({ content: '发送消息失败，请重试', key: 'sendMessage', duration: 2 });
    }
  };

  const handleViewDetail = (item) => {
    setDetailItem(item);
    setShowDetailModal(true);
  };

  const renderMessagesList = () => {
    if (internalLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin tip="加载消息中..." /></div>;
    if (internalError) return <Alert message="加载消息失败" description={internalError.toString()} type="error" showIcon />;
    if (!messages || messages.length === 0) return <Empty description="暂无消息记录" />;

    // Filter messages where currentUser is either sender or receiver
    const relevantMessages = messages.filter(msg => 
        msg.sender?.id === currentUser?._id || 
        msg.receiver?.id === currentUser?._id ||
        // Fallback for mock data structure if IDs don't match directly with currentUser._id
        // This part needs careful handling based on actual ID structures
        (currentUser?.role === 'teacher' && (msg.receiver?.role === 'parent' || msg.sender?.role === 'parent')) ||
        (currentUser?.role === 'parent' && (msg.receiver?.role === 'teacher' || msg.sender?.role === 'teacher'))
    );

    return (
      <List
        itemLayout="horizontal"
        dataSource={relevantMessages} // Use filtered messages
        renderItem={item => (
          <List.Item
            actions={[
              <Button type="link" onClick={() => handleViewDetail(item)}>查看详情</Button>,
              // TODO: Add reply action if currentUser is receiver
              // item.receiver?.id === currentUser?._id && <Button type="link" onClick={() => { /* reply logic */ }}>回复</Button>
            ]}
          >
            <List.Item.Meta
              avatar={
                <Badge dot={!item.read && item.receiver?.id === currentUser?._id}>
                    <Avatar icon={<UserOutlined />} src={item.sender?.avatar} />
                </Badge>
              }
              title={<Space>
                        <Text strong>{item.sender?.name || '未知发件人'}</Text> 
                        <Text type="secondary">发给</Text> 
                        <Text strong>{item.receiver?.name || '未知收件人'}</Text>
                     </Space>}
              description={<Paragraph ellipsis={{ rows: 2 }}>{item.content}</Paragraph>}
            />
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary">{moment(item.createdAt).format('YYYY-MM-DD HH:mm')}</Text><br/>
              {item.attachments && item.attachments.length > 0 && 
                <Tag icon={<FileOutlined />}>{item.attachments.length}个附件</Tag>}
            </div>
          </List.Item>
        )}
      />
    );
  };

  const renderSendMessageModal = () => (
    <Modal
      title="发送新消息"
      visible={showMessageModal}
      onCancel={() => setShowMessageModal(false)}
      footer={null} // Using Form's button
      destroyOnClose
    >
      <Form form={sendMessageForm} layout="vertical" onFinish={handleSendMessage}>
        <Form.Item 
          name="receiver"
          label="接收人"
          rules={[{ required: true, message: '请选择接收人' }]}
        >
          <Select placeholder="选择接收人">
            {/* TODO: Dynamically populate users, filter out current user */} 
            {mockUsers.filter(u => u.id !== currentUser?._id && u.id !== 'currentUserPlaceholder').map(user => (
              <Option key={user.id} value={user.id}>{user.name} ({user.role})</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item 
          name="content" 
          label="消息内容" 
          rules={[{ required: true, message: '请输入消息内容' }]}
        >
          <TextArea rows={4} placeholder="请输入消息内容..." />
        </Form.Item>
        <Form.Item name="attachments">
          {/* TODO: Implement attachment upload functionality */}
          <Text type="secondary">附件上传功能暂未实现。</Text>
        </Form.Item>
        <Form.Item style={{ textAlign: 'right' }}>
          <Button onClick={() => setShowMessageModal(false)} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" htmlType="submit">发送</Button>
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderDetailModal = () => {
    if (!detailItem) return null;
    return (
      <Modal
        title="消息详情"
        visible={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>关闭</Button>,
          // TODO: Add reply button if applicable
        ]}
      >
        <Title level={5}>发件人: <Text>{detailItem.sender?.name}</Text></Title>
        <Title level={5}>收件人: <Text>{detailItem.receiver?.name}</Text></Title>
        <Paragraph><strong>时间:</strong> {moment(detailItem.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Paragraph>
        <Divider />
        <Paragraph>{detailItem.content}</Paragraph>
        {detailItem.attachments && detailItem.attachments.length > 0 && (
          <>
            <Divider />
            <Paragraph strong>附件:</Paragraph>
            <List
              size="small"
              dataSource={detailItem.attachments}
              renderItem={att => <List.Item><a href={att.url} target="_blank" rel="noopener noreferrer"><FileOutlined /> {att.name}</a></List.Item>}
            />
          </>
        )}
      </Modal>
    );
  };

  return (
    <div>
      {userRole === 'teacher' && (
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleShowSendMessageModal} 
          style={{ marginBottom: 16 }}
        >
          发送新消息
        </Button>
      )}
      {renderMessagesList()}
      {renderSendMessageModal()}
      {renderDetailModal()}
    </div>
  );
};

export default MessagesTab; 