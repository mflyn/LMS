const axios = require('axios');
const { error, isId } = require('./ai2Contract');

const unavailable = () => error(503, 'MEDIA_SERVICE_UNAVAILABLE');
const invalidConfig = () => Object.assign(new Error('AI2_MEDIA_INSPECT_CONFIGURATION_INVALID'), { code: 'AI2_MEDIA_INSPECT_CONFIGURATION_INVALID' });
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = value => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const dataField = (value, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor?.enumerable || !own(descriptor, 'value')) throw unavailable();
  return descriptor.value;
};
const closed = (value, keys) => record(value) && Reflect.ownKeys(value).length === keys.length
  && keys.every(key => {
    if (!own(value, key)) return false;
    dataField(value, key);
    return true;
  });
const list = (value, length) => Array.isArray(value) && value.length === length
  && Reflect.ownKeys(value).length === length + 1 && Array.from({ length }, (_, i) => String(i)).every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable && own(descriptor, 'value');
  });
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const bodyFor = (input, type, field) => {
  if (!closed(input, ['familyId', 'childId', 'identity', 'mediaIds', 'bindings'])
    || !isId(input.familyId) || !isId(input.childId) || !record(input.identity)) throw unavailable();
  // Parent membership is resolved from current Family data, never stale JWT scope claims.
  const identity = { id: dataField(input.identity, 'id'), role: dataField(input.identity, 'role') };
  if (!isId(identity.id) || !['parent', 'student'].includes(identity.role)) throw unavailable();
  if (identity.role === 'student') {
    for (const key of ['familyId', 'childId', 'tokenVersion']) identity[key] = dataField(input.identity, key);
    if (identity.id !== input.childId || identity.childId !== input.childId || identity.familyId !== input.familyId
      || !Number.isSafeInteger(identity.tokenVersion) || identity.tokenVersion < 0) throw unavailable();
  }
  const length = input.mediaIds?.length;
  if (!Number.isInteger(length) || length < 1 || length > 10 || !list(input.mediaIds, length)
    || !list(input.bindings, length) || !input.mediaIds.every(isId) || new Set(input.mediaIds).size !== length) throw unavailable();
  const bindings = input.bindings.map((ref, i) => {
    if (!closed(ref, ['mediaId', 'resourceType', 'resourceId', 'field', 'bindingOperationId'])
      || ref.mediaId !== input.mediaIds[i] || ref.resourceType !== type || !isId(ref.resourceId)
      || ref.field !== field || !uuid(ref.bindingOperationId)) throw unavailable();
    return { mediaId: ref.mediaId, resourceType: ref.resourceType, resourceId: ref.resourceId,
      field: ref.field, bindingOperationId: ref.bindingOperationId };
  });
  return { familyId: input.familyId, childId: input.childId, identity, mediaIds: [...input.mediaIds], bindings };
};
const parse = (response, command, serviceToken) => {
  if (response?.status !== 200 || !closed(response.data, ['success', 'data']) || response.data.success !== true
    || !closed(response.data.data, ['items']) || JSON.stringify(response.data).includes(serviceToken)) throw unavailable();
  const items = response.data.data.items;
  if (!list(items, command.mediaIds.length)) throw unavailable();
  return items.map((item, index) => {
    if (!closed(item, ['mediaId', 'mimeType', 'sizeBytes', 'status']) || item.mediaId !== command.mediaIds[index]
      || !['image/jpeg', 'image/png', 'image/webp'].includes(item.mimeType) || !Number.isSafeInteger(item.sizeBytes)
      || item.sizeBytes < 1 || item.sizeBytes > 10 * 1024 * 1024 || !['available', 'deleted'].includes(item.status)) throw unavailable();
    return { mediaId: item.mediaId, mimeType: item.mimeType, sizeBytes: item.sizeBytes, status: item.status };
  });
};
function createMediaInspectClient({ resourceServiceUrl, serviceToken, timeout = 3000, axiosInstance = axios } = {}, profile) {
  let url;
  try {
    url = new URL(resourceServiceUrl);
    if (typeof resourceServiceUrl !== 'string' || !['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash || typeof serviceToken !== 'string' || serviceToken.length < 32
      || !Number.isInteger(timeout) || timeout < 1 || timeout > 30000 || typeof axiosInstance?.post !== 'function') throw invalidConfig();
  } catch { throw invalidConfig(); }
  const endpoint = `${url.origin}/api/internal/media/${profile.name}/inspect`;
  return { inspect: async input => {
    try {
      const command = bodyFor(input, profile.type, profile.field);
      const response = await axiosInstance.post(endpoint, command, { headers: { 'x-service-token': serviceToken },
        timeout, maxRedirects: 0, maxContentLength: 32768, maxBodyLength: 32768, proxy: false });
      return parse(response, command, serviceToken);
    } catch { throw unavailable(); }
  } };
}
const createAi2MediaInspectClient = options => createMediaInspectClient(options,
  { name: 'ai2', type: 'ai2_attempt', field: 'correctionMediaIds' });
const createAi3MediaInspectClient = options => createMediaInspectClient(options,
  { name: 'ai3', type: 'ai3_attempt', field: 'practiceMediaIds' });
module.exports = { createAi2MediaInspectClient, createAi3MediaInspectClient };
