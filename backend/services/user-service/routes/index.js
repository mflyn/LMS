const express = require('express');
const router = express.Router();

// 导入各个路由模块
const authRoutes = require('./auth');
const userRoutes = require('./user');
const studentRoutes = require('./student');
const familyRoutes = require('./family');
const childrenRoutes = require('./children');

// 使用路由
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/students', studentRoutes);
router.use('/families', familyRoutes);
router.use('/children', childrenRoutes);

module.exports = router;
