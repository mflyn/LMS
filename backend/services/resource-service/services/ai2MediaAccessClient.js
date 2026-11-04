const axios = require('axios');
const { AppError } = require('../../../common/middleware/errorTypes');

const ID = /^[0-9a-f]{24}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shape = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);
const unavailable = () => new AppError('Media access dependency unavailable', 503, 'MEDIA_SERVICE_UNAVAILABLE', true, []);

const createAi2MediaAccessClient = ({ axiosInstance = axios, homeworkServiceUrl, serviceToken, timeout = 3000 } = {}) => {
  let url;
  try { url = new URL(homeworkServiceUrl); } catch (_) { throw new Error('HOMEWORK_SERVICE_URL is required'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid HOMEWORK_SERVICE_URL');
  }
  if (typeof serviceToken !== 'string' || serviceToken.length < 32) throw new Error('MEDIA_REFERENCE_SERVICE_TOKEN is required');
  if (!Number.isSafeInteger(timeout) || timeout < 1 || typeof axiosInstance?.post !== 'function') throw new Error('Invalid media access transport');
  const endpoint = `${url.toString().replace(/\/+$/, '')}/api/internal/ai2/media-access-check`;
  const check = async input => {
    if (!shape(input, ['familyId', 'childId', 'actorId', 'role', 'mediaId', 'bindings'])
      || ![input.familyId, input.childId, input.actorId, input.mediaId].every(v => matches(v, ID))
      || !['student', 'parent'].includes(input.role) || !Array.isArray(input.bindings)
      || input.bindings.length < 1 || input.bindings.length > 100) throw unavailable();
    const bindings = Array.from(input.bindings, binding => {
      if (!shape(binding, ['attemptId', 'bindingOperationId']) || !matches(binding.attemptId, ID)
        || !matches(binding.bindingOperationId, UUID)) throw unavailable();
      return { attemptId: binding.attemptId, bindingOperationId: binding.bindingOperationId };
    });
    try {
      const response = await axiosInstance.post(endpoint, {
        familyId: input.familyId, childId: input.childId, actorId: input.actorId,
        role: input.role, mediaId: input.mediaId, bindings
      }, { headers: { 'x-service-token': serviceToken }, timeout, maxRedirects: 0 });
      const body = response?.data;
      if (response?.status !== 200 || !shape(body, ['success', 'data']) || body.success !== true
        || !shape(body.data, ['allowed']) || typeof body.data.allowed !== 'boolean') throw unavailable();
      return body.data.allowed;
    } catch (_) {
      // Never surface transport configuration, credentials, or remote error bodies.
      throw unavailable();
    }
  };
  return { check };
};

module.exports = { createAi2MediaAccessClient };
