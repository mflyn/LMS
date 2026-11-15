const express = require('express');
const { createInternalMediaReferencesRouter } = require('./internalMediaReferences');
const { createCompletionMediaReferencesRouter } = require('./completionMediaReferences');
const { PURPOSE_BY_FIELD } = require('../services/mediaReferenceService');
const { AppError } = require('../../../common/middleware/errorTypes');
const { validPair } = require('../../../common/services/completionMediaProtocol');

// Enabled resource composition only; legacy production keeps its original router.
const createMediaReferenceProtocolRouter = ({ credential, referenceService, operationService,
  assertAi2Continuous = () => {},
  assertAi3Continuous = () => { throw new AppError('AI3_NOT_READY', 503, 'AI3_NOT_READY', true, []); } } = {}) => {
  if (typeof assertAi2Continuous !== 'function') throw new TypeError('AI2 continuity assertion is required');
  if (typeof assertAi3Continuous !== 'function') throw new TypeError('AI3 continuity assertion is required');
  const legacy = createInternalMediaReferencesRouter({ credential, referenceService });
  const completion = createCompletionMediaReferencesRouter({ credential, operationService });
  const router = express.Router();
  const invalid = () => new AppError('Invalid media reference protocol', 400, 'VALIDATION_ERROR', true, []);
  for (const action of ['prepare', 'commit', 'unbind', 'abort', 'status']) {
    router.post('/' + action, credential, (req, res, next) => {
      const body = req.body;
      if (body?.resourceType === 'ai2_attempt') {
        try { assertAi2Continuous(); } catch (cause) { return next(cause); }
      }
      if (body?.resourceType === 'ai3_attempt') {
        try { assertAi3Continuous(); } catch (cause) { return next(cause); }
      }
      if (!body || !Array.isArray(body.references) || !body.references.length) return next(invalid());
      const references = Array.from(body.references);
      const isCompletion = references.every(ref => ref && validPair(body.resourceType, ref.field));
      const isLegacy = references.every(ref => ref && Object.prototype.hasOwnProperty.call(
        PURPOSE_BY_FIELD, `${body.resourceType}.${ref.field}`));
      if (isCompletion) return completion(req, res, next);
      if (isLegacy && ['prepare', 'commit', 'unbind'].includes(action)
        && !['commandHash', 'mode', 'remoteOperationId'].some(key => Object.prototype.hasOwnProperty.call(body, key))) {
        return legacy(req, res, next);
      }
      return next(invalid());
    });
  }
  return router;
};

module.exports = { createMediaReferenceProtocolRouter };
