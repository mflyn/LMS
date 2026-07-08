const mongoose = require('mongoose');

const { AppError } = require('../../../common/middleware/errorTypes');
const MediaAsset = require('../models/MediaAsset');
const MediaReference = require('../models/MediaReference');

const PURPOSE_BY_FIELD = Object.freeze({
  'child.avatarMediaId': 'avatar',
  'growth_task.attachmentMediaIds': 'task_attachment',
  'family_mistake.questionMediaId': 'mistake_question',
  'family_mistake.childAnswerMediaId': 'mistake_answer'
});
const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REFERENCES_PER_COMMAND = 100;

const operationalError = (message, statusCode, code) => new AppError(
  message,
  statusCode,
  code,
  true,
  []
);
const validationError = (message) => operationalError(message, 400, 'VALIDATION_ERROR');
const accessDenied = () => operationalError('Media scope does not match', 403, 'CHILD_ACCESS_DENIED');
const notFound = () => operationalError('Media reference resource not found', 404, 'RESOURCE_NOT_FOUND');
const conflict = () => operationalError('Media reference operation conflicts', 409, 'RESOURCE_CONFLICT');
const purposeMismatch = () => operationalError('Media purpose does not match field', 400, 'MEDIA_PURPOSE_MISMATCH');

const validObjectId = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
const withSession = (query, session) => (session ? query.session(session) : query);

const serializeReference = (reference) => {
  const result = {
    mediaId: reference.mediaId.toString(),
    field: reference.field,
    state: reference.state
  };
  if (reference.leaseExpiresAt) result.leaseExpiresAt = new Date(reference.leaseExpiresAt).toISOString();
  if (reference.releasedAt) result.releasedAt = new Date(reference.releasedAt).toISOString();
  return result;
};

const normalizeCommand = (command = {}, action) => {
  const { familyId, childId, resourceType, resourceId, operationId } = command;
  if (!['prepare', 'commit', 'unbind'].includes(action)
    || ![familyId, childId, resourceId].every((value) => validObjectId(String(value || '')))
    || !MediaReference.MEDIA_RESOURCE_TYPES.includes(resourceType)
    || typeof operationId !== 'string'
    || !OPERATION_ID_PATTERN.test(operationId)
    || !Array.isArray(command.references)
    || command.references.length < 1
    || command.references.length > MAX_REFERENCES_PER_COMMAND) {
    throw validationError('Invalid media reference command');
  }

  const normalized = new Map();
  command.references.forEach((reference) => {
    const mediaId = String(reference && reference.mediaId || '');
    const field = reference && reference.field;
    if (!validObjectId(mediaId)
      || typeof field !== 'string'
      || !MediaReference.MEDIA_RESOURCE_FIELDS[resourceType].includes(field)) {
      throw validationError('Invalid media reference identity');
    }
    const hasBindingOperation = Object.prototype.hasOwnProperty.call(
      reference || {},
      'bindingOperationId'
    );
    if (action === 'unbind') {
      if (!hasBindingOperation
        || typeof reference.bindingOperationId !== 'string'
        || !OPERATION_ID_PATTERN.test(reference.bindingOperationId)) {
        throw validationError('Invalid binding operation');
      }
    } else if (hasBindingOperation) {
      throw validationError('bindingOperationId is only valid for unbind');
    }

    const key = `${field}:${mediaId}`;
    const normalizedReference = {
      mediaId,
      field,
      ...(action === 'unbind' ? { bindingOperationId: reference.bindingOperationId } : {})
    };
    const existing = normalized.get(key);
    if (existing && existing.bindingOperationId !== normalizedReference.bindingOperationId) {
      throw validationError('Conflicting binding operations for one reference');
    }
    normalized.set(key, normalizedReference);
  });

  return {
    familyId: String(familyId),
    childId: String(childId),
    resourceType,
    resourceId: String(resourceId),
    operationId,
    references: [...normalized.values()].sort((left, right) => (
      left.field.localeCompare(right.field) || left.mediaId.localeCompare(right.mediaId)
    ))
  };
};

