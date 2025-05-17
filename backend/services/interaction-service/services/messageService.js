const Message = require('../models/Message');
const { NotFoundError, ForbiddenError, BadRequestError, AppError } = require('../../../common/middleware/errorTypes');
const mongoose = require('mongoose'); // Needed for ObjectId validation

class MessageService {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * 获取消息列表 (用户只能获取自己参与的消息)
   * @param {Object} requestingUser - 发起请求的用户对象 (req.user)
   * @param {Object} queryParams - 查询参数 (contactId, startDate, endDate, page, limit, sortBy, sortOrder)
   */
  async getMessages(requestingUser, queryParams) {
    const { id: currentUserId } = requestingUser;
    const { 
      contactId, // ID of the other user in the conversation
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const query = {
      $or: [
        { sender: currentUserId },
        { receiver: currentUserId }
      ]
    };

    if (contactId) {
      if (!mongoose.Types.ObjectId.isValid(contactId)) {
        throw new BadRequestError('Invalid contactId format.');
      }
      // User wants messages specifically with contactId
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { sender: currentUserId, receiver: contactId },
            { sender: contactId, receiver: currentUserId }
          ]
        }
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    if (['createdAt', 'updatedAt'].includes(sortBy)) { // Common sort fields
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions['createdAt'] = -1; // Default sort
    }

    try {
      this.logger.debug('Executing getMessages query', { userId: currentUserId, query, page, limit, sortOptions });
      const messages = await Message.find(query)
        .populate('sender', 'name role email') // Adjust fields as necessary
        .populate('receiver', 'name role email') // Adjust fields as necessary
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(); // Use lean for performance if not modifying docs

      const totalMessages = await Message.countDocuments(query);
      this.logger.info(`Retrieved ${messages.length} messages for user ${currentUserId} (total: ${totalMessages})`);

      return {
        data: messages,
        pagination: {
          total: totalMessages,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(totalMessages / limit)
        }
      };
    } catch (error) {
      this.logger.error('Error fetching messages:', { error: error.message, userId: currentUserId, queryParams });
      // Let the global error handler manage this, but ensure it's an AppError or similar
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to retrieve messages due to a server error.', 500, error);
    }
  }

  /**
   * 获取单个消息详情
   * @param {Object} requestingUser - 发起请求的用户对象
   * @param {String} messageId - 要获取的消息ID
   */
  async getMessageById(requestingUser, messageId) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw new BadRequestError('Invalid message ID format.');
    }

    const { id: currentUserId } = requestingUser;

    try {
      this.logger.debug(`Attempting to find message ${messageId} for user ${currentUserId}`);
      const message = await Message.findById(messageId)
        .populate('sender', 'name role email')
        .populate('receiver', 'name role email')
        .lean();

      if (!message) {
        throw new NotFoundError('Message not found.');
      }

      // Permission check: User must be sender or receiver
      if (message.sender._id.toString() !== currentUserId && message.receiver._id.toString() !== currentUserId) {
        // Note: ._id is used here because sender/receiver are populated objects
        this.logger.warn(`User ${currentUserId} attempted to access message ${messageId} without permission.`);
        throw new ForbiddenError('You do not have permission to view this message.');
      }
      
      // Optional: If message is fetched by receiver and not read, mark as read.
      // This could also be a separate explicit action (like markMessageAsRead).
      // For now, GETting a message does not automatically mark it as read.

      this.logger.info(`Message ${messageId} retrieved successfully for user ${currentUserId}`);
      return message;
    } catch (error) {
      this.logger.error(`Error fetching message ${messageId}:`, { error: error.message, userId: currentUserId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to retrieve message due to a server error.', 500, error);
    }
  }

  /**
   * 发送新消息
   * @param {Object} requestingUser - 发起请求的用户对象 (req.user)
   * @param {Object} messageData - 消息数据 (receiver, content, attachments)
   */
  async sendMessage(requestingUser, messageData) {
    const { id: senderId } = requestingUser;
    const { receiver, content, attachments } = messageData;

    // Basic validation - more detailed validation should be in a validation middleware layer
    if (!receiver || !mongoose.Types.ObjectId.isValid(receiver)) {
      throw new BadRequestError('Valid receiver ID is required.');
    }
    if (!content || typeof content !== 'string' || content.trim() === '') {
      throw new BadRequestError('Message content cannot be empty.');
    }
    if (senderId === receiver) {
        throw new BadRequestError('Sender and receiver cannot be the same user.');
    }

    // TODO: Optional - Check if receiver user exists in the User service/database.
    // This might involve an RPC call or a shared database context if User model is not directly accessible.
    // For now, we assume receiver ID is valid if it passes ObjectId check.

    const newMessage = new Message({
      sender: senderId,
      receiver,
      content: content.trim(),
      attachments: attachments || [], // Ensure attachments is an array
      read: false // New messages are unread by default
    });

    try {
      const savedMessage = await newMessage.save();
      this.logger.info('Message sent successfully', { messageId: savedMessage._id, sender: senderId, receiver });
      
      // Populate sender and receiver for the response, similar to GET requests
      const populatedMessage = await Message.findById(savedMessage._id)
        .populate('sender', 'name role email')
        .populate('receiver', 'name role email')
        .lean();

      // TODO: Emit a real-time event (e.g., via WebSocket) to notify the receiver
      // this.eventEmitter.emit('newMessage', populatedMessage);

      return populatedMessage;
    } catch (error) {
      this.logger.error('Error sending message:', { error: error.message, senderId, receiver, contentPreview: content.substring(0, 50) });
      if (error.name === 'ValidationError') {
        throw new BadRequestError('Message validation failed.', error.errors);
      }
      throw new AppError('Failed to send message due to a server error.', 500, error);
    }
  }

  /**
   * 将消息标记为已读
   * @param {Object} requestingUser - 发起请求的用户对象
   * @param {String} messageId - 要标记的消息ID
   */
  async markMessageAsRead(requestingUser, messageId) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw new BadRequestError('Invalid message ID format.');
    }

    const { id: currentUserId } = requestingUser;

    try {
      const message = await Message.findById(messageId);

      if (!message) {
        throw new NotFoundError('Message not found to mark as read.');
      }

      // Permission check: Only the receiver can mark the message as read.
      if (message.receiver.toString() !== currentUserId) {
        this.logger.warn(`User ${currentUserId} attempted to mark message ${messageId} (receiver: ${message.receiver.toString()}) as read without permission.`);
        throw new ForbiddenError('You can only mark messages addressed to you as read.');
      }

      if (message.read) {
        this.logger.info(`Message ${messageId} is already marked as read.`);
        // Return the message populated, consistent with successful update
        return Message.findById(messageId)
            .populate('sender', 'name role email')
            .populate('receiver', 'name role email')
            .lean();
      }

      message.read = true;
      const updatedMessage = await message.save();
      this.logger.info(`Message ${messageId} marked as read for user ${currentUserId}.`);
      
      // Populate for consistency
      return Message.findById(updatedMessage._id)
        .populate('sender', 'name role email')
        .populate('receiver', 'name role email')
        .lean();

    } catch (error) {
      this.logger.error(`Error marking message ${messageId} as read:`, { error: error.message, userId: currentUserId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to mark message as read due to a server error.', 500, error);
    }
  }

  /**
   * 删除消息 (仅发送者可以删除)
   * @param {Object} requestingUser - 发起请求的用户对象
   * @param {String} messageId - 要删除的消息ID
   */
  async deleteMessage(requestingUser, messageId) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw new BadRequestError('Invalid message ID format.');
    }

    const { id: currentUserId } = requestingUser;

    try {
      const message = await Message.findById(messageId);

      if (!message) {
        throw new NotFoundError('Message not found to delete.');
      }

      // Permission check: Only the sender can delete the message.
      if (message.sender.toString() !== currentUserId) {
        this.logger.warn(`User ${currentUserId} attempted to delete message ${messageId} (sender: ${message.sender.toString()}) without permission.`);
        throw new ForbiddenError('You can only delete messages that you have sent.');
      }

      await Message.findByIdAndDelete(messageId); // Or message.deleteOne() if you prefer instance method
      this.logger.info(`Message ${messageId} deleted successfully by sender ${currentUserId}.`);

      // Typically for a DELETE operation, a 204 No Content response is sent from the controller,
      // so no specific data needs to be returned from the service, or just a confirmation object.
      return { message: 'Message deleted successfully' }; 

    } catch (error) {
      this.logger.error(`Error deleting message ${messageId}:`, { error: error.message, userId: currentUserId });
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete message due to a server error.', 500, error);
    }
  }

  /**
   * 获取用户的未读消息数量
   * @param {Object} requestingUser - 发起请求的用户对象
   * @param {String} targetUserId - 要查询未读数量的目标用户ID (通常是 requestingUser.id)
   */
  async getUnreadMessageCount(requestingUser, targetUserIdFromQuery) {
    const { id: currentUserId } = requestingUser;

    // Permission: User can only get their own unread count.
    // targetUserIdFromQuery is what client sends, it MUST match currentUserId unless admin/specific role.
    // For simplicity, we'll enforce targetUserIdFromQuery must be currentUserId.
    if (!targetUserIdFromQuery || !mongoose.Types.ObjectId.isValid(targetUserIdFromQuery)) {
        throw new BadRequestError('Valid target user ID (userId) query parameter is required.');
    }

    if (targetUserIdFromQuery !== currentUserId) {
        this.logger.warn(`User ${currentUserId} attempted to get unread message count for another user ${targetUserIdFromQuery}.`);
        throw new ForbiddenError('You can only retrieve your own unread message count.');
    }

    try {
      const unreadCount = await Message.countDocuments({
        receiver: currentUserId, // Query by current user ID
        read: false
      });
      this.logger.info(`User ${currentUserId} has ${unreadCount} unread messages.`);
      return { unreadCount };
    } catch (error) {
      this.logger.error(`Error fetching unread message count for user ${currentUserId}:`, { error: error.message });
      throw new AppError('Failed to retrieve unread message count.', 500, error);
    }
  }
}

module.exports = MessageService; 