const Progress = require('../../models/Progress');
const mongoose = require('mongoose');

module.exports = async () => {
  try {
    // 创建ObjectId实例用于关联
    const studentId1 = mongoose.Types.ObjectId();
    const studentId2 = mongoose.Types.ObjectId();
    const studentId3 = mongoose.Types.ObjectId();
    const subjectChineseId = mongoose.Types.ObjectId();
    const subjectMathId = mongoose.Types.ObjectId();
    const subjectEnglishId = mongoose.Types.ObjectId();
    const teacherId = mongoose.Types.ObjectId();
    
    const progressRecords = [
      {
        student: studentId1,
        subject: subjectChineseId,
        chapter: '第一章',
        section: '1.1 拼音',
        completionRate: 100,
        status: 'completed',
        comments: '掌握良好',
        createdAt: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(new Date().getTime() - 25 * 24 * 60 * 60 * 1000),
        createdBy: teacherId,
        updatedBy: teacherId
      },
      {
        student: studentId1,
        subject: subjectChineseId,
        chapter: '第一章',
        section: '1.2 汉字基础',
        completionRate: 85,
        status: 'in_progress',
        comments: '需要加强练习',
        createdAt: new Date(new Date().getTime() - 20 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(new Date().getTime() - 15 * 24 * 60 * 60 * 1000),
        createdBy: teacherId,
        updatedBy: teacherId
      },
      {
        student: studentId1,
        subject: subjectMathId,
        chapter: '第一章',
        section: '1.1 数字1-10',
        completionRate: 100,
        status: 'completed',
        comments: '掌握良好',
        createdAt: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(new Date().getTime() - 28 * 24 * 60 * 60 * 1000),
        createdBy: teacherId,
        updatedBy: teacherId
      },
      {
        student: studentId2,
        subject: subjectChineseId,
        chapter: '第一章',
        section: '1.1 拼音',
        completionRate: 90,
        status: 'completed',
        comments: '整体良好，声调需加强',
        createdAt: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(new Date().getTime() - 25 * 24 * 60 * 60 * 1000),
        createdBy: teacherId,
        updatedBy: teacherId
      },
      {
        student: studentId2,
        subject: subjectMathId,
        chapter: '第一章',
        section: '1.1 数字1-10',
        completionRate: 80,
        status: 'in_progress',
        comments: '需要加强练习',
        createdAt: new Date(new Date().getTime() - 25 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(new Date().getTime() - 20 * 24 * 60 * 60 * 1000),
        createdBy: teacherId,
        updatedBy: teacherId
      },
      {
        student: studentId3,
        subject: subjectEnglishId,
        chapter: '第一章',
        section: '1.1 字母A-M',
        completionRate: 75,
        status: 'in_progress',
        comments: '发音需要加强',
        createdAt: new Date(new Date().getTime() - 15 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(new Date().getTime() - 10 * 24 * 60 * 60 * 1000),
        createdBy: teacherId,
        updatedBy: teacherId
      },
      {
        student: studentId3,
        subject: subjectMathId,
        chapter: '第二章',
        section: '2.1 简单加法',
        completionRate: 60,
        status: 'in_progress',
        comments: '需要更多练习',
        createdAt: new Date(new Date().getTime() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000),
        createdBy: teacherId,
        updatedBy: teacherId
      }
    ];

    for (const progress of progressRecords) {
      const existingProgress = await Progress.findOne({ 
        student: progress.student,
        subject: progress.subject,
        chapter: progress.chapter,
        section: progress.section
      });
      if (!existingProgress) {
        await Progress.create(progress);
        console.log(`学习进度 ${progress.chapter}-${progress.section} 创建成功`);
      } else {
        console.log(`学习进度 ${progress.chapter}-${progress.section} 已存在，跳过创建`);
      }
    }
  } catch (error) {
    console.error('创建学习进度数据时出错：', error);
    throw error;
  }
};