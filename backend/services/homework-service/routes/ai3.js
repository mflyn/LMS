const express = require('express');
const { TextDecoder } = require('util');
const { authenticateGateway } = require('../../../common/middleware/auth');
const { AppError } = require('../../../common/middleware/errorTypes');
const { addLocalDateDays } = require('../../../common/utils/familyDate');
const { error } = require('../services/ai3Contract');
const parsed = Symbol('ai3RawBodyVerified');
function createAi3JsonParser() {
  const parser = express.json({ limit: 32768, verify: (req, _res, bytes, encoding) => {
    if (encoding !== 'utf-8') throw error(400, 'VALIDATION_ERROR');
    new TextDecoder('utf-8', { fatal: true }).decode(bytes); req[parsed] = true;
  } });
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.body !== undefined || req._body) return next(new AppError('AI3_NOT_READY', 503, 'AI3_NOT_READY', true, []));
    parser(req, res, cause => {
      if (!cause) return next();
      const large = cause.type === 'entity.too.large', code = large ? 'AI3_INPUT_TOO_LARGE' : 'VALIDATION_ERROR';
      return next(new AppError(code, large ? 413 : 400, code, true, []));
    });
  };
}
const pagination = (query, args) => {
  for (const [key, fallback, max] of [['page', 1, Number.MAX_SAFE_INTEGER], ['pageSize', 20, 100]]) {
    const value = query[key] === undefined ? fallback : Number(query[key]);
    if (query[key] !== undefined && !/^[1-9][0-9]*$/.test(query[key])
      || !Number.isSafeInteger(value) || value < 1 || value > max) throw error(400, 'VALIDATION_ERROR');
    args[key] = value;
  }
};
function createAi3Router({ service } = {}) {
  if (!service) throw new TypeError('AI3 service required');
  const router = express.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticateGateway);
  router.use((req, _res, next) => {
    if (req.method === 'POST' && !req[parsed]) return next(new AppError('AI3_NOT_READY', 503, 'AI3_NOT_READY', true, []));
    return next();
  });
  const handle = (action, status = 200) => async (req, res, next) => {
    try {
      const allowed = action === 'listRounds' ? ['childId','page','pageSize','reviewFrom','reviewTo']
        : action === 'listCommands' ? ['childId','scope','page','pageSize']
          : ['listAttempts', 'listContents'].includes(action) ? ['page','pageSize'] : [];
      if (Object.entries(req.query).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')
        || action === 'listCommands' && req.query.scope !== 'mine') throw error(400, 'VALIDATION_ERROR');
      const args = { identity: req.user, ...req.params, body: req.body };
      if (action.startsWith('list')) {
        pagination(req.query, args);
        if (['listRounds', 'listCommands'].includes(action)) args.childId = req.query.childId;
      }
      if (action === 'listRounds') {
        for (const field of ['reviewFrom', 'reviewTo']) {
          if (req.query[field] !== undefined) {
            try { addLocalDateDays(req.query[field], 0); } catch (_) { throw error(400, 'VALIDATION_ERROR'); }
            args[field] = req.query[field];
          }
        }
        if (args.reviewFrom && args.reviewTo && args.reviewFrom > args.reviewTo) throw error(400, 'VALIDATION_ERROR');
      }
      let data = await service[action](args);
      // Generation dispatch is an explicit write, never a side effect of command reads.
      if (action === 'generate' && data.command?.phase === 'RESERVED') {
        data = await service.runGeneration({ identity: req.user, commandId: data.command.id });
      }
      const commandAction = ['generate', 'submit', 'review', 'recover'].includes(action);
      const pending = commandAction && data.command && !['SUCCEEDED', 'FAILED'].includes(data.command.phase);
      const responseStatus = pending ? 202 : action === 'submit' && data.command?.phase === 'FAILED' ? 200 : status;
      return res.status(responseStatus).json({ success: true, data });
    } catch (cause) {
      const known = Number.isInteger(cause.statusCode) && cause.statusCode >= 400 && cause.statusCode <= 599
        && /^(AI3_[A-Z_]+|AI_[A-Z_]+|VALIDATION_ERROR|IDEMPOTENCY_CONFLICT|CHILD_ACCESS_DENIED|STALE_CHILD_TOKEN|RESOURCE_NOT_FOUND|UNAUTHENTICATED|SOURCE_SERVICE_UNAVAILABLE|MEDIA_SERVICE_UNAVAILABLE|SERVICE_UNAVAILABLE)$/.test(cause.code);
      const code = known ? cause.code : 'SERVICE_UNAVAILABLE';
      return next(new AppError(code, known ? cause.statusCode : 503, code, true, []));
    }
  };
  router.post('/practice-rounds', handle('create', 201));
  router.get('/practice-rounds', handle('listRounds'));
  router.get('/practice-rounds/:roundId', handle('getRound'));
  router.get('/practice-rounds/:roundId/contents', handle('listContents'));
  router.get('/practice-rounds/:roundId/contents/:contentId', handle('getContent'));
  router.get('/practice-rounds/:roundId/generation-preview', handle('generationPreview'));
  router.post('/practice-rounds/:roundId/generate', handle('generate', 202));
  router.post('/practice-rounds/:roundId/content-revisions', handle('reviseContent', 201));
  router.post('/practice-rounds/:roundId/reject-content', handle('rejectContent'));
  router.get('/practice-rounds/:roundId/publication-preview', handle('publicationPreview'));
  router.post('/practice-rounds/:roundId/publish', handle('publish', 201));
  router.post('/practice-rounds/:roundId/cancel', handle('cancel'));
  router.post('/practice-rounds/:roundId/withdraw', handle('withdraw'));
  router.get('/practice-rounds/:roundId/attempts', handle('listAttempts'));
  router.post('/practice-rounds/:roundId/attempts', handle('submit', 201));
  router.get('/practice-rounds/:roundId/attempts/:attemptId', handle('getAttempt'));
  router.get('/practice-rounds/:roundId/attempts/:attemptId/review-context', handle('reviewContext'));
  router.post('/practice-rounds/:roundId/attempts/:attemptId/review', handle('review'));
  router.get('/commands', handle('listCommands'));
  router.get('/commands/:commandId', handle('getCommand'));
  router.post('/commands/:commandId/recover', handle('recover'));
  router.use((_req, _res, next) => next(new AppError('RESOURCE_NOT_FOUND', 404, 'RESOURCE_NOT_FOUND', true, [])));
  return router;
}
module.exports = { createAi3Router, createAi3JsonParser };
