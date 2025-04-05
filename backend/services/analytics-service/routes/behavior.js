const express = require('express');
const router = express.Router();
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

// 认证中间件
const authenticateToken = (req, res, next) => {
  // 从请求头获取用户信息（由API网关添加）
  if (!req.headers['x-user-id'] || !req.headers['x-user-role']) {
    return res.status(401).json({ message: '未认证' });
  }
  
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role']
  };
  
  next();
};

// 角色检查中间件
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: '未认证' });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    next();
  };
};

// 获取学生学习行为分析
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { period = 'month' } = req.query;
    
    // 检查权限：只有学生本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ message: '权限不足' });
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
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }
    
    // 获取学习时间分布
    const timeDistribution = {
      morning: Math.floor(Math.random() * 30) + 10,
      afternoon: Math.floor(Math.random() * 40) + 20,
      evening: Math.floor(Math.random() * 50) + 30,
    };
    
    // 获取学习专注度数据
    const focusData = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      focusData.push({
        date: date.toISOString().split('T')[0],
        focusScore: Math.floor(Math.random() * 40) + 60,
        distractionCount: Math.floor(Math.random() * 10)
      });
    }
    
    // 获取学习习惯数据
    const studyHabits = {
      regularStudyTime: Math.random() > 0.5,
      reviewFrequency: Math.floor(Math.random() * 5) + 1,
      homeworkCompletionRate: Math.floor(Math.random() * 30) + 70,
      notesTakingQuality: Math.floor(Math.random() * 3) + 3,
      questionAskingFrequency: Math.floor(Math.random() * 10)
    };
    
    // 生成学习行为建议
    const behaviorSuggestions = [];
    
    // 基于专注度的建议
    const avgFocusScore = focusData.reduce((sum, item) => sum + item.focusScore, 0) / focusData.length;
    if (avgFocusScore < 70) {
      behaviorSuggestions.push({
        area: '专注度',
        issue: '学习专注度较低',
        suggestion: '建议采用番茄工作法，每25分钟专注学习后短暂休息5分钟'
      });
    }
    
    // 基于学习时间分布的建议
    if (timeDistribution.evening > timeDistribution.morning + timeDistribution.afternoon) {
      behaviorSuggestions.push({
        area: '学习时间',
        issue: '晚间学习时间过多',
        suggestion: '建议适当调整学习时间分布，增加白天学习时间，保证充足睡眠'
      });
    }
    
    // 基于学习习惯的建议
    if (!studyHabits.regularStudyTime) {
      behaviorSuggestions.push({
        area: '学习规律',
        issue: '学习时间不规律',
        suggestion: '建议制定固定的学习计划表，养成规律学习的习惯'
      });
    }
    
    if (studyHabits.homeworkCompletionRate < 80) {
      behaviorSuggestions.push({
        area: '作业完成',
        issue: '作业完成率较低',
        suggestion: '建议每天设定作业完成目标，按时完成作业并及时复习'
      });
    }
    
    res.json({
      timeDistribution,
      focusData,
      studyHabits,
      period,
      behaviorSuggestions
    });
  } catch (err) {
    logger.error('获取学生学习行为分析失败:', err);
    res.status(500).json({ message: '获取学生学习行为分析失败', error: err.message });
  }
});

// 获取班级整体表现分析
router.get('/class/:classId/overall', authenticateToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { classId } = req.params;
    const { period = 'month' } = req.query;
    
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
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }
    
    // 获取班级整体成绩分布
    const scoreDistribution = {
      excellent: Math.floor(Math.random() * 20) + 10,
      good: Math.floor(Math.random() * 30) + 20,
      average: Math.floor(Math.random() * 30) + 20,
      needsImprovement: Math.floor(Math.random() * 20) + 5
    };
    
    // 获取班级知识点掌握情况
    const knowledgePointsMastery = [];
    const subjects = ['语文', '数学', '英语', '科学', '社会'];
    for (const subject of subjects) {
      knowledgePointsMastery.push({
        subject,
        masteryRate: Math.floor(Math.random() * 30) + 70,
        weakPoints: [
          '知识点1',
          '知识点2',
          '知识点3'
        ].map(point => `${subject}${point}`)
      });
    }
    
    // 获取班级学习参与度
    const participationRate = {
      classDiscussion: Math.floor(Math.random() * 30) + 70,
      homeworkSubmission: Math.floor(Math.random() * 20) + 80,
      extracurricularActivities: Math.floor(Math.random() * 40) + 60
    };
    
    // 生成班级行为改进建议
    const classImprovement = [];
    
    // 基于成绩分布的建议
    if (scoreDistribution.needsImprovement > 15) {
      classImprovement.push({
        area: '成绩分布',
        issue: '需要提升的学生比例较高',
        suggestion: '建议针对成绩较弱的学生组织额外辅导，实施分层教学策略'
      });
    }
    
    // 基于知识点掌握情况的建议
    const weakSubjects = knowledgePointsMastery.filter(item => item.masteryRate < 75);
    if (weakSubjects.length > 0) {
      classImprovement.push({
        area: '知识点掌握',
        issue: `${weakSubjects.map(s => s.subject).join('、')}学科知识点掌握率较低`,
        suggestion: '建议加强薄弱学科的基础知识教学，增加针对性练习'
      });
    }
    
    // 基于参与度的建议
    if (participationRate.classDiscussion < 75) {
      classImprovement.push({
        area: '课堂参与',
        issue: '课堂讨论参与度不足',
        suggestion: '建议采用更多互动式教学方法，鼓励学生积极参与课堂讨论'
      });
    }
    
    res.json({
      scoreDistribution,
      knowledgePointsMastery,
      participationRate,
      period,
      classImprovement
    });
  } catch (err) {
    logger.error('获取班级整体表现分析失败:', err);
    res.status(500).json({ message: '获取班级整体表现分析失败', error: err.message });
  }
});

// 获取学生学习进度比较
router.get('/student/:studentId/comparison', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { classId, subject } = req.query;
    
    // 检查权限：只有学生本人、其家长、教师或管理员可以查看
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    if (!classId) {
      return res.status(400).json({ message: '班级ID不能为空' });
    }
    
    // 获取学生在班级中的排名
    const rankData = {};
    
    if (subject) {
      // 特定学科的排名
      rankData[subject] = {
        score: Math.floor(Math.random() * 30) + 70,
        classAverage: Math.floor(Math.random() * 20) + 60,
        rank: Math.floor(Math.random() * 10) + 1,
        totalStudents: Math.floor(Math.random() * 20) + 30
      };
    } else {
      // 所有学科的排名
      const subjects = ['语文', '数学', '英语', '科学', '社会'];
      for (const subj of subjects) {
        rankData[subj] = {
          score: Math.floor(Math.random() * 30) + 70,
          classAverage: Math.floor(Math.random() * 20) + 60,
          rank: Math.floor(Math.random() * 10) + 1,
          totalStudents: Math.floor(Math.random() * 20) + 30
        };
      }
    }
    
    // 获取学生与班级平均水平的差距
    const gapAnalysis = [];
    const subjects = subject ? [subject] : ['语文', '数学', '英语', '科学', '社会'];
    
    for (const subj of subjects) {
      const studentScore = rankData[subj].score;
      const classAverage = rankData[subj].classAverage;
      const gap = studentScore - classAverage;
      
      gapAnalysis.push({
        subject: subj,
        gap,
        status: gap > 10 ? '优秀' : (gap > 0 ? '良好' : '需要提升'),
        improvementSuggestions: gap < 0 ? [
          '增加练习次数',
          '专注薄弱知识点',
          '寻求老师辅导'
        ] : []
      });
    }
    
    // 生成个性化学习建议
    const personalizedSuggestions = [];
    
    // 找出最弱和最强的学科
    const sortedByGap = [...gapAnalysis].sort((a, b) => a.gap - b.gap);
    const weakestSubject = sortedByGap[0];
    const strongestSubject = sortedByGap[sortedByGap.length - 1];
    
    // 针对最弱学科的建议
    if (weakestSubject.gap < 0) {
      personalizedSuggestions.push({
        subject: weakestSubject.subject,
        type: '提升建议',
        suggestion: `建议增加${weakestSubject.subject}的学习时间，重点关注基础知识点的掌握`
      });
    }
    
    // 针对最强学科的建议
    if (strongestSubject.gap > 10) {
      personalizedSuggestions.push({
        subject: strongestSubject.subject,
        type: '发展建议',
        suggestion: `可以在${strongestSubject.subject}方面尝试更具挑战性的学习内容，发挥优势`
      });
    }
    
    // 平衡学习的建议
    if (strongestSubject.gap - weakestSubject.gap > 20) {
      personalizedSuggestions.push({
        subject: '全科',
        type: '平衡建议',
        suggestion: '各学科发展不均衡，建议适当调整学习时间分配，保持全面发展'
      });
    }
    
    res.json({
      rankData,
      gapAnalysis,
      personalizedSuggestions
    });
  } catch (err) {
    logger.error('获取学生学习进度比较失败:', err);
    res.status(500).json({ message: '获取学生学习进度比较失败', error: err.message });
  }
});

module.exports = router;