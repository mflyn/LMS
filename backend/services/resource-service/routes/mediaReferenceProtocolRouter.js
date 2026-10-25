const express = require('express');
const { createInternalMediaReferencesRouter } = require('./internalMediaReferences');
const { createCompletionMediaReferencesRouter } = require('./completionMediaReferences');
const { PURPOSE_BY_FIELD } = require('../services/mediaReferenceService');
const { AppError } = require('../../../common/middleware/errorTypes');

// Enabled resource composition only; legacy production keeps its original router.
const createMediaReferenceProtocolRouter = ({ credential, referenceService, operationService } = {}) => {
  const legacy = createInternalMediaReferencesRouter({ credential, referenceService });
  const completion = createCompletionMediaReferencesRouter({ credential, operationService });
  const router = express.Router();
  const invalid = () => new AppError('Invalid media reference protocol', 400, 'VALIDATION_ERROR', true, []);
  for (const action of ['prepare', 'commit', 'unbind', 'abort', 'status']) {
    router.post('/' + action, credential, (req, res, next) => {
      const body = req.body;
      if (!body || !Array.isArray(body.references) || !body.references.length) return next(invalid());
      const references = Array.from(body.references);
      const isCompletion = references.every(ref => ref && ref.field === 'completionMediaIds')
        && body.resourceType === 'growth_task';
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
