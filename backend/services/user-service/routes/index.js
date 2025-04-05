const express = require('express');
const router = express.Router();

// 导入各个路由模块
const authRoutes = require('./auth');
const userRoutes = require('./user');

// 使用路由
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

module.exports = router;