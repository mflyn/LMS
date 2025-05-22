import React from 'react';
import { List, Button, Avatar, Typography, Tag, Space } from 'antd';
import { FileTextOutlined, VideoCameraOutlined, PictureOutlined, FileOutlined, DownloadOutlined, StarOutlined } from '@ant-design/icons';

const { Text } = Typography; // Only Text might be needed if Title/Paragraph are not used directly here

// 模拟相关资源数据，实际应用中应作为prop传入或通过API获取
const MOCK_RELATED_RESOURCES = [
  { id: 'related101', title: '三年级语文阅读理解专项练习', type: '习题', subject: '语文', grade: '三年级', uploader: { name: '李老师' }, rating: 4.5, downloads: 120, views: 350 },
  { id: 'related102', title: '小学生必背古诗词75首 (带拼音和解析)', type: '文档', subject: '语文', grade: '全年级', uploader: { name: '王老师' }, rating: 5, downloads: 230, views: 500 },
  { id: 'related103', title: '部编版三年级上册语文知识点梳理', type: '文档', subject: '语文', grade: '三年级', uploader: { name: '张老师' }, rating: 4, downloads: 98, views: 210 },
  { id: 'related104', title: '趣味数学启蒙动画系列', type: '视频', subject: '数学', grade: '一、二年级', uploader: { name: '赵老师' }, rating: 4.8, downloads: 150, views: 400 },
];

const ResourceIcon = ({ type }) => {
  let icon;
  switch (type) {
    case '文档': case '教案': case '习题': icon = <FileTextOutlined />;
      break;
    case '视频': icon = <VideoCameraOutlined />;
      break;
    case '图片': icon = <PictureOutlined />;
      break;
    default: icon = <FileOutlined />;
  }
  return <Avatar icon={icon} style={{ backgroundColor: '#1890ff' }} />;
};

const RelatedResources = ({ currentResourceId, relatedData }) => {
  // 如果提供了 relatedData prop，则使用它；否则使用模拟数据
  // 实际应用中，这个数据应该通过API获取，并基于 currentResourceId 进行筛选或推荐
  const resourcesToDisplay = relatedData || MOCK_RELATED_RESOURCES.filter(r => r.id !== currentResourceId).slice(0, 3); // Display up to 3 related items

  if (!resourcesToDisplay || resourcesToDisplay.length === 0) {
    return <Text>暂无相关推荐。</Text>;
  }

  return (
    <List
      itemLayout="horizontal"
      dataSource={resourcesToDisplay}
      renderItem={item => (
        <List.Item
          actions={[
            <Button type="link" key={`view-${item.id}`} onClick={() => console.log('View related:', item.id)}>查看</Button>,
            <Button type="link" key={`download-${item.id}`} icon={<DownloadOutlined />} onClick={() => console.log('Download related:', item.id)}>下载</Button>
          ]}
        >
          <List.Item.Meta
            avatar={<ResourceIcon type={item.type} />}
            title={<a href={`/resources/${item.id}`} target="_blank" rel="noopener noreferrer">{item.title}</a>} // Assuming a route for resource details
            description={
              <Space direction="vertical" size="small">
                <Text type="secondary">上传者: {item.uploader?.name || '匿名'}</Text>
                <Space wrap size="small">
                  {item.subject && <Tag color="blue">{item.subject}</Tag>}
                  {item.grade && <Tag color="green">{item.grade}</Tag>}
                  {item.type && <Tag color="orange">{item.type}</Tag>}
                </Space>
                <Space size="middle">
                  {typeof item.rating === 'number' && <span><StarOutlined /> {item.rating.toFixed(1)}</span>}
                  {typeof item.downloads === 'number' && <span><DownloadOutlined /> {item.downloads}</span>}
                  {typeof item.views === 'number' && <span><UserOutlined /> {item.views}</span>} {/* Assuming views icon */}
                </Space>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  );
};

export default RelatedResources; 