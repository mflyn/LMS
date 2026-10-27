const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { Types } = require('mongoose');
const { AppError } = require('../middleware/errorTypes');
const { sendFamilyError } = require('../utils/familyResponse');

const fields = ['sourceTaskId', 'sourceMistakeId'];
const isId = value => typeof value === 'string' && value.length === 24 && /^[a-f0-9]{24}$/i.test(value);
const fail = (status, code) => Object.assign(new AppError(code, status, code, true, []), { status });
const unavailable = () => fail(503, 'SOURCE_SERVICE_UNAVAILABLE');
const missing = () => fail(404, 'RESOURCE_NOT_FOUND');
const normalizeId = (value, allowObjectId = true) => {
  if (allowObjectId && value instanceof Types.ObjectId) {
    try { value = Types.ObjectId.prototype.toHexString.call(value); } catch { throw fail(400, 'VALIDATION_ERROR'); }
  }
  if (!isId(value)) throw fail(400, 'VALIDATION_ERROR');
  return value.toLowerCase();
};
const parseSourceFields = (body, allowObjectId) => {
  const supplied = fields.filter(key => Object.prototype.hasOwnProperty.call(body, key));
  if (supplied.length > 1) throw fail(400, 'VALIDATION_ERROR');
  return Object.fromEntries(supplied.map(key => [key, normalizeId(body[key], allowObjectId)]));
};
const parseLearningSource = body => parseSourceFields(body, false);
const sourceProjection = row => Object.fromEntries(fields.filter(key => row[key] != null).map(key => [key, normalizeId(row[key])]));
const digest = value => crypto.createHash('sha256').update(value).digest();
const validToken = token => typeof token === 'string' && token.trim().length >= 32;
const minimal = row => ({ id: normalizeId(row._id), familyId: normalizeId(row.familyId), childId: normalizeId(row.childId),
  subject: row.subject ?? '', title: row.title || row.knowledgePointName || row.subject || '' });
const validateScope = input => Object.fromEntries(['id', 'familyId', 'childId'].map(key => [key, normalizeId(input[key])]));
const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object)
  && Object.keys(object).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(object, key));
const validSource = (value, scope) => exactKeys(value, ['id', 'familyId', 'childId', 'subject', 'title'])
  && Object.keys(scope).every(key => value[key] === scope[key])
  && typeof value.subject === 'string' && typeof value.title === 'string';
const localRead = async (Model, scope) => {
  const row = await Model.findOne({ _id: scope.id, familyId: scope.familyId, childId: scope.childId })
    .select('_id familyId childId subject title knowledgePointName').lean();
  if (!row) return null;
  const source = minimal(row);
  if (!validSource(source, scope)) throw unavailable();
  return source;
};

const createLearningSourceReader = ({ TaskModel, MistakeModel, taskUrl, mistakeUrl, serviceToken,
  axiosInstance = axios, timeout = 3000 } = {}) => {
  const read = async input => {
    const selected = parseSourceFields(input, true);
    const field = fields.find(key => selected[key]);
    if (!field) return null;
    const scope = validateScope({ id: selected[field], familyId: input.familyId, childId: input.childId });
    const isTask = field === 'sourceTaskId', Model = isTask ? TaskModel : MistakeModel;
    let source;
    try {
      if (Model) {
        source = await localRead(Model, scope);
      } else {
        const base = isTask ? taskUrl : mistakeUrl;
        if (!validToken(serviceToken) || !Number.isInteger(timeout) || timeout <= 0 || timeout > 10000) throw unavailable();
        const url = new URL(base);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw unavailable();
        const response = await axiosInstance.get(new URL(`/api/internal/learning-sources/${isTask ? 'tasks' : 'mistakes'}/${scope.id}`, url).href, {
          params: { familyId: scope.familyId, childId: scope.childId }, timeout, maxRedirects: 0,
          maxContentLength: 4096, headers: { 'x-service-token': serviceToken }, validateStatus: () => true
        });
        const body = response?.data;
        if (response?.status === 404 && body?.success === false && body.error?.code === 'RESOURCE_NOT_FOUND'
          && body.error.message === 'RESOURCE_NOT_FOUND' && Array.isArray(body.error.details) && !body.error.details.length) {
          source = null;
        } else {
          if (response?.status !== 200 || !exactKeys(body, ['success', 'data']) || body.success !== true
            || !exactKeys(body.data, ['source']) || !validSource(body.data.source, scope)) throw unavailable();
          source = { ...body.data.source };
        }
      }
    } catch {
      throw unavailable();
    }
    // Only confirmed empty reads become 404; dependency exceptions never do.
    if (source === null) throw missing();
    return source;
  };
  const describe = async input => {
    const selected = sourceProjection(input);
    if (!Object.keys(selected).length) return {};
    try {
      return { sourceAvailable: true, source: await read({ ...selected, familyId: input.familyId, childId: input.childId }) };
    } catch (cause) {
      if (cause.code === 'RESOURCE_NOT_FOUND') return { sourceAvailable: false, source: null };
      throw cause;
    }
  };
  return { require: read, describe };
};

const createLearningSourceRouter = ({ kind, Model, serviceToken } = {}) => {
  if (!['tasks', 'mistakes'].includes(kind) || !Model) throw new TypeError('Source kind and local model required');
  const router = express.Router();
  router.get(`/${kind}/:sourceId`, async (req, res) => {
    const supplied = req.get('x-service-token');
    if (!validToken(serviceToken) || typeof supplied !== 'string' || !crypto.timingSafeEqual(digest(supplied), digest(serviceToken))) {
      return sendFamilyError(res, 401, 'INVALID_SERVICE_CREDENTIAL', 'INVALID_SERVICE_CREDENTIAL');
    }
    let scope;
    try {
      if (!exactKeys(req.query, ['familyId', 'childId'])) throw fail(400, 'VALIDATION_ERROR');
      scope = validateScope({ id: req.params.sourceId, ...req.query });
    } catch {
      req.app.locals.logger?.warn?.('learning.source.read', { kind, result: 'VALIDATION_ERROR' });
      return sendFamilyError(res, 400, 'VALIDATION_ERROR', 'VALIDATION_ERROR');
    }
    try {
      const source = await localRead(Model, scope);
      if (source === null) {
        req.app.locals.logger?.warn?.('learning.source.read', { kind, result: 'RESOURCE_NOT_FOUND' });
        return sendFamilyError(res, 404, 'RESOURCE_NOT_FOUND', 'RESOURCE_NOT_FOUND');
      }
      return res.json({ success: true, data: { source } });
    } catch {
      const code = 'SOURCE_SERVICE_UNAVAILABLE';
      req.app.locals.logger?.warn?.('learning.source.read', { kind, result: code });
      return sendFamilyError(res, 503, code, code);
    }
  });
  return router;
};

module.exports = { parseLearningSource, sourceProjection, createLearningSourceReader, createLearningSourceRouter };
