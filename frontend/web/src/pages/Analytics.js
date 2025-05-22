import React, { useState, useEffect } from 'react';
import { 
  Layout, Row, Col, Card, Form, Button, Tabs, Spin, Alert, 
  Select, DatePicker, Typography, Space, Divider, List, Tag, Empty
} from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { 
  ScoreTrendChart, 
  SubjectComparisonChart, 
  LearningAbilityChart, 
  LearningProgressChart,
  ClassScoreDistributionChart,
  LearningTimeAllocationChart,
  HomeworkCompletionChart,
  AttendanceRateChart
} from '../components/charts/AnalyticsCharts';
import axios from 'axios';

const { TabPane } = Tabs;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const Analytics = () => {
  const { currentUser } = useAuth();
  const { subscribe, unsubscribe } = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('studentReport');
  
  const [studentReportForm] = Form.useForm();
  const [classReportForm] = Form.useForm();
  const [trendAnalysisForm] = Form.useForm();
  const [progressAnalysisForm] = Form.useForm();
  
  // 学生报告状态
  const [studentReport, setStudentReport] = useState(null);
  
  // 班级报告状态
  const [classReport, setClassReport] = useState(null);
  
  // 学习趋势状态
  const [trendData, setTrendData] = useState(null);
  
  // 学习进度状态
  const [progressDataState, setProgressDataState] = useState(null);
  
  // Mock data for dropdowns - TODO: Fetch these dynamically
  const [mockStudents, setMockStudents] = useState([{id: 'student1', name: '张三 (mock)'}, {id: 'student2', name: '李四 (mock)'}]);
  const [mockClasses, setMockClasses] = useState([{id: 'class1', name: '三年级一班 (mock)'}, {id: 'class2', name: '三年级二班 (mock)'}]);
  const [mockSubjects, setMockSubjects] = useState([{id: 'math', name: '数学 (mock)'}, {id: 'chinese', name: '语文 (mock)'}]);

  useEffect(() => {
    // TODO: Fetch initial dynamic options for selects (students, classes, subjects)
    // For example:
    // const fetchInitialOptions = async () => {
    //   try {
    //     const studentsRes = await axios.get('/api/users/students');
    //     setMockStudents(studentsRes.data.map(s => ({ id: s._id, name: s.name })));
    //     const classesRes = await axios.get('/api/classes');
    //     setMockClasses(classesRes.data.map(c => ({ id: c._id, name: c.name })));
    //     // ... and so on for subjects
    //   } catch (err) {
    //     console.error("Failed to fetch initial options", err);
    //     setError("无法加载筛选选项，请刷新页面。");
    //   }
    // };
    // fetchInitialOptions();
  }, []);
  
  const fetchStudentReport = async (values) => {
    const { studentId, reportPeriod } = values;
    if (!studentId) {
      setError('请选择学生');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/analytics/reports/student/${studentId}`, {
        params: { period: reportPeriod }
      });
      setStudentReport(response.data);
    } catch (error) {
      console.error('获取学生报告失败:', error);
      setError('获取学生报告失败，请稍后重试');
      setStudentReport(null); // Clear previous report on error
    } finally {
      setLoading(false);
    }
  };
  
  const fetchClassReport = async (values) => {
    const { classId, classPeriod } = values;
    if (!classId) {
      setError('请选择班级');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/analytics/reports/class/${classId}`, {
        params: { period: classPeriod }
      });
      setClassReport(response.data);
    } catch (error) {
      console.error('获取班级报告失败:', error);
      setError('获取班级报告失败，请稍后重试');
      setClassReport(null); // Clear previous report on error
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    let unsubTrend, unsubClass, unsubProgress;
    if (subscribe) { // Ensure subscribe is available (e.g. context is ready)
        // Assuming form values are available for WebSocket subscription logic
        const currentTrendStudentId = trendAnalysisForm.getFieldValue('trendStudentId');
        const currentClassId = classReportForm.getFieldValue('classId');
        const currentProgressStudentId = progressAnalysisForm.getFieldValue('progressStudentId');

        unsubTrend = subscribe('student-trends-update', (data) => {
          if (data.studentId === currentTrendStudentId) {
            setTrendData(data);
          }
        });
        unsubClass = subscribe('class-trends-update', (data) => {
          if (data.classId === currentClassId) {
            setClassReport(data); // This might need more sophisticated merging if classReport has other filters
          }
        });
        unsubProgress = subscribe('student-progress-update', (data) => {
          if (data.studentId === currentProgressStudentId) {
            setProgressDataState(data);
          }
        });
    }
    return () => {
      if (unsubTrend) unsubTrend();
      if (unsubClass) unsubClass();
      if (unsubProgress) unsubProgress();
    };
  }, [subscribe, trendAnalysisForm, classReportForm, progressAnalysisForm]); // Watch forms for ID changes
  
  const fetchTrendData = async (values) => {
    const { trendStudentId, trendSubject, trendPeriod } = values;
    if (!trendStudentId) {
      setError('请选择学生');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/analytics/trends/student/${trendStudentId}`, {
        params: { 
          subject: trendSubject || undefined,
          period: trendPeriod 
        }
      });
      setTrendData(response.data);
    } catch (error) {
      console.error('获取学习趋势数据失败:', error);
      setError('获取学习趋势数据失败，请稍后重试');
      setTrendData(null);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchProgressData = async (values) => {
    const { progressStudentId, progressSubject, progressPeriod } = values;
    if (!progressStudentId) {
      setError('请选择学生');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/analytics/progress/student/${progressStudentId}`, {
        params: { 
          subject: progressSubject || undefined,
          period: progressPeriod 
        }
      });
      setProgressDataState(response.data);
    } catch (error) {
      console.error('获取学习进度数据失败:', error);
      setError('获取学习进度数据失败，请稍后重试');
      setProgressDataState(null);
    } finally {
      setLoading(false);
    }
  };
  
  const renderStudentReport = () => {
    if (!studentReport) return <Empty description="暂无学生报告数据，请先查询。" />;
    return (
      <Card title={`${studentReport.student?.name || '未知学生'} 的学习报告`} style={{ marginTop: 20 }}>
        <Title level={5}>学习表现概览</Title>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {studentReport.subjectPerformance && Object.entries(studentReport.subjectPerformance).map(([subject, data]) => (
            <Col xs={24} sm={12} md={8} lg={6} key={subject}>
              <Card title={subject} size="small">
                <Text>平均分: {data.averageScore}</Text><br/>
                <Text>最高分: {data.highestScore}</Text><br/>
                <Text>进步率: {data.improvementRate}%</Text><br/>
                <Text>趋势: {data.trend}</Text>
              </Card>
            </Col>
          ))}
        </Row>
        
        <Row gutter={[16,16]}>
            <Col xs={24} md={12}>
                <Title level={5}>学习优势</Title>
                <List
                    size="small"
                    bordered
                    dataSource={studentReport.strengths || []}
                    renderItem={item => <List.Item>{item}</List.Item>}
                    locale={{ emptyText: '暂无数据' }}
                />
            </Col>
            <Col xs={24} md={12}>
                <Title level={5}>学习不足</Title>
                <List
                    size="small"
                    bordered
                    dataSource={studentReport.weaknesses || []}
                    renderItem={item => <List.Item>{item}</List.Item>}
                    locale={{ emptyText: '暂无数据' }}
                />
            </Col>
        </Row>
        <Divider />
        <Title level={5}>学习建议</Title>
        <List
            size="small"
            bordered
            dataSource={studentReport.suggestions || []}
            renderItem={item => <List.Item>{item}</List.Item>}
            locale={{ emptyText: '暂无数据' }}
            style={{marginBottom: 20}}
        />
        
        {studentReport.mistakeAnalysis && studentReport.mistakeAnalysis.length > 0 && (
          <>
            <Title level={5}>错题分析</Title>
            <List
                size="small"
                bordered
                dataSource={studentReport.mistakeAnalysis}
                renderItem={item => <List.Item>{item}</List.Item>}
                locale={{ emptyText: '暂无数据' }}
            />
          </>
        )}
      </Card>
    );
  };
  
  const renderClassReport = () => {
    if (!classReport) return <Empty description="暂无班级报告数据，请先查询。" />;
    return (
      <Card title={`${classReport.className || '未知班级'} 学习报告`} style={{ marginTop: 20 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={8}>
            <Card title="整体情况">
              <Text>平均分: {classReport.overallMetrics?.averageScore} 分</Text><br/>
              <Text>及格率: {classReport.overallMetrics?.passRate}%</Text><br/>
              <Text>优秀率: {classReport.overallMetrics?.excellenceRate}%</Text>
            </Card>
          </Col>
          <Col xs={24} md={12} lg={16}>
            <ClassScoreDistributionChart data={classReport.scoreDistributionData} /> 
          </Col>
        </Row>
        <Divider />
        <Title level={5}>各学科表现</Title>
        {classReport.subjectBreakdown && classReport.subjectBreakdown.map(subjectData => (
          <Card key={subjectData.subject} title={subjectData.subject} size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}><Text>平均分: {subjectData.averageScore}</Text></Col>
              <Col span={8}><Text>最高分: {subjectData.highestScore}</Text></Col>
              <Col span={8}><Text>最低分: {subjectData.lowestScore}</Text></Col>
            </Row>
          </Card>
        ))}
        <Divider />
        <Title level={5}>学生排名 (前10)</Title>
        <List
          size="small"
          bordered
          dataSource={classReport.topStudents || []}
          renderItem={(item, index) => <List.Item>{index + 1}. {item.name} - {item.score}分</List.Item>}
          locale={{ emptyText: '暂无数据' }}
        />
      </Card>
    );
  };

  const renderTrendData = () => {
    if (!trendData) return <Empty description="暂无学习趋势数据，请先查询。" />;
    return (
      <Card title="学习趋势分析结果" style={{ marginTop: 20 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <ScoreTrendChart data={trendData} subject={trendAnalysisForm.getFieldValue('trendSubject') ? mockSubjects.find(s=>s.id === trendAnalysisForm.getFieldValue('trendSubject'))?.name : undefined} />
          </Col>
          <Col xs={24} md={12}>
            <SubjectComparisonChart data={trendData} />
          </Col>
           {trendData.abilityData && (
            <Col xs={24} md={12}>
              <LearningAbilityChart data={trendData.abilityData} />
            </Col>
          )}
          {/* Add more charts as needed based on trendData structure */}
        </Row>
      </Card>
    );
  };

  const renderProgressData = () => {
    if (!progressDataState) return <Empty description="暂无学习进度数据，请先查询。" />;
    return (
      <Card title="学习进度分析结果" style={{ marginTop: 20 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <LearningProgressChart data={progressDataState} subject={progressAnalysisForm.getFieldValue('progressSubject') ? mockSubjects.find(s=>s.id === progressAnalysisForm.getFieldValue('progressSubject'))?.name : undefined} />
          </Col>
          <Col xs={24} md={12}>
             <HomeworkCompletionChart data={progressDataState.homeworkCompletionData} />
          </Col>
          <Col xs={24} md={12}>
            <AttendanceRateChart data={progressDataState.attendanceData} />
          </Col>
          {/* Add more charts based on progressDataState structure */}
        </Row>
      </Card>
    );
  };

  const commonPeriodOptions = [
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' },
    { value: 'semester', label: '本学期' },
    { value: 'year', label: '本学年' },
  ];
  
  return (
    <Layout.Content style={{ padding: '24px', margin: 0, minHeight: 280, background: '#fff' }}>
      <Title level={3} style={{ marginBottom: '24px' }}>数据分析中心</Title>
      {error && <Alert message={error} type="error" showIcon closable style={{ marginBottom: '20px' }} onClose={() => setError(null)} />}
      <Tabs activeKey={activeTab} onChange={(key) => { setActiveTab(key); setError(null); /* Reset data for other tabs if needed */ }}>
        <TabPane tab="学生个人报告" key="studentReport">
          <Form form={studentReportForm} layout="inline" onFinish={fetchStudentReport} style={{ marginBottom: '20px' }}>
            <Form.Item label="选择学生" name="studentId" rules={[{ required: true, message: '请选择学生' }]}>
              <Select style={{ width: 180 }} placeholder="选择学生">
                {mockStudents.map(student => <Option key={student.id} value={student.id}>{student.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="报告周期" name="reportPeriod" initialValue="semester">
              <Select style={{ width: 120 }}>
                {commonPeriodOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>查询报告</Button>
            </Form.Item>
          </Form>
          {loading ? <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div> : renderStudentReport()}
        </TabPane>

        <TabPane tab="班级学习报告" key="classReport">
          <Form form={classReportForm} layout="inline" onFinish={fetchClassReport} style={{ marginBottom: '20px' }}>
            <Form.Item label="选择班级" name="classId" rules={[{ required: true, message: '请选择班级' }]}>
              <Select style={{ width: 180 }} placeholder="选择班级">
                {mockClasses.map(cls => <Option key={cls.id} value={cls.id}>{cls.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="报告周期" name="classPeriod" initialValue="semester">
              <Select style={{ width: 120 }}>
                 {commonPeriodOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>查询报告</Button>
            </Form.Item>
          </Form>
          {loading ? <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div> : renderClassReport()}
        </TabPane>

        <TabPane tab="学习趋势分析" key="trendAnalysis">
          <Form form={trendAnalysisForm} layout="inline" onFinish={fetchTrendData} style={{ marginBottom: '20px' }}>
            <Form.Item label="选择学生" name="trendStudentId" rules={[{ required: true, message: '请选择学生' }]}>
              <Select style={{ width: 180 }} placeholder="选择学生">
                {mockStudents.map(student => <Option key={student.id} value={student.id}>{student.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="选择学科" name="trendSubject">
              <Select style={{ width: 150 }} placeholder="所有学科" allowClear>
                {mockSubjects.map(subject => <Option key={subject.id} value={subject.id}>{subject.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="周期" name="trendPeriod" initialValue="semester">
              <Select style={{ width: 120 }}>
                {commonPeriodOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>分析趋势</Button>
            </Form.Item>
          </Form>
          {loading ? <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div> : renderTrendData()}
        </TabPane>

        <TabPane tab="学习进度分析" key="progressAnalysis">
          <Form form={progressAnalysisForm} layout="inline" onFinish={fetchProgressData} style={{ marginBottom: '20px' }}>
            <Form.Item label="选择学生" name="progressStudentId" rules={[{ required: true, message: '请选择学生' }]}>
              <Select style={{ width: 180 }} placeholder="选择学生">
                {mockStudents.map(student => <Option key={student.id} value={student.id}>{student.name}</Option>)}
              </Select>
            </Form.Item>
             <Form.Item label="选择学科" name="progressSubject">
              <Select style={{ width: 150 }} placeholder="所有学科" allowClear>
                {mockSubjects.map(subject => <Option key={subject.id} value={subject.id}>{subject.name}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="周期" name="progressPeriod" initialValue="semester">
              <Select style={{ width: 120 }}>
                 {commonPeriodOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>分析进度</Button>
            </Form.Item>
          </Form>
          {loading ? <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div> : renderProgressData()}
        </TabPane>
      </Tabs>
    </Layout.Content>
  );
};

export default Analytics;