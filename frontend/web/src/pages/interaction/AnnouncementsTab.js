import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Input, Select, Checkbox, Typography, List, Avatar, Tag, message, Spin, Alert, Space, Tooltip, Divider, Empty, Card } from 'antd';
import { NotificationOutlined, PlusOutlined, FileOutlined, TeamOutlined, PushpinOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext'; // Adjusted path
import axios from 'axios';
import moment from 'moment';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

const AnnouncementsTab = ({ initialAnnouncements, isLoading, loadError, onRefresh }) => {
  const { currentUser, userRole } = useAuth();
  const [announcements, setAnnouncements] = useState(initialAnnouncements || []);
  const [internalLoading, setInternalLoading] = useState(isLoading);
  const [internalError, setInternalError] = useState(loadError);

  const [publishAnnouncementForm] = Form.useForm();

  // Modal states
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Mock data for class selection - TODO: Fetch dynamically
  const [mockClasses, setMockClasses] = useState([
    { id: 'class1', name: '三年级一班 (mock)' },
    { id: 'class2', name: '三年级二班 (mock)' },
    { id: 'all', name: '全校通知 (mock)' },
  ]);

  useEffect(() => {
    setAnnouncements(initialAnnouncements || []);
  }, [initialAnnouncements]);

  useEffect(() => {
    setInternalLoading(isLoading);
  }, [isLoading]);

  useEffect(() => {
    setInternalError(loadError);
  }, [loadError]);

  const handleShowPublishModal = () => {
    publishAnnouncementForm.resetFields();
    publishAnnouncementForm.setFieldsValue({ important: false });
    setShowAnnouncementModal(true);
  };

  const handlePublishAnnouncement = async (values) => {
    try {
      message.loading({ content: '正在发布...', key: 'publishAnnouncement' });
      // TODO: Replace with actual API call
      const announcementData = {
        ...values,
        publisherId: currentUser._id, // Assuming teacher/admin publishes
      };
      console.log('Publishing announcement:', announcementData);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setShowAnnouncementModal(false);
      publishAnnouncementForm.resetFields();
      message.success({ content: '公告发布成功!', key: 'publishAnnouncement', duration: 2 });
      if (onRefresh) onRefresh(); // Refresh announcements list
    } catch (error) {
      console.error('发布公告失败:', error);
      message.error({ content: '发布公告失败，请重试', key: 'publishAnnouncement', duration: 2 });
    }
  };

  const handleViewDetail = (item) => {
    setDetailItem(item);
    setShowDetailModal(true);
  };

  const renderAnnouncementsList = () => {
    if (internalLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin tip="加载公告中..." /></div>;
    if (internalError) return <Alert message="加载公告失败" description={internalError.toString()} type="error" showIcon />;
    if (!announcements || announcements.length === 0) return <Empty description="暂无公告信息" />;

    return (
      <List
        itemLayout="vertical"
        dataSource={announcements}
        renderItem={item => (
          <List.Item
            key={item.id}
            actions={[
              <Button type="link" onClick={() => handleViewDetail(item)}>查看详情</Button>,
              // TODO: Add edit/delete for authorized users
            ]}
            extra={item.important && <Tag icon={<PushpinOutlined />} color="volcano">重要</Tag>}
          >
            <List.Item.Meta
              avatar={<Avatar icon={<NotificationOutlined />} style={{ backgroundColor: item.important ? '#faad14' : '#1890ff' }} />}
              title={<Text strong>{item.title}</Text>}
              description={
                <Space size="small">
                  <Text type="secondary">发布人: {item.publisher?.name || '未知'}</Text>
                  <Text type="secondary">|</Text>
                  <Text type="secondary">范围: {item.className || (item.classId === 'all' ? '全校' : '未知班级')}</Text>
                </Space>
              }
            />
            <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '更多' }}>
              {item.content}
            </Paragraph>
            <Space split={<Divider type="vertical" />">
                <Text type="secondary">发布于: {moment(item.publishTime).format('YYYY-MM-DD HH:mm')}</Text>
                {item.attachments && item.attachments.length > 0 && 
                    <Text type="secondary"><FileOutlined /> {item.attachments.length}个附件</Text>}
            </Space>
          </List.Item>
        )}
      />
    );
  };

  const renderPublishAnnouncementModal = () => (
    <Modal
      title="发布新公告"
      visible={showAnnouncementModal}
      onCancel={() => setShowAnnouncementModal(false)}
      footer={null}
      destroyOnClose
      width={700}
    >
      <Form form={publishAnnouncementForm} layout="vertical" onFinish={handlePublishAnnouncement}>
        <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }]}>
          <Input placeholder="例如：关于国庆节放假安排的通知" />
        </Form.Item>
        <Form.Item name="classId" label="发布范围" rules={[{ required: true, message: '请选择发布范围' }]}>
          <Select placeholder="选择班级或全校">
            {/* TODO: Dynamically populate classes */} 
            {mockClasses.map(cls => <Option key={cls.id} value={cls.id}>{cls.name}</Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }]}>
          <TextArea rows={6} placeholder="请输入详细公告内容..." />
        </Form.Item>
        <Form.Item name="attachments">
          {/* TODO: Implement attachment upload functionality */}
          <Text type="secondary">附件上传功能暂未实现。</Text>
        </Form.Item>
        <Form.Item name="important" valuePropName="checked">
          <Checkbox>标记为重要公告</Checkbox>
        </Form.Item>
        <Form.Item style={{ textAlign: 'right' }}>
          <Button onClick={() => setShowAnnouncementModal(false)} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" htmlType="submit">发布公告</Button>
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderDetailModal = () => {
    if (!detailItem) return null;
    return (
      <Modal
        title="公告详情"
        visible={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>关闭</Button>,
        ]}
        width={700}
      >
        <Title level={4}>{detailItem.title} {detailItem.important && <Tag color="volcano">重要</Tag>}</Title>
        <Space split={<Divider type="vertical" />} style={{ marginBottom: 16}}>
            <Text type="secondary">发布人: {detailItem.publisher?.name}</Text>
            <Text type="secondary">范围: {detailItem.className || (detailItem.classId === 'all' ? '全校' : '未知班级')}</Text>
            <Text type="secondary">时间: {moment(detailItem.publishTime).format('YYYY-MM-DD HH:mm')}</Text>
        </Space>
        <Card bordered type="inner">
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{detailItem.content}</Paragraph>
        </Card>
        {detailItem.attachments && detailItem.attachments.length > 0 && (
          <div style={{ marginTop: 16}}>
            <Paragraph strong>附件:</Paragraph>
            <List
              size="small"
              dataSource={detailItem.attachments}
              renderItem={att => <List.Item><a href={att.url} target="_blank" rel="noopener noreferrer"><FileOutlined /> {att.name}</a></List.Item>}
            />
          </div>
        )}
      </Modal>
    );
  };

  return (
    <div>
      {(userRole === 'teacher' || userRole === 'admin') && (
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleShowPublishModal} 
          style={{ marginBottom: 16 }}
        >
          发布新公告
        </Button>
      )}
      {renderAnnouncementsList()}
      {renderPublishAnnouncementModal()}
      {renderDetailModal()}
    </div>
  );
};

export default AnnouncementsTab; 