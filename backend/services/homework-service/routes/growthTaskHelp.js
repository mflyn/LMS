const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const createGrowthTaskHelpRouter = ({ helpService } = {}) => {
  if (typeof helpService?.update !== 'function') throw new TypeError('Help service required');
  const router = express.Router();
  router.patch('/:taskId/help', authenticateGateway, async (req, res, next) => {
    try {
      if (Object.keys(req.query).length) return res.status(400).json({ success: false,
        error: { code: 'VALIDATION_ERROR', message: 'VALIDATION_ERROR', details: [] } });
      const result = await helpService.update({ identity: req.user, taskId: req.params.taskId, body: req.body });
      return res.status(200).json(result);
    } catch (cause) { return next(cause); }
  });
  return router;
};
module.exports = { createGrowthTaskHelpRouter };
