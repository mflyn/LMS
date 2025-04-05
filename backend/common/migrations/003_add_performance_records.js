/**
 * 添加学生成绩记录表和相关索引
 * 用于存储学生的学习成绩和表现数据
 */

const { MongoClient } = require('mongodb');
const config = require('../config/db');

module.exports = async function() {
  console.log('运行迁移脚本: 003_add_performance_records.js');
  
  const client = new MongoClient(config.mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  
  try {
    await client.connect();
    console.log('已连接到MongoDB');
    
    const db = client.db();
    
    // 创建学生成绩记录集合
    await db.createCollection('performance_records');
    
    // 创建索引以提高查询效率
    await db.collection('performance_records').createIndex({ studentId: 1 });
    await db.collection('performance_records').createIndex({ subjectId: 1 });
    await db.collection('performance_records').createIndex({ examDate: -1 });
    await db.collection('performance_records').createIndex({ studentId: 1, subjectId: 1, examDate: -1 });
    
    // 创建学生能力评估集合
    await db.createCollection('student_abilities');
    await db.collection('student_abilities').createIndex({ studentId: 1 });
    
    // 创建学习分析报告集合
    await db.createCollection('learning_analytics');
    await db.collection('learning_analytics').createIndex({ studentId: 1 });
    await db.collection('learning_analytics').createIndex({ generatedDate: -1 });
    
    console.log('学生成绩记录相关集合和索引创建完成');
    
  } catch (err) {
    console.error('数据库迁移失败:', err);
    throw err;
  } finally {
    await client.close();
    console.log('MongoDB连接已关闭');
  }
};