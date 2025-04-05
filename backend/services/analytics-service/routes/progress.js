const express = require('express');
const router = express.Router();
const StudentPerformanceTrend = require('../models/StudentPerformanceTrend');
const winston = require('winston');

// 获取日志记录器实例
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

// 获取学生学习进度分析
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { subject, period = 'semester' } = req.query;
    
    // 根据时间段设置日期范围
    const endDate = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'semester':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
    }
    
    // 查询学生的学习进度数据
    const query = { student: studentId };
    
    if (subject) {
      query['subjectTrends.subject'] = subject;
    }
    
    const performanceTrend = await StudentPerformanceTrend.findOne(query)
      .populate('student', 'name grade class');
    
    if (!performanceTrend) {
      // 如果没有找到数据，返回模拟数据
      const subjects = subject ? [subject] : ['语文', '数学', '英语', '科学', '社会'];
      const progressData = {};
      
      for (const subj of subjects) {
        // 生成模拟的学习进度数据
        const scoreData = [];
        const dates = [];
        const now = new Date();
        
        // 根据时间段生成日期点
        for (let i = 0; i < (period === 'week' ? 7 : (period === 'month' ? 4 : 6)); i++) {
          const date = new Date();
          if (period === 'week') {
            date.setDate(now.getDate() - (6 - i));
          } else if (period === 'month') {
            date.setDate(now.getDate() - (28 - i * 7));
          } else {
            date.setMonth(now.getMonth() - (6 - i));
          }
          dates.push(date.toISOString().split('T')[0]);
        }
        
        // 生成模拟的分数数据
        let prevScore = Math.floor(Math.random() * 20) + 70;
        for (const date of dates) {
          // 分数在前一个基础上有小幅波动
          const change = Math.floor(Math.random() * 10) - 4; // -4到5的变化
          const score = Math.max(60, Math.min(100, prevScore + change));
          prevScore = score;
          
          scoreData.push({
            date,
            score,
            testType: ['日常测验', '单元测试', '月考'][Math.floor(Math.random() * 3)]
          });
        }
        
        // 计算进步率
        const firstScore = scoreData[0].score;
        const lastScore = scoreData[scoreData.length - 1].score;
        const improvementRate = ((lastScore - firstScore) / firstScore * 100).toFixed(2);
        
        // 确定趋势
        let trend;
        if (improvementRate > 5) {
          trend = '上升';
        } else if (improvementRate < -5) {
          trend = '下降';
        } else {
          trend = '稳定';
        }
        
        progressData[subj] = {
          scores: scoreData,
          averageScore: (scoreData.reduce((sum, item) => sum + item.score, 0) / scoreData.length).toFixed(2),
          trend,
          improvementRate: parseFloat(improvementRate),
          weakPoints: [
            `${subj}知识点1`,
            `${subj}知识点2`,
            `${subj}知识点3`
          ],
          strengths: [
            `${subj}优势1`,
            `${subj}优势2`
          ]
        };
      }
      
      return res.json({
        studentId,
        period,
        progressData
      });
    }
    
    // 处理真实数据
    const progressData = {};
    
    for (const subjectTrend of performanceTrend.subjectTrends) {
      if (subject && subjectTrend.subject !== subject) continue;
      
      // 过滤时间范围内的成绩
      const filteredScores = subjectTrend.scores.filter(score => {
        const scoreDate = new Date(score.date);
        return scoreDate >= startDate && scoreDate <= endDate;
      });
      
      progressData[subjectTrend.subject] = {
        scores: filteredScores,
        averageScore: subjectTrend.averageScore,
        trend: subjectTrend.trend,
        improvementRate: subjectTrend.improvementRate,
        weakPoints: subjectTrend.weakPoints,
        strengths: subjectTrend.strengths
      };
    }
    
    res.json({
      studentId,
      period,
      progressData
    });
  } catch (err) {
    logger.error('获取学生学习进度分析失败:', err);
    res.status(500).json({ message: '获取学生学习进度分析失败', error: err.message });
  }
});

// 获取班级学习进度对比
router.get('/class/:classId/comparison', async (req, res) => {
  try {
    const { classId } = req.params;
    const { subject, period = 'semester' } = req.query;
    
    if (!subject) {
      return res.status(400).json({ message: '学科参数不能为空' });
    }
    
    // 模拟班级学习进度对比数据
    const studentCount = Math.floor(Math.random() * 20) + 30; // 30-50名学生
    const classAverage = Math.floor(Math.random() * 15) + 75; // 75-90的平均分
    
    // 生成班级分数分布
    const scoreDistribution = {
      '90-100': Math.floor(Math.random() * 10) + 5,
      '80-89': Math.floor(Math.random() * 15) + 10,
      '70-79': Math.floor(Math.random() * 10) + 8,
      '60-69': Math.floor(Math.random() * 8) + 4,
      '0-59': Math.floor(Math.random() * 5) + 1
    };
    
    // 确保总数等于学生总数
    let totalStudents = Object.values(scoreDistribution).reduce((sum, count) => sum + count, 0);
    if (totalStudents !== studentCount) {
      // 调整最大的那个区间
      const maxRange = Object.entries(scoreDistribution).reduce((max, [range, count]) => 
        count > max.count ? {range, count} : max, {range: '', count: 0});
      scoreDistribution[maxRange.range] += (studentCount - totalStudents);
    }
    
    // 生成知识点掌握情况
    const knowledgePoints = [];
    for (let i = 1; i <= 5; i++) {
      knowledgePoints.push({
        name: `${subject}知识点${i}`,
        masteryRate: Math.floor(Math.random() * 30) + 70,
        difficulty: Math.floor(Math.random() * 5) + 1
      });
    }
    
    // 生成班级进步趋势
    const trendData = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(now.getMonth() - (5 - i));
      trendData.push({
        date: date.toISOString().split('T')[0],
        averageScore: Math.floor(Math.random() * 10) + 70 + i
      });
    }
    
    res.json({
      classId,
      subject,
      period,
      studentCount,
      classAverage,
      scoreDistribution,
      knowledgePoints,
      trendData,
      improvementRate: ((trendData[trendData.length - 1].averageScore - trendData[0].averageScore) / trendData[0].averageScore * 100).toFixed(2)
    });
  } catch (err) {
    logger.error('获取班级学习进度对比失败:', err);
    res.status(500).json({ message: '获取班级学习进度对比失败', error: err.message });
  }
});

module.exports = router;