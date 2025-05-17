const express = require('express');
const router = express.Router();
const MessageService = require('../services/messageService');
const { validate } = require('../../../common/middleware/requestValidator');
const { catchAsync } = require('../../../common/middleware/errorHandler');
const { AppResponse } = require('../../../common/utils/appResponse');
const {
  getMessagesValidationRules,
  messageIdValidationRules,
  sendMessageValidationRules,
  getUnreadStatsValidationRules
} = require('../validators/messageValidators');

// Helper to get service instance (could be a more sophisticated DI)
const getService = (req) => new MessageService(req.app.locals.logger);

// 获取消息列表
router.get('/', 
  getMessagesValidationRules(), 
  validate, 
  catchAsync(async (req, res) => {
    const service = getService(req);
    const result = await service.getMessages(req.user, req.query);
    res.status(200).json(new AppResponse(200, 'Messages retrieved successfully.', result.data, null, result.pagination));
  })
);

// 获取单个消息
router.get('/:id', 
  messageIdValidationRules(), 
  validate, 
  catchAsync(async (req, res) => {
    const service = getService(req);
    const message = await service.getMessageById(req.user, req.params.id);
    res.status(200).json(new AppResponse(200, 'Message retrieved successfully.', message));
  })
);

// 发送消息
router.post('/', 
  sendMessageValidationRules(), 
  validate, 
  catchAsync(async (req, res) => {
    const service = getService(req);
    const message = await service.sendMessage(req.user, req.body);
    res.status(201).json(new AppResponse(201, 'Message sent successfully.', message));
  })
);

// 标记消息为已读
router.put('/:id/read', 
  messageIdValidationRules(), 
  validate, 
  catchAsync(async (req, res) => {
    const service = getService(req);
    const message = await service.markMessageAsRead(req.user, req.params.id);
    res.status(200).json(new AppResponse(200, 'Message marked as read.', message));
  })
);

// 删除消息
router.delete('/:id', 
  messageIdValidationRules(), 
  validate, 
  catchAsync(async (req, res) => {
    const service = getService(req);
    await service.deleteMessage(req.user, req.params.id);
    res.status(200).json(new AppResponse(200, 'Message deleted successfully.')); // Or 204 No Content
  })
);

// 获取未读消息数量
router.get('/stats/unread', 
  getUnreadStatsValidationRules(),
  validate, 
  catchAsync(async (req, res) => {
    const service = getService(req);
    // Service method expects targetUserId as a second param, which comes from query for this route
    const result = await service.getUnreadMessageCount(req.user, req.query.userId);
    res.status(200).json(new AppResponse(200, 'Unread message count retrieved.', result));
  })
);

module.exports = router;