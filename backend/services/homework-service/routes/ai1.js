const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { error } = require('../services/ai1Contract');
const { AppError } = require('../../../common/middleware/errorTypes');
const parsed = Symbol('ai1RawBodyVerified');
function createAi1JsonParser() {
  const parser = express.json({ limit: 32768, verify: (req, _res, buffer, encoding) => {
    if (encoding !== 'utf-8') throw error(400, 'VALIDATION_ERROR');
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    req[parsed] = buffer.length <= 32768;
  } });
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.body !== undefined || req._body) return next(new AppError('AI_PROFILE_UNAVAILABLE', 503, 'AI_PROFILE_UNAVAILABLE', true, []));
    parser(req, res, cause => {
      if (!cause) return next();
      const large = cause.type === 'entity.too.large';
      const code = large ? 'AI_INPUT_TOO_LARGE' : 'VALIDATION_ERROR';
      next(new AppError(code, large ? 413 : 400, code, true, []));
    });
  };
}

// The router does not create a Provider; runtime activation is a separate boundary.
function createAi1Router({ service } = {}) {
  if (!service) throw new TypeError('AI1 service required');
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticateGateway);
  router.use((req, _res, next) => {
    if (req.method === 'POST' && !req[parsed]) return next(new AppError('AI_PROFILE_UNAVAILABLE', 503, 'AI_PROFILE_UNAVAILABLE', true, []));
    next();
  });
  const handle = (action, status = 200) => async (req, res, next) => {
    try {
      let args = { identity: req.user, ...req.params, body: req.body };
      if (action === 'listJobs' || action === 'listCycles') {
        const allowed = action === 'listJobs' ? ['childId', 'scope', 'page', 'pageSize'] : ['childId', 'page', 'pageSize'];
        if (Object.keys(req.query).some(k => !allowed.includes(k)) || typeof req.query.childId !== 'string'
          || (action === 'listJobs' && req.query.scope !== 'mine-unfinished')) throw error(400, 'VALIDATION_ERROR');
        const number = (key, fallback) => {
          if (req.query[key] === undefined) return fallback;
          if (typeof req.query[key] !== 'string' || !/^[1-9][0-9]*$/.test(req.query[key])) throw error(400, 'VALIDATION_ERROR');
          return Number(req.query[key]);
        };
        args = { identity: req.user, childId: req.query.childId, page: number('page', 1), pageSize: number('pageSize', 20) };
      } else if (Object.keys(req.query).length) throw error(400, 'VALIDATION_ERROR');
      const data = await service[action](args);
      const code = action === 'recover' ? (['succeeded', 'failed'].includes(data.job.status) ? 200 : 202) : status;
      return res.status(code).json({ success: true, data });
    } catch (cause) {
      // Do not let dependency/driver messages expose inputs, credentials or other families.
      const known = Number.isInteger(cause.statusCode) && cause.statusCode >= 400 && cause.statusCode <= 599
        && /^(AI_[A-Z_]+|VALIDATION_ERROR|IDEMPOTENCY_KEY_REUSED|CHILD_ACCESS_DENIED|RESOURCE_NOT_FOUND|UNAUTHENTICATED|SOURCE_SERVICE_UNAVAILABLE|SERVICE_UNAVAILABLE)$/.test(cause.code);
      const code = known ? cause.code : 'SERVICE_UNAVAILABLE';
      next(new AppError(code, known ? cause.statusCode : 503, code, true, []));
    }
  };
  router.post('/tutor-cycles', handle('create', 201));
  router.get('/tutor-cycles', handle('listCycles'));
  router.get('/tutor-cycles/:cycleId', handle('getCycle'));
  router.post('/tutor-cycles/:cycleId/explanation-jobs', handle('generateAndRun', 202));
  router.post('/tutor-cycles/:cycleId/explanation-revisions', handle('revise', 201));
  router.post('/tutor-cycles/:cycleId/explanation-review', handle('review'));
  router.post('/tutor-cycles/:cycleId/cancel', handle('close'));
  router.get('/tutor-jobs', handle('listJobs'));
  router.get('/tutor-jobs/:jobId', handle('getJob'));
  router.post('/tutor-jobs/:jobId/recover', handle('recover'));
  router.get('/tutor-artifacts/:artifactId', handle('getArtifact'));
  return router;
}
module.exports = { createAi1Router, createAi1JsonParser };
