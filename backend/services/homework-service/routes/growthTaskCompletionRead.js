const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');

// Enabled formal composition uses this read-only router, without recovery dependencies.
const createGrowthTaskCompletionReadRouter = ({ readService } = {}) => {
  if (typeof readService?.detail !== 'function' || typeof readService?.list !== 'function') {
    throw new TypeError('Task detail and list read service is required');
  }
  const router = express.Router();
  const handle = action => async (req, res, next) => {
    try {
      const result = await readService[action]({ identity: req.user, taskId: req.params.taskId, query: req.query });
      res.status(200).json(result);
    } catch (cause) { next(cause); }
  };
  router.get('/', authenticateGateway, handle('list'));
  router.get('/:taskId', authenticateGateway, handle('detail'));
  return router;
};
module.exports = { createGrowthTaskCompletionReadRouter };
