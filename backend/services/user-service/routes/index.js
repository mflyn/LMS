const express = require('express');
const router = express.Router();

// 导入各个路由模块
const authRoutes = require('./auth');
const userRoutes = require('./user');
const studentRoutes = require('./student');

// 使用路由
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/students', studentRoutes);

module.exports = router;