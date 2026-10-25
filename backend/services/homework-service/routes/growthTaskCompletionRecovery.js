const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');

const createGrowthTaskCompletionRecoveryRouter = ({ completionService } = {}) => {
  for (const action of ['discoverRecovery', 'listRecoveries', 'recover']) {
    if (typeof completionService?.[action] !== 'function') throw new TypeError('Completion recovery service is required');
  }
  const router = express.Router();
  const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
  const handle = action => async (req, res, next) => {
    try {
      const result = await completionService[action]({ identity: req.user, taskId: req.params.taskId,
        operationId: req.params.operationId, query: req.query, body: req.body });
      res.status(200).json(result);
    } catch (cause) { next(cause); }
  };
  router.get('/completion-recoveries', noStore, authenticateGateway, handle('listRecoveries'));
  router.get('/:taskId/completion-recovery', noStore, authenticateGateway, handle('discoverRecovery'));
  router.post('/:taskId/completion-operations/:operationId/recover', noStore, authenticateGateway, handle('recover'));
  return router;
};

module.exports = { createGrowthTaskCompletionRecoveryRouter };
