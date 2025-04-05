const express = require('express');
const router = express.Router();
const StudentPerformanceTrend = require('../models/StudentPerformanceTrend');
const MistakeRecord = require('../models/MistakeRecord');
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

// 生成学生个性化学习报告
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { period = 'semester' } = req.query;
    
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
    
    // 查询学生的学习表现数据
    const performanceTrend = await StudentPerformanceTrend.findOne({ student: studentId })
      .populate('student', 'name grade class');
    
    // 查询学生的错题记录
    const mistakeRecords = await MistakeRecord.find({
      student: studentId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 });
    
    // 如果没有找到数据，生成模拟数据
    if (!performanceTrend) {
      // 生成模拟的学习报告数据
      const subjects = ['语文', '数学', '英语', '科学', '社会'];
      const subjectPerformance = {};
      
      for (const subject of subjects) {
        // 生成模拟的成绩数据
        const scores = [];
        let baseScore = Math.floor(Math.random() * 20) + 70; // 基础分数70-90
        
        for (let i = 0; i < 6; i++) {
          const date = new Date(startDate);
          date.setMonth(startDate.getMonth() + i);
          
          // 分数在基础分上有波动，但总体呈上升趋势
          const trend = Math.min(15, Math.floor(15 * i / 5)); // 最多提升15分
          const fluctuation = Math.floor(Math.random() * 10) - 5; // -5到4的随机波动
          const score = Math.min(100, Math.max(60, baseScore + trend + fluctuation));
          
          scores.push({
            date: date.toISOString().split('T')[0],
            score,
            testType: ['日常测验', '单元测试', '月考', '期中考试', '期末考试'][Math.floor(Math.random() * 5)]
          });
        }
        
        // 计算进步率
        const firstScore = scores[0].score;
        const lastScore = scores[scores.length - 1].score;
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
        
        // 生成知识点掌握情况
        const knowledgePoints = [];
        for (let i = 1; i <= 5; i++) {
          knowledgePoints.push({
            name: `${subject}知识点${i}`,
            masteryRate: Math.floor(Math.random() * 30) + 70,
            importance: Math.floor(Math.random() * 5) + 1
          });
        }
        
        // 生成学习习惯评估
        const studyHabits = {
          homeworkCompletion: Math.floor(Math.random() * 20) + 80,
          classParticipation: Math.floor(Math.random() * 30) + 70,
          reviewFrequency: Math.floor(Math.random() * 5) + 1,
          noteQuality: Math.floor(Math.random() * 3) + 3
        };
        
        // 生成改进建议
        const improvementSuggestions = [
          `加强${subject}基础知识的巩固`,
          `增加${subject}练习的频率`,
          `提高${subject}学习的专注度`,
          `建立良好的${subject}学习习惯`,
          `多参与${subject}课堂讨论`
        ];
        
        subjectPerformance[subject] = {
          scores,
          averageScore: (scores.reduce((sum, item) => sum + item.score, 0) / scores.length).toFixed(2),
          trend,
          improvementRate: parseFloat(improvementRate),
          knowledgePoints,
          studyHabits,
          improvementSuggestions: improvementSuggestions.slice(0, 3)
        };
      }
      
      // 生成错题分析
      const mistakeAnalysis = {
        totalMistakes: Math.floor(Math.random() * 50) + 20,
        categories: {
          '概念理解': Math.floor(Math.random() * 15) + 5,
          '计算错误': Math.floor(Math.random() * 10) + 5,
          '审题不清': Math.floor(Math.random() * 8) + 3,
          '知识遗忘': Math.floor(Math.random() * 12) + 4,
          '方法不当': Math.floor(Math.random() * 7) + 2,
          '粗心大意': Math.floor(Math.random() * 20) + 10
        },
        subjectDistribution: {}
      };
      
      for (const subject of subjects) {
        mistakeAnalysis.subjectDistribution[subject] = Math.floor(Math.random() * 15) + 5;
      }
      
      // 生成学习时间分析
      const timeAnalysis = {
        totalHours: Math.floor(Math.random() * 100) + 100,
        distribution: {
          '语文': Math.floor(Math.random() * 20) + 15,
          '数学': Math.floor(Math.random() * 25) + 20,
          '英语': Math.floor(Math.random() * 20) + 15,
          '科学': Math.floor(Math.random() * 15) + 10,
          '社会': Math.floor(Math.random() * 10) + 5,
          '其他': Math.floor(Math.random() * 15) + 10
        },
        efficiency: Math.floor(Math.random() * 20) + 70
      };
      
      // 生成综合评价
      const overallEvaluation = {
        strengths: [
          '学习态度认真',
          '善于思考问题',
          '课堂参与度高'
        ],
        weaknesses: [
          '学习计划执行不够严格',
          '部分知识点掌握不牢固',
          '做题时有时粗心大意'
        ],
        overallRating: Math.floor(Math.random() * 2) + 4, // 4-5分
        teacherComments: '该学生学习态度端正，有较强的学习能力，但需要加强基础知识的巩固和提高学习效率。建议增加练习量，培养良好的学习习惯。'
      };
      
      return res.json({
        studentId,
        period,
        reportDate: new Date().toISOString().split('T')[0],
        subjectPerformance,
        mistakeAnalysis,
        timeAnalysis,
        overallEvaluation
      });
    }
    
    // 处理真实数据
    const subjectPerformance = {};
    
    for (const subjectTrend of performanceTrend.subjectTrends) {
      // 过滤时间范围内的成绩
      const filteredScores = subjectTrend.scores.filter(score => {
        const scoreDate = new Date(score.date);
        return scoreDate >= startDate && scoreDate <= endDate;
      });
      
      subjectPerformance[subjectTrend.subject] = {
        scores: filteredScores,
        averageScore: subjectTrend.averageScore,
        trend: subjectTrend.trend,
        improvementRate: subjectTrend.improvementRate,
        knowledgePoints: subjectTrend.knowledgePoints,
        studyHabits: subjectTrend.studyHabits || {
          homeworkCompletion: Math.floor(Math.random() * 20) + 80,
          classParticipation: Math.floor(Math.random() * 30) + 70,
          reviewFrequency: Math.floor(Math.random() * 5) + 1,
          noteQuality: Math.floor(Math.random() * 3) + 3
        },
        improvementSuggestions: subjectTrend.improvementSuggestions || [
          `加强${subjectTrend.subject}基础知识的巩固`,
          `增加${subjectTrend.subject}练习的频率`,
          `提高${subjectTrend.subject}学习的专注度`
        ]
      };
    }
    
    // 处理错题分析
    const mistakeCategories = {};
    const mistakeSubjects = {};
    
    for (const mistake of mistakeRecords) {
      // 统计错题类别
      if (mistakeCategories[mistake.category]) {
        mistakeCategories[mistake.category]++;
      } else {
        mistakeCategories[mistake.category] = 1;
      }
      
      // 统计错题学科分布
      if (mistakeSubjects[mistake.subject]) {
        mistakeSubjects[mistake.subject]++;
      } else {
        mistakeSubjects[mistake.subject] = 1;
      }
    }
    
    const mistakeAnalysis = {
      totalMistakes: mistakeRecords.length,
      categories: mistakeCategories,
      subjectDistribution: mistakeSubjects
    };
    
    // 生成学习时间分析（模拟数据）
    const timeAnalysis = {
      totalHours: Math.floor(Math.random() * 100) + 100,
      distribution: {
        '语文': Math.floor(Math.random() * 20) + 15,
        '数学': Math.floor(Math.random() * 25) + 20,
        '英语': Math.floor(Math.random() * 20) + 15,
        '科学': Math.floor(Math.random() * 15) + 10,
        '社会': Math.floor(Math.random() * 10) + 5,
        '其他': Math.floor(Math.random() * 15) + 10
      },
      efficiency: Math.floor(Math.random() * 20) + 70
    };
    
    // 生成综合评价
    const overallEvaluation = {
      strengths: [
        '学习态度认真',
        '善于思考问题',
        '课堂参与度高'
      ],
      weaknesses: [
        '学习计划执行不够严格',
        '部分知识点掌握不牢固',
        '做题时有时粗心大意'
      ],
      overallRating: Math.floor(Math.random() * 2) + 4, // 4-5分
      teacherComments: '该学生学习态度端正，有较强的学习能力，但需要加强基础知识的巩固和提高学习效率。建议增加练习量，培养良好的学习习惯。'
    };
    
    res.json({
      studentId,
      studentName: performanceTrend.student ? performanceTrend.student.name : '未知',
      period,
      reportDate: new Date().toISOString().split('T')[0],
      subjectPerformance,
      mistakeAnalysis,
      timeAnalysis,
      overallEvaluation
    });
  } catch (err) {
    logger.error('生成学生个性化学习报告失败:', err);
    res.status(500).json({ message: '生成学生个性化学习报告失败', error: err.message });
  }
});

// 生成班级学习报告
router.get('/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const { period = 'semester' } = req.query;
    
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
    
    // 模拟班级学习报告数据
    const subjects = ['语文', '数学', '英语', '科学', '社会'];
    const subjectPerformance = {};
    
    for (const subject of subjects) {
      // 生成模拟的成绩数据
      const scoreData = [];
      let baseScore = Math.floor(Math.random() * 10) + 75; // 基础平均分75-85
      
      for (let i = 0; i < 6; i++) {
        const date = new Date(startDate);
        date.setMonth(startDate.getMonth() + i);
        
        // 分数在基础分上有波动，但总体呈上升趋势
        const trend = Math.min(10, Math.floor(10 * i / 5)); // 最多提升10分
        const fluctuation = Math.floor(Math.random() * 6) - 3; // -3到2的随机波动
        const averageScore = Math.min(95, Math.max(70, baseScore + trend + fluctuation));
        
        scoreData.push({
          date: date.toISOString().split('T')[0],
          averageScore,
          testType: ['日常测验', '单元测试', '月考', '期中考试', '期末考试'][Math.floor(Math.random() * 5)]
        });
      }
      
      // 计算进步率
      const firstScore = scoreData[0].averageScore;
      const lastScore = scoreData[scoreData.length - 1].averageScore;
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
      
      // 生成分数分布
      const scoreDistribution = {
        '90-100': Math.floor(Math.random() * 10) + 5,
        '80-89': Math.floor(Math.random() * 15) + 10,
        '70-79': Math.floor(Math.random() * 10) + 8,
        '60-69': Math.floor(Math.random() * 8) + 4,
        '0-59': Math.floor(Math.random() * 5) + 1
      };
      
      // 生成知识点掌握情况
      const knowledgePoints = [];
      for (let i = 1; i <= 5; i++) {
        knowledgePoints.push({
          name: `${subject}知识点${i}`,
          masteryRate: Math.floor(Math.random() * 30) + 70,
          difficulty: Math.floor(Math.random() * 5) + 1
        });
      }
      
      subjectPerformance[subject] = {
        scoreData,
        averageScore: (scoreData.reduce((sum, item) => sum + item.averageScore, 0) / scoreData.length).toFixed(2),
        trend,
        improvementRate: parseFloat(improvementRate),
        scoreDistribution,
        knowledgePoints,
        weakPoints: [
          `${subject}知识点1`,
          `${subject}知识点2`,
          `${subject}知识点3`
        ]
      };
    }
    
    // 生成学生表现分析
    const studentCount = Math.floor(Math.random() * 20) + 30; // 30-50名学生
    const studentPerformance = {
      excellent: Math.floor(Math.random() * 10) + 5,
      good: Math.floor(Math.random() * 15) + 10,
      average: Math.floor(Math.random() * 10) + 8,
      needsImprovement: Math.floor(Math.random() * 8) + 4
    };
    
    // 确保总数等于学生总数
    let totalStudents = Object.values(studentPerformance).reduce((sum, count) => sum + count, 0);
    if (totalStudents !== studentCount) {
      // 调整最大的那个区间
      const maxCategory = Object.entries(studentPerformance).reduce((max, [category, count]) => 
        count > max.count ? {category, count} : max, {category: '', count: 0});
      studentPerformance[maxCategory.category] += (studentCount - totalStudents);
    }
    
    // 生成班级参与度分析
    const participationAnalysis = {
      classDiscussion: Math.floor(Math.random() * 30) + 70,
      homeworkSubmission: Math.floor(Math.random() * 20) + 80,
      extracurricularActivities: Math.floor(Math.random() * 40) + 60,
      parentInvolvement: Math.floor(Math.random() * 50) + 50
    };
    
    // 生成班级整体评价
    const overallEvaluation = {
      strengths: [
        '班级整体学习氛围良好',
        '学生之间互助合作精神强',
        '课堂参与度高'
      ],
      weaknesses: [
        '部分学生学习积极性不高',
        '班级内学生成绩差异较大',
        '部分知识点掌握不均衡'
      ],
      improvementSuggestions: [
        '加强分层教学，关注学困生',
        '增加小组合作学习活动',
        '强化基础知识的巩固',
        '提高课堂教学效率'
      ],
      teacherComments: '本班级整体表现良好，大部分学生学习态度端正，但存在部分学生需要更多关注和辅导。建议加强个性化教学，提高全体学生的学习积极性。'
    };
    
    res.json({
      classId,
      period,
      reportDate: new Date().toISOString().split('T')[0],
      studentCount,
      studentPerformance,
      subjectPerformance,
      participationAnalysis,
      overallEvaluation
    });
  } catch (err) {
    logger.error('生成班级学习报告失败:', err);
    res.status(500).json({ message: '生成班级学习报告失败', error: err.message });
  }
});

module.exports = router;