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

// 获取学生成绩趋势分析
router.get('/student/:studentId', async (req, res) => {
  // 获取Socket.IO实例
  const io = req.app.locals.io;
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
    
    // 查询学生的成绩趋势数据
    const query = { student: studentId };
    
    if (subject) {
      query['subjectTrends.subject'] = subject;
    }
    
    const performanceTrend = await StudentPerformanceTrend.findOne(query)
      .populate('student', 'name grade class');
    
    if (!performanceTrend) {
      // 如果没有找到数据，返回模拟数据
      const subjects = subject ? [subject] : ['语文', '数学', '英语', '科学', '社会'];
      const trendsData = {};
      
      for (const subj of subjects) {
        // 生成模拟的成绩趋势数据
        const scoreData = [];
        const testTypes = ['日常测验', '单元测试', '月考', '期中考试', '期末考试'];
        
        // 根据时间段生成不同的测试点
        let testCount;
        if (period === 'week') {
          testCount = 3; // 一周3次测试
        } else if (period === 'month') {
          testCount = 8; // 一个月8次测试
        } else if (period === 'semester') {
          testCount = 15; // 一学期15次测试
        } else {
          testCount = 25; // 一年25次测试
        }
        
        // 生成测试日期和分数
        let baseScore = Math.floor(Math.random() * 20) + 70; // 基础分数70-90
        for (let i = 0; i < testCount; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + Math.floor((endDate - startDate) / testCount * i));
          
          // 分数在基础分上有波动，但总体呈上升趋势
          const trend = Math.min(15, Math.floor(15 * i / testCount)); // 最多提升15分
          const fluctuation = Math.floor(Math.random() * 10) - 5; // -5到4的随机波动
          const score = Math.min(100, Math.max(60, baseScore + trend + fluctuation));
          
          scoreData.push({
            date: date.toISOString().split('T')[0],
            score,
            testType: testTypes[Math.floor(Math.random() * testTypes.length)]
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
        
        // 分析薄弱知识点
        const weakPoints = [
          `${subj}知识点1`,
          `${subj}知识点2`,
          `${subj}知识点3`
        ];
        
        // 分析优势知识点
        const strengths = [
          `${subj}优势1`,
          `${subj}优势2`
        ];
        
        trendsData[subj] = {
          scores: scoreData,
          averageScore: (scoreData.reduce((sum, item) => sum + item.score, 0) / scoreData.length).toFixed(2),
          trend,
          improvementRate: parseFloat(improvementRate),
          weakPoints,
          strengths
        };
      }
      
      return res.json({
        studentId,
        period,
        trendsData
      });
    }
    
    // 处理真实数据
    const trendsData = {};
    
    for (const subjectTrend of performanceTrend.subjectTrends) {
      if (subject && subjectTrend.subject !== subject) continue;
      
      // 过滤时间范围内的成绩
      const filteredScores = subjectTrend.scores.filter(score => {
        const scoreDate = new Date(score.date);
        return scoreDate >= startDate && scoreDate <= endDate;
      });
      
      trendsData[subjectTrend.subject] = {
        scores: filteredScores,
        averageScore: subjectTrend.averageScore,
        trend: subjectTrend.trend,
        improvementRate: subjectTrend.improvementRate,
        weakPoints: subjectTrend.weakPoints,
        strengths: subjectTrend.strengths
      };
    }
    
    const responseData = {
      studentId,
      period,
      trendsData
    };
    
    // 通过WebSocket发送实时数据更新
    if (io) {
      io.to(studentId).emit('student-trends-update', responseData);
    }
    
    res.json(responseData);
  } catch (err) {
    logger.error('获取学生成绩趋势分析失败:', err);
    res.status(500).json({ message: '获取学生成绩趋势分析失败', error: err.message });
  }
});

// 获取班级成绩趋势分析
router.get('/class/:classId', async (req, res) => {
  // 获取Socket.IO实例
  const io = req.app.locals.io;
  try {
    const { classId } = req.params;
    const { subject, period = 'semester' } = req.query;
    
    if (!subject) {
      return res.status(400).json({ message: '学科参数不能为空' });
    }
    
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
    
    // 模拟班级成绩趋势数据
    const testTypes = ['日常测验', '单元测试', '月考', '期中考试', '期末考试'];
    const trendData = [];
    
    // 根据时间段生成不同的测试点
    let testCount;
    if (period === 'week') {
      testCount = 3; // 一周3次测试
    } else if (period === 'month') {
      testCount = 8; // 一个月8次测试
    } else if (period === 'semester') {
      testCount = 15; // 一学期15次测试
    } else {
      testCount = 25; // 一年25次测试
    }
    
    // 生成测试日期和分数
    let baseScore = Math.floor(Math.random() * 10) + 75; // 基础平均分75-85
    for (let i = 0; i < testCount; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + Math.floor((endDate - startDate) / testCount * i));
      
      // 班级平均分在基础分上有波动，但总体呈上升趋势
      const trend = Math.min(10, Math.floor(10 * i / testCount)); // 最多提升10分
      const fluctuation = Math.floor(Math.random() * 6) - 3; // -3到2的随机波动
      const averageScore = Math.min(95, Math.max(70, baseScore + trend + fluctuation));
      
      // 生成分数分布
      const scoreDistribution = {
        '90-100': Math.floor(Math.random() * 10) + 5,
        '80-89': Math.floor(Math.random() * 15) + 10,
        '70-79': Math.floor(Math.random() * 10) + 8,
        '60-69': Math.floor(Math.random() * 8) + 4,
        '0-59': Math.floor(Math.random() * 5) + 1
      };
      
      trendData.push({
        date: date.toISOString().split('T')[0],
        testType: testTypes[Math.floor(Math.random() * testTypes.length)],
        averageScore,
        scoreDistribution,
        passRate: Math.floor(Math.random() * 15) + 85 // 85%-100%的及格率
      });
    }
    
    // 计算进步率
    const firstScore = trendData[0].averageScore;
    const lastScore = trendData[trendData.length - 1].averageScore;
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
    
    // 分析薄弱知识点
    const weakPoints = [
      `${subject}知识点1`,
      `${subject}知识点2`,
      `${subject}知识点3`
    ];
    
    const responseData = {
      classId,
      subject,
      period,
      trendData,
      averageScore: (trendData.reduce((sum, item) => sum + item.averageScore, 0) / trendData.length).toFixed(2),
      trend,
      improvementRate: parseFloat(improvementRate),
      weakPoints
    };
    
    // 通过WebSocket发送实时数据更新
    if (io) {
      io.to(classId).emit('class-trends-update', responseData);
    }
    
    res.json(responseData);
  } catch (err) {
    logger.error('获取班级成绩趋势分析失败:', err);
    res.status(500).json({ message: '获取班级成绩趋势分析失败', error: err.message });
  }
});

module.exports = router;