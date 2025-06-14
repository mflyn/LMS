const Meeting = require('../models/Meeting');
const { AppError } = require('../../../common/middleware/errorTypes');

class MeetingService {
  constructor(logger) {
    this.logger = logger;
  }

  async getMeetings(requestingUser, queryParams = {}) {
    const { teacherId, parentId, studentId, startDate, endDate, limit = 10, skip = 0 } = queryParams;
    let status = queryParams.status;
    const query = {};

    // 基于角色的访问控制
    switch (requestingUser.role) {
      case 'admin':
        // 管理员可以查看所有会议
        break;
      case 'teacher':
        query.teacherId = requestingUser.id;
        break;
      case 'parent':
        query.parentId = requestingUser.id;
        break;
      case 'student':
        query.studentId = requestingUser.id;
        break;
      default:
        throw new AppError('无权访问会议列表', 403);
    }

    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        query.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        query.status = status;
      }
    }

    if (startDate || endDate) {
      query.scheduledTime = {};
      if (startDate) query.scheduledTime.$gte = new Date(startDate);
      if (endDate) query.scheduledTime.$lte = new Date(endDate);
    }

    // 添加其他查询条件
    if (teacherId) query.teacherId = teacherId;
    if (parentId) query.parentId = parentId;
    if (studentId) query.studentId = studentId;

    try {
      const meetings = await Meeting.find(query)
        .populate('teacherId', 'name email')
        .populate('parentId', 'name email')
        .populate('studentId', 'name email')
        .sort({ scheduledTime: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Meeting.countDocuments(query);

      return {
        data: meetings,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      };
    } catch (error) {
      this.logger.error('获取会议列表失败:', error);
      throw new AppError('获取会议列表失败', 500);
    }
  }

  async createMeeting(meetingData, requestingUser) {
    try {
      const meeting = new Meeting({
        ...meetingData,
        createdBy: requestingUser.id,
        status: 'scheduled'
      });

      await meeting.save();
      return meeting;
    } catch (error) {
      this.logger.error('创建会议失败:', error);
      throw new AppError('创建会议失败', 500);
    }
  }

  async updateMeeting(meetingId, updateData, requestingUser) {
    try {
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        throw new AppError('会议不存在', 404);
      }

      // 权限检查
      if (requestingUser.role !== 'admin' && meeting.createdBy.toString() !== requestingUser.id) {
        throw new AppError('无权修改此会议', 403);
      }

      Object.assign(meeting, updateData);
      await meeting.save();
      return meeting;
    } catch (error) {
      this.logger.error('更新会议失败:', error);
      throw new AppError('更新会议失败', 500);
    }
  }

  async deleteMeeting(meetingId, requestingUser) {
    try {
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        throw new AppError('会议不存在', 404);
      }

      // 权限检查
      if (requestingUser.role !== 'admin' && meeting.createdBy.toString() !== requestingUser.id) {
        throw new AppError('无权删除此会议', 403);
      }

      await Meeting.findByIdAndDelete(meetingId);
      return { message: '会议删除成功' };
    } catch (error) {
      this.logger.error('删除会议失败:', error);
      throw new AppError('删除会议失败', 500);
    }
  }
}

module.exports = MeetingService;
