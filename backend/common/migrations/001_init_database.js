/**
 * 初始化数据库结构
 * 创建必要的集合和索引
 */

const { MongoClient } = require('mongodb');
const config = require('../config/db');

module.exports = async function() {
  console.log('运行迁移脚本: 001_init_database.js');
  
  const client = new MongoClient(config.mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  
  try {
    await client.connect();
    console.log('已连接到MongoDB');
    
    const db = client.db();
    
    // 创建用户集合和索引
    await db.createCollection('users');
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    // 创建学生集合和索引
    await db.createCollection('students');
    await db.collection('students').createIndex({ studentId: 1 }, { unique: true });
    
    // 创建教师集合和索引
    await db.createCollection('teachers');
    await db.collection('teachers').createIndex({ teacherId: 1 }, { unique: true });
    
    // 创建家长集合和索引
    await db.createCollection('parents');
    await db.collection('parents').createIndex({ parentId: 1 }, { unique: true });
    
    // 创建班级集合
    await db.createCollection('classes');
    
    // 创建课程集合
    await db.createCollection('subjects');
    
    // 创建作业集合
    await db.createCollection('homework');
    
    // 创建作业提交集合
    await db.createCollection('homework_submissions');
    await db.collection('homework_submissions').createIndex({ homeworkId: 1, studentId: 1 }, { unique: true });
    
    // 创建学习进度集合
    await db.createCollection('progress');
    await db.collection('progress').createIndex({ studentId: 1, subjectId: 1 });
    
    // 创建学习资源集合
    await db.createCollection('resources');
    
    // 创建通知集合
    await db.createCollection('notifications');
    await db.collection('notifications').createIndex({ userId: 1 });
    
    // 创建消息集合
    await db.createCollection('messages');
    await db.collection('messages').createIndex({ senderId: 1 });
    await db.collection('messages').createIndex({ receiverId: 1 });
    
    // 创建会议集合
    await db.createCollection('meetings');
    
    // 创建公告集合
    await db.createCollection('announcements');
    
    console.log('数据库结构初始化完成');
    
  } catch (err) {
    console.error('数据库迁移失败:', err);
    throw err;
  } finally {
    await client.close();
    console.log('MongoDB连接已关闭');
  }
};