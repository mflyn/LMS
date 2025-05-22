import React, { useState, useEffect } from 'react';
import { Card, Tabs, Empty, Spin, Alert, Button, Typography, Tag, Space, message } from 'antd';
import { FileTextOutlined, VideoCameraOutlined, PictureOutlined, FileOutlined, DownloadOutlined } from '@ant-design/icons';
import RatingsAndComments from './RatingsAndComments';
import RelatedResources from './RelatedResources';

const { TabPane } = Tabs;
const { Text, Title, Paragraph } = Typography;

// 模拟的初始评论数据，实际应用中应从API获取或作为prop传入
const MOCK_INITIAL_COMMENTS = [
  {
    id: 'comment1',
    resourceId: 'mockResource1', // Ensure this matches the resource being previewed if needed by RatingsAndComments
    user: { id: 'user101', name: '李老师', avatar: null },
    content: '这是一个非常好的学习资源，内容丰富，适合三年级学生使用。',
    rating: 5,
    createdAt: '2023-10-15T14:30:00Z'
  },
  {
    id: 'comment2',
    resourceId: 'mockResource1',
    user: { id: 'user102', name: '王老师', avatar: null },
    content: '资料质量很高，但是有些内容可能对低年级学生来说有点难度。',
    rating: 4,
    createdAt: '2023-10-14T09:45:00Z'
  }
];

// 资源预览组件
const ResourcePreview = ({ resource, onClose }) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 评论提交处理函数 (将来对接API)
  const handleCommentSubmission = (commentData, successCallback) => {
    console.log('Submitting comment:', commentData);
    setLoading(true); // Simulate API call loading
    setTimeout(() => {
      // 模拟API成功响应
      const newlySubmittedComment = {
        ...commentData,
        id: `comment-${Date.now()}`, // Simulate a new ID from backend
        user: { id: commentData.userId, name: commentData.userName, avatar: null }, // Reconstruct user object
        createdAt: new Date().toISOString(), // Simulate backend timestamp
      };
      message.success('评论已提交成功！');
      if (successCallback) {
        successCallback(newlySubmittedComment);
      }
      setLoading(false);
    }, 1000);
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
  
  // 渲染评分和评论 - 现在使用新组件
  const renderRatingsAndCommentsTab = () => {
    if (!resource) return <Empty description="资源信息不完整，无法加载评价区。" />;
    return (
      <RatingsAndComments 
        resourceId={resource.id} 
        initialComments={MOCK_INITIAL_COMMENTS.filter(c => c.resourceId === resource.id)} // Pass filtered comments or fetch them
        onCommentSubmit={handleCommentSubmission} 
      />
    );
  };
  
  // 渲染相关推荐 - 现在使用新组件
  const renderRelatedResourcesTab = () => {
    if (!resource) return <Empty description="资源信息不完整，无法加载相关推荐。" />;
    // 实际应用中，relatedData 应该通过API获取，或者基于当前 resource.id 和其他逻辑推荐
    // 此处我们仅传递 currentResourceId，RelatedResources 组件内部会使用模拟数据
    return <RelatedResources currentResourceId={resource.id} />;
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
            {renderRatingsAndCommentsTab()}
          </TabPane>
          <TabPane tab="相关推荐" key="related">
            {renderRelatedResourcesTab()}
          </TabPane>
        </Tabs>
      )}
    </Card>
  );
};

export default ResourcePreview;