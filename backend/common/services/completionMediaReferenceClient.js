const axios = require('axios');
const { validateMediaReferenceClientConfig } = require('./mediaReferenceClient');

const { fieldFor, typedScope, referenceSetHash, isAttemptType } = require('./completionMediaProtocol');
const ID = /^[0-9a-f]{24}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const FAILURE_CODES = new Set(['MEDIA_OPERATION_EXPIRED', 'MEDIA_OPERATION_ABORTED', 'RESOURCE_NOT_FOUND',
  'CHILD_ACCESS_DENIED', 'MEDIA_PURPOSE_MISMATCH', 'RESOURCE_CONFLICT']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shape = (value, required, optional = []) => plain(value)
  && required.every(key => Object.prototype.hasOwnProperty.call(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);
const canonicalUuid = value => matches(value, UUID) && value === value.toLowerCase();
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const error = (status, code, message) => Object.assign(new Error(message), { status, code, details: [] });
const invalid = () => error(400, 'VALIDATION_ERROR', 'Invalid completion media command');
const pending = () => error(503, 'MEDIA_REFERENCE_PENDING', 'Media reference operation is pending');
const requireResponse = condition => { if (!condition) throw pending(); };

const normalizeCommand = (input, action) => {
  const field = fieldFor(input?.resourceType);
  const referenceMode = action === 'status' && input?.mode === 'references';
  const unbind = action === 'unbind';
  const keys = ['familyId', 'childId', 'resourceType', 'resourceId', 'references'];
  if (!referenceMode) keys.push('remoteOperationId');
  if (!referenceMode && !unbind) keys.push('commandHash');
  if (action === 'status') keys.push('mode');
  if (!shape(input, keys) || ![input.familyId, input.childId, input.resourceId].every(v => matches(v, ID))
    || !field || (action === 'status' && !['operation', 'references'].includes(input.mode))
    || (!referenceMode && (!matches(input.remoteOperationId, UUID) || (!unbind && !matches(input.commandHash, HASH))))
    || !Array.isArray(input.references) || input.references.length < 1 || input.references.length > 10) throw invalid();
  const references = Array.from(input.references, ref => {
    if (!shape(ref, unbind ? ['mediaId', 'field', 'bindingOperationId'] : ['mediaId', 'field'])
      || !matches(ref.mediaId, ID) || ref.field !== field || (unbind && !matches(ref.bindingOperationId, UUID))) throw invalid();
    return { mediaId: ref.mediaId.toLowerCase(), field,
      ...(unbind ? { bindingOperationId: ref.bindingOperationId.toLowerCase() } : {}) };
  }).sort((a, b) => a.mediaId.localeCompare(b.mediaId));
  if (new Set(references.map(ref => ref.mediaId)).size !== references.length) throw invalid();
  // Snapshot only explicit fields before transport; never generate an identity or reuse a public operationId.
  return { familyId: input.familyId.toLowerCase(), childId: input.childId.toLowerCase(), resourceType: input.resourceType,
    resourceId: input.resourceId.toLowerCase(), references,
    ...(referenceMode ? {} : { operationId: input.remoteOperationId.toLowerCase() }),
    ...(referenceMode || unbind ? {} : { commandHash: input.commandHash }),
    ...(action === 'status' ? { mode: input.mode } : {}) };
};

const parseOperation = (value, command, action) => {
  if (command.mode === 'references' || action === 'unbind') { requireResponse(value === null); return null; }
  const scope = typedScope(command), typed = isAttemptType(command.resourceType);
  requireResponse(shape(value, ['operationId', 'state', 'commandHash', 'leaseExpiresAt', 'leaseExpired', 'failureCode',
    ...Object.keys(scope), ...(typed ? ['referenceSetHash'] : [])]));
  requireResponse(Object.entries(scope).every(([key, expected]) => value[key] === expected));
  requireResponse(value.operationId === command.operationId && ['ABSENT', 'PREPARED', 'COMMITTED', 'ABORTED'].includes(value.state));
  const absent = value.state === 'ABSENT', prepared = value.state === 'PREPARED';
  if (typed) requireResponse(value.referenceSetHash === (absent ? null : referenceSetHash(command)));
  requireResponse(!['commit', 'abort'].includes(action) || ['COMMITTED', 'ABORTED'].includes(value.state));
  requireResponse(absent ? action === 'status' && value.commandHash === null : value.commandHash === command.commandHash);
  requireResponse(prepared ? timestamp(value.leaseExpiresAt) && typeof value.leaseExpired === 'boolean'
    : value.leaseExpiresAt === null && value.leaseExpired === null);
  requireResponse(value.state === 'ABORTED' ? FAILURE_CODES.has(value.failureCode) : value.failureCode === null);
  return { operationId: value.operationId, state: value.state, commandHash: value.commandHash,
    leaseExpiresAt: value.leaseExpiresAt, leaseExpired: value.leaseExpired, failureCode: value.failureCode,
    ...scope, ...(typed ? { referenceSetHash: value.referenceSetHash } : {}) };
};

const parseProof = (proof, ref, command, operation) => {
  if (proof === null) return null;
  requireResponse(shape(proof, ['mediaId', 'resourceType', 'resourceId', 'field', 'bindingOperationId', 'deletedAt', 'releasedAt']));
  requireResponse(proof.mediaId === ref.mediaId && proof.resourceType === command.resourceType
    && proof.resourceId === command.resourceId && proof.field === fieldFor(command.resourceType) && canonicalUuid(proof.bindingOperationId)
    && timestamp(proof.deletedAt) && timestamp(proof.releasedAt));
  requireResponse(['released', 'absent'].includes(ref.state)
    && (!operation || operation.state === 'COMMITTED' && proof.bindingOperationId === command.operationId)
    && (ref.state === 'absent' || proof.bindingOperationId === ref.bindingOperationId));
  return { mediaId: proof.mediaId, resourceType: proof.resourceType, resourceId: proof.resourceId, field: proof.field,
    bindingOperationId: proof.bindingOperationId, deletedAt: proof.deletedAt, releasedAt: proof.releasedAt };
};

const parseResponse = (response, command, action, serviceToken) => {
  requireResponse(response?.status === 200 && shape(response.data, ['success', 'data'], ['requestId'])
    && response.data.success === true && !JSON.stringify(response.data).includes(serviceToken));
  const data = response.data.data;
  requireResponse(shape(data, ['operation', 'references']) && Array.isArray(data.references)
    && data.references.length === command.references.length);
  const operation = parseOperation(data.operation, command, action);
  const remaining = new Set(command.references.map(ref => ref.mediaId));
  const references = Array.from(data.references, ref => {
    const scope = typedScope(command);
    requireResponse(shape(ref, ['mediaId', 'field', 'state', 'privacyDeletion', ...Object.keys(scope)], ['bindingOperationId'])
      && Object.entries(scope).every(([key, expected]) => ref[key] === expected)
      && remaining.delete(ref.mediaId) && ref.field === fieldFor(command.resourceType) && ['prepared', 'bound', 'released', 'absent'].includes(ref.state));
    requireResponse(ref.state === 'absent' ? !Object.prototype.hasOwnProperty.call(ref, 'bindingOperationId')
      : canonicalUuid(ref.bindingOperationId));
    if (action === 'unbind') {
      const requested = command.references.find(r => r.mediaId === ref.mediaId);
      requireResponse(['released', 'absent'].includes(ref.state)
        && (ref.state === 'absent' || ref.bindingOperationId === requested.bindingOperationId)
        && (ref.privacyDeletion === null || ref.privacyDeletion?.bindingOperationId === requested.bindingOperationId));
    }
    if (operation?.state === 'PREPARED') requireResponse(ref.state === 'prepared' && ref.bindingOperationId === command.operationId);
    if (operation && ref.bindingOperationId === command.operationId) {
      if (operation.state === 'COMMITTED') requireResponse(['bound', 'released'].includes(ref.state));
      if (operation.state === 'ABORTED') requireResponse(ref.state === 'released');
      requireResponse(operation.state !== 'ABSENT');
    }
    return { mediaId: ref.mediaId, field: ref.field, state: ref.state, ...scope,
      ...(ref.state === 'absent' ? {} : { bindingOperationId: ref.bindingOperationId }),
      privacyDeletion: parseProof(ref.privacyDeletion, ref, command, operation) };
  });
  requireResponse(remaining.size === 0);
  return { operation, references };
};

const createCompletionMediaReferenceClient = ({ axiosInstance = axios, resourceServiceUrl, serviceToken, timeout = 3000 } = {}) => {
  validateMediaReferenceClientConfig({ resourceServiceUrl, serviceToken, timeout });
  if (typeof axiosInstance?.post !== 'function') throw new Error('A media reference transport is required');
  const baseUrl = resourceServiceUrl.trim().replace(/\/+$/, '');
  const execute = async (action, input) => {
    const command = normalizeCommand(input, action);
    try {
      const response = await axiosInstance.post(`${baseUrl}/api/internal/media/references/${action}`, command,
        { headers: { 'x-service-token': serviceToken }, timeout, maxRedirects: 0 });
      return parseResponse(response, command, action, serviceToken);
    } catch (_cause) {
      // A bare HTTP error cannot prove a terminal state. Never expose remote bodies/config or clear local intent.
      throw pending();
    }
  };
  return { prepare: input => execute('prepare', input), commit: input => execute('commit', input),
    abort: input => execute('abort', input), status: input => execute('status', input), unbind: input => execute('unbind', input) };
};

module.exports = { createCompletionMediaReferenceClient };
