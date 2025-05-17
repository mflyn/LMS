const Announcement = require('../models/Announcement');
const { NotFoundError, ForbiddenError, BadRequestError, AppError } = require('../../../common/middleware/errorTypes');
const mongoose = require('mongoose'); // Needed for ObjectId validation

class AnnouncementService {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * 获取公告列表
   * @param {Object} requestingUser - 发起请求的用户对象 (req.user)
   * @param {Object} queryParams - 查询参数 (classId, startDate, endDate, page, limit, sortBy, sortOrder)
   */
  async getAnnouncements(requestingUser, queryParams) {
    const { id: currentUserId, role, classId: userClassId, taughtClasses } = requestingUser; // Assuming user object has these from gateway
    const { 
      classId, // Specific classId from query params
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const query = {};

    // Permission & Query Logic based on role and queryParams.classId
    if (role === 'admin' || role === 'superadmin') {
      // Admins can see all announcements, or filter by a specific class if provided
      if (classId) {
        if (!mongoose.Types.ObjectId.isValid(classId)) throw new BadRequestError('Invalid classId format.');
        query.class = classId;
      }
    } else if (role === 'teacher') {
      // Teachers can see announcements for classes they teach, or a specific one they teach if classId is provided
      const teacherAllowedClassIds = taughtClasses || []; // Array of class IDs teacher is associated with
      if (classId) {
        if (!mongoose.Types.ObjectId.isValid(classId)) throw new BadRequestError('Invalid classId format.');
        if (!teacherAllowedClassIds.map(id => id.toString()).includes(classId.toString())) {
          throw new ForbiddenError('You are not authorized to view announcements for this class.');
        }
        query.class = classId;
      } else {
        // If no specific classId, show from all taught classes
        if (teacherAllowedClassIds.length === 0) {
             this.logger.info(`Teacher ${currentUserId} has no associated classes to view announcements from.`);
             return { data: [], pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 } };
        }
        query.class = { $in: teacherAllowedClassIds };
      }
    } else if (role === 'student' || role === 'parent') {
      // Students/Parents can see announcements for their class (or child's class for parent)
      // We assume userClassId is the relevant one (student's own class, or parent's first child's class for simplicity)
      const relevantClassIdFromQuery = classId; // classId from query params
      const effectiveClassId = relevantClassIdFromQuery || userClassId; 

      if (!effectiveClassId || !mongoose.Types.ObjectId.isValid(effectiveClassId)) {
        throw new BadRequestError('Class ID is required and must be valid to view announcements.');
      }
      // Students/parents can only view their own class's announcements.
      // If classId is specified in query, it must match their userClassId.
      if (relevantClassIdFromQuery && relevantClassIdFromQuery.toString() !== userClassId.toString()) {
           throw new ForbiddenError('You can only view announcements for your own class.');
      }
      query.class = userClassId; // Always restrict to user's own class from token
    } else {
      // Other roles or undefined roles have no access by default
      throw new ForbiddenError('Your role does not have permission to view announcements.');
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    if (['createdAt', 'updatedAt'].includes(sortBy)) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions['createdAt'] = -1; // Default sort
    }

    try {
      this.logger.debug('Executing getAnnouncements query', { userId: currentUserId, role, query, page, limit, sortOptions });
      const announcements = await Announcement.find(query)
        .populate('author', 'name role') // Populate with specific fields
        .populate('class', 'name grade')  // Populate with specific fields
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

      const totalAnnouncements = await Announcement.countDocuments(query);
      this.logger.info(`Retrieved ${announcements.length} announcements for user ${currentUserId} (total: ${totalAnnouncements})`);

      return {
        data: announcements,
        pagination: {
          total: totalAnnouncements,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(totalAnnouncements / limit)
        }
      };
    } catch (error) {
      this.logger.error('Error fetching announcements:', { error: error.message, userId: currentUserId, queryParams });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to retrieve announcements due to a server error.', 500, error);
    }
  }

  /**
   * 获取单个公告详情
   * @param {Object} requestingUser - 发起请求的用户对象
   * @param {String} announcementId - 要获取的公告ID
   */
  async getAnnouncementById(requestingUser, announcementId) {
    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      throw new BadRequestError('Invalid announcement ID format.');
    }

    const { id: currentUserId, role, classId: userClassId, taughtClasses } = requestingUser;

    try {
      this.logger.debug(`Attempting to find announcement ${announcementId} for user ${currentUserId}`);
      const announcement = await Announcement.findById(announcementId)
        .populate('author', 'name role')
        .populate('class', 'name grade')
        .lean();

      if (!announcement) {
        throw new NotFoundError('Announcement not found.');
      }

      // Permission check:
      if (role === 'admin' || role === 'superadmin') {
        // Admins can view any announcement
      } else if (role === 'teacher') {
        const teacherAllowedClassIds = (taughtClasses || []).map(id => id.toString());
        if (!teacherAllowedClassIds.includes(announcement.class._id.toString())) {
          this.logger.warn(`Teacher ${currentUserId} attempted to access announcement ${announcementId} for class ${announcement.class._id} without permission.`);
          throw new ForbiddenError('You do not have permission to view this announcement.');
        }
      } else if (role === 'student' || role === 'parent') {
        if (!userClassId || announcement.class._id.toString() !== userClassId.toString()) {
          this.logger.warn(`User ${currentUserId} (role: ${role}) attempted to access announcement ${announcementId} for class ${announcement.class._id} without permission.`);
          throw new ForbiddenError('You do not have permission to view this announcement.');
        }
      } else {
        throw new ForbiddenError('Your role does not have permission to view this announcement.');
      }

      this.logger.info(`Announcement ${announcementId} retrieved successfully by user ${currentUserId}`);
      return announcement;
    } catch (error) {
      this.logger.error(`Error fetching announcement ${announcementId}:`, { error: error.message, userId: currentUserId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to retrieve announcement due to a server error.', 500, error);
    }
  }

  /**
   * 创建新公告
   * @param {Object} requestingUser - 发起请求的用户对象 (req.user)
   * @param {Object} announcementData - 公告数据 (title, content, classId, attachments)
   */
  async createAnnouncement(requestingUser, announcementData) {
    const { id: authorId, role, taughtClasses } = requestingUser;
    const { title, content, classId, attachments } = announcementData; // classId here is targetClassId

    // Permission Check: Only teachers and admins can create announcements.
    if (!['teacher', 'admin', 'superadmin'].includes(role)) {
      throw new ForbiddenError('You do not have permission to create announcements.');
    }

    // Validation (basic, more in validator layer)
    if (!title || title.trim() === '') throw new BadRequestError('Title is required.');
    if (!content || content.trim() === '') throw new BadRequestError('Content is required.');
    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      throw new BadRequestError('Valid target class ID (classId) is required.');
    }

    // Teacher specific permission: can only post to classes they teach.
    if (role === 'teacher') {
      const teacherAllowedClassIds = (taughtClasses || []).map(id => id.toString());
      if (!teacherAllowedClassIds.includes(classId.toString())) {
        throw new ForbiddenError('Teachers can only create announcements for classes they teach.');
      }
    }
    // Admins can post to any class (no specific check needed here if classId is valid)

    const newAnnouncement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      author: authorId,
      class: classId, // This is the target class ID
      attachments: attachments || []
    });

    try {
      const savedAnnouncement = await newAnnouncement.save();
      this.logger.info('Announcement created successfully', { announcementId: savedAnnouncement._id, authorId, targetClassId: classId });

      // Populate for consistent response
      const populatedAnnouncement = await Announcement.findById(savedAnnouncement._id)
        .populate('author', 'name role')
        .populate('class', 'name grade')
        .lean();
      
      return populatedAnnouncement;
    } catch (error) {
      this.logger.error('Error creating announcement:', { error: error.message, authorId, targetClassId: classId });
      if (error.name === 'ValidationError') {
        throw new BadRequestError('Announcement validation failed.', error.errors);
      }
      throw new AppError('Failed to create announcement due to a server error.', 500, error);
    }
  }

  /**
   * 更新公告
   * @param {Object} requestingUser - 发起请求的用户对象
   * @param {String} announcementId - 要更新的公告ID
   * @param {Object} updateData - 要更新的数据 (title, content, attachments)
   */
  async updateAnnouncement(requestingUser, announcementId, updateData) {
    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      throw new BadRequestError('Invalid announcement ID format.');
    }

    const { id: currentUserId, role } = requestingUser;
    const { title, content, attachments } = updateData;

    // Basic validation for presence of updatable fields if they are provided
    if (updateData.hasOwnProperty('title') && (!title || title.trim() === '')) {
        throw new BadRequestError('Title cannot be empty if provided for update.');
    }
    if (updateData.hasOwnProperty('content') && (!content || content.trim() === '')) {
        throw new BadRequestError('Content cannot be empty if provided for update.');
    }

    try {
      const announcement = await Announcement.findById(announcementId);
      if (!announcement) {
        throw new NotFoundError('Announcement not found to update.');
      }

      // Permission Check: Only author or admin/superadmin can update.
      const isAuthor = announcement.author.toString() === currentUserId;
      const isAdmin = ['admin', 'superadmin'].includes(role);

      if (!isAuthor && !isAdmin) {
        this.logger.warn(`User ${currentUserId} (role: ${role}) attempted to update announcement ${announcementId} without permission.`);
        throw new ForbiddenError('You do not have permission to update this announcement.');
      }
      
      // Apply updates for allowed fields
      if (updateData.hasOwnProperty('title')) announcement.title = title.trim();
      if (updateData.hasOwnProperty('content')) announcement.content = content.trim();
      if (updateData.hasOwnProperty('attachments')) announcement.attachments = attachments || [];
      // author and class are generally not updated via this method.
      // updatedAt is handled by timestamps:true

      const updatedAnnouncementDoc = await announcement.save();
      this.logger.info(`Announcement ${announcementId} updated successfully by user ${currentUserId}.`);

      // Populate for consistent response
      const populatedAnnouncement = await Announcement.findById(updatedAnnouncementDoc._id)
        .populate('author', 'name role')
        .populate('class', 'name grade')
        .lean();
        
      return populatedAnnouncement;
    } catch (error) {
      this.logger.error(`Error updating announcement ${announcementId}:`, { error: error.message, userId: currentUserId });
      if (error.name === 'ValidationError') {
        throw new BadRequestError('Announcement validation failed.', error.errors);
      }
      throw new AppError('Failed to update announcement due to a server error.', 500, error);
    }
  }

  /**
   * 删除公告
   * @param {Object} requestingUser - 发起请求的用户对象
   * @param {String} announcementId - 要删除的公告ID
   */
  async deleteAnnouncement(requestingUser, announcementId) {
    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      throw new BadRequestError('Invalid announcement ID format.');
    }

    const { id: currentUserId, role } = requestingUser;

    try {
      const announcement = await Announcement.findById(announcementId);
      if (!announcement) {
        throw new NotFoundError('Announcement not found to delete.');
      }

      // Permission Check: Only author or admin/superadmin can delete.
      const isAuthor = announcement.author.toString() === currentUserId;
      const isAdmin = ['admin', 'superadmin'].includes(role);
      // Additional check: if a teacher is the author, can they delete if they are no longer teaching the class?
      // For now, being the author is sufficient for non-admins. Admins can always delete.

      if (!isAuthor && !isAdmin) {
        this.logger.warn(`User ${currentUserId} (role: ${role}) attempted to delete announcement ${announcementId} without permission.`);
        throw new ForbiddenError('You do not have permission to delete this announcement.');
      }

      await Announcement.findByIdAndDelete(announcementId);
      this.logger.info(`Announcement ${announcementId} deleted successfully by user ${currentUserId}.`);
      
      return { message: 'Announcement deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting announcement ${announcementId}:`, { error: error.message, userId: currentUserId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete announcement due to a server error.', 500, error);
    }
  }

  /**
   * 获取班级最新公告列表
   * @param {Object} requestingUser - 发起请求的用户对象
   * @param {String} classIdParam - 班级ID (来自路径参数)
   * @param {Object} queryParams - 查询参数 (limit)
   */
  async getLatestClassAnnouncements(requestingUser, classIdParam, queryParams) {
    if (!mongoose.Types.ObjectId.isValid(classIdParam)) {
      throw new BadRequestError('Invalid class ID format in path parameter.');
    }

    const { id: currentUserId, role, classId: userClassId, taughtClasses } = requestingUser;
    const { limit = 5 } = queryParams;

    // Permission check - similar to getAnnouncementById, user must have access to this classIdParam's announcements
    let canViewClassAnnouncements = false;
    if (role === 'admin' || role === 'superadmin') {
        canViewClassAnnouncements = true;
    } else if (role === 'teacher') {
        const teacherAllowedClassIds = (taughtClasses || []).map(id => id.toString());
        if (teacherAllowedClassIds.includes(classIdParam.toString())) {
            canViewClassAnnouncements = true;
        }
    } else if (role === 'student' || role === 'parent') {
        if (userClassId && classIdParam.toString() === userClassId.toString()) {
            canViewClassAnnouncements = true;
        }
    }

    if (!canViewClassAnnouncements) {
        this.logger.warn(`User ${currentUserId} (role: ${role}) attempted to access latest announcements for class ${classIdParam} without permission.`);
        throw new ForbiddenError('You do not have permission to view announcements for this class.');
    }

    try {
      this.logger.debug(`Fetching latest ${limit} announcements for class ${classIdParam}`);
      const announcements = await Announcement.find({ class: classIdParam })
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .populate('author', 'name role') // Do not populate 'class' as it's already known from classIdParam
        .lean();
      
      this.logger.info(`Retrieved ${announcements.length} latest announcements for class ${classIdParam}.`);
      return announcements; // Returns an array directly, no pagination for this specific endpoint
    } catch (error) {
      this.logger.error(`Error fetching latest announcements for class ${classIdParam}:`, { error: error.message });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to retrieve latest class announcements.', 500, error);
    }
  }
}

module.exports = AnnouncementService; 