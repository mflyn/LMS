/**
 * 性能记录相关种子数据索引文件
 * 用于统一导出所有性能记录相关的种子数据函数
 */

const performanceRecords = require('./performance_records');
const studentAbilities = require('./student_abilities');
const learningAnalytics = require('./learning_analytics');

module.exports = async () => {
  console.log('开始创建性能记录相关种子数据...');
  
  try {
    // 按顺序执行各种子数据创建函数
    await performanceRecords();
    await studentAbilities();
    await learningAnalytics();
    
    console.log('性能记录相关种子数据创建完成');
  } catch (error) {
    console.error('创建性能记录相关种子数据时出错：', error);
    throw error;
  }
};