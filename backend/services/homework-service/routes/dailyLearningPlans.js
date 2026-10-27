const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { createDailyLearningPlanService } = require('../services/dailyLearningPlanService');
const { invalid } = require('../services/growthTaskCompletionCommand');
const createDailyLearningPlanRouter = ({ service = createDailyLearningPlanService() } = {}) => {
  const router = express.Router();
  for (const method of ['get', 'put']) router[method]('/:childId/daily-learning-plans/:localDate', authenticateGateway, async (req, res, next) => {
    try {
      if (Object.keys(req.query).length) throw invalid();
      return res.status(200).json(await service[method]({ identity: req.user, childId: req.params.childId,
        localDate: req.params.localDate, body: req.body }));
    } catch (cause) { return next(cause); }
  });
  return router;
};
module.exports = { createDailyLearningPlanRouter };
