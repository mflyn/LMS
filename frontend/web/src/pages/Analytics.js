import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Tabs, Tab, Spinner, Alert } from 'react-bootstrap';
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

const Analytics = () => {
  const { currentUser } = useAuth();
  const { subscribe } = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('studentReport');
  
  // 学生报告状态
  const [studentId, setStudentId] = useState('');
  const [reportPeriod, setReportPeriod] = useState('semester');
  const [studentReport, setStudentReport] = useState(null);
  
  // 班级报告状态
  const [classId, setClassId] = useState('');
  const [classPeriod, setClassPeriod] = useState('semester');
  const [classReport, setClassReport] = useState(null);
  
  // 学习趋势状态
  const [trendStudentId, setTrendStudentId] = useState('');
  const [trendSubject, setTrendSubject] = useState('');
  const [trendPeriod, setTrendPeriod] = useState('semester');
  const [trendData, setTrendData] = useState(null);
  
  // 学习进度状态
  const [progressStudentId, setProgressStudentId] = useState('');
  const [progressSubject, setProgressSubject] = useState('');
  const [progressPeriod, setProgressPeriod] = useState('semester');
  const [progressData, setProgressData] = useState(null);
  
  // 获取学生个性化学习报告
  const fetchStudentReport = async () => {
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
    } finally {
      setLoading(false);
    }
  };
  
  // 获取班级学习报告
  const fetchClassReport = async () => {
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
    } finally {
      setLoading(false);
    }
  };
  
  // 使用WebSocket接收实时数据更新
  useEffect(() => {
    // 订阅学生趋势数据更新
    const unsubscribeTrend = subscribe('student-trends-update', (data) => {
      if (data.studentId === trendStudentId) {
        setTrendData(data);
      }
    });
    
    // 订阅班级趋势数据更新
    const unsubscribeClass = subscribe('class-trends-update', (data) => {
      if (data.classId === classId) {
        setClassReport(data);
      }
    });
    
    // 订阅学习进度数据更新
    const unsubscribeProgress = subscribe('student-progress-update', (data) => {
      if (data.studentId === progressStudentId) {
        setProgressData(data);
      }
    });
    
    return () => {
      unsubscribeTrend();
      unsubscribeClass();
      unsubscribeProgress();
    };
  }, [subscribe, trendStudentId, classId, progressStudentId]);
  
  // 获取学习趋势数据
  const fetchTrendData = async () => {
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
    } finally {
      setLoading(false);
    }
  };
  
  // 获取学习进度数据
  const fetchProgressData = async () => {
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
      setProgressData(response.data);
    } catch (error) {
      console.error('获取学习进度数据失败:', error);
      setError('获取学习进度数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 渲染学生报告
  const renderStudentReport = () => {
    if (!studentReport) return null;
    
    return (
      <Card className="mt-4">
        <Card.Header>
          <h5 className="mb-0">{studentReport.student.name} 的学习报告</h5>
        </Card.Header>
        <Card.Body>
          <h6>学习表现概览</h6>
          <Row className="mb-4">
            {Object.entries(studentReport.subjectPerformance).map(([subject, data]) => (
              <Col md={4} key={subject} className="mb-3">
                <Card>
                  <Card.Body>
                    <h6>{subject}</h6>
                    <p>平均分: {data.averageScore}</p>
                    <p>最高分: {data.highestScore}</p>
                    <p>进步率: {data.improvementRate}%</p>
                    <p>趋势: {data.trend}</p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          
          <h6>学习优势</h6>
          <ul>
            {studentReport.strengths.map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
          
          <h6>学习不足</h6>
          <ul>
            {studentReport.weaknesses.map((weakness, index) => (
              <li key={index}>{weakness}</li>
            ))}
          </ul>
          
          <h6>学习建议</h6>
          <ul>
            {studentReport.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
          
          {studentReport.mistakeAnalysis && (
            <div>
              <h6>错题分析</h6>
              <ul>
                {studentReport.mistakeAnalysis.map((mistake, index) => (
                  <li key={index}>{mistake}</li>
                ))}
              </ul>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };
  
  // 渲染班级报告
  const renderClassReport = () => {
    if (!classReport) return null;
    
    return (
      <Card className="mt-4">
        <Card.Header>
          <h5 className="mb-0">{classReport.className} 班级学习报告</h5>
        </Card.Header>
        <Card.Body>
          <Row className="mb-4">
            <Col md={12} lg={6}>
              <ClassScoreDistributionChart data={classReport} />
            </Col>
            <Col md={12} lg={6}>
              <AttendanceRateChart data={classReport} period="本学期" />
            </Col>
          </Row>
          
          <h6>班级整体表现</h6>
          <Row className="mb-4">
            {Object.entries(classReport.subjectPerformance).map(([subject, data]) => (
              <Col md={4} key={subject} className="mb-3">
                <Card>
                  <Card.Body>
                    <h6>{subject}</h6>
                    <p>班级平均分: {data.classAverage}</p>
                    <p>最高分: {data.highestScore}</p>
                    <p>最低分: {data.lowestScore}</p>
                    <p>及格率: {data.passRate}%</p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          
          <h6>班级优势学科</h6>
          <ul>
            {classReport.strengths.map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
          
          <h6>班级薄弱学科</h6>
          <ul>
            {classReport.weaknesses.map((weakness, index) => (
              <li key={index}>{weakness}</li>
            ))}
          </ul>
          
          <h6>教学建议</h6>
          <ul>
            {classReport.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
          
          {classReport.topStudents && (
            <div>
              <h6>优秀学生</h6>
              <ul>
                {classReport.topStudents.map((student, index) => (
                  <li key={index}>{student.name} - {student.subject}: {student.score}分</li>
                ))}
              </ul>
            </div>
          )}
          
          {classReport.needHelpStudents && (
            <div>
              <h6>需要帮助的学生</h6>
              <ul>
                {classReport.needHelpStudents.map((student, index) => (
                  <li key={index}>{student.name} - {student.subject}: {student.score}分</li>
                ))}
              </ul>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };
  
  // 渲染学习趋势
  const renderTrendData = () => {
    if (!trendData) return null;
    
    return (
      <div>
        <Card className="mt-4">
          <Card.Header>
            <h5 className="mb-0">{trendData.student.name} 的学习趋势分析</h5>
          </Card.Header>
          <Card.Body>
            <Row className="mb-4">
              <Col md={12} lg={6}>
                <ScoreTrendChart data={trendData} />
              </Col>
              <Col md={12} lg={6}>
                <SubjectComparisonChart data={trendData} />
              </Col>
            </Row>
            
            <Row className="mb-4">
              <Col md={12} lg={6}>
                <LearningAbilityChart data={trendData} />
              </Col>
              <Col md={12} lg={6}>
                <HomeworkCompletionChart data={trendData} period="本学期" />
              </Col>
            </Row>
            
            {Object.entries(trendData.trends).map(([subject, data]) => (
              <div key={subject} className="mb-4">
                <h6>{subject} 学习趋势</h6>
                <div className="mb-3">
                  <p>平均分: {data.averageScore}</p>
                  <p>最高分: {data.highestScore}</p>
                  <p>最低分: {data.lowestScore}</p>
                  <p>趋势: {data.trend}</p>
                </div>
                <div>
                  <h6>成绩记录</h6>
                  <ul>
                    {data.scoreData.map((record, index) => (
                      <li key={index}>
                        {record.date}: {record.score}分 ({record.testType})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>
      </div>
    );
  };
  
  // 渲染学习进度
  const renderProgressData = () => {
    if (!progressData) return null;
    
    return (
      <div>
        <Card className="mt-4">
          <Card.Header>
            <h5 className="mb-0">{progressData.student.name} 的学习进度分析</h5>
          </Card.Header>
          <Card.Body>
            <Row className="mb-4">
              <Col md={12} lg={6}>
                <LearningProgressChart data={progressData} />
              </Col>
              <Col md={12} lg={6}>
                <LearningTimeAllocationChart data={progressData} />
              </Col>
            </Row>
            
            {Object.entries(progressData.progress).map(([subject, data]) => (
              <div key={subject} className="mb-4">
                <Row>
                  <Col md={12} lg={6}>
                    <h6>{subject} 学习进度</h6>
                    <div className="mb-3">
                      <p>完成率: {data.completionRate}%</p>
                      <p>当前进度: {data.currentUnit}</p>
                      <p>学习速度: {data.learningSpeed}</p>
                    </div>
                  </Col>
                  <Col md={12} lg={6}>
                    <LearningProgressChart data={data} subject={subject} />
                  </Col>
                </Row>
                <div>
                  <h6>单元完成情况</h6>
                  <ul>
                    {data.unitProgress.map((unit, index) => (
                      <li key={index}>
                        {unit.name}: {unit.status} ({unit.completionDate ? new Date(unit.completionDate).toLocaleDateString() : '未完成'})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>
      </div>
    );
  };
  
  return (
    <Container className="py-4">
      <h2 className="mb-4">数据分析</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="studentReport" title="学生学习报告">
          <Card>
            <Card.Header>
              <h5 className="mb-0">生成学生个性化学习报告</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>选择学生</Form.Label>
                      <Form.Control 
                        type="text" 
                        placeholder="请输入学生ID" 
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>报告周期</Form.Label>
                      <Form.Select 
                        value={reportPeriod}
                        onChange={(e) => setReportPeriod(e.target.value)}
                      >
                        <option value="week">周报告</option>
                        <option value="month">月报告</option>
                        <option value="semester">学期报告</option>
                        <option value="year">年度报告</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-end">
                  <Button 
                    variant="primary" 
                    onClick={fetchStudentReport}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                        />
                        <span className="ms-2">加载中...</span>
                      </>
                    ) : '生成报告'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          
          {renderStudentReport()}
        </Tab>
        
        <Tab eventKey="classReport" title="班级学习报告">
          <Card>
            <Card.Header>
              <h5 className="mb-0">生成班级学习报告</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>选择班级</Form.Label>
                      <Form.Control 
                        type="text" 
                        placeholder="请输入班级ID" 
                        value={classId}
                        onChange={(e) => setClassId(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>报告周期</Form.Label>
                      <Form.Select 
                        value={classPeriod}
                        onChange={(e) => setClassPeriod(e.target.value)}
                      >
                        <option value="week">周报告</option>
                        <option value="month">月报告</option>
                        <option value="semester">学期报告</option>
                        <option value="year">年度报告</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-end">
                  <Button 
                    variant="primary" 
                    onClick={fetchClassReport}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                        />
                        <span className="ms-2">加载中...</span>
                      </>
                    ) : '生成报告'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          
          {renderClassReport()}
        </Tab>
        
        <Tab eventKey="trends" title="学习趋势分析">
          <Card>
            <Card.Header>
              <h5 className="mb-0">学习趋势分析</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>选择学生</Form.Label>
                      <Form.Control 
                        type="text" 
                        placeholder="请输入学生ID" 
                        value={trendStudentId}
                        onChange={(e) => setTrendStudentId(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>学科</Form.Label>
                      <Form.Select 
                        value={trendSubject}
                        onChange={(e) => setTrendSubject(e.target.value)}
                      >
                        <option value="">全部</option>
                        <option value="语文">语文</option>
                        <option value="数学">数学</option>
                        <option value="英语">英语</option>
                        <option value="科学">科学</option>
                        <option value="社会">社会</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>时间段</Form.Label>
                      <Form.Select 
                        value={trendPeriod}
                        onChange={(e) => setTrendPeriod(e.target.value)}
                      >
                        <option value="week">最近一周</option>
                        <option value="month">最近一个月</option>
                        <option value="semester">本学期</option>
                        <option value="year">本学年</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-end">
                  <Button 
                    variant="primary" 
                    onClick={fetchTrendData}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                        />
                        <span className="ms-2">加载中...</span>
                      </>
                    ) : '分析趋势'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          
          {renderTrendData()}
        </Tab>
        
        <Tab eventKey="progress" title="学习进度分析">
          <Card>
            <Card.Header>
              <h5 className="mb-0">学习进度分析</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>选择学生</Form.Label>
                      <Form.Control 
                        type="text" 
                        placeholder="请输入学生ID" 
                        value={progressStudentId}
                        onChange={(e) => setProgressStudentId(e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>学科</Form.Label>
                      <Form.Select 
                        value={progressSubject}
                        onChange={(e) => setProgressSubject(e.target.value)}
                      >
                        <option value="">全部</option>
                        <option value="语文">语文</option>
                        <option value="数学">数学</option>
                        <option value="英语">英语</option>
                        <option value="科学">科学</option>
                        <option value="社会">社会</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>时间段</Form.Label>
                      <Form.Select 
                        value={progressPeriod}
                        onChange={(e) => setProgressPeriod(e.target.value)}
                      >
                        <option value="week">最近一周</option>
                        <option value="month">最近一个月</option>
                        <option value="semester">本学期</option>
                        <option value="year">本学年</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-end">
                  <Button 
                    variant="primary" 
                    onClick={fetchProgressData}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                        />
                        <span className="ms-2">加载中...</span>
                      </>
                    ) : '分析进度'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          
          {renderProgressData()}
        </Tab>
      </Tabs>
    </Container>
  );
};

export default Analytics;