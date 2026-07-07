const express = require('express');
const router = express.Router();
const notificationsRoutes = require('./notifications');
const { createFamilyNotificationsRouter } = require('./familyNotifications');

// 使用路由
router.use('/', createFamilyNotificationsRouter());
router.use('/notifications', notificationsRoutes);

module.exports = router;