const createMediaReferenceService = ({
  MediaAssetModel = MediaAsset,
  MediaReferenceModel = MediaReference,
  leaseSeconds = 900,
  now = Date.now,
  transactionRunner
} = {}) => {
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) {
    throw new Error('MEDIA_REFERENCE_LEASE_SECONDS must be between 1 and 3600');
  }
  if (typeof transactionRunner !== 'function') throw new Error('transactionRunner is required');

  const referenceQuery = (command, reference) => ({
    familyId: command.familyId,
    childId: command.childId,
    mediaId: reference.mediaId,
    resourceType: command.resourceType,
    resourceId: command.resourceId,
    field: reference.field
  });

  const validateAssets = async (command, session) => {
    const mediaIds = command.references.map((reference) => reference.mediaId);
    const assets = await withSession(MediaAssetModel.find({ _id: { $in: mediaIds } }), session).lean();
    const byId = new Map(assets.map((asset) => [asset._id.toString(), asset]));

    command.references.forEach((reference) => {
      const asset = byId.get(reference.mediaId);
      if (!asset || asset.status !== 'active') throw notFound();
      if (asset.familyId.toString() !== command.familyId
        || !asset.childId
        || asset.childId.toString() !== command.childId) {
        throw accessDenied();
      }
      if (asset.purpose !== PURPOSE_BY_FIELD[`${command.resourceType}.${reference.field}`]) {
        throw purposeMismatch();
      }
    });
  };

  const prepare = async (input) => {
    const command = normalizeCommand(input, 'prepare');
    return transactionRunner(async (session) => {
      await validateAssets(command, session);
      const current = new Date(Number(now()));
      const leaseExpiresAt = new Date(current.getTime() + leaseSeconds * 1000);
      const results = [];

      for (const reference of command.references) {
        const query = referenceQuery(command, reference);
        let row = await withSession(MediaReferenceModel.findOne(query), session);
        if (!row) {
          [row] = await MediaReferenceModel.create([{
            ...query,
            operationId: command.operationId,
            state: 'prepared',
            leaseExpiresAt,
            releasedAt: null
          }], { session });
        } else if (row.state === 'bound') {
          if (row.operationId !== command.operationId) throw conflict();
        } else if (row.state === 'released' && row.operationId === command.operationId) {
          // Replaying a released operation must not resurrect it.
        } else if (row.state === 'prepared'
          && row.operationId !== command.operationId
          && row.leaseExpiresAt > current) {
          throw conflict();
        } else if (row.state === 'prepared' && row.operationId === command.operationId) {
          // Idempotent replay preserves the original lease.
        } else {
          row.operationId = command.operationId;
          row.state = 'prepared';
          row.leaseExpiresAt = leaseExpiresAt;
          row.releasedAt = null;
          row.releaseOperationId = null;
          await row.save({ session });
        }
        results.push(serializeReference(row));
      }
      return results;
    });
  };

  const commit = async (input) => {
    const command = normalizeCommand(input, 'commit');
    return transactionRunner(async (session) => {
      const current = new Date(Number(now()));
      const results = [];
      for (const reference of command.references) {
        const row = await withSession(MediaReferenceModel.findOne(referenceQuery(command, reference)), session);
        if (!row) throw notFound();
        if (row.state === 'bound') {
          if (row.operationId !== command.operationId) throw conflict();
          results.push(serializeReference(row));
          continue;
        }
        if (row.operationId !== command.operationId
          || row.state !== 'prepared'
          || !row.leaseExpiresAt
          || row.leaseExpiresAt <= current) {
          throw conflict();
        }
        row.state = 'bound';
        row.leaseExpiresAt = null;
        row.releasedAt = null;
        row.releaseOperationId = null;
        await row.save({ session });
        results.push(serializeReference(row));
      }
      return results;
    });
  };

  const unbind = async (input) => {
    const command = normalizeCommand(input, 'unbind');
    return transactionRunner(async (session) => {
      const releasedAt = new Date(Number(now()));
      const rows = [];
      for (const reference of command.references) {
        const row = await withSession(MediaReferenceModel.findOne(referenceQuery(command, reference)), session);
        if (row && row.operationId !== reference.bindingOperationId) throw conflict();
        rows.push({ reference, row });
      }

      const results = [];
      for (const { reference, row } of rows) {
        if (!row) {
          results.push({ mediaId: reference.mediaId, field: reference.field, state: 'released' });
          continue;
        }
        if (row.state !== 'released') {
          row.state = 'released';
          row.leaseExpiresAt = null;
          row.releasedAt = releasedAt;
          row.releaseOperationId = command.operationId;
          await row.save({ session });
        }
        results.push(serializeReference(row));
      }
      return results;
    });
  };

  const reclaimExpiredPrepared = async ({ limit = 100 } = {}) => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw validationError('limit must be between 1 and 1000');
    }
    const current = new Date(Number(now()));
    const expired = await MediaReferenceModel.find({
      state: 'prepared',
      leaseExpiresAt: { $lte: current }
    }).sort({ leaseExpiresAt: 1, _id: 1 }).limit(limit).select('_id').lean();
    if (expired.length === 0) return { reclaimed: 0 };

    const result = await MediaReferenceModel.deleteMany({
      _id: { $in: expired.map((reference) => reference._id) },
      state: 'prepared',
      leaseExpiresAt: { $lte: current }
    });
    return { reclaimed: result.deletedCount };
  };

  const releasePreparedForDeletedMedia = async ({ mediaId, releasedAt, session }) => {
    const query = MediaReferenceModel.updateMany(
      { mediaId, state: 'prepared' },
      {
        $set: {
          state: 'released',
          leaseExpiresAt: null,
          releasedAt
        }
      }
    );
    const result = await withSession(query, session);
    return { released: result.modifiedCount };
  };

  return {
    commit,
    prepare,
    reclaimExpiredPrepared,
    releasePreparedForDeletedMedia,
    unbind
  };
};

module.exports = {
  MAX_REFERENCES_PER_COMMAND,
  OPERATION_ID_PATTERN,
  PURPOSE_BY_FIELD,
  createMediaReferenceService,
  normalizeCommand,
  serializeReference
};
