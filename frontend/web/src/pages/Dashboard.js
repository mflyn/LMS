import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, List, Typography, Progress, Divider, Badge, Avatar, Tabs, Alert, Empty, Spin, Button } from 'antd';
import { 
  UserOutlined, 
  BookOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  RiseOutlined,
  FallOutlined,
  BellOutlined,
  MessageOutlined,
  FileTextOutlined,
  CalendarOutlined,
  TrophyOutlined,
  WarningOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const Dashboard = () => {
  const { userRole, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 仪表盘数据状态
  const [dashboardData, setDashboardData] = useState({
    student: null,
    parent: null,
    teacher: null,
    admin: null
  });
  
  // 在组件加载时获取仪表盘数据
  useEffect(() => {
    if (userRole) {
      fetchDashboardData();
    }
  }, [userRole]);
  
  // 使用WebSocket接收实时数据更新
  useEffect(() => {
    if (!userRole) return;
    
    // 导入WebSocket上下文
    const { subscribe } = require('../contexts/WebSocketContext').useWebSocket();
    
    // 根据用户角色订阅相应的事件
    let unsubscribe;
    switch (userRole) {
      case 'student':
        unsubscribe = subscribe('student-trends-update', (data) => {
          if (data.studentId === currentUser?._id) {
            setDashboardData(prev => ({
              ...prev,
              student: {
                ...prev.student,
                recentScores: data.trendsData ? Object.entries(data.trendsData).map(([subject, data]) => ({
                  subject,
                  score: data.scores ? data.scores[data.scores.length - 1]?.score : 0,
                  date: data.scores ? data.scores[data.scores.length - 1]?.date : '',
                  trend: data.trend === '上升' ? 'up' : data.trend === '下降' ? 'down' : 'stable'
                })).slice(0, 4) : prev.student.recentScores
              }
            }));
          }
        });
        break;
      case 'teacher':
        unsubscribe = subscribe('class-trends-update', (data) => {
          if (data.classId === currentUser?.classId) {
            setDashboardData(prev => ({
              ...prev,
              teacher: {
                ...prev.teacher,
                // 更新相关数据
              }
            }));
          }
        });
        break;
      default:
        break;
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userRole, currentUser]);
  
  // 获取仪表盘数据
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 根据用户角色获取相应的仪表盘数据
      switch (userRole) {
        case 'student':
          try {
            // 调用API获取学生仪表盘数据
            const trendsResponse = await axios.get(`/api/analytics/trends/student/${currentUser._id}`);
            const progressResponse = await axios.get(`/api/analytics/progress/student/${currentUser._id}`);
            const homeworkResponse = await axios.get(`/api/homework/student/${currentUser._id}`);
            const notificationsResponse = await axios.get(`/api/notifications/user/${currentUser._id}`);
            
            // 处理API响应数据
            const recentScores = trendsResponse.data.trendsData ? 
              Object.entries(trendsResponse.data.trendsData).map(([subject, data]) => ({
                subject,
                score: data.scores ? data.scores[data.scores.length - 1]?.score : 0,
                date: data.scores ? data.scores[data.scores.length - 1]?.date : '',
                trend: data.trend === '上升' ? 'up' : data.trend === '下降' ? 'down' : 'stable'
              })).slice(0, 4) : [];
            
            const progressData = progressResponse.data.progressData ? 
              Object.entries(progressResponse.data.progressData).map(([subject, data]) => ({
                subject,
                progress: data.completionRate || 0
              })) : [];
            
            const homeworkList = homeworkResponse.data.homeworks || [];
            const notifications = notificationsResponse.data.notifications || [];
            
            // 计算总体进度和作业统计
            const overallProgress = progressData.length > 0 ? 
              progressData.reduce((sum, item) => sum + item.progress, 0) / progressData.length : 0;
            
            const completedHomework = homeworkList.filter(hw => hw.status === 'completed').length;
            const totalHomework = homeworkList.length;
            const pendingHomework = totalHomework - completedHomework;
            
            const averageScore = recentScores.length > 0 ? 
              recentScores.reduce((sum, item) => sum + item.score, 0) / recentScores.length : 0;
            
            // 更新仪表盘数据
            setDashboardData(prev => ({ 
              ...prev, 
              student: {
                recentScores,
                homeworkList,
                notifications,
                progressData,
                overallProgress,
                completedHomework,
                totalHomework,
                pendingHomework,
                averageScore
              } 
            }));
          } catch (error) {
            console.error('获取学生仪表盘数据失败:', error);
            // 如果API调用失败，使用模拟数据作为备份
            setDashboardData(prev => ({ ...prev, student: getStudentMockData() }));
          }
          setLoading(false);
          break;
          
        case 'parent':
          try {
            // 调用API获取家长仪表盘数据
            const childrenResponse = await axios.get(`/api/users/parent/${currentUser._id}/children`);
            const children = childrenResponse.data.children || [];
            
            // 如果有子女，获取第一个子女的详细信息
            let childData = {};
            if (children.length > 0) {
              const childId = children[0].id;
              const childTrendsResponse = await axios.get(`/api/analytics/trends/student/${childId}`);
              const childProgressResponse = await axios.get(`/api/analytics/progress/student/${childId}`);
              const childHomeworkResponse = await axios.get(`/api/homework/student/${childId}`);
              
              childData = {
                trends: childTrendsResponse.data,
                progress: childProgressResponse.data,
                homework: childHomeworkResponse.data
              };
            }
            
            // 更新仪表盘数据
            setDashboardData(prev => ({ 
              ...prev, 
              parent: {
                children,
                selectedChild: children.length > 0 ? children[0] : null,
                childData,
                // 其他数据
              } 
            }));
          } catch (error) {
            console.error('获取家长仪表盘数据失败:', error);
            // 如果API调用失败，使用模拟数据作为备份
            setDashboardData(prev => ({ ...prev, parent: getParentMockData() }));
          }
          setLoading(false);
          break;
          
        case 'teacher':
          try {
            // 调用API获取教师仪表盘数据
            const classResponse = await axios.get(`/api/users/teacher/${currentUser._id}/classes`);
            const classes = classResponse.data.classes || [];
            
            // 如果有班级，获取第一个班级的详细信息
            let classData = {};
            if (classes.length > 0) {
              const classId = classes[0].id;
              const classTrendsResponse = await axios.get(`/api/analytics/trends/class/${classId}?subject=语文`);
              const classStudentsResponse = await axios.get(`/api/users/class/${classId}/students`);
              const classHomeworkResponse = await axios.get(`/api/homework/class/${classId}`);
              
              classData = {
                trends: classTrendsResponse.data,
                students: classStudentsResponse.data.students || [],
                homework: classHomeworkResponse.data.homeworks || []
              };
            }
            
            // 更新仪表盘数据
            setDashboardData(prev => ({ 
              ...prev, 
              teacher: {
                classes,
                selectedClass: classes.length > 0 ? classes[0] : null,
                classData,
                // 其他数据
              } 
            }));
          } catch (error) {
            console.error('获取教师仪表盘数据失败:', error);
            // 如果API调用失败，使用模拟数据作为备份
            setDashboardData(prev => ({ ...prev, teacher: getTeacherMockData() }));
          }
          setLoading(false);
          break;
          
        case 'admin':
          try {
            // 调用API获取管理员仪表盘数据
            const statsResponse = await axios.get('/api/analytics/admin/stats');
            const usersResponse = await axios.get('/api/users/stats');
            const resourcesResponse = await axios.get('/api/resources/stats');
            
            // 更新仪表盘数据
            setDashboardData(prev => ({ 
              ...prev, 
              admin: {
                stats: statsResponse.data,
                users: usersResponse.data,
                resources: resourcesResponse.data,
                // 其他数据
              } 
            }));
          } catch (error) {
            console.error('获取管理员仪表盘数据失败:', error);
            // 如果API调用失败，使用模拟数据作为备份
            setDashboardData(prev => ({ ...prev, admin: getAdminMockData() }));
          }
          setLoading(false);
          break;
          
        default:
          setLoading(false);
          break;
      }
    } catch (err) {
      console.error('获取仪表盘数据失败:', err);
      setError('获取仪表盘数据失败，请稍后重试');
      setLoading(false);
    }
  };
  
  // 模拟数据生成函数
  const getStudentMockData = () => {
    return {
      recentScores: [
        { subject: '语文', score: 92, date: '2023-10-15', trend: 'up' },
        { subject: '数学', score: 88, date: '2023-10-12', trend: 'down' },
        { subject: '英语', score: 95, date: '2023-10-10', trend: 'up' },
        { subject: '科学', score: 90, date: '2023-10-08', trend: 'up' },
      ],
      homeworkList: [
        { id: 1, title: '语文作文', subject: '语文', deadline: '2023-10-20', status: 'pending' },
        { id: 2, title: '数学习题集', subject: '数学', deadline: '2023-10-18', status: 'completed' },
        { id: 3, title: '英语阅读理解', subject: '英语', deadline: '2023-10-22', status: 'pending' },
        { id: 4, title: '科学实验报告', subject: '科学', deadline: '2023-10-25', status: 'pending' },
      ],
      notifications: [
        { id: 1, title: '期中考试通知', content: '下周一开始期中考试，请做好准备', time: '2023-10-16 09:30', read: false },
        { id: 2, title: '家长会通知', content: '本周五下午3点举行家长会', time: '2023-10-14 14:00', read: true },
        { id: 3, title: '作业提醒', content: '您有3项作业即将截止', time: '2023-10-13 16:45', read: false },
      ],
      progressData: [
        { subject: '语文', progress: 85 },
        { subject: '数学', progress: 70 },
        { subject: '英语', progress: 90 },
        { subject: '科学', progress: 75 },
      ],
      overallProgress: 80,
      completedHomework: 15,
      totalHomework: 20,
      pendingHomework: 5,
      averageScore: 91.2
    };
  };
  
  const getParentMockData = () => {
    return {
      children: [
        { id: 1, name: '张小明', grade: '三年级', class: '2班' },
        { id: 2, name: '张小红', grade: '一年级', class: '5班' },
      ],
      studyData: {
        recentScores: [
          { subject: '语文', score: 92, date: '2023-10-15', trend: 'up' },
          { subject: '数学', score: 88, date: '2023-10-12', trend: 'down' },
          { subject: '英语', score: 95, date: '2023-10-10', trend: 'up' },
        ],
        homeworkStatus: {
          completed: 15,
          pending: 3,
          overdue: 1,
        },
        attendance: {
          present: 45,
          absent: 2,
          late: 3,
        },
        teacherComments: [
          { id: 1, teacher: '李老师', subject: '语文', content: '上课认真听讲，作业完成质量高', date: '2023-10-14' },
          { id: 2, teacher: '王老师', subject: '数学', content: '需要加强数学思维训练，多做应用题', date: '2023-10-10' },
        ],
      }
    };
  };
  
  const getTeacherMockData = () => {
    return {
      classStats: [
        { class: '三年级2班', studentCount: 45, avgScore: 87.5, homeworkCompletionRate: 92 },
        { class: '三年级3班', studentCount: 42, avgScore: 85.2, homeworkCompletionRate: 88 },
      ],
      recentHomework: [
        { id: 1, title: '语文作文', class: '三年级2班', assignDate: '2023-10-15', dueDate: '2023-10-20', submittedCount: 38, totalCount: 45 },
        { id: 2, title: '阅读理解练习', class: '三年级3班', assignDate: '2023-10-14', dueDate: '2023-10-19', submittedCount: 35, totalCount: 42 },
        { id: 3, title: '古诗词背诵', class: '三年级2班', assignDate: '2023-10-12', dueDate: '2023-10-17', submittedCount: 42, totalCount: 45 },
      ],
      studentAlerts: [
        { id: 1, name: '王小明', class: '三年级2班', issue: '连续3次未交作业', severity: 'high' },
        { id: 2, name: '李小红', class: '三年级3班', issue: '最近考试成绩下降明显', severity: 'medium' },
        { id: 3, name: '张小华', class: '三年级2班', issue: '上课注意力不集中', severity: 'low' },
      ]
    };
  };
  
  const getAdminMockData = () => {
    return {
      schoolStats: {
        studentCount: 1250,
        teacherCount: 68,
        classCount: 30,
        avgAttendance: 96.5,
      },
      gradePerformance: [
        { grade: '一年级', avgScore: 92.5, passRate: 98.2 },
        { grade: '二年级', avgScore: 90.1, passRate: 97.5 },
        { grade: '三年级', avgScore: 88.7, passRate: 96.8 },
        { grade: '四年级', avgScore: 87.2, passRate: 95.9 },
        { grade: '五年级', avgScore: 85.8, passRate: 94.7 },
        { grade: '六年级', avgScore: 86.3, passRate: 95.2 },
      ],
      systemAlerts: [
        { id: 1, type: '系统', message: '数据库备份已完成', time: '2023-10-16 03:00', severity: 'info' },
        { id: 2, type: '安全', message: '发现异常登录尝试', time: '2023-10-15 14:23', severity: 'warning' },
        { id: 3, type: '性能', message: '系统负载过高', time: '2023-10-14 10:15', severity: 'error' },
      ]
    };
  };
  
  // 根据用户角色渲染不同的仪表盘内容
  const renderDashboardContent = () => {
    switch (userRole) {
      case 'student':
        return renderStudentDashboard();
      case 'parent':
        return renderParentDashboard();
      case 'teacher':
        return renderTeacherDashboard();
      case 'admin':
        return renderAdminDashboard();
      default:
        return <div>未知用户角色</div>;
    }
  };
  
  // 学生仪表盘
  const renderStudentDashboard = () => {
    // 使用从API获取的数据或模拟数据
    const data = dashboardData.student || getStudentMockData();
    
    const recentScores = data.recentScores;
    const homeworkList = data.homeworkList;
    const notifications = data.notifications;
    const progressData = data.progressData;

    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <Title level={4}>欢迎回来，{currentUser?.name || '同学'}！</Title>
          <Paragraph>今天是学习的好日子，继续保持努力！</Paragraph>
        </div>
        
        <Divider orientation="left">学习概览</Divider>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="总体学习进度" 
                value={data.overallProgress} 
                suffix="%" 
                prefix={<BookOutlined />} 
              />
              <Progress percent={data.overallProgress} status="active" />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="已完成作业" 
                value={data.completedHomework} 
                suffix={`/${data.totalHomework}`} 
                prefix={<CheckCircleOutlined />} 
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="待完成作业" 
                value={data.pendingHomework} 
                prefix={<ClockCircleOutlined />} 
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="平均成绩" 
                value={data.averageScore} 
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
            <Card title="各科学习进度" bordered={false}>
              <List
                dataSource={progressData}
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
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="最近考试成绩" bordered={false}>
              <List
                dataSource={recentScores}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.subject}
                      description={`考试日期: ${item.date}`}
                    />
                    <div>
                      {item.score} 分
                      {item.trend === 'up' ? 
                        <RiseOutlined style={{ color: '#3f8600', marginLeft: 8 }} /> : 
                        <FallOutlined style={{ color: '#cf1322', marginLeft: 8 }} />}
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
        
        <Divider orientation="left">作业与通知</Divider>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="待完成作业" bordered={false} extra={<a href="#">查看全部</a>}>
              <List
                dataSource={homeworkList.filter(hw => hw.status === 'pending')}
                renderItem={item => (
                  <List.Item actions={[<a key="view">查看</a>, <a key="submit">提交</a>]}>
                    <List.Item.Meta
                      avatar={<Avatar icon={<FileTextOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                      title={item.title}
                      description={
                        <>
                          <Text type="secondary">{item.subject}</Text>
                          <br />
                          <Text type="danger">截止日期: {item.deadline}</Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: <Empty description="暂无待完成作业" /> }}
              />
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="最新通知" bordered={false} extra={<a href="#">查看全部</a>}>
              <List
                dataSource={notifications}
                renderItem={item => (
                  <List.Item actions={[<a key="view">查看详情</a>]}>
                    <List.Item.Meta
                      avatar={
                        <Badge dot={!item.read}>
                          <Avatar icon={<BellOutlined />} style={{ backgroundColor: item.read ? '#d9d9d9' : '#1890ff' }} />
                        </Badge>
                      }
                      title={<Text strong={!item.read}>{item.title}</Text>}
                      description={
                        <>
                          <Text type="secondary">{item.content}</Text>
                          <br />
                          <Text type="secondary">{item.time}</Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: <Empty description="暂无通知" /> }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };
  
  // 家长仪表盘
  const renderParentDashboard = () => {
    // 使用从API获取的数据或模拟数据
    const data = dashboardData.parent || getParentMockData();
    
    // 孩子信息
    const children = data.children;

    // 当前选中的孩子（默认第一个）
    const [selectedChild, setSelectedChild] = useState(children[0]);

    // 孩子的学习数据
    const studyData = data.studyData;

    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <Title level={4}>欢迎回来，{currentUser?.name || '家长'}！</Title>
          <Tabs defaultActiveKey="1" onChange={(key) => setSelectedChild(children[parseInt(key) - 1])}>
            {children.map((child, index) => (
              <TabPane tab={child.name} key={index + 1}>
                <Paragraph>您正在查看 {child.name} ({child.grade}{child.class}) 的学习情况</Paragraph>
              </TabPane>
            ))}
          </Tabs>
        </div>
        
        <Divider orientation="left">学习概览</Divider>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="平均成绩" 
                value={91.7} 
                precision={1} 
                prefix={<TrophyOutlined />} 
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="作业完成率" 
                value={studyData.homeworkStatus.completed} 
                suffix={`/${studyData.homeworkStatus.completed + studyData.homeworkStatus.pending + studyData.homeworkStatus.overdue}`} 
                prefix={<CheckCircleOutlined />} 
              />
              <Progress 
                percent={Math.round((studyData.homeworkStatus.completed / (studyData.homeworkStatus.completed + studyData.homeworkStatus.pending + studyData.homeworkStatus.overdue)) * 100)} 
                status="active" 
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic 
                title="出勤率" 
                value={Math.round((studyData.attendance.present / (studyData.attendance.present + studyData.attendance.absent + studyData.attendance.late)) * 100)} 
                suffix="%" 
                prefix={<UserOutlined />} 
              />
            </Card>
          </Col>
        </Row>
        
        <Divider orientation="left">学习详情</Divider>
        
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="最近考试成绩" bordered={false}>
              <List
                dataSource={studyData.recentScores}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.subject}
                      description={`考试日期: ${item.date}`}
                    />
                    <div>
                      {item.score} 分
                      {item.trend === 'up' ? 
                        <RiseOutlined style={{ color: '#3f8600', marginLeft: 8 }} /> : 
                        <FallOutlined style={{ color: '#cf1322', marginLeft: 8 }} />}
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="老师评语" bordered={false}>
              <List
                dataSource={studyData.teacherComments}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar>{item.teacher.charAt(0)}</Avatar>}
                      title={`${item.teacher}（${item.subject}）`}
                      description={
                        <>
                          <Text>{item.content}</Text>
                          <br />
                          <Text type="secondary">{item.date}</Text>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
        
        <Divider orientation="left">作业情况</Divider>
        
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card>
              <Row gutter={16}>
                <Col span={8}>
                  <Card type="inner" title="已完成作业">
                    <Statistic 
                      value={studyData.homeworkStatus.completed} 
                      valueStyle={{ color: '#3f8600' }} 
                      prefix={<CheckCircleOutlined />} 
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card type="inner" title="待完成作业">
                    <Statistic 
                      value={studyData.homeworkStatus.pending} 
                      valueStyle={{ color: '#faad14' }} 
                      prefix={<ClockCircleOutlined />} 
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card type="inner" title="逾期作业">
                    <Statistic 
                      value={studyData.homeworkStatus.overdue} 
                      valueStyle={{ color: '#cf1322' }} 
                      prefix={<WarningOutlined />} 
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };
  
  // 教师仪表盘
  const renderTeacherDashboard = () => {
    // 使用从API获取的数据或模拟数据
    const data = dashboardData.teacher || getTeacherMockData();
    
    const classStats = data.classStats;
    const recentHomework = data.recentHomework;
    const studentAlerts = data.studentAlerts;

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
  
  // 管理员仪表盘
  const renderAdminDashboard = () => {
    // 使用从API获取的数据或模拟数据
    const data = dashboardData.admin || getAdminMockData();
    
    const schoolStats = data.schoolStats;
    const gradePerformance = data.gradePerformance;
    const systemAlerts = data.systemAlerts;

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

  // 刷新仪表盘数据
  const handleRefreshData = () => {
    fetchDashboardData();
  };

  return (
    <div className="dashboard-content">
      {error && (
        <Alert 
          message="加载数据失败" 
          description={error} 
          type="error" 
          showIcon 
          closable 
          action={
            <Button size="small" type="primary" onClick={handleRefreshData}>
              重试
            </Button>
          }
        />
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button 
              onClick={handleRefreshData} 
              loading={loading}
              icon={<ReloadOutlined />}
            >
              刷新数据
            </Button>
          </div>
          {renderDashboardContent()}
        </>
      )}
    </div>
  );
};

export default Dashboard;