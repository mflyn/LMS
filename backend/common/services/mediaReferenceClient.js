const axios = require('axios');

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const REFERENCE_FIELDS = new Set([
  'avatarMediaId',
  'attachmentMediaIds',
  'questionMediaId',
  'childAnswerMediaId'
]);
const REFERENCE_STATES = new Set(['prepared', 'bound', 'released']);
const REFERENCE_KEYS = new Set([
  'mediaId',
  'field',
  'state',
  'leaseExpiresAt',
  'releasedAt'
]);
const STABLE_REMOTE_STATUSES = new Set([400, 403, 404, 409]);

const validateMediaReferenceClientConfig = ({
  resourceServiceUrl,
  serviceToken,
  timeout = 3000
} = {}) => {
  if (typeof resourceServiceUrl !== 'string' || !resourceServiceUrl.trim()) {
    throw new Error('RESOURCE_SERVICE_URL is required');
  }
  if (typeof serviceToken !== 'string' || serviceToken.length < 32) {
    throw new Error('MEDIA_REFERENCE_SERVICE_TOKEN must contain at least 32 characters');
  }
  if (!Number.isInteger(timeout) || timeout < 1) {
    throw new Error('MEDIA_REFERENCE_TIMEOUT_MS must be a positive integer');
  }
};

const pendingError = () => {
  const error = new Error('Media reference operation is pending');
  error.status = 503;
  error.code = 'MEDIA_REFERENCE_PENDING';
  error.details = [];
  return error;
};

const containsCredential = (value, serviceToken) => {
  try {
    return JSON.stringify(value).includes(serviceToken);
  } catch (error) {
    return true;
  }
};

const stableRemoteError = (cause, serviceToken) => {
  const response = cause && cause.response;
  const remote = response && response.data && response.data.error;
  if (!response
    || !STABLE_REMOTE_STATUSES.has(response.status)
    || !remote
    || typeof remote.code !== 'string'
    || !remote.code
    || typeof remote.message !== 'string'
    || !remote.message
    || containsCredential({
      code: remote.code,
      message: remote.message,
      details: remote.details
    }, serviceToken)) {
    return null;
  }

  const error = new Error(remote.message);
  error.status = response.status;
  error.code = remote.code;
  error.details = Array.isArray(remote.details) ? remote.details : [];
  return error;
};

const validTimestamp = (value) => {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const parseReference = (reference) => {
  if (!reference
    || typeof reference !== 'object'
    || Array.isArray(reference)
    || Object.keys(reference).some((key) => !REFERENCE_KEYS.has(key))
    || typeof reference.mediaId !== 'string'
    || !OBJECT_ID_PATTERN.test(reference.mediaId)
    || !REFERENCE_FIELDS.has(reference.field)
    || !REFERENCE_STATES.has(reference.state)
    || (Object.prototype.hasOwnProperty.call(reference, 'leaseExpiresAt')
      && !validTimestamp(reference.leaseExpiresAt))
    || (Object.prototype.hasOwnProperty.call(reference, 'releasedAt')
      && !validTimestamp(reference.releasedAt))) {
    throw new Error('Invalid media reference response');
  }

  return {
    mediaId: reference.mediaId,
    field: reference.field,
    state: reference.state,
    ...(reference.leaseExpiresAt ? { leaseExpiresAt: reference.leaseExpiresAt } : {}),
    ...(reference.releasedAt ? { releasedAt: reference.releasedAt } : {})
  };
};

const parseResponse = (response) => {
  const references = response
    && response.data
    && response.data.success === true
    && response.data.data
    && response.data.data.references;
  if (!Array.isArray(references)) throw new Error('Invalid media reference response');
  return references.map(parseReference);
};

const createMediaReferenceClient = ({
  axiosInstance = axios,
  resourceServiceUrl,
  serviceToken,
  timeout = 3000
} = {}) => {
  validateMediaReferenceClientConfig({ resourceServiceUrl, serviceToken, timeout });
  const baseUrl = resourceServiceUrl.trim().replace(/\/+$/, '');

  const execute = async (action, command) => {
    try {
      const response = await axiosInstance.post(
        `${baseUrl}/api/internal/media/references/${action}`,
        command,
        {
          headers: { 'x-service-token': serviceToken },
          timeout
        }
      );
      return parseResponse(response);
    } catch (cause) {
      const remoteError = stableRemoteError(cause, serviceToken);
      if (remoteError) throw remoteError;
      throw pendingError();
    }
  };

  return {
    prepare: (command) => execute('prepare', command),
    commit: (command) => execute('commit', command),
    unbind: (command) => execute('unbind', command)
  };
};

module.exports = {
  createMediaReferenceClient,
  validateMediaReferenceClientConfig
};
