const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

/**
 * 学生成绩记录种子数据
 */
module.exports = async () => {
  try {
    // 获取模型
    const PerformanceRecord = mongoose.model('PerformanceRecord');
    const User = mongoose.model('User');
    const Subject = mongoose.model('Subject');
    
    // 获取学生和教师用户
    const students = await User.find({ role: 'student' }).select('_id');
    const teachers = await User.find({ role: 'teacher' }).select('_id');
    
    // 获取科目
    const subjects = await Subject.find().select('_id');
    
    if (students.length === 0 || teachers.length === 0 || subjects.length === 0) {
      console.log('缺少必要的用户或科目数据，跳过创建成绩记录');
      return;
    }
    
    // 准备成绩记录数据
    const performanceRecords = [];
    
    // 为每个学生创建多个科目的成绩记录
    for (const student of students) {
      for (const subject of subjects) {
        // 创建期中考试记录
        performanceRecords.push({
          studentId: student._id,
          subjectId: subject._id,
          examDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
          examType: '期中考试',
          score: Math.floor(Math.random() * 30) + 70, // 70-99分
          totalScore: 100,
          rank: Math.floor(Math.random() * 30) + 1,
          classRank: Math.floor(Math.random() * 10) + 1,
          gradeRank: Math.floor(Math.random() * 50) + 1,
          comments: '期中考试表现良好，继续保持',
          strengths: ['计算能力强', '理解概念清晰'],
          weaknesses: ['应用题解答需要加强'],
          improvementSuggestions: ['多做应用题练习', '加强知识点复习'],
          recordedBy: teachers[0]._id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // 创建单元测试记录
        performanceRecords.push({
          studentId: student._id,
          subjectId: subject._id,
          examDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15天前
          examType: '单元测试',
          score: Math.floor(Math.random() * 20) + 80, // 80-99分
          totalScore: 100,
          rank: Math.floor(Math.random() * 30) + 1,
          classRank: Math.floor(Math.random() * 10) + 1,
          gradeRank: Math.floor(Math.random() * 50) + 1,
          comments: '单元测试表现优秀',
          strengths: ['知识点掌握牢固', '解题速度快'],
          weaknesses: ['个别难点题目需要加强'],
          improvementSuggestions: ['针对性练习难点题目'],
          recordedBy: teachers[0]._id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // 创建日常测验记录
        performanceRecords.push({
          studentId: student._id,
          subjectId: subject._id,
          examDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
          examType: '日常测验',
          score: Math.floor(Math.random() * 15) + 85, // 85-99分
          totalScore: 100,
          rank: Math.floor(Math.random() * 30) + 1,
          classRank: Math.floor(Math.random() * 10) + 1,
          gradeRank: Math.floor(Math.random() * 50) + 1,
          comments: '日常测验表现稳定',
          strengths: ['基础知识扎实'],
          weaknesses: ['需要提高解题速度'],
          improvementSuggestions: ['多做题提高速度', '加强时间管理'],
          recordedBy: teachers[0]._id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // 批量插入数据
    const existingCount = await PerformanceRecord.countDocuments();
    if (existingCount === 0) {
      await PerformanceRecord.insertMany(performanceRecords);
      console.log(`成功创建 ${performanceRecords.length} 条学生成绩记录`);
    } else {
      console.log('成绩记录数据已存在，跳过创建');
    }
  } catch (error) {
    console.error('创建成绩记录种子数据时出错：', error);
    throw error;
  }
};