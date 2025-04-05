const express = require('express');
const router = express.Router();
const notificationsRoutes = require('./notifications');

// 使用路由
router.use('/notifications', notificationsRoutes);

module.exports = router;