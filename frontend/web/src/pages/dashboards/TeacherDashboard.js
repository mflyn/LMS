import React from 'react';
import { Typography, Row, Col, Card, Statistic, Divider, Table, Progress, List, Alert } from 'antd';
import { UserOutlined, TrophyOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const TeacherDashboard = ({ teacherData, currentUser }) => {
  if (!teacherData) {
    return <Title level={4}>教师数据加载中...</Title>;
  }

  const { 
    classStats = [], 
    recentHomework = [], 
    studentAlerts = [] 
  } = teacherData;

  return (
    <div className="dashboard-container">
        <div className="dashboard-header">
          <Title level={4}>欢迎回来，{currentUser?.name || '老师'}！</Title>
          <Paragraph>您有 {studentAlerts.length} 个学生需要关注，{recentHomework.length} 个作业需要批改。</Paragraph>
        </div>
        
        <Divider orientation="left">班级概览</Divider>
        
        <Row gutter={[16, 16]}>
          {classStats.map((cls, index) => (
            <Col xs={24} sm={12} key={index}>
              <Card title={cls.class} bordered={false}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic 
                      title="学生人数" 
                      value={cls.studentCount} 
                      prefix={<UserOutlined />} 
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic 
                      title="平均成绩" 
                      value={cls.avgScore} 
                      precision={1} 
                      prefix={<TrophyOutlined />} 
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic 
                      title="作业完成率" 
                      value={cls.homeworkCompletionRate} 
                      suffix="%" 
                      prefix={<CheckCircleOutlined />} 
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
        
        <Divider orientation="left">作业管理</Divider>
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="最近布置的作业" bordered={false} extra={<a href="#">布置新作业</a>}>
              <Table 
                dataSource={recentHomework} 
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '作业标题', dataIndex: 'title', key: 'title' },
                  { title: '班级', dataIndex: 'class', key: 'class' },
                  { title: '布置日期', dataIndex: 'assignDate', key: 'assignDate' },
                  { title: '截止日期', dataIndex: 'dueDate', key: 'dueDate' },
                  { 
                    title: '提交情况', 
                    key: 'submission', 
                    render: (_, record) => (
                      <>
                        <Progress 
                          percent={Math.round((record.submittedCount / record.totalCount) * 100)} 
                          size="small" 
                        />
                        <Text type="secondary">{record.submittedCount}/{record.totalCount}</Text>
                      </>
                    ) 
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: () => (
                      <span>
                        <a style={{ marginRight: 8 }}>查看详情</a>
                        <a>批改</a>
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
        
        <Divider orientation="left">学生预警</Divider>
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <List
              grid={{ gutter: 16, column: 1 }}
              dataSource={studentAlerts}
              renderItem={item => (
                <List.Item>
                  <Alert
                    message={`${item.name}（${item.class}）`}
                    description={item.issue}
                    type={item.severity === 'high' ? 'error' : item.severity === 'medium' ? 'warning' : 'info'}
                    action={
                      <a>联系家长</a>
                    }
                  />
                </List.Item>
              )}
            />
          </Col>
        </Row>
      </div>
  );
};

export default TeacherDashboard; 