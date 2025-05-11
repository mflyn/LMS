const express = require('express');
const router = express.Router();
const { resourceValidation } = require('../../../common/middleware/requestValidator');
const { validate } = require('../../../common/middleware/requestValidator');
const { upload, fileUploadSecurity } = require('../../../common/middleware/fileUploadSecurity');
const resourceController = require('../controllers/resourceController');

// 上传资源
router.post(
  '/',
  fileUploadSecurity,
  upload.single('file'),
  resourceValidation,
  validate,
  resourceController.uploadResource
);

// 获取资源列表
router.get(
  '/',
  resourceController.getResources
);

// 获取资源详情
router.get(
  '/:id',
  resourceController.getResource
);

// 删除资源
router.delete(
  '/:id',
  resourceController.deleteResource
);

module.exports = router; 