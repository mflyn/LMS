import React, { useState } from 'react';
import { Card, Tabs, Empty, Spin, Alert, Button, Rate, Input, List, Avatar, Typography, Tag, Space } from 'antd';
import { FileTextOutlined, VideoCameraOutlined, PictureOutlined, FileOutlined, DownloadOutlined, StarOutlined, LikeOutlined, MessageOutlined, UserOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

// 资源预览组件
const ResourcePreview = ({ resource, onClose }) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  
  // 模拟评论数据
  const [comments, setComments] = useState([
    {
      id: 1,
      user: { id: 101, name: '李老师', avatar: null },
      content: '这是一个非常好的学习资源，内容丰富，适合三年级学生使用。',
      rating: 5,
      createdAt: '2023-10-15 14:30'
    },
    {
      id: 2,
      user: { id: 102, name: '王老师', avatar: null },
      content: '资料质量很高，但是有些内容可能对低年级学生来说有点难度。',
      rating: 4,
      createdAt: '2023-10-14 09:45'
    }
  ]);
  
  // 提交评分和评论
  const handleSubmitRating = () => {
    if (userRating === 0) {
      alert('请先进行评分');
      return;
    }
    
    // 在实际项目中，这里应该调用API提交评分和评论
    // 模拟添加新评论
    const newComment = {
      id: Date.now(),
      user: { id: 999, name: '当前用户', avatar: null },
      content: userComment,
      rating: userRating,
      createdAt: new Date().toLocaleString()
    };
    
    setComments([newComment, ...comments]);
    setUserComment('');
    alert('评分和评论已提交');
  };
  
  // 渲染文档预览
  const renderDocumentPreview = () => {
    // 在实际项目中，这里应该使用PDF预览组件，如react-pdf
    return (
      <div style={{ height: 500, background: '#f5f5f5', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', border: '1px dashed #d9d9d9', borderRadius: 4 }}>
        <FileTextOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <div>文档预览区域</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          (此处将显示PDF预览，需要安装react-pdf)
        </div>
        <Button type="primary" icon={<DownloadOutlined />} style={{ marginTop: 16 }}>
          下载文档
        </Button>
      </div>
    );
  };
  
  // 渲染视频预览
  const renderVideoPreview = () => {
    return (
      <div style={{ height: 500, background: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', borderRadius: 4 }}>
        <VideoCameraOutlined style={{ fontSize: 48, color: '#fff', marginBottom: 16 }} />
        <div style={{ color: '#fff' }}>视频预览区域</div>
        <div style={{ color: '#aaa', fontSize: 12, marginTop: 8 }}>
          (此处将显示视频播放器)
        </div>
      </div>
    );
  };
  
  // 渲染图片预览
  const renderImagePreview = () => {
    return (
      <div style={{ height: 500, background: '#f5f5f5', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', border: '1px dashed #d9d9d9', borderRadius: 4 }}>
        <PictureOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <div>图片预览区域</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          (此处将显示图片预览)
        </div>
      </div>
    );
  };
  
  // 根据资源类型渲染不同的预览
  const renderPreviewByType = () => {
    if (!resource) return <Empty description="无可预览内容" />;
    
    switch (resource.type) {
      case '文档':
      case '教案':
      case '习题':
        return renderDocumentPreview();
      case '视频':
        return renderVideoPreview();
      case '图片':
        return renderImagePreview();
      default:
        return (
          <div style={{ height: 500, background: '#f5f5f5', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', border: '1px dashed #d9d9d9', borderRadius: 4 }}>
            <FileOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
            <div>暂不支持此类型资源的预览</div>
            <Button type="primary" icon={<DownloadOutlined />} style={{ marginTop: 16 }}>
              下载资源
            </Button>
          </div>
        );
    }
  };
  
  // 渲染评分和评论
  const renderRatingsAndComments = () => {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>为此资源评分</Title>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <Rate allowHalf value={userRating} onChange={setUserRating} />
            <span style={{ marginLeft: 8 }}>{userRating ? `${userRating} 分` : ''}</span>
          </div>
          <TextArea 
            rows={4} 
            placeholder="分享您对此资源的看法..."
            value={userComment}
            onChange={e => setUserComment(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" onClick={handleSubmitRating}>提交评价</Button>
        </div>
        
        <Divider />
        
        <div>
          <Title level={5}>用户评价 ({comments.length})</Title>
          <List
            itemLayout="horizontal"
            dataSource={comments}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={
                    <Space>
                      <Text strong>{item.user.name}</Text>
                      <Rate disabled defaultValue={item.rating} style={{ fontSize: 12 }} />
                    </Space>
                  }
                  description={
                    <>
                      <Paragraph>{item.content}</Paragraph>
                      <Text type="secondary">{item.createdAt}</Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </div>
    );
  };
  
  // 渲染相关推荐
  const renderRelatedResources = () => {
    // 模拟相关资源数据
    const relatedResources = [
      { id: 101, title: '三年级语文阅读理解练习', type: '习题', subject: '语文', grade: '三年级', uploader: { name: '李老师' }, rating: 4.5, downloads: 120 },
      { id: 102, title: '小学生必背古诗词', type: '文档', subject: '语文', grade: '全年级', uploader: { name: '王老师' }, rating: 5, downloads: 230 },
      { id: 103, title: '语文知识点总结', type: '文档', subject: '语文', grade: '三年级', uploader: { name: '张老师' }, rating: 4, downloads: 98 },
    ];
    
    return (
      <List
        itemLayout="horizontal"
        dataSource={relatedResources}
        renderItem={item => (
          <List.Item
            actions={[
              <Button type="link" key="view">查看</Button>,
              <Button type="link" key="download">下载</Button>
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar 
                  icon={
                    item.type === '文档' ? <FileTextOutlined /> :
                    item.type === '视频' ? <VideoCameraOutlined /> :
                    item.type === '图片' ? <PictureOutlined /> :
                    <FileOutlined />
                  } 
                  style={{ backgroundColor: '#1890ff' }}
                />
              }
              title={item.title}
              description={
                <Space>
                  <Tag color="blue">{item.subject}</Tag>
                  <Tag color="green">{item.grade}</Tag>
                  <Tag color="orange">{item.type}</Tag>
                  <span><StarOutlined /> {item.rating}</span>
                  <span><DownloadOutlined /> {item.downloads}</span>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    );
  };
  
  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{resource?.title || '资源预览'}</span>
          {onClose && <Button type="text" onClick={onClose}>关闭</Button>}
        </div>
      }
      style={{ width: '100%' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert message="加载失败" description={error} type="error" />
      ) : (
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="预览" key="preview">
            {renderPreviewByType()}
          </TabPane>
          <TabPane tab="评价" key="ratings">
            {renderRatingsAndComments()}
          </TabPane>
          <TabPane tab="相关推荐" key="related">
            {renderRelatedResources()}
          </TabPane>
        </Tabs>
      )}
    </Card>
  );
};

export default ResourcePreview;