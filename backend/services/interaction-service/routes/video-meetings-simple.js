/**
 * 简化版视频会议路由
 * 用于单元测试
 */

const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const videoMeetingService = require('../services/videoMeetingService');
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

// 创建视频会议
router.post('/create', async (req, res) => {
  try {
    const { meetingId, topic, duration, password } = req.body;
    
    if (!meetingId || !topic) {
      return res.status(400).json({ message: '会议ID和主题不能为空' });
    }
    
    // 查找会议
    const meeting = await Meeting.findById(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ message: '会议不存在' });
    }
    
    // 创建视频会议
    const videoMeeting = await videoMeetingService.createMeeting({
      topic,
      duration: duration || 60,
      password: password || '',
      host: req.user ? req.user.name : '未知用户'
    });
    
    // 更新会议记录
    meeting.videoMeetingId = videoMeeting.id;
    meeting.videoMeetingUrl = videoMeeting.joinUrl;
    meeting.videoMeetingHostUrl = videoMeeting.hostUrl;
    
    await meeting.save();
    
    res.json({
      meetingId,
      videoMeeting
    });
  } catch (err) {
    logger.error('创建视频会议失败:', err);
    res.status(500).json({ message: '创建视频会议失败', error: err.message });
  }
});

// 结束视频会议
router.post('/end', async (req, res) => {
  try {
    const { meetingId, videoMeetingId } = req.body;
    
    if (!meetingId || !videoMeetingId) {
      return res.status(400).json({ message: '会议ID和视频会议ID不能为空' });
    }
    
    // 查找会议
    const meeting = await Meeting.findById(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ message: '会议不存在' });
    }
    
    // 结束视频会议
    await videoMeetingService.endMeeting(videoMeetingId);
    
    // 更新会议记录
    meeting.videoMeetingId = null;
    meeting.videoMeetingUrl = null;
    meeting.videoMeetingHostUrl = null;
    
    await meeting.save();
    
    res.json({ message: '视频会议已结束' });
  } catch (err) {
    logger.error('结束视频会议失败:', err);
    res.status(500).json({ message: '结束视频会议失败', error: err.message });
  }
});

// 获取视频会议状态
router.get('/status/:videoMeetingId', async (req, res) => {
  try {
    const { videoMeetingId } = req.params;
    
    // 获取视频会议状态
    const status = await videoMeetingService.getMeetingStatus(videoMeetingId);
    
    res.json(status);
  } catch (err) {
    logger.error('获取视频会议状态失败:', err);
    res.status(500).json({ message: '获取视频会议状态失败', error: err.message });
  }
});

module.exports = router;
