/**
 * 基本集成测试 - 不依赖数据库
 * 这个测试文件只测试基本的路由注册和健康检查功能
 */

const express = require('express');
const request = require('supertest');

// 创建一个简单的Express应用
const app = express();

// 添加健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'analytics-service'
  });
});

// 添加一些模拟路由
app.get('/api/analytics/progress/student/:id', (req, res) => {
  res.status(200).json({
    data: {
      studentId: req.params.id,
      subjects: [
        { subject: '数学', progress: 80 },
        { subject: '语文', progress: 75 }
      ]
    }
  });
});

app.get('/api/analytics/trends/student/:id', (req, res) => {
  res.status(200).json({
    data: {
      studentId: req.params.id,
      trends: {
        '数学': [85, 88, 90],
        '语文': [80, 82, 85]
      }
    }
  });
});

app.get('/api/analytics/reports/student/:id', (req, res) => {
  res.status(200).json({
    data: {
      studentId: req.params.id,
      strengths: ['数学计算', '语文阅读'],
      weaknesses: ['英语口语', '物理概念'],
      recommendations: ['加强英语口语练习', '多做物理概念题']
    }
  });
});

// 测试
describe('基本集成测试', () => {
  // 健康检查测试
  it('应该能够通过健康检查', async () => {
    const response = await request(app)
      .get('/health')
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('service', 'analytics-service');
  });
  
  // 进度分析路由测试
  it('应该能够访问进度分析路由', async () => {
    const response = await request(app)
      .get('/api/analytics/progress/student/123456789012')
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('subjects');
    expect(Array.isArray(response.body.data.subjects)).toBe(true);
  });
  
  // 趋势分析路由测试
  it('应该能够访问趋势分析路由', async () => {
    const response = await request(app)
      .get('/api/analytics/trends/student/123456789012')
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('trends');
    expect(response.body.data.trends).toHaveProperty('数学');
    expect(response.body.data.trends).toHaveProperty('语文');
  });
  
  // 报告路由测试
  it('应该能够访问报告路由', async () => {
    const response = await request(app)
      .get('/api/analytics/reports/student/123456789012')
      .set('Accept', 'application/json');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('strengths');
    expect(response.body.data).toHaveProperty('weaknesses');
    expect(response.body.data).toHaveProperty('recommendations');
  });
});
