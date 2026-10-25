const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');

// Enabled formal composition only; legacy keeps its existing task router.
const createGrowthTaskCompletionMutationRouter = ({ mutationService } = {}) => {
  if (typeof mutationService?.edit !== 'function' || typeof mutationService?.remove !== 'function') {
    throw new TypeError('Task edit and remove services are required');
  }
  const router = express.Router();
  const handle = action => async (req, res, next) => {
    try {
      const result = await mutationService[action]({ identity: req.user, taskId: req.params.taskId, body: req.body });
      res.status(200).json(result);
    } catch (cause) { next(cause); }
  };
  router.patch('/:taskId', authenticateGateway, handle('edit'));
  router.delete('/:taskId', authenticateGateway, handle('remove'));
  return router;
};

module.exports = { createGrowthTaskCompletionMutationRouter };
