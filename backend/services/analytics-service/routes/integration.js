const express = require('express');
const axios = require('axios');
const router = express.Router();

// 获取学生作业数据并分析
router.get('/performance/homework/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // 从数据服务获取作业数据
    const dataServiceUrl = process.env.DATA_SERVICE_URL || 'http://data-service:5002';
    let homeworkData;
    
    try {
      const response = await axios.get(`${dataServiceUrl}/api/homework/student/${studentId}`);
      homeworkData = response.data.homework;
    } catch (error) {
      console.error('获取作业数据失败:', error.message);
      return res.status(503).json({
        message: '数据服务暂时不可用'
      });
    }
    
    // 分析作业数据
    const mathHomework = homeworkData.filter(hw => hw.subject === '数学');
    const chineseHomework = homeworkData.filter(hw => hw.subject === '语文');
    
    // 计算平均分
    const calculateAverage = (homework) => {
      if (homework.length === 0) return 0;
      const sum = homework.reduce((acc, hw) => acc + hw.score, 0);
      return sum / homework.length;
    };
    
    // 计算趋势
    const calculateTrend = (homework) => {
      if (homework.length < 2) return '稳定';
      
      // 按提交日期排序
      const sorted = [...homework].sort((a, b) => 
        new Date(a.submittedDate) - new Date(b.submittedDate)
      );
      
      const firstScore = sorted[0].score;
      const lastScore = sorted[sorted.length - 1].score;
      
      if (lastScore > firstScore) return '上升';
      if (lastScore < firstScore) return '下降';
      return '稳定';
    };
    
    // 构建响应数据
    const homeworkPerformance = {
      math: {
        count: mathHomework.length,
        averageScore: calculateAverage(mathHomework),
        trend: calculateTrend(mathHomework)
      },
      chinese: {
        count: chineseHomework.length,
        averageScore: calculateAverage(chineseHomework),
        trend: calculateTrend(chineseHomework)
      },
      averageScore: calculateAverage(homeworkData),
      totalCount: homeworkData.length
    };
    
    res.status(200).json({
      data: {
        studentId,
        homeworkPerformance
      }
    });
  } catch (error) {
    console.error('分析作业数据失败:', error.message);
    res.status(500).json({
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'production' ? {} : error.message
    });
  }
});

// 获取学生进度概览
router.get('/progress/overview/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // 从进度服务获取进度数据
    const progressServiceUrl = process.env.PROGRESS_SERVICE_URL || 'http://progress-service:5003';
    let progressData;
    
    try {
      const response = await axios.get(`${progressServiceUrl}/api/progress/${studentId}`);
      progressData = response.data.progress;
    } catch (error) {
      console.error('获取进度数据失败:', error.message);
      return res.status(503).json({
        message: '进度服务暂时不可用'
      });
    }
    
    // 计算总体进度
    const calculateOverallProgress = (progress) => {
      if (progress.length === 0) return 0;
      const sum = progress.reduce((acc, p) => acc + p.completionRate, 0);
      return sum / progress.length;
    };
    
    // 按学科分组
    const subjectProgress = {};
    progressData.forEach(p => {
      if (!subjectProgress[p.subject]) {
        subjectProgress[p.subject] = [];
      }
      subjectProgress[p.subject].push(p);
    });
    
    // 计算每个学科的进度
    const subjectProgressSummary = {};
    Object.keys(subjectProgress).forEach(subject => {
      subjectProgressSummary[subject] = calculateOverallProgress(subjectProgress[subject]);
    });
    
    res.status(200).json({
      data: {
        studentId,
        overallProgress: calculateOverallProgress(progressData),
        subjectProgress: subjectProgressSummary
      }
    });
  } catch (error) {
    console.error('分析进度数据失败:', error.message);
    res.status(500).json({
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'production' ? {} : error.message
    });
  }
});

// 发送分析结果通知
router.post('/notify/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { message, type } = req.body;
    
    if (!message) {
      return res.status(400).json({
        message: '消息内容不能为空'
      });
    }
    
    // 向通知服务发送通知
    const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:5004';
    
    try {
      await axios.post(`${notificationServiceUrl}/api/notifications`, {
        user: userId,
        message,
        type: type || 'info'
      });
    } catch (error) {
      console.error('发送通知失败:', error.message);
      return res.status(503).json({
        message: '通知服务暂时不可用'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '通知已发送'
    });
  } catch (error) {
    console.error('发送通知失败:', error.message);
    res.status(500).json({
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'production' ? {} : error.message
    });
  }
});

module.exports = router;
