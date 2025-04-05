/**
 * 测试工具函数集合
 * 提供常用的测试辅助函数
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

/**
 * 数据库测试助手
 * 使用内存数据库进行测试，避免影响实际数据库
 */
class DbTestHelper {
  constructor() {
    this.mongoServer = null;
    this.mongoUri = null;
  }

  /**
   * 连接到测试数据库
   */
  async connect() {
    this.mongoServer = await MongoMemoryServer.create();
    this.mongoUri = this.mongoServer.getUri();

    await mongoose.connect(this.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }

  /**
   * 断开测试数据库连接
   */
  async disconnect() {
    await mongoose.disconnect();
    await this.mongoServer.stop();
  }

  /**
   * 清空所有集合
   */
  async clearDatabase() {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
}

/**
 * 请求测试助手
 * 简化API测试流程
 */
class RequestTestHelper {
  constructor(app) {
    this.app = app;
    this.agent = request(app);
    this.authToken = null;
  }

  /**
   * 设置认证令牌
   * @param {string} token JWT令牌
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * 发送GET请求
   * @param {string} url 请求URL
   * @param {Object} query 查询参数
   * @returns {Promise} 请求Promise
   */
  async get(url, query = {}) {
    const req = this.agent.get(url).query(query);
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }
    return req;
  }

  /**
   * 发送POST请求
   * @param {string} url 请求URL
   * @param {Object} data 请求体数据
   * @returns {Promise} 请求Promise
   */
  async post(url, data = {}) {
    const req = this.agent.post(url).send(data);
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }
    return req;
  }

  /**
   * 发送PUT请求
   * @param {string} url 请求URL
   * @param {Object} data 请求体数据
   * @returns {Promise} 请求Promise
   */
  async put(url, data = {}) {
    const req = this.agent.put(url).send(data);
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }
    return req;
  }

  /**
   * 发送DELETE请求
   * @param {string} url 请求URL
   * @returns {Promise} 请求Promise
   */
  async delete(url) {
    const req = this.agent.delete(url);
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }
    return req;
  }

  /**
   * 模拟用户登录
   * @param {string} username 用户名
   * @param {string} password 密码
   * @returns {Promise} 登录响应
   */
  async login(username, password) {
    const response = await this.post('/api/auth/login', { username, password });
    if (response.status === 200 && response.body.token) {
      this.setAuthToken(response.body.token);
    }
    return response;
  }
}

/**
 * 生成测试数据助手
 */
class TestDataGenerator {
  /**
   * 生成随机字符串
   * @param {number} length 字符串长度
   * @returns {string} 随机字符串
   */
  static generateRandomString(length = 10) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * 生成测试用户数据
   * @returns {Object} 用户数据
   */
  static generateUserData() {
    const username = `test_${this.generateRandomString(5)}`;
    return {
      username,
      password: 'Test@123',
      email: `${username}@example.com`,
      name: `Test User ${username}`,
      role: 'teacher'
    };
  }

  /**
   * 生成测试学生数据
   * @returns {Object} 学生数据
   */
  static generateStudentData() {
    const studentId = `S${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    return {
      studentId,
      name: `学生${studentId}`,
      grade: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'][Math.floor(Math.random() * 6)],
      class: `${Math.floor(Math.random() * 10) + 1}班`,
      gender: Math.random() > 0.5 ? '男' : '女',
      birthDate: new Date(2010 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
    };
  }

  /**
   * 生成测试资源数据
   * @returns {Object} 资源数据
   */
  static generateResourceData() {
    const subjects = ['语文', '数学', '英语', '科学', '社会', '音乐', '美术', '体育'];
    const types = ['教案', '课件', '习题', '视频', '音频', '图片', '文档'];
    
    return {
      title: `测试资源${this.generateRandomString(5)}`,
      description: '这是一个用于测试的学习资源',
      subject: subjects[Math.floor(Math.random() * subjects.length)],
      grade: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'][Math.floor(Math.random() * 6)],
      type: types[Math.floor(Math.random() * types.length)],
      file: {
        name: `test_file_${this.generateRandomString(5)}.pdf`,
        type: 'application/pdf',
        size: Math.floor(Math.random() * 1000000) + 100000
      }
    };
  }
}

module.exports = {
  DbTestHelper,
  RequestTestHelper,
  TestDataGenerator
};