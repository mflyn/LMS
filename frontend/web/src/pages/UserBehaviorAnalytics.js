import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Tabs, Table, Spin, Alert, Select, DatePicker, Button, Empty, Statistic, List, Tag, Typography } from 'antd';
import { UserOutlined, ClockCircleOutlined, BarChartOutlined, BulbOutlined, CalendarOutlined, BookOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useUserBehavior } from '../contexts/UserBehaviorContext';
import { Line, Bar, Heatmap, Pie } from '@ant-design/charts';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

const UserBehaviorAnalytics = () => {
  const { currentUser, userRole } = useAuth();
  const { trackPageView } = useUserBehavior();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('activityLogs');
  
  // 用户活动日志状态
  const [userId, setUserId] = useState(currentUser?.id || '');
  const [dateRange, setDateRange] = useState([null, null]);
  const [activityData, setActivityData] = useState(null);
  
  // 学习习惯分析状态
  const [learningHabitsUserId, setLearningHabitsUserId] = useState(currentUser?.id || '');
  const [learningHabitsDays, setLearningHabitsDays] = useState(30);
  const [learningHabitsData, setLearningHabitsData] = useState(null);
  
  // 使用习惯统计状态
  const [usagePatternRole, setUsagePatternRole] = useState(userRole || 'student');
  const [usagePatternDays, setUsagePatternDays] = useState(30);
  const [usagePatternData, setUsagePatternData] = useState(null);
  
  // 个性化推荐状态
  const [recommendationsUserId, setRecommendationsUserId] = useState(currentUser?.id || '');
  const [recommendationsData, setRecommendationsData] = useState(null);
  
  // 记录页面访问
  useEffect(() => {
    trackPageView('/user-behavior-analytics', '用户行为分析');
  }, [trackPageView]);
  
  // 获取用户活动日志
  const fetchActivityLogs = async () => {
    if (!userId) {
      setError('请选择用户');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const startDate = dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined;
      const endDate = dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined;
      
      const response = await axios.get(`/api/analytics/user-behavior/activity/${userId}`, {
        params: { startDate, endDate }
      });
      
      setActivityData(response.data);
    } catch (error) {
      console.error('获取用户活动日志失败:', error);
      setError('获取用户活动日志失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取学习习惯分析
  const fetchLearningHabits = async () => {
    if (!learningHabitsUserId) {
      setError('请选择用户');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/analytics/user-behavior/learning-habits/${learningHabitsUserId}`, {
        params: { days: learningHabitsDays }
      });
      
      setLearningHabitsData(response.data);
    } catch (error) {
      console.error('获取学习习惯分析失败:', error);
      setError('获取学习习惯分析失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取使用习惯统计
  const fetchUsagePatterns = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/analytics/user-behavior/usage-patterns/${usagePatternRole}`, {
        params: { days: usagePatternDays }
      });
      
      setUsagePatternData(response.data);
    } catch (error) {
      console.error('获取使用习惯统计失败:', error);
      setError('获取使用习惯统计失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取个性化推荐
  const fetchRecommendations = async () => {
    if (!recommendationsUserId) {
      setError('请选择用户');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/analytics/user-behavior/recommendations/${recommendationsUserId}`);
      
      setRecommendationsData(response.data);
    } catch (error) {
      console.error('获取个性化推荐失败:', error);
      setError('获取个性化推荐失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 渲染用户活动日志
  const renderActivityLogs = () => {
    if (!activityData) return null;
    
    const { activitySummary, recentActivities } = activityData;
    
    // 活动摘要图表配置
    const activityChartConfig = {
      data: activitySummary,
      xField: '_id',
      yField: 'count',
      color: '#1890ff',
      label: {
        position: 'middle',
        style: {
          fill: '#FFFFFF',
          opacity: 0.6,
        },
      },
      meta: {
        _id: { alias: '操作类型' },
        count: { alias: '次数' },
      },
    };
    
    // 最近活动表格列配置
    const columns = [
      {
        title: '时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        render: (text) => new Date(text).toLocaleString(),
      },
      {
        title: '操作类型',
        dataIndex: 'actionType',
        key: 'actionType',
        render: (text) => getActionTypeText(text),
      },
      {
        title: '页面',
        dataIndex: ['location', 'page'],
        key: 'page',
      },
      {
        title: '组件',
        dataIndex: ['location', 'component'],
        key: 'component',
      },
      {
        title: '状态',
        dataIndex: 'success',
        key: 'success',
        render: (success) => success ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
      },
    ];
    
    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="活动摘要">
              {activitySummary.length > 0 ? (
                <Bar {...activityChartConfig} />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
          
          <Col span={24}>
            <Card title="最近活动记录">
              <Table 
                dataSource={recentActivities} 
                columns={columns} 
                rowKey="_id"
                pagination={{ pageSize: 5 }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };
  
  // 渲染学习习惯分析
  const renderLearningHabits = () => {
    if (!learningHabitsData) return null;
    
    const { timeHeatmap, actionTypeData, suggestions } = learningHabitsData;
    
    // 准备热图数据
    const heatmapData = [];
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmapData.push({
          day: days[day],
          hour: `${hour}:00`,
          value: timeHeatmap[day][hour]
        });
      }
    }
    
    // 热图配置
    const heatmapConfig = {
      data: heatmapData,
      xField: 'hour',
      yField: 'day',
      colorField: 'value',
      color: ['#BAE7FF', '#1890FF', '#0050B3'],
      meta: {
        hour: {
          type: 'cat',
        },
      },
    };
    
    // 操作类型数据图表配置
    const actionTypeChartData = Object.entries(actionTypeData).map(([type, data]) => ({
      type: getActionTypeText(type),
      value: data.totalCount
    }));
    
    const actionTypeChartConfig = {
      data: actionTypeChartData,
      angleField: 'value',
      colorField: 'type',
      radius: 0.8,
      label: {
        type: 'outer',
        content: '{name}: {percentage}',
      },
    };
    
    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="学习时间分布热图">
              {heatmapData.some(item => item.value > 0) ? (
                <Heatmap {...heatmapConfig} />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="操作类型分布">
              {actionTypeChartData.length > 0 ? (
                <Pie {...actionTypeChartConfig} />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="学习习惯建议">
              {suggestions.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={suggestions}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={<><Tag color="blue">{item.area}</Tag> {item.issue}</>}
                        description={item.suggestion}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无建议" />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    );
  };
  
  // 渲染使用习惯统计
  const renderUsagePatterns = () => {
    if (!usagePatternData) return null;
    
    const { pageUsage, featureUsage, suggestions } = usagePatternData;
    
    // 页面使用统计图表数据
    const pageUsageChartData = Object.entries(pageUsage).map(([page, data]) => ({
      page,
      visits: data.totalCount,
      users: data.uniqueUsers
    }));
    
    // 页面使用统计图表配置
    const pageUsageChartConfig = {
      data: pageUsageChartData,
      xField: 'page',
      yField: 'visits',
      seriesField: 'page',
      color: '#1890ff',
      label: {
        position: 'middle',
        style: {
          fill: '#FFFFFF',
          opacity: 0.6,
        },
      },
    };
    
    // 功能使用统计图表数据
    const featureUsageChartData = Object.entries(featureUsage).map(([feature, data]) => ({
      feature: getActionTypeText(feature),
      count: data.totalCount,
      users: data.uniqueUsers
    }));
    
    // 功能使用统计图表配置
    const featureUsageChartConfig = {
      data: featureUsageChartData,
      xField: 'feature',
      yField: 'count',
      seriesField: 'feature',
      color: '#1890ff',
      label: {
        position: 'middle',
        style: {
          fill: '#FFFFFF',
          opacity: 0.6,
        },
      },
    };
    
    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card title="页面访问统计">
              {pageUsageChartData.length > 0 ? (
                <Bar {...pageUsageChartConfig} />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
          
          <Col span={24}>
            <Card title="功能使用统计">
              {featureUsageChartData.length > 0 ? (
                <Bar {...featureUsageChartConfig} />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
          
          <Col span={24}>
            <Card title="使用习惯建议">
              {suggestions.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={suggestions}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={<><Tag color="blue">{item.area}</Tag> {item.issue}</>}
                        description={item.suggestion}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无建议" />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    );
  };
  
  // 渲染个性化推荐
  const renderRecommendations = () => {
    if (!recommendationsData) return null;
    
    const { resources, activities, courses } = recommendationsData;
    
    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card 
              title={
                <span>
                  <BookOutlined /> 推荐资源
                </span>
              }
            >
              {resources.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={resources}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={item.title}
                        description={
                          <>
                            <Tag color="blue">{item.type}</Tag>
                            <Tag color="green">{item.subject}</Tag>
                            <div>{item.description}</div>
                          </>
                        }
                      />
                      <Button type="link" href={item.url} target="_blank">查看</Button>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无推荐资源" />
              )}
            </Card>
          </Col>
          
          <Col xs={24} md={8}>
            <Card 
              title={
                <span>
                  <CalendarOutlined /> 推荐活动
                </span>
              }
            >
              {activities.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={activities}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={item.title}
                        description={
                          <>
                            <div><ClockCircleOutlined /> {item.time}</div>
                            <div>{item.description}</div>
                          </>
                        }
                      />
                      <Button type="primary" size="small">参与</Button>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无推荐活动" />
              )}
            </Card>
          </Col>
          
          <Col xs={24} md={8}>
            <Card 
              title={
                <span>
                  <BulbOutlined /> 推荐课程
                </span>
              }
            >
              {courses.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={courses}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={item.title}
                        description={
                          <>
                            <Tag color="orange">{item.level}</Tag>
                            <Tag color="purple">{item.category}</Tag>
                            <div>{item.description}</div>
                          </>
                        }
                      />
                      <Button type="primary" size="small">查看详情</Button>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无推荐课程" />
              )}
            </Card>
          </Col>
        </Row>
      </div>
    );
  };
  
  // 操作类型文本映射
  const getActionTypeText = (type) => {
    const actionTypeMap = {
      'page_view': '页面访问',
      'button_click': '按钮点击',
      'form_submit': '表单提交',
      'resource_download': '资源下载',
      'resource_view': '资源查看',
      'login': '登录',
      'logout': '登出',
      'search': '搜索',
      'comment': '评论',
      'like': '点赞',
      'share': '分享',
      'assignment_submit': '作业提交',
      'quiz_complete': '测验完成',
      'video_play': '视频播放',
      'video_pause': '视频暂停',
      'video_complete': '视频完成',
      'notification_click': '通知点击',
      'message_send': '消息发送',
      'profile_update': '个人资料更新'
    };
    
    return actionTypeMap[type] || type;
  };
  
  return (
    <div className="user-behavior-analytics-container">
      <Title level={2}>用户行为分析</Title>
      <Paragraph>分析用户在系统中的行为模式和学习习惯，提供个性化建议和推荐。</Paragraph>
      
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={
            <span>
              <UserOutlined /> 用户活动日志
            </span>
          } 
          key="activityLogs"
        >
          <Card>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={8}>
                <Form.Item label="选择用户">
                  <Select
                    value={userId}
                    onChange={setUserId}
                    placeholder="请选择用户"
                    style={{ width: '100%' }}
                  >
                    <Select.Option value={currentUser?.id}>{currentUser?.name || '当前用户'}</Select.Option>
                    {/* 这里可以添加更多用户选项 */}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="日期范围">
                  <RangePicker 
                    value={dateRange} 
                    onChange={setDateRange} 
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button 
                  type="primary" 
                  onClick={fetchActivityLogs} 
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  查询
                </Button>
              </Col>
            </Row>
          </Card>
          
          {loading ? (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <Spin size="large" />
            </div>
          ) : (
            renderActivityLogs()
          )}
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <ClockCircleOutlined /> 学习习惯分析
            </span>
          } 
          key="learningHabits"
        >
          <Card>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={12}>
                <Form.Item label="选择用户">
                  <Select
                    value={learningHabitsUserId}
                    onChange={setLearningHabitsUserId}
                    placeholder="请选择用户"
                    style={{ width: '100%' }}
                  >
                    <Select.Option value={currentUser?.id}>{currentUser?.name || '当前用户'}</Select.Option>
                    {/* 这里可以添加更多用户选项 */}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="分析天数">
                  <Select
                    value={learningHabitsDays}
                    onChange={setLearningHabitsDays}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value={7}>最近7天</Select.Option>
                    <Select.Option value={30}>最近30天</Select.Option>
                    <Select.Option value={90}>最近90天</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button 
                  type="primary" 
                  onClick={fetchLearningHabits} 
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  分析
                </Button>
              </Col>
            </Row>
          </Card>
          
          {loading ? (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <Spin size="large" />
            </div>
          ) : (
            renderLearningHabits()
          )}
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <BarChartOutlined /> 使用习惯统计
            </span>
          } 
          key="usagePatterns"
        >
          <Card>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={12}>
                <Form.Item label="用户角色">
                  <Select
                    value={usagePatternRole}
                    onChange={setUsagePatternRole}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="student">学生</Select.Option>
                    <Select.Option value="teacher">教师</Select.Option>
                    <Select.Option value="parent">家长</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="分析天数">
                  <Select
                    value={usagePatternDays}
                    onChange={setUsagePatternDays}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value={7}>最近7天</Select.Option>
                    <Select.Option value={30}>最近30天</Select.Option>
                    <Select.Option value={90}>最近90天</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button 
                  type="primary" 
                  onClick={fetchUsagePatterns} 
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  统计
                </Button>
              </Col>
            </Row>
          </Card>
          
          {loading ? (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <Spin size="large" />
            </div>
          ) : (
            renderUsagePatterns()
          )}
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <BulbOutlined /> 个性化推荐
            </span>
          } 
          key="recommendations"
        >
          <Card>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={16}>
                <Form.Item label="选择用户">
                  <Select
                    value={recommendationsUserId}
                    onChange={setRecommendationsUserId}
                    placeholder="请选择用户"
                    style={{ width: '100%' }}
                  >
                    <Select.Option value={currentUser?.id}>{currentUser?.name || '当前用户'}</Select.Option>
                    {/* 这里可以添加更多用户选项 */}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Button 
                  type="primary" 
                  onClick={fetchRecommendations} 
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  获取推荐
                </Button>
              </Col>
            </Row>
          </Card>
          
          {loading ? (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <Spin size="large" />
            </div>
          ) : (
            renderRecommendations()
          )}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default UserBehaviorAnalytics;