const express = require('express');
const router = express.Router();

// 导入各个路由模块
const authRoutes = require('./auth');
const userRoutes = require('./user');
const studentRoutes = require('./student');
const familyRoutes = require('./family');
const { createChildrenRouter } = require('./children');
const { createFamilyController } = require('../controllers/familyController');

const createRoutes = ({ childAvatarMediaService = null } = {}) => {
  const composed = express.Router();
  const controller = createFamilyController({ childAvatarMediaService });
  composed.use('/auth', authRoutes);
  composed.use('/users', userRoutes);
  composed.use('/students', studentRoutes);
  composed.use('/families', familyRoutes);
  composed.use('/children', createChildrenRouter({ controller }));
  return composed;
};

router.use(createRoutes());

module.exports = router;
module.exports.createRoutes = createRoutes;
