import React, { useState } from 'react';
import { Card, Table, Typography, Row, Col, Select, Button, Statistic, Badge, Avatar, Tabs, List, Tag, Tooltip, Progress } from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  BookOutlined, 
  RiseOutlined,
  FallOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

// 学生状态配置
const STUDENT_STATUS_CONFIG = [
  { value: 'excellent', text: '优秀', color: '#52c41a', icon: <CheckCircleOutlined /> },
  { value: 'good', text: '良好', color: '#1890ff', icon: <CheckCircleOutlined /> },
  { value: 'attention', text: '需要关注', color: '#faad14', icon: <ExclamationCircleOutlined /> },
  { value: 'help', text: '需要帮助', color: '#f5222d', icon: <ExclamationCircleOutlined /> },
  { value: 'unknown', text: '未知', color: '#d9d9d9', icon: null } // 默认或未知状态
];

// 分数颜色辅助函数
const getScoreColor = (score) => {
  if (score === null || score === undefined) return '#8c8c8c'; // 未知或无分数
  if (score >= 90) return '#52c41a'; // 优秀 - 绿色
  if (score >= 80) return '#1890ff'; // 良好 - 蓝色
  if (score >= 70) return '#faad14'; // 中等 - 黄色
  if (score >= 60) return '#fa8c16'; // 及格 - 橙色
  return '#f5222d'; // 不及格 - 红色
};

// 可用科目列表
const AVAILABLE_SUBJECTS = [
  { key: '语文', label: '语文' },
  { key: '数学', label: '数学' },
  { key: '英语', label: '英语' },
  // { key: '科学', label: '科学' }, // 示例：可以轻松添加更多科目
];

/**
 * 教师仪表盘组件
 * 用于在Dashboard中展示班级整体情况和学生表现
 * 
 * @param {Object} props
 * @param {Array} props.classes - 教师负责的班级列表
 * @param {Object} props.selectedClass - 当前选中的班级
 * @param {Object} props.classData - 班级详细数据
 * @param {Function} props.onClassChange - 班级切换回调
 * @param {Function} props.onRefresh - 刷新数据回调
 */
const TeacherDashboard = ({ 
  classes = [], 
  selectedClass = null, 
  classData = {}, 
  onClassChange,
  onRefresh
}) => {
  // 当前选中的科目
  const [selectedSubject, setSelectedSubject] = useState(AVAILABLE_SUBJECTS[0]?.key || '语文');
  
  // 班级趋势数据
  const trends = classData.trends || {};
  
  // 学生列表
  const students = classData.students || [];
  
  // 作业列表
  const homeworks = classData.homework || [];
  
  // 班级选择处理
  const handleClassChange = (classId) => {
    const newSelectedClass = classes.find(c => c.id === classId);
    if (onClassChange) {
      onClassChange(newSelectedClass);
    }
  };
  
  // 科目选择处理
  const handleSubjectChange = (subject) => {
    setSelectedSubject(subject);
  };
  
  // 刷新数据
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };
  
  // 计算班级统计数据
  const classStats = {
    studentCount: students.length,
    homeworkCount: homeworks.length,
    completionRate: homeworks.length > 0 ? 
      Math.round((homeworks.filter(hw => hw.submittedCount / hw.totalStudents >= 0.9).length / homeworks.length) * 100) : 0,
    averageScore: trends.averageScores ? 
      trends.averageScores[trends.averageScores.length - 1]?.score || 0 : 0,
    trend: trends.trend || 'stable'
  };
  
  // 学生表格列定义
  const studentColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
          <Text>{text}</Text>
        </div>
      )
    },
    {
      title: '最近成绩',
      dataIndex: 'recentScore',
      key: 'recentScore',
      sorter: (a, b) => a.recentScore - b.recentScore,
      render: (score) => (
        <Text strong style={{ color: getScoreColor(score) }}>
          {score === null || score === undefined ? '-' : score}
        </Text>
      )
    },
    {
      title: '趋势',
      dataIndex: 'trend',
      key: 'trend',
      render: (trend) => {
        if (trend === 'up') {
          return <RiseOutlined style={{ color: '#52c41a' }} />;
        } else if (trend === 'down') {
          return <FallOutlined style={{ color: '#f5222d' }} />;
        } else {
          return <span>-</span>;
        }
      }
    },
    {
      title: '作业完成率',
      dataIndex: 'homeworkCompletion',
      key: 'homeworkCompletion',
      sorter: (a, b) => a.homeworkCompletion - b.homeworkCompletion,
      render: (rate) => (
        <Progress percent={rate} size="small" status={rate < 60 ? 'exception' : 'normal'} />
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: STUDENT_STATUS_CONFIG.filter(s => s.value !== 'unknown').map(s => ({ text: s.text, value: s.value })),
      onFilter: (value, record) => record.status === value,
      render: (statusValue) => {
        const config = STUDENT_STATUS_CONFIG.find(s => s.value === statusValue) || STUDENT_STATUS_CONFIG.find(s => s.value === 'unknown');
        return <Tag icon={config.icon} color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" size="small">查看详情</Button>
      )
    }
  ];
  
  // 作业列表列定义
  const homeworkColumns = [
    {
      title: '作业名称',
      dataIndex: 'title',
      key: 'title',
      render: (text) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          <Text>{text}</Text>
        </div>
      )
    },
    {
      title: '科目',
      dataIndex: 'subject',
      key: 'subject',
      filters: AVAILABLE_SUBJECTS.map(s => ({ text: s.label, value: s.key })),
      onFilter: (value, record) => record.subject === value,
      render: (subject) => <Tag>{subject}</Tag>
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      sorter: (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
      render: (date) => {
        const dueDate = new Date(date);
        const now = new Date();
        const isOverdue = dueDate < now;
        
        return (
          <Tooltip title={isOverdue ? '已逾期' : ''}>
            <Text type={isOverdue ? 'danger' : ''}>{date}</Text>
            {isOverdue && <ClockCircleOutlined style={{ marginLeft: 8, color: '#f5222d' }} />}
          </Tooltip>
        );
      }
    },
    {
      title: '提交率',
      dataIndex: 'submittedCount',
      key: 'submittedCount',
      sorter: (a, b) => (a.submittedCount / a.totalStudents) - (b.submittedCount / b.totalStudents),
      render: (count, record) => {
        const rate = Math.round((count / record.totalStudents) * 100);
        return <Progress percent={rate} size="small" status={rate < 60 ? 'exception' : 'normal'} />;
      }
    },
    {
      title: '平均分',
      dataIndex: 'averageScore',
      key: 'averageScore',
      sorter: (a, b) => a.averageScore - b.averageScore,
      render: (score) => (
        <Text strong style={{ color: getScoreColor(score) }}>
          {score === null || score === undefined ? '-' : score}
        </Text>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" size="small">查看详情</Button>
      )
    }
  ];

  return (
    <div className="teacher-dashboard">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <Title level={4} style={{ marginBottom: 0 }}>班级概览</Title>
                <Text type="secondary">{selectedClass ? selectedClass.name : '请选择班级'}</Text>
              </div>
              <div>
                <Select 
                  value={selectedClass ? selectedClass.id : undefined} 
                  style={{ width: 150, marginRight: 16 }} 
                  placeholder="选择班级"
                  onChange={handleClassChange}
                >
                  {classes.map(cls => (
                    <Option key={cls.id} value={cls.id}>{cls.name}</Option>
                  ))}
                </Select>
                <Select 
                  value={selectedSubject} 
                  style={{ width: 100, marginRight: 16 }} 
                  onChange={handleSubjectChange}
                >
                  {AVAILABLE_SUBJECTS.map(subject => (
                    <Option key={subject.key} value={subject.key}>{subject.label}</Option>
                  ))}
                </Select>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={handleRefresh}
                >
                  刷新
                </Button>
              </div>
            </div>
            
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic 
                    title="学生人数" 
                    value={classStats.studentCount} 
                    prefix={<TeamOutlined />} 
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic 
                    title="作业数量" 
                    value={classStats.homeworkCount} 
                    prefix={<BookOutlined />} 
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic 
                    title="作业完成率" 
                    value={classStats.completionRate} 
                    suffix="%" 
                    precision={0}
                    valueStyle={{ color: classStats.completionRate >= 80 ? '#3f8600' : '#cf1322' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic 
                    title="平均成绩" 
                    value={classStats.averageScore} 
                    precision={1}
                    valueStyle={{ 
                      color: classStats.trend === 'up' ? '#3f8600' : 
                             classStats.trend === 'down' ? '#cf1322' : '#1890ff' 
                    }}
                    prefix={classStats.trend === 'up' ? <RiseOutlined /> : 
                           classStats.trend === 'down' ? <FallOutlined /> : null}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
        
        <Col span={8}>
          <Card title="需要关注的学生" style={{ height: '100%' }}>
            <List
              dataSource={students.filter(s => s.status === 'attention' || s.status === 'help').slice(0, 5)}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={item.name}
                    description={
                      <Tag 
                        icon={item.status === 'help' ? <ExclamationCircleOutlined /> : null}
                        color={item.status === 'help' ? '#f5222d' : '#faad14'}
                      >
                        {item.status === 'help' ? '需要帮助' : '需要关注'}
                      </Tag>
                    }
                  />
                  <div>
                    <Text type="secondary">最近成绩: </Text>
                    <Text 
                      strong 
                      style={{ 
                        color: item.recentScore >= 60 ? '#52c41a' : '#f5222d' 
                      }}
                    >
                      {item.recentScore}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Tabs defaultActiveKey="students">
              <TabPane tab="学生列表" key="students">
                <Table 
                  dataSource={students} 
                  columns={studentColumns} 
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </TabPane>
              <TabPane tab="作业列表" key="homework">
                <Table 
                  dataSource={homeworks} 
                  columns={homeworkColumns} 
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TeacherDashboard;