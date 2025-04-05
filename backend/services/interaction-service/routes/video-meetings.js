const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
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

// WebRTC信令服务器配置
let activeRooms = {};
let userConnections = {};

// 创建视频会议房间
router.post('/rooms', authenticateToken, async (req, res) => {
  try {
    const { meetingId, roomName } = req.body;
    
    if (!meetingId || !roomName) {
      return res.status(400).json({ message: '会议ID和房间名称不能为空' });
    }
    
    // 检查会议是否存在
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: '会议不存在' });
    }
    
    // 检查权限：只有会议的参与者（教师、家长、学生）可以创建房间
    const isParticipant = [
      meeting.teacher.toString(),
      meeting.parent.toString(),
      meeting.student.toString()
    ].includes(req.user.id);
    
    if (!isParticipant) {
      return res.status(403).json({ message: '权限不足，您不是此会议的参与者' });
    }
    
    // 生成唯一的房间ID
    const roomId = `${meetingId}-${Date.now()}`;
    
    // 创建房间
    activeRooms[roomId] = {
      id: roomId,
      name: roomName,
      meetingId,
      createdBy: req.user.id,
      participants: [],
      createdAt: new Date(),
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
        // 在生产环境中，应添加TURN服务器配置
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'username',
        //   credential: 'credential'
        // }
      ]
    };
    
    // 更新会议记录
    meeting.meetingLink = `/video-meeting/${roomId}`;
    meeting.status = '已确认';
    await meeting.save();
    
    res.status(201).json({
      message: '视频会议房间创建成功',
      room: {
        id: roomId,
        name: roomName,
        meetingId,
        joinUrl: `/api/interaction/video-meetings/join/${roomId}`,
        iceServers: activeRooms[roomId].iceServers
      }
    });
  } catch (err) {
    logger.error('创建视频会议房间失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 加入视频会议
router.get('/join/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // 检查房间是否存在
    if (!activeRooms[roomId]) {
      return res.status(404).json({ message: '会议房间不存在或已结束' });
    }
    
    const room = activeRooms[roomId];
    
    // 检查会议是否存在
    const meeting = await Meeting.findById(room.meetingId);
    if (!meeting) {
      return res.status(404).json({ message: '会议不存在' });
    }
    
    // 检查权限：只有会议的参与者（教师、家长、学生）可以加入房间
    const isParticipant = [
      meeting.teacher.toString(),
      meeting.parent.toString(),
      meeting.student.toString()
    ].includes(req.user.id);
    
    if (!isParticipant) {
      return res.status(403).json({ message: '权限不足，您不是此会议的参与者' });
    }
    
    // 将用户添加到房间参与者列表
    if (!room.participants.includes(req.user.id)) {
      room.participants.push(req.user.id);
    }
    
    // 将用户与房间关联
    userConnections[req.user.id] = roomId;
    
    res.json({
      message: '成功加入会议',
      room: {
        id: room.id,
        name: room.name,
        meetingId: room.meetingId,
        participants: room.participants,
        iceServers: room.iceServers
      }
    });
  } catch (err) {
    logger.error('加入视频会议失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// WebRTC信令：发送offer
router.post('/signal/offer', authenticateToken, async (req, res) => {
  try {
    const { roomId, targetUserId, offer } = req.body;
    
    if (!roomId || !targetUserId || !offer) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 检查房间是否存在
    if (!activeRooms[roomId]) {
      return res.status(404).json({ message: '会议房间不存在或已结束' });
    }
    
    // 检查目标用户是否在房间中
    if (!activeRooms[roomId].participants.includes(targetUserId)) {
      return res.status(404).json({ message: '目标用户不在会议中' });
    }
    
    // 在实际应用中，这里应该通过WebSocket或其他实时通信方式发送offer
    // 这里简化处理，假设有一个信令队列
    if (!global.signalingQueue) {
      global.signalingQueue = {};
    }
    
    if (!global.signalingQueue[targetUserId]) {
      global.signalingQueue[targetUserId] = [];
    }
    
    global.signalingQueue[targetUserId].push({
      type: 'offer',
      from: req.user.id,
      offer,
      roomId
    });
    
    res.json({ message: 'Offer已发送' });
  } catch (err) {
    logger.error('发送WebRTC offer失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// WebRTC信令：发送answer
router.post('/signal/answer', authenticateToken, async (req, res) => {
  try {
    const { roomId, targetUserId, answer } = req.body;
    
    if (!roomId || !targetUserId || !answer) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 检查房间是否存在
    if (!activeRooms[roomId]) {
      return res.status(404).json({ message: '会议房间不存在或已结束' });
    }
    
    // 检查目标用户是否在房间中
    if (!activeRooms[roomId].participants.includes(targetUserId)) {
      return res.status(404).json({ message: '目标用户不在会议中' });
    }
    
    // 在实际应用中，这里应该通过WebSocket或其他实时通信方式发送answer
    // 这里简化处理，假设有一个信令队列
    if (!global.signalingQueue) {
      global.signalingQueue = {};
    }
    
    if (!global.signalingQueue[targetUserId]) {
      global.signalingQueue[targetUserId] = [];
    }
    
    global.signalingQueue[targetUserId].push({
      type: 'answer',
      from: req.user.id,
      answer,
      roomId
    });
    
    res.json({ message: 'Answer已发送' });
  } catch (err) {
    logger.error('发送WebRTC answer失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// WebRTC信令：发送ICE候选
router.post('/signal/ice-candidate', authenticateToken, async (req, res) => {
  try {
    const { roomId, targetUserId, candidate } = req.body;
    
    if (!roomId || !targetUserId || !candidate) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 检查房间是否存在
    if (!activeRooms[roomId]) {
      return res.status(404).json({ message: '会议房间不存在或已结束' });
    }
    
    // 检查目标用户是否在房间中
    if (!activeRooms[roomId].participants.includes(targetUserId)) {
      return res.status(404).json({ message: '目标用户不在会议中' });
    }
    
    // 在实际应用中，这里应该通过WebSocket或其他实时通信方式发送ICE候选
    // 这里简化处理，假设有一个信令队列
    if (!global.signalingQueue) {
      global.signalingQueue = {};
    }
    
    if (!global.signalingQueue[targetUserId]) {
      global.signalingQueue[targetUserId] = [];
    }
    
    global.signalingQueue[targetUserId].push({
      type: 'ice-candidate',
      from: req.user.id,
      candidate,
      roomId
    });
    
    res.json({ message: 'ICE候选已发送' });
  } catch (err) {
    logger.error('发送WebRTC ICE候选失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取信令消息
router.get('/signal/messages', authenticateToken, async (req, res) => {
  try {
    // 获取用户的信令消息
    if (!global.signalingQueue || !global.signalingQueue[req.user.id]) {
      return res.json({ messages: [] });
    }
    
    const messages = global.signalingQueue[req.user.id];
    
    // 清空队列
    global.signalingQueue[req.user.id] = [];
    
    res.json({ messages });
  } catch (err) {
    logger.error('获取信令消息失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 离开视频会议
router.post('/leave/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // 检查房间是否存在
    if (!activeRooms[roomId]) {
      return res.status(404).json({ message: '会议房间不存在或已结束' });
    }
    
    // 将用户从房间参与者列表中移除
    const participantIndex = activeRooms[roomId].participants.indexOf(req.user.id);
    if (participantIndex !== -1) {
      activeRooms[roomId].participants.splice(participantIndex, 1);
    }
    
    // 移除用户与房间的关联
    delete userConnections[req.user.id];
    
    // 如果房间没有参与者了，关闭房间
    if (activeRooms[roomId].participants.length === 0) {
      // 更新会议记录
      const meeting = await Meeting.findById(activeRooms[roomId].meetingId);
      if (meeting) {
        meeting.status = '已完成';
        await meeting.save();
      }
      
      // 删除房间
      delete activeRooms[roomId];
    }
    
    res.json({ message: '已离开会议' });
  } catch (err) {
    logger.error('离开视频会议失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取活跃房间列表（仅管理员可用）
router.get('/rooms', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const rooms = Object.values(activeRooms).map(room => ({
      id: room.id,
      name: room.name,
      meetingId: room.meetingId,
      participantCount: room.participants.length,
      createdAt: room.createdAt
    }));
    
    res.json({ rooms });
  } catch (err) {
    logger.error('获取活跃房间列表失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 结束视频会议（仅创建者或管理员可用）
router.post('/end/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // 检查房间是否存在
    if (!activeRooms[roomId]) {
      return res.status(404).json({ message: '会议房间不存在或已结束' });
    }
    
    // 检查权限：只有房间创建者或管理员可以结束会议
    if (activeRooms[roomId].createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足，只有会议创建者或管理员可以结束会议' });
    }
    
    // 更新会议记录
    const meeting = await Meeting.findById(activeRooms[roomId].meetingId);
    if (meeting) {
      meeting.status = '已完成';
      await meeting.save();
    }
    
    // 通知所有参与者会议已结束
    activeRooms[roomId].participants.forEach(participantId => {
      if (global.signalingQueue && global.signalingQueue[participantId]) {
        global.signalingQueue[participantId].push({
          type: 'meeting-ended',
          roomId
        });
      }
      
      // 移除用户与房间的关联
      delete userConnections[participantId];
    });
    
    // 删除房间
    delete activeRooms[roomId];
    
    res.json({ message: '会议已结束' });
  } catch (err) {
    logger.error('结束视频会议失败:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;