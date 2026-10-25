const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');

// Mounted by enabled formal composition; legacy keeps its original writer.
const createGrowthTaskCompletionRouter = ({ completionService, confirmationService } = {}) => {
  if (typeof completionService?.complete !== 'function' || typeof confirmationService?.confirm !== 'function') {
    throw new TypeError('Completion and confirmation services are required');
  }
  const router = express.Router();
  const handle = (service, action) => async (req, res, next) => {
    try {
      const result = await service[action]({ identity: req.user, taskId: req.params.taskId, body: req.body });
      res.status(200).json(result);
    } catch (cause) {
      next(cause);
    }
  };
  router.patch('/:taskId/complete', authenticateGateway, handle(completionService, 'complete'));
  router.patch('/:taskId/confirm', authenticateGateway, handle(confirmationService, 'confirm'));
  return router;
};

module.exports = { createGrowthTaskCompletionRouter };
