import React from 'react';
import { Row, Col, Card, Statistic, List, Typography, Progress, Divider, Badge, Avatar, Empty } from 'antd';
import { BookOutlined, CheckCircleOutlined, ClockCircleOutlined, RiseOutlined, FallOutlined, BellOutlined, FileTextOutlined, TrophyOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const StudentDashboard = ({ studentData, currentUser }) => {
  if (!studentData) {
    return <Empty description="学生数据加载中或无法获取..." />;
  }

  // 从 studentData 中解构所需数据，并提供默认值
  const {
    recentScores = [],
    homeworkList = [],
    notifications = [],
    progressData = [], // 修正: 此处变量名应与 studentData 中的属性名一致，假设是 progressData
    overallProgress = 0,
    completedHomework = 0,
    totalHomework = 0,
    pendingHomework = 0,
    averageScore = 0
  } = studentData;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <Title level={4}>欢迎回来，{currentUser?.name || '同学'}！</Title>
        <Paragraph>今天是学习的好日子，继续保持努力！</Paragraph>
      </div>
      
      <Divider orientation="left">学习概览</Divider>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card variant="outlined">
            <Statistic 
              title="总体学习进度" 
              value={overallProgress} 
              suffix="%" 
              prefix={<BookOutlined />} 
            />
            <Progress percent={overallProgress} status="active" />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="outlined">
            <Statistic 
              title="已完成作业" 
              value={completedHomework} 
              suffix={`/${totalHomework}`} 
              prefix={<CheckCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="outlined">
            <Statistic 
              title="待完成作业" 
              value={pendingHomework} 
              prefix={<ClockCircleOutlined />} 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="outlined">
            <Statistic 
              title="平均成绩" 
              value={averageScore} 
              precision={1} 
              prefix={<TrophyOutlined />} 
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Divider orientation="left">学习进度</Divider>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="各科学习进度" variant="borderless">
            {progressData.length > 0 ? (
              <List
                dataSource={progressData} // 使用解构后的 progressData
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.subject}
                      description={
                        <Progress 
                          percent={item.progress} 
                          status={item.progress >= 80 ? "success" : "active"} 
                          format={percent => `${percent}%`}
                        />
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无各科学习进度数据" />
            )}
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card title="最近考试成绩" variant="borderless">
            {recentScores.length > 0 ? (
              <List
                dataSource={recentScores} // 使用解构后的 recentScores
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.subject}
                      description={`考试日期: ${item.date || '未知'}`}
                    />
                    <div>
                      {item.score} 分
                      {item.trend === 'up' ? 
                        <RiseOutlined style={{ color: '#3f8600', marginLeft: 8 }} /> :
                      item.trend === 'down' ?
                        <FallOutlined style={{ color: '#cf1322', marginLeft: 8 }} /> : null}
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无最近考试成绩数据" />
            )}
          </Card>
        </Col>
      </Row>
      
      <Divider orientation="left">作业与通知</Divider>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="待完成作业" variant="borderless" extra={<a href="/homework">查看全部</a>}>
            {homeworkList.filter(hw => hw.status === 'pending').length > 0 ? (
              <List
                dataSource={homeworkList.filter(hw => hw.status === 'pending')} // 使用解构后的 homeworkList
                renderItem={item => (
                  <List.Item actions={[
                    <a key="view" href={`/homework/${item.id}`}>查看</a>, 
                    <a key="submit" href={`/homework/${item.id}/submit`}>提交</a>
                  ]}>
                    <List.Item.Meta
                      avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                      title={item.title}
                      description={
                        <>
                          <Text type="secondary">{item.subject}</Text>
                          <br />
                          <Text type="danger">截止日期: {item.deadline ? new Date(item.deadline).toLocaleDateString() : '未设定'}</Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无待完成作业" />
            )}
          </Card>
        </Col>
        
        <Col xs={24} md={12}>
          <Card title="最新通知" variant="borderless" extra={<a href="/notifications">查看全部</a>}>
            {notifications.length > 0 ? (
              <List
                dataSource={notifications.slice(0, 5)} // 使用解构后的 notifications，并只显示前5条
                renderItem={item => (
                  <List.Item actions={[<a key="view" href={`/notifications/${item.id}`}>查看详情</a>]}>
                    <List.Item.Meta
                      avatar={
                        <Badge dot={!item.read}>
                          <Avatar icon={<BellOutlined />} style={{ backgroundColor: item.read ? '#d9d9d9' : '#1890ff' }} />
                        </Badge>
                      }
                      title={<Text strong={!item.read}>{item.title}</Text>}
                      description={
                        <>
                          <Text type="secondary" ellipsis={{ rows: 2 }}>{item.content}</Text>
                          <br />
                          <Text type="secondary">{item.time ? new Date(item.time).toLocaleString() : '未知时间'}</Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无通知" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default StudentDashboard;
