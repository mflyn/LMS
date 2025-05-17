const express = require('express');
const router = express.Router();
const AnnouncementService = require('../services/announcementService');
const {
  validateGetAnnouncements,
  validateCreateAnnouncement,
  validateUpdateAnnouncement,
  validateGetLatestClassAnnouncements,
  validateMongoId
} = require('../validators/announcementValidators');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const catchAsync = require('../../../common/utils/catchAsync');
const AppResponse = require('../../../common/utils/AppResponse');
const { USER_ROLES } = require('../../../common/constants/userRoles');

const announcementService = new AnnouncementService();

// 获取公告列表
router.get(
  '/',
  authenticateGateway,
  validateGetAnnouncements,
  catchAsync(async (req, res) => {
    const { data, pagination } = await announcementService.getAnnouncements(req.query, req.user);
    new AppResponse(res, { data, pagination }).send();
  })
);

// 获取单个公告
router.get(
  '/:id',
  authenticateGateway,
  validateMongoId('id'),
  catchAsync(async (req, res) => {
    const announcement = await announcementService.getAnnouncementById(req.params.id, req.user);
    new AppResponse(res, announcement).send();
  })
);

// 创建公告
router.post(
  '/',
  authenticateGateway,
  checkRole([USER_ROLES.ADMIN, USER_ROLES.TEACHER]),
  validateCreateAnnouncement,
  catchAsync(async (req, res) => {
    const announcement = await announcementService.createAnnouncement(req.body, req.user);
    new AppResponse(res, announcement, '公告创建成功', 201).send();
  })
);

// 更新公告
router.put(
  '/:id',
  authenticateGateway,
  validateMongoId('id'),
  validateUpdateAnnouncement,
  catchAsync(async (req, res) => {
    const announcement = await announcementService.updateAnnouncement(req.params.id, req.body, req.user);
    new AppResponse(res, announcement, '公告更新成功').send();
  })
);

// 删除公告
router.delete(
  '/:id',
  authenticateGateway,
  validateMongoId('id'),
  catchAsync(async (req, res) => {
    await announcementService.deleteAnnouncement(req.params.id, req.user);
    new AppResponse(res, null, '公告删除成功').send();
  })
);

// 获取班级最新公告
router.get(
  '/class/:classId/latest',
  authenticateGateway,
  validateMongoId('classId'), // Ensuring classId is a valid MongoId
  validateGetLatestClassAnnouncements, // For other query params like limit
  catchAsync(async (req, res) => {
    const announcements = await announcementService.getLatestClassAnnouncements(
      req.params.classId,
      req.query, // Pass the whole query for limit
      req.user
    );
    new AppResponse(res, announcements).send();
  })
);

module.exports = router;