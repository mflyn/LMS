/**
 * 添加缺少的数据库集合
 * 创建设计文档中提到但尚未在初始化脚本中创建的集合和索引
 */

const { MongoClient } = require('mongodb');
const config = require('../config/db');

module.exports = async function() {
  console.log('运行迁移脚本: 002_add_missing_collections.js');
  
  const client = new MongoClient(config.mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  
  try {
    await client.connect();
    console.log('已连接到MongoDB');
    
    const db = client.db();
    
    // 创建成绩记录集合
    await db.createCollection('grades');
    await db.collection('grades').createIndex({ studentId: 1 });
    await db.collection('grades').createIndex({ subjectId: 1 });
    await db.collection('grades').createIndex({ examDate: 1 });
    
    // 创建错题记录集合
    await db.createCollection('mistake_records');
    await db.collection('mistake_records').createIndex({ studentId: 1 });
    await db.collection('mistake_records').createIndex({ knowledgePoint: 1 });
    
    // 创建学生表现趋势集合
    await db.createCollection('student_performance_trends');
    await db.collection('student_performance_trends').createIndex({ studentId: 1 });
    
    // 创建班级表现集合
    await db.createCollection('class_performances');
    await db.collection('class_performances').createIndex({ classId: 1 });
    
    // 创建用户行为集合
    await db.createCollection('user_behaviors');
    await db.collection('user_behaviors').createIndex({ userId: 1 });
    await db.collection('user_behaviors').createIndex({ actionType: 1 });
    await db.collection('user_behaviors').createIndex({ timestamp: -1 });
    
    // 创建性能数据集合
    await db.createCollection('performance_data');
    await db.collection('performance_data').createIndex({ serviceName: 1, timestamp: -1 });
    await db.collection('performance_data').createIndex({ duration: -1 });
    
    // 创建资源评论集合
    await db.createCollection('resource_reviews');
    await db.collection('resource_reviews').createIndex({ resourceId: 1 });
    
    // 创建资源集合集合
    await db.createCollection('resource_collections');
    await db.collection('resource_collections').createIndex({ creatorId: 1 });
    
    console.log('缺少的数据库集合创建完成');
    
  } catch (err) {
    console.error('数据库迁移失败:', err);
    throw err;
  } finally {
    await client.close();
    console.log('MongoDB连接已关闭');
  }
};