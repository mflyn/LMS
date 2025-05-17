const mongoose = require('mongoose');

// 创建有效的ObjectId
const createObjectId = () => new mongoose.Types.ObjectId().toString();

// 创建测试数据
const mockData = {
  // 学生ID
  studentId: createObjectId(),
  // 教师ID
  teacherId: createObjectId(),
  // 班级ID
  classId: createObjectId(),
  
  // 学生性能趋势数据
  studentPerformanceTrends: [
    {
      student: createObjectId(),
      subject: '数学',
      performanceData: [
        {
          date: new Date('2023-01-01'),
          score: 85,
          assessmentType: 'quiz'
        },
        {
          date: new Date('2023-01-15'),
          score: 90,
          assessmentType: 'homework'
        },
        {
          date: new Date('2023-02-01'),
          score: 88,
          assessmentType: 'exam'
        }
      ]
    },
    {
      student: createObjectId(),
      subject: '语文',
      performanceData: [
        {
          date: new Date('2023-01-05'),
          score: 92,
          assessmentType: 'quiz'
        },
        {
          date: new Date('2023-01-20'),
          score: 88,
          assessmentType: 'homework'
        },
        {
          date: new Date('2023-02-05'),
          score: 95,
          assessmentType: 'exam'
        }
      ]
    }
  ],
  
  // 用户行为数据
  userBehaviors: [
    {
      user: createObjectId(),
      behaviorType: 'login',
      timestamp: new Date('2023-01-01T08:00:00Z'),
      details: {
        device: 'mobile',
        browser: 'Safari',
        os: 'iOS'
      }
    },
    {
      user: createObjectId(),
      behaviorType: 'resource_access',
      timestamp: new Date('2023-01-01T09:30:00Z'),
      details: {
        resourceId: createObjectId(),
        resourceType: 'video',
        duration: 300
      }
    }
  ],
  
  // 性能数据
  performanceData: [
    {
      requestId: 'req123',
      serviceName: 'user-service',
      method: 'GET',
      url: '/api/users',
      route: '/users',
      statusCode: 200,
      duration: 150,
      timestamp: new Date('2023-01-01T10:00:00Z'),
      slow: false,
      userAgent: 'Mozilla/5.0',
      userId: createObjectId(),
      userRole: 'student',
      memoryUsage: { rss: 50000000 },
      performanceLevel: 'good'
    },
    {
      requestId: 'req456',
      serviceName: 'resource-service',
      method: 'GET',
      url: '/api/resources/123',
      route: '/resources/:id',
      statusCode: 200,
      duration: 250,
      timestamp: new Date('2023-01-01T11:00:00Z'),
      slow: true,
      userAgent: 'Mozilla/5.0',
      userId: createObjectId(),
      userRole: 'teacher',
      memoryUsage: { rss: 70000000 },
      performanceLevel: 'medium'
    }
  ]
};

// 导出测试数据
module.exports = mockData;
