import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, List, Typography, Progress, Divider, Avatar, Tabs, Empty } from 'antd';
import {
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  FallOutlined,
  TrophyOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const ParentDashboard = ({ parentData, currentUser }) => {
  const children = parentData?.children || [];
  const allStudyData = parentData?.studyData || {};
  const [selectedChild, setSelectedChild] = useState(children.length > 0 ? children[0] : null);
  
  const currentChildStudyData = selectedChild ? (allStudyData[selectedChild.id] || allStudyData) : {};

  useEffect(() => {
    if (children.length > 0) {
      const currentSelectedChildExists = children.find(c => c.id === selectedChild?.id);
      if (!selectedChild || !currentSelectedChildExists) {
        setSelectedChild(children[0]);
      }
    } else {
      setSelectedChild(null);
    }
  }, [children, selectedChild]);

  if (!parentData) {
    return <Empty description="家长数据加载中..." />;
  }
  if (children.length === 0) {
    return <Empty description="暂无子女信息。" />;
  }

  const homeworkStatus = currentChildStudyData?.homeworkStatus || { completed: 0, pending: 0, overdue: 0 };
  const attendance = currentChildStudyData?.attendance || { present: 0, absent: 0, late: 0 };
  const recentScores = currentChildStudyData?.recentScores || [];
  const teacherComments = currentChildStudyData?.teacherComments || [];
  const averageScore = currentChildStudyData?.averageScore || 0;

  const totalHomework = homeworkStatus.completed + homeworkStatus.pending + homeworkStatus.overdue;
  const homeworkCompletionPercent = totalHomework > 0 ? Math.round((homeworkStatus.completed / totalHomework) * 100) : 0;

  const totalAttendance = attendance.present + attendance.absent + attendance.late;
  const attendancePercent = totalAttendance > 0 ? Math.round((attendance.present / totalAttendance) * 100) : 0;

  const handleTabChange = (activeKey) => {
    const child = children.find(c => c.id.toString() === activeKey);
    setSelectedChild(child || null);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <Title level={4}>欢迎回来，{currentUser?.name || '家长'}！</Title>
        {children.length > 1 ? (
          <Tabs 
            activeKey={selectedChild ? selectedChild.id.toString() : (children[0]?.id.toString())} 
            onChange={handleTabChange}
          >
            {children.map(child => (
              <TabPane tab={child.name} key={child.id.toString()}>
                {/* 切换 Tab 时，下面的内容会根据 selectedChild 更新 */}
              </TabPane>
            ))}
          </Tabs>
        ) : (
          children.length === 1 && <Paragraph>您正在查看 {children[0].name} ({children[0].grade}{children[0].class}) 的学习情况</Paragraph>
        )}
      </div>
      
      {selectedChild ? (
        <>
          <Paragraph style={{ marginTop: children.length > 1 ? 0 : 16 }}>
            当前查看: <Text strong>{selectedChild.name}</Text> ({selectedChild.grade}{selectedChild.class})
          </Paragraph>
          <Divider orientation="left">{selectedChild.name} 的学习概览</Divider>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
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
            <Col xs={24} sm={8}>
              <Card variant="outlined">
                <Statistic 
                  title="作业完成数" 
                  value={homeworkStatus.completed} 
                  suffix={`/${totalHomework}`} 
                  prefix={<CheckCircleOutlined />} 
                />
                {totalHomework > 0 && <Progress percent={homeworkCompletionPercent} status="active" />}
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card variant="outlined">
                <Statistic 
                  title="出勤率" 
                  value={attendancePercent} 
                  suffix="%" 
                  prefix={<UserOutlined />} 
                />
              </Card>
            </Col>
          </Row>
          
          <Divider orientation="left">学习详情</Divider>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title="最近考试成绩" variant="borderless">
                {recentScores.length > 0 ? (
                  <List
                    dataSource={recentScores}
                    renderItem={item => (
                      <List.Item>
                        <List.Item.Meta
                          title={item.subject}
                          description={`考试日期: ${item.date ? new Date(item.date).toLocaleDateString() : '未知'}`}
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
                ) : <Empty description="暂无最近考试成绩" />}
              </Card>
            </Col>
            
            <Col xs={24} md={12}>
              <Card title="老师评语" variant="borderless">
                {teacherComments.length > 0 ? (
                  <List
                    dataSource={teacherComments}
                    renderItem={item => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar>{item.teacher?.charAt(0) || '师'}</Avatar>}
                          title={`${item.teacher || '老师'}（${item.subject || '科目'}）`}
                          description={
                            <>
                              <Text>{item.content}</Text>
                              <br />
                              <Text type="secondary">{item.date ? new Date(item.date).toLocaleDateString() : '未知日期'}</Text>
                            </>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : <Empty description="暂无老师评语" />}
              </Card>
            </Col>
          </Row>
          
          <Divider orientation="left">作业情况汇总</Divider>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card variant="outlined">
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Card type="inner" title="已完成作业">
                      <Statistic 
                        value={homeworkStatus.completed} 
                        valueStyle={{ color: '#3f8600' }} 
                        prefix={<CheckCircleOutlined />} 
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card type="inner" title="待完成作业">
                      <Statistic 
                        value={homeworkStatus.pending} 
                        valueStyle={{ color: '#faad14' }} 
                        prefix={<ClockCircleOutlined />} 
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card type="inner" title="逾期作业">
                      <Statistic 
                        value={homeworkStatus.overdue} 
                        valueStyle={{ color: '#cf1322' }} 
                        prefix={<WarningOutlined />} 
                      />
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <Paragraph style={{ marginTop: 16 }}>请在上方选择一个孩子以查看其学习情况。</Paragraph>
      )}
    </div>
  );
};
export default ParentDashboard; 