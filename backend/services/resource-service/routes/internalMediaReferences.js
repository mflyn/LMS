const express = require('express');

const { logFamilyOperation } = require('../../../common/utils/familyAudit');

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const createInternalMediaReferencesRouter = ({ credential, referenceService } = {}) => {
  if (typeof credential !== 'function') throw new Error('Media reference credential is required');
  if (!referenceService || ['prepare', 'commit', 'unbind'].some(
    (method) => typeof referenceService[method] !== 'function'
  )) {
    throw new Error('mediaReferenceService is required');
  }

  const router = express.Router();
  const command = (action) => asyncRoute(async (req, res) => {
    const references = await referenceService[action](req.body);
    logFamilyOperation(req, {
      operation: `media_reference.${action}`,
      result: references.every((reference) => reference.state === 'bound') ? 'bound' : references[0].state,
      familyId: req.body.familyId,
      childId: req.body.childId,
      resourceType: req.body.resourceType,
      resourceId: req.body.resourceId,
      mediaIds: references.map((reference) => reference.mediaId)
    });
    res.status(200).json({ success: true, data: { references } });
  });

  router.post('/prepare', credential, command('prepare'));
  router.post('/commit', credential, command('commit'));
  router.post('/unbind', credential, command('unbind'));
  return router;
};

module.exports = {
  createInternalMediaReferencesRouter
};
