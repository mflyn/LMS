const express = require('express');
const { createCompletionRetirementCredential } = require('../../../common/middleware/completionRetirementCredential');
const { invalid } = require('../services/growthTaskCompletionCommand');

const createCompletionMediaRetirementRouter = ({ env, service } = {}) => {
  const credential = createCompletionRetirementCredential(env);
  if (typeof service?.retire !== 'function' || typeof service?.status !== 'function') throw new TypeError('Retirement service required');
  const router = express.Router();
  for (const [path, action] of [['/', 'retire'], ['/status', 'status']]) {
    router.post(path, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, credential,
      async (req, res, next) => {
        try {
          if (Object.keys(req.query).length) throw invalid();
          res.status(200).json({ success: true, data: await service[action](req.body) });
        } catch (cause) { next(cause); }
      });
  }
  return router;
};

module.exports = { createCompletionMediaRetirementRouter };
