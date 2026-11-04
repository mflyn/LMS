const express = require('express');
const { createMediaReferenceCredential } = require('../middleware/mediaReferenceCredential');
const { AppError } = require('../../../common/middleware/errorTypes');
const { MAX_MEDIA_BYTES } = require('../models/MediaAsset');

const ID = /^[0-9a-f]{24}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const closed = (value, required, optional = []) => object(value)
  && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const invalid = () => new AppError('VALIDATION_ERROR', 400, 'VALIDATION_ERROR', true, []);
const unavailable = () => new AppError('MEDIA_SERVICE_UNAVAILABLE', 503, 'MEDIA_SERVICE_UNAVAILABLE', true, []);
const validate = body => {
  if (!closed(body, ['familyId', 'childId', 'identity', 'mediaIds', 'bindings'])
    || ![body.familyId, body.childId].every(value => matches(value, ID))
    || !closed(body.identity, ['id', 'role'], ['familyId', 'childId', 'tokenVersion'])
    || !matches(body.identity.id, ID) || !['parent', 'student'].includes(body.identity.role)
    || ['familyId', 'childId'].some(key => Object.hasOwn(body.identity, key) && !matches(body.identity[key], ID))
    || Object.hasOwn(body.identity, 'tokenVersion')
      && (!Number.isSafeInteger(body.identity.tokenVersion) || body.identity.tokenVersion < 0)
    || !Array.isArray(body.mediaIds) || body.mediaIds.length < 1 || body.mediaIds.length > 10
    || !body.mediaIds.every(value => matches(value, ID))
    || new Set(body.mediaIds.map(value => value.toLowerCase())).size !== body.mediaIds.length
    || !Array.isArray(body.bindings) || body.bindings.length !== body.mediaIds.length) throw invalid();
  body.bindings.forEach((binding, index) => {
    if (!closed(binding, ['mediaId', 'resourceType', 'resourceId', 'field', 'bindingOperationId'])
      || binding.mediaId !== body.mediaIds[index] || binding.resourceType !== 'ai2_attempt'
      || !matches(binding.resourceId, ID) || binding.field !== 'correctionMediaIds'
      || !matches(binding.bindingOperationId, UUID)) throw invalid();
  });
};
const metadata = (items, mediaIds) => {
  if (!Array.isArray(items) || items.length !== mediaIds.length) throw unavailable();
  return items.map((item, index) => {
    if (!object(item) || item.mediaId !== mediaIds[index]
      || !['image/jpeg', 'image/png', 'image/webp'].includes(item.mimeType)
      || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes < 1 || item.sizeBytes > MAX_MEDIA_BYTES
      || !['available', 'deleted'].includes(item.status)) throw unavailable();
    return { mediaId: item.mediaId, mimeType: item.mimeType, sizeBytes: item.sizeBytes, status: item.status };
  });
};
const safeErrors = new Map([
  ['INVALID_SERVICE_CREDENTIAL', 401], ['VALIDATION_ERROR', 400], ['CHILD_ACCESS_DENIED', 403],
  ['RESOURCE_NOT_FOUND', 404], ['MEDIA_SERVICE_UNAVAILABLE', 503], ['AI2_NOT_READY', 503]
]);

const createAi2MediaInspectRouter = ({ serviceToken, mediaService, assertAi2Continuous = () => {} } = {}) => {
  if (typeof mediaService?.inspect !== 'function' || typeof assertAi2Continuous !== 'function') {
    throw new TypeError('AI2 inspection dependencies required');
  }
  const credential = createMediaReferenceCredential(serviceToken);
  const router = express.Router();
  // Mounted ahead of the app JSON parser so unauthenticated/malformed payloads never reach generic error logging.
  router.post('/inspect', credential, express.json({ limit: '32kb' }), (req, res, next) => {
    Promise.resolve().then(() => {
      assertAi2Continuous();
      validate(req.body);
      return mediaService.inspect(req.body);
    }).then(items => {
      assertAi2Continuous();
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: { items: metadata(items, req.body.mediaIds) } });
    }).catch(next);
  });
  router.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    const parserError = ['entity.parse.failed', 'entity.too.large'].includes(error?.type);
    const code = parserError ? 'VALIDATION_ERROR'
      : safeErrors.has(error?.code) && safeErrors.get(error.code) === error.statusCode ? error.code : 'MEDIA_SERVICE_UNAVAILABLE';
    res.set('Cache-Control', 'no-store');
    res.status(safeErrors.get(code)).json({ success: false, error: { code, message: code, details: [] } });
  });
  return router;
};

module.exports = { createAi2MediaInspectRouter };
