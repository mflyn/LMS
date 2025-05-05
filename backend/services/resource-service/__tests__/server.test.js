const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

describe('Resource Service 服务器测试', () => {
  // 测试健康检查端点
  describe('基本路由测试', () => {
    it('应该正确挂载资源路由', async () => {
      const response = await request(app).get('/api/resources');
      
      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });
    
    it('应该正确挂载推荐路由', async () => {
      const response = await request(app).get('/api/recommendations');
      
      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });
    
    it('应该能够访问静态文件目录', async () => {
      // 创建测试文件
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const testFilePath = path.join(uploadDir, 'test.txt');
      fs.writeFileSync(testFilePath, 'test content');
      
      const response = await request(app).get('/uploads/test.txt');
      
      expect(response.status).toBe(200);
      expect(response.text).toBe('test content');
      
      // 清理测试文件
      fs.unlinkSync(testFilePath);
    });
  });
  
  // 测试文件上传配置
  describe('文件上传配置', () => {
    it('应该限制文件大小', async () => {
      // 创建一个超过大小限制的文件
      const largeFilePath = path.join(__dirname, 'large.txt');
      const largeContent = Buffer.alloc(51 * 1024 * 1024); // 51MB
      fs.writeFileSync(largeFilePath, largeContent);
      
      const response = await request(app)
        .post('/api/resources')
        .attach('file', largeFilePath)
        .field('title', '测试资源')
        .field('subject', '数学')
        .field('grade', '三年级')
        .field('type', '习题')
        .field('uploaderId', new mongoose.Types.ObjectId().toString());
      
      expect(response.status).toBe(500); // 文件太大会导致错误
      
      // 清理测试文件
      fs.unlinkSync(largeFilePath);
    });
    
    it('应该验证文件类型', async () => {
      // 创建一个不支持的文件类型
      const invalidFilePath = path.join(__dirname, 'test.exe');
      fs.writeFileSync(invalidFilePath, 'test content');
      
      const response = await request(app)
        .post('/api/resources')
        .attach('file', invalidFilePath)
        .field('title', '测试资源')
        .field('subject', '数学')
        .field('grade', '三年级')
        .field('type', '习题')
        .field('uploaderId', new mongoose.Types.ObjectId().toString());
      
      expect(response.status).toBe(500); // 不支持的文件类型会导致错误
      
      // 清理测试文件
      fs.unlinkSync(invalidFilePath);
    });
  });
  
  // 测试错误处理
  describe('错误处理', () => {
    it('应该处理不存在的路由', async () => {
      const response = await request(app).get('/non-existent-route');
      
      expect(response.status).toBe(404);
    });
    
    it('应该处理无效的请求', async () => {
      const response = await request(app)
        .post('/api/resources')
        .send({ invalid: 'data' });
      
      expect(response.status).toBe(400);
    });
  });
});
