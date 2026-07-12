const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { applySensitiveRateLimit } = require('../../../common/middleware/sensitiveRateLimit');
const familyController = require('../controllers/familyController');

const createChildrenRouter = ({ controller = familyController } = {}) => {
  const router = express.Router();
  router.post('/', authenticateGateway, controller.createChild);
  router.get('/', authenticateGateway, controller.listChildren);
  router.get('/:childId', authenticateGateway, controller.getChild);
  router.patch('/:childId', authenticateGateway, controller.updateChild);
  router.post('/:childId/pin', authenticateGateway, applySensitiveRateLimit, controller.setChildPin);
  return router;
};

module.exports = createChildrenRouter();
module.exports.createChildrenRouter = createChildrenRouter;
