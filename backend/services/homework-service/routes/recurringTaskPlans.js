const express = require('express');
const { authenticateGateway, checkRole } = require('../../../common/middleware/auth');
const { invalid } = require('../services/recurringTaskPlanCommand');
const createRecurringTaskPlanRouter = ({ service }) => {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticateGateway, checkRole('parent'));
  const bind = (method, path, allowedQuery, action) => router[method](path, async (req, res, next) => {
    try {
      if (Object.keys(req.query).some(key => !allowedQuery.includes(key))
        || Object.values(req.query).some(value => typeof value !== 'string')) throw invalid();
      for (const key of ['page', 'pageSize']) if (req.query[key] !== undefined && !/^[1-9]\d*$/.test(req.query[key])) throw invalid();
      const result = await action({ identity: req.user, ...req.params, body: req.body,
        ...req.query, ...Object.fromEntries(['page', 'pageSize'].filter(key => req.query[key] !== undefined)
          .map(key => [key, Number(req.query[key])])) });
      return res.status(result.httpStatus || 200).json({ success: true, data: result.httpStatus ? result.data : result });
    } catch (cause) { return next(cause); }
  });
  bind('get', '/recurring-task-plans', ['childId', 'page', 'pageSize'], input => service.listPlans(input));
  bind('post', '/recurring-task-plans', [], input => service.execute({ ...input, action: 'create' }));
  bind('get', '/recurring-task-plans/:planId', [], input => service.getPlan(input));
  bind('patch', '/recurring-task-plans/:planId', [], input => service.execute({ ...input, action: 'patch' }));
  bind('post', '/recurring-task-plans/:planId/stop', [], input => service.execute({ ...input, action: 'stop' }));
  bind('get', '/recurring-task-plan-commands', ['childId', 'page', 'pageSize'], input => service.listCommands(input));
  bind('get', '/recurring-task-plan-commands/:operationId', ['childId'], input => service.getCommand(input));
  bind('post', '/recurring-task-plan-commands/:operationId/abort', [], input => service.abort(input));
  return router;
};
module.exports = { createRecurringTaskPlanRouter };
