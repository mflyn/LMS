const express = require('express');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { AppError } = require('../../../common/middleware/errorTypes');
const { error } = require('../services/ai2Contract');
const parsed = Symbol('ai2RawBodyVerified');
function createAi2JsonParser() {
  const parser = express.json({ limit: 32768, verify: (req, _res, buffer, encoding) => {
    if (encoding !== 'utf-8') throw error(400, 'VALIDATION_ERROR');
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    req[parsed] = true;
  } });
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.body !== undefined || req._body) return next(new AppError('AI2_NOT_READY', 503, 'AI2_NOT_READY', true, []));
    parser(req, res, cause => {
      if (!cause) return next();
      const large = cause.type === 'entity.too.large', code = large ? 'AI2_INPUT_TOO_LARGE' : 'VALIDATION_ERROR';
      next(new AppError(code, large ? 413 : 400, code, true, []));
    });
  };
}
// Explicit factory only: formal production assembly is verified separately.
function createAi2Router({ service } = {}) {
  if (!service) throw new TypeError('AI2 service required');
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticateGateway);
  router.use((req, _res, next) => {
    if (req.method === 'POST' && !req[parsed]) return next(new AppError('AI2_NOT_READY', 503, 'AI2_NOT_READY', true, []));
    next();
  });
  const handle = (action, status = 200) => async (req, res, next) => {
    try {
      const allowed = action === 'preview' ? ['cycleId'] : action === 'listCommands' ? ['childId', 'scope', 'page', 'pageSize']
        : action === 'listPackages' ? ['childId', 'page', 'pageSize'] : action === 'listAttempts' ? ['page', 'pageSize'] : [];
      if (Object.entries(req.query).some(([k, v]) => !allowed.includes(k) || typeof v !== 'string')
        || (action === 'listCommands' && req.query.scope !== 'mine')) throw error(400, 'VALIDATION_ERROR');
      const args = { identity: req.user, ...req.params, body: req.body };
      if (action === 'preview') args.cycleId = req.query.cycleId;
      if (action.startsWith('list')) {
        for (const [key, fallback] of [['page', 1], ['pageSize', 20]]) {
          if (req.query[key] !== undefined && !/^[1-9][0-9]*$/.test(req.query[key])) throw error(400, 'VALIDATION_ERROR');
          args[key] = req.query[key] === undefined ? fallback : Number(req.query[key]);
        }
        args.childId = req.query.childId;
      }
      const data = await service[action](args);
      const pending = ['submit', 'recover'].includes(action) && !['SUCCEEDED', 'FAILED'].includes(data.command?.phase);
      return res.status(pending ? 202 : action === 'submit' && data.command?.phase === 'FAILED' ? 200 : status).json({ success: true, data });
    } catch (cause) {
      const known = Number.isInteger(cause.statusCode) && cause.statusCode >= 400 && cause.statusCode <= 599
        && /^(AI2_[A-Z_]+|VALIDATION_ERROR|IDEMPOTENCY_CONFLICT|CHILD_ACCESS_DENIED|STALE_CHILD_TOKEN|RESOURCE_NOT_FOUND|UNAUTHENTICATED|SOURCE_SERVICE_UNAVAILABLE|MEDIA_SERVICE_UNAVAILABLE|SERVICE_UNAVAILABLE)$/.test(cause.code);
      const code = known ? cause.code : 'SERVICE_UNAVAILABLE';
      next(new AppError(code, known ? cause.statusCode : 503, code, true, []));
    }
  };
  router.get('/publication-preview', handle('preview'));
  router.post('/learning-packages', handle('publish', 201));
  router.get('/learning-packages', handle('listPackages'));
  router.get('/learning-packages/:packageId', handle('getPackage'));
  router.post('/learning-packages/:packageId/withdraw', handle('withdraw'));
  router.get('/learning-packages/:packageId/attempts', handle('listAttempts'));
  router.post('/learning-packages/:packageId/attempts', handle('submit', 201));
  router.get('/learning-packages/:packageId/attempts/:attemptId', handle('getAttempt'));
  router.post('/learning-packages/:packageId/attempts/:attemptId/review', handle('review'));
  router.get('/commands', handle('listCommands'));
  router.get('/commands/:commandId', handle('getCommand'));
  router.post('/commands/:commandId/recover', handle('recover'));
  return router;
}
module.exports = { createAi2Router, createAi2JsonParser };
