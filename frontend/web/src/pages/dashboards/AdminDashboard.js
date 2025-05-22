import React from 'react';
import { Typography, Row, Col, Card, Statistic, Divider, Table, Progress, List, Badge } from 'antd';
import { UserOutlined, BookOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const AdminDashboard = ({ adminData, currentUser }) => {
  if (!adminData) {
    return <Title level={4}>管理员数据加载中...</Title>;
  }

  const { 
    schoolStats = { studentCount: 0, teacherCount: 0, classCount: 0, avgAttendance: 0 }, 
    gradePerformance = [], 
    systemAlerts = [] 
  } = adminData;

  return (
    <div className="dashboard-container">
        <div className="dashboard-header">
          <Title level={4}>欢迎回来，{currentUser?.name || '管理员'}！</Title>
          <Paragraph>学校系统运行正常，有 {systemAlerts.filter(a => a.severity !== 'info').length} 个需要关注的警报。</Paragraph>
        </div>
        
        <Divider orientation="left">学校概览</Divider>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="学生总数" 
                value={schoolStats.studentCount} 
                prefix={<UserOutlined />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="教师总数" 
                value={schoolStats.teacherCount} 
                prefix={<UserOutlined />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="班级总数" 
                value={schoolStats.classCount} 
                prefix={<BookOutlined />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="平均出勤率" 
                value={schoolStats.avgAttendance} 
                suffix="%" 
                precision={1}
                prefix={<CheckCircleOutlined />} 
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>
        
        <Divider orientation="left">年级表现</Divider>
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card bordered={false}>
              <Table 
                dataSource={gradePerformance} 
                rowKey="grade"
                pagination={false}
                columns={[
                  { title: '年级', dataIndex: 'grade', key: 'grade' },
                  { 
                    title: '平均成绩', 
                    dataIndex: 'avgScore', 
                    key: 'avgScore',
                    render: (score) => <span>{score} 分</span>
                  },
                  { 
                    title: '及格率', 
                    dataIndex: 'passRate', 
                    key: 'passRate',
                    render: (rate) => <span>{rate}%</span>
                  },
                  {
                    title: '成绩分布',
                    key: 'distribution',
                    render: (_, record) => (
                      <Progress 
                        percent={record.passRate} 
                        success={{ percent: record.avgScore }}
                        size="small"
                        format={() => `${record.avgScore}分/${record.passRate}%`}
                      />
                    )
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
        
        <Divider orientation="left">系统状态</Divider>
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <List
              dataSource={systemAlerts}
              renderItem={item => (
                <List.Item
                  actions={[<a key="view">查看详情</a>, <a key="resolve">标记为已解决</a>]}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge 
                        status={
                          item.severity === 'error' ? 'error' : 
                          item.severity === 'warning' ? 'warning' : 'default'
                        } 
                      />
                    }
                    title={item.message}
                    description={
                      <>
                        <Text type="secondary">{item.type}</Text>
                        <br />
                        <Text type="secondary">{item.time}</Text>
                      </>
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

export default AdminDashboard; 