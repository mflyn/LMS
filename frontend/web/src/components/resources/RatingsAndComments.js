import React, { useState } from 'react';
import { Rate, Input, List, Avatar, Typography, Button, Divider, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

// 模拟当前用户，实际应用中应从AuthContext等获取
const MOCK_CURRENT_USER = { id: 999, name: '当前用户', avatar: null };

const RatingsAndComments = ({ resourceId, initialComments = [], onCommentSubmit }) => {
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [comments, setComments] = useState(initialComments);

  const handleSubmitRating = () => {
    if (userRating === 0 && !userComment.trim()) {
      alert('请至少提供评分或评论内容。');
      return;
    }

    const newCommentData = {
      resourceId,
      userId: MOCK_CURRENT_USER.id,
      userName: MOCK_CURRENT_USER.name,
      rating: userRating,
      content: userComment,
      createdAt: new Date().toISOString(), // Use ISO string for consistency
    };

    if (onCommentSubmit) {
      // 如果提供了回调，则由父组件处理提交逻辑（例如API调用）
      onCommentSubmit(newCommentData, (newlySubmittedComment) => {
        // 可选：成功回调后更新本地评论列表
        setComments(prevComments => [newlySubmittedComment, ...prevComments]);
        setUserRating(0); // Reset form
        setUserComment('');
      });
    } else {
      // 否则，模拟本地添加 (之前的行为)
      const displayComment = {
        id: Date.now(), // 本地模拟ID
        user: { id: MOCK_CURRENT_USER.id, name: MOCK_CURRENT_USER.name, avatar: MOCK_CURRENT_USER.avatar },
        content: userComment,
        rating: userRating,
        createdAt: new Date().toLocaleString(),
      };
      setComments(prevComments => [displayComment, ...prevComments]);
      setUserRating(0); // Reset form
      setUserComment('');
      alert('评价已（本地模拟）提交');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>为此资源评分和评论</Title>
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
        {comments.length > 0 ? (
          <List
            itemLayout="horizontal"
            dataSource={comments}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} src={item.user?.avatar} />}
                  title={
                    <Space>
                      <Text strong>{item.user?.name || '匿名用户'}</Text>
                      {item.rating > 0 && <Rate disabled value={item.rating} style={{ fontSize: 14 }} />}
                    </Space>
                  }
                  description={
                    <>
                      <Paragraph style={{ marginBottom: 4 }}>{item.content}</Paragraph>
                      <Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.createdAt).toLocaleString()}</Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Text>暂无评价。</Text>
        )}
      </div>
    </div>
  );
};

export default RatingsAndComments; 