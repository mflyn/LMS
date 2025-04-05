const express = require('express');
const router = express.Router();

// 导入各个路由模块
const gradeRoutes = require('./grade');
const homeworkRoutes = require('./homework');
const classPerformanceRoutes = require('./class-performance');
const mistakeRecordRoutes = require('./mistake-record');

// 使用路由
router.use('/grades', gradeRoutes);
router.use('/homework', homeworkRoutes);
router.use('/class-performance', classPerformanceRoutes);
router.use('/mistake-record', mistakeRecordRoutes);

module.exports = router;