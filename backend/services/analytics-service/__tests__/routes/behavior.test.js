const request = require('supertest');
const express = require('express');
// 使用绝对路径导入
const behaviorRouter = require('../../../../services/analytics-service/routes/behavior');

// 确保在测试前清除所有模块缓存
beforeEach(() => {
  jest.resetModules();
});

// Mock winston logger
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  };
  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
      align: jest.fn(),
      simple: jest.fn()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    addColors: jest.fn()
  };
});

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/analytics/behavior', behaviorRouter);

describe('Behavior Routes', () => {
  // Test for GET /student/:studentId
  describe('GET /student/:studentId', () => {
    it('should return 401 if user is not authenticated', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/student/123');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('未认证');
    });

    it('should return 403 if student tries to access another student\'s data', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/student/456')
        .set('x-user-id', '123')
        .set('x-user-role', 'student');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('权限不足');
    });

    it('should return behavior analysis for student accessing their own data', async () => {
      const studentId = '123';
      const response = await request(app)
        .get(`/api/analytics/behavior/student/${studentId}`)
        .set('x-user-id', studentId)
        .set('x-user-role', 'student');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timeDistribution');
      expect(response.body).toHaveProperty('focusData');
      expect(response.body).toHaveProperty('studyHabits');
      expect(response.body).toHaveProperty('behaviorSuggestions');
    });

    it('should return behavior analysis for teacher accessing student data', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/student/123')
        .set('x-user-id', 'teacher1')
        .set('x-user-role', 'teacher');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timeDistribution');
      expect(response.body).toHaveProperty('focusData');
      expect(response.body).toHaveProperty('studyHabits');
    });

    it('should handle different period parameters', async () => {
      const periods = ['week', 'month', 'semester'];

      for (const period of periods) {
        const response = await request(app)
          .get(`/api/analytics/behavior/student/123?period=${period}`)
          .set('x-user-id', 'teacher1')
          .set('x-user-role', 'teacher');

        expect(response.status).toBe(200);
        expect(response.body.period).toBe(period);
      }
    });

    it('should handle server errors', async () => {
      // Mock Math.random to throw an error
      const originalRandom = Math.random;
      Math.random = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/api/analytics/behavior/student/123')
        .set('x-user-id', 'teacher1')
        .set('x-user-role', 'teacher');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('获取学生学习行为分析失败');

      // Restore Math.random
      Math.random = originalRandom;
    });
  });

  // Test for GET /class/:classId/overall
  describe('GET /class/:classId/overall', () => {
    it('should return 401 if user is not authenticated', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/class/123/overall');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('未认证');
    });

    it('should return 403 if non-teacher/admin tries to access class data', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/class/123/overall')
        .set('x-user-id', '123')
        .set('x-user-role', 'student');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('权限不足');
    });

    it('should return class analysis for teacher', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/class/123/overall')
        .set('x-user-id', 'teacher1')
        .set('x-user-role', 'teacher');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('scoreDistribution');
      expect(response.body).toHaveProperty('knowledgePointsMastery');
      expect(response.body).toHaveProperty('participationRate');
      expect(response.body).toHaveProperty('classImprovement');
    });

    it('should handle different period parameters', async () => {
      const periods = ['week', 'month', 'semester'];

      for (const period of periods) {
        const response = await request(app)
          .get(`/api/analytics/behavior/class/123/overall?period=${period}`)
          .set('x-user-id', 'admin1')
          .set('x-user-role', 'admin');

        expect(response.status).toBe(200);
        expect(response.body.period).toBe(period);
      }
    });

    it('should handle server errors', async () => {
      // Mock Math.random to throw an error
      const originalRandom = Math.random;
      Math.random = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/api/analytics/behavior/class/123/overall')
        .set('x-user-id', 'teacher1')
        .set('x-user-role', 'teacher');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('获取班级整体表现分析失败');

      // Restore Math.random
      Math.random = originalRandom;
    });
  });

  // Test for GET /student/:studentId/comparison
  describe('GET /student/:studentId/comparison', () => {
    it('should return 401 if user is not authenticated', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/student/123/comparison');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('未认证');
    });

    it('should return 403 if student tries to access another student\'s data', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/student/456/comparison')
        .set('x-user-id', '123')
        .set('x-user-role', 'student');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('权限不足');
    });

    it('should return 400 if classId is missing', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/student/123/comparison')
        .set('x-user-id', '123')
        .set('x-user-role', 'student');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('班级ID不能为空');
    });

    it('should return comparison data for student accessing their own data', async () => {
      const studentId = '123';
      const response = await request(app)
        .get(`/api/analytics/behavior/student/${studentId}/comparison?classId=class1`)
        .set('x-user-id', studentId)
        .set('x-user-role', 'student');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rankData');
      expect(response.body).toHaveProperty('gapAnalysis');
      expect(response.body).toHaveProperty('personalizedSuggestions');
    });

    it('should return comparison data for specific subject', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/student/123/comparison?classId=class1&subject=math')
        .set('x-user-id', 'teacher1')
        .set('x-user-role', 'teacher');

      expect(response.status).toBe(200);
      expect(response.body.rankData).toHaveProperty('math');
      expect(response.body.gapAnalysis.length).toBe(1);
      expect(response.body.gapAnalysis[0].subject).toBe('math');
    });

    it('should return comparison data for all subjects when no subject specified', async () => {
      const response = await request(app)
        .get('/api/analytics/behavior/student/123/comparison?classId=class1')
        .set('x-user-id', 'teacher1')
        .set('x-user-role', 'teacher');

      expect(response.status).toBe(200);
      expect(Object.keys(response.body.rankData).length).toBeGreaterThan(1);
      expect(response.body.gapAnalysis.length).toBeGreaterThan(1);
    });

    it('should handle server errors', async () => {
      // Mock Math.random to throw an error
      const originalRandom = Math.random;
      Math.random = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/api/analytics/behavior/student/123/comparison?classId=class1')
        .set('x-user-id', 'teacher1')
        .set('x-user-role', 'teacher');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('获取学生学习进度比较失败');

      // Restore Math.random
      Math.random = originalRandom;
    });
  });
});
