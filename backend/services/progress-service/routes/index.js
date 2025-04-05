const express = require('express');
const router = express.Router();
const progressRoutes = require('./progress');
const reportRoutes = require('./reports');

// 使用路由
router.use('/student', progressRoutes);
router.use('/reports', reportRoutes);

module.exports = router;