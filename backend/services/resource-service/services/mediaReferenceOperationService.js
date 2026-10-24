const { createHash } = require('crypto');
const { AppError } = require('../../../common/middleware/errorTypes');
const MediaAsset = require('../models/MediaAsset');
const MediaReference = require('../models/MediaReference');
const MediaReferenceOperation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const { OPERATION_ID_PATTERN } = require('./mediaReferenceService');

const FIELD = 'completionMediaIds';
const error = (status, code) => new AppError(code, status, code, true, []);
const invalid = () => error(400, 'VALIDATION_ERROR');
const inconsistent = () => error(409, 'MEDIA_OPERATION_INCONSISTENT');
const plain = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const objectId = (value) => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
const exactKeys = (value, keys) => plain(value) && Object.keys(value).every((key) => keys.includes(key));

const normalize = (input, action) => {
  const referenceMode = action === 'status' && input?.mode === 'references';
  const unbind = action === 'unbind';
  const keys = ['familyId', 'childId', 'resourceType', 'resourceId', 'references'];
  if (!referenceMode) keys.push('operationId');
  if (!referenceMode && !unbind) keys.push('commandHash');
  if (action === 'status') keys.push('mode');
  if (!exactKeys(input, keys) || ![input.familyId, input.childId, input.resourceId].every(objectId)
    || input.resourceType !== 'growth_task'
    || (action === 'status' && !['operation', 'references'].includes(input.mode))
    || !Array.isArray(input.references) || input.references.length < 1 || input.references.length > 10
    || (!referenceMode && (typeof input.operationId !== 'string' || !OPERATION_ID_PATTERN.test(input.operationId)
      || (!unbind && (typeof input.commandHash !== 'string' || !/^[0-9a-f]{64}$/.test(input.commandHash)))))) throw invalid();
  const references = Array.from(input.references, (ref) => {
    if (!exactKeys(ref, unbind ? ['mediaId', 'field', 'bindingOperationId'] : ['mediaId', 'field'])
      || !objectId(ref.mediaId) || ref.field !== FIELD
      || (unbind && (typeof ref.bindingOperationId !== 'string' || !OPERATION_ID_PATTERN.test(ref.bindingOperationId)))) throw invalid();
    return { mediaId: ref.mediaId.toLowerCase(), field: FIELD,
      ...(unbind ? { bindingOperationId: ref.bindingOperationId.toLowerCase() } : {}) };
  }).sort((a, b) => a.mediaId.localeCompare(b.mediaId));
  if (new Set(references.map((ref) => ref.mediaId)).size !== references.length) throw invalid();
  return {
    familyId: input.familyId.toLowerCase(), childId: input.childId.toLowerCase(), resourceType: 'growth_task',
    resourceId: input.resourceId.toLowerCase(), field: FIELD, references,
    ...(referenceMode ? {} : { operationId: input.operationId.toLowerCase() }),
    ...(referenceMode || unbind ? {} : { commandHash: input.commandHash,
      referenceSetHash: createHash('sha256').update(JSON.stringify(references)).digest('hex') })
  };
};

const operationKey = (command) => ({
  familyId: command.familyId, childId: command.childId, resourceType: command.resourceType,
  resourceId: command.resourceId, field: FIELD, operationId: command.operationId
});
const referenceKey = (command, reference) => ({
  familyId: command.familyId, childId: command.childId, resourceType: command.resourceType,
  resourceId: command.resourceId, field: FIELD, mediaId: reference.mediaId
});

const createMediaReferenceOperationService = ({
  MediaAssetModel = MediaAsset, MediaReferenceModel = MediaReference,
  OperationModel = MediaReferenceOperation, transactionRunner, now = Date.now, leaseSeconds = 900
} = {}) => {
  if (typeof transactionRunner !== 'function') throw new Error('transactionRunner is required');
  if (typeof now !== 'function' || !Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) {
    throw new Error('Invalid operation clock or lease duration');
  }

  const currentTime = () => {
    const value = new Date(Number(now()));
    if (!Number.isFinite(value.getTime())) throw new Error('Invalid operation clock');
    return value;
  };
  const readReferences = async (command, session) => {
    const rows = await MediaReferenceModel.find({
      ...referenceKey(command, command.references[0]), mediaId: { $in: command.references.map((ref) => ref.mediaId) }
    }).session(session).lean();
    const byId = new Map(rows.map((ref) => [String(ref.mediaId), ref]));
    return command.references.map((ref) => byId.get(ref.mediaId) || null);
  };
  const readProofs = async (command, rows, session) => {
    const receipts = await Receipt.find({ familyId: command.familyId, childId: command.childId,
      resourceType: command.resourceType, resourceId: command.resourceId, field: FIELD,
      mediaId: { $in: command.references.map(ref => ref.mediaId) },
      ...(command.operationId ? { bindingOperationId: command.operationId } : {}) }).session(session).lean();
    const tombstones = await Tombstone.find({ familyId: command.familyId, childId: command.childId,
      mediaId: { $in: receipts.map(r => r.mediaId) }, purpose: 'task_completion', reason: 'user_requested' }).session(session).lean();
    return command.references.map((ref, index) => {
      const binding = ref.bindingOperationId || command.operationId || rows[index]?.operationId;
      const matches = receipts.filter(r => String(r.mediaId) === ref.mediaId
        && (!binding || r.bindingOperationId === binding));
      if (matches.length > 1) throw inconsistent();
      if (!matches.length) return null;
      const receipt = matches[0], tombstone = tombstones.find(t => String(t.mediaId) === ref.mediaId);
      if (!tombstone) throw inconsistent();
      return { mediaId: ref.mediaId, resourceType: receipt.resourceType, resourceId: String(receipt.resourceId),
        field: receipt.field, bindingOperationId: receipt.bindingOperationId,
        deletedAt: tombstone.deletedAt.toISOString(), releasedAt: receipt.releasedAt.toISOString() };
    });
  };
  const response = (command, operation, rows, time, proofs) => ({
    operation: command.operationId ? {
      operationId: command.operationId, state: operation?.state || 'ABSENT', commandHash: operation?.commandHash || null,
      leaseExpiresAt: operation?.state === 'PREPARED' ? operation.leaseExpiresAt.toISOString() : null,
      leaseExpired: operation?.state === 'PREPARED' ? time >= operation.leaseExpiresAt : null,
      failureCode: operation?.state === 'ABORTED' ? operation.failureCode : null
    } : null,
    references: command.references.map((ref, index) => ({
      mediaId: ref.mediaId, field: ref.field, state: rows[index]?.state || 'absent', privacyDeletion: proofs[index],
      ...(rows[index] ? { bindingOperationId: rows[index].operationId } : {})
    }))
  });
  const validateIdentity = (command, operation) => {
    if (operation.commandHash !== command.commandHash || operation.referenceSetHash !== command.referenceSetHash
      || JSON.stringify(operation.references.map((ref) => ({ mediaId: String(ref.mediaId), field: ref.field })))
        !== JSON.stringify(command.references)) throw error(409, 'MEDIA_OPERATION_CONFLICT');
    if (!['PREPARED', 'COMMITTED', 'ABORTED'].includes(operation.state)
      || (operation.state === 'PREPARED' && !(operation.leaseExpiresAt instanceof Date))) throw inconsistent();
  };
  const validatePrepared = (operation, rows) => {
    if (rows.some((ref) => !ref || ref.operationId !== operation.operationId || ref.state !== 'prepared'
      || ref.leaseExpiresAt?.getTime() !== operation.leaseExpiresAt.getTime())) throw inconsistent();
  };
  const validateAssets = async (command, session) => {
    const assets = await MediaAssetModel.find({ _id: { $in: command.references.map((ref) => ref.mediaId) } }).session(session).lean();
    const byId = new Map(assets.map((asset) => [String(asset._id), asset]));
    for (const ref of command.references) {
      const asset = byId.get(ref.mediaId);
      if (!asset || asset.status !== 'active') return 'RESOURCE_NOT_FOUND';
      if (String(asset.familyId) !== command.familyId || String(asset.childId) !== command.childId) return 'CHILD_ACCESS_DENIED';
      if (asset.purpose !== 'task_completion' || !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) {
        return 'MEDIA_PURPOSE_MISMATCH';
      }
    }
    return null;
  };
  const fenceAssets = async (command, session) => {
    // A real write (not only a snapshot read) conflicts with a concurrent asset deletion.
    const result = await MediaAssetModel.updateMany({
      _id: { $in: command.references.map((ref) => ref.mediaId) }, familyId: command.familyId,
      childId: command.childId, status: 'active', purpose: 'task_completion'
    }, { $inc: { __v: 1 } }, { session });
    if (result.matchedCount !== command.references.length) throw inconsistent();
  };
  const retryRace = () => Object.assign(new Error('Retry operation CAS'), { operationRace: true });
  const transact = async (work) => {
    // withTransaction retries write conflicts. Unique first-insert races need a new transaction.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await transactionRunner(async (session) => {
          if (!session?.inTransaction()) throw new Error('Active MongoDB transaction is required');
          return work(session);
        });
      } catch (err) {
        if (err.code !== 11000 && !err.operationRace) throw err;
      }
    }
    throw error(503, 'MEDIA_REFERENCE_PENDING');
  };
  const insertOperation = async (command, session, state, time, failureCode = null) => {
    const [operation] = await OperationModel.create([{
      ...operationKey(command), commandHash: command.commandHash, referenceSetHash: command.referenceSetHash,
      references: command.references, state, version: 0,
      leaseExpiresAt: state === 'PREPARED' ? new Date(time.getTime() + leaseSeconds * 1000) : null,
      terminalAt: state === 'PREPARED' ? null : time, failureCode
    }], { session });
    return operation.toObject();
  };
  const transition = async (command, operation, rows, session, time, state, failureCode = null) => {
    validatePrepared(operation, rows);
    await OperationModel.hydrate({ ...operation, state, terminalAt: time, leaseExpiresAt: null,
      failureCode, version: operation.version + 1 }).validate();
    const updated = await OperationModel.findOneAndUpdate({
      ...operationKey(command), _id: operation._id, state: 'PREPARED', version: operation.version
    }, { $set: { state, terminalAt: time, leaseExpiresAt: null, failureCode }, $inc: { version: 1 } },
    { session, new: true, runValidators: true }).lean();
    if (!updated) throw retryRace();
    for (let index = 0; index < command.references.length; index += 1) {
      const ref = command.references[index];
      const patch = {
        state: state === 'COMMITTED' ? 'bound' : 'released', leaseExpiresAt: null,
        releasedAt: state === 'COMMITTED' ? null : time,
        releaseOperationId: state === 'COMMITTED' ? null : command.operationId
      };
      // Existing cross-field validators require a document, not a Query as `this`.
      await MediaReferenceModel.hydrate({ ...rows[index], ...patch }).validate();
      const result = await MediaReferenceModel.updateOne({
        ...referenceKey(command, ref), operationId: command.operationId, state: 'prepared', leaseExpiresAt: operation.leaseExpiresAt
      }, { $set: patch }, { session });
      if (result.matchedCount !== 1) throw inconsistent();
    }
    return updated;
  };

  const releaseForPrivacyDeletion = async ({ asset, session }) => {
    if (!session?.inTransaction()) throw new Error('Active MongoDB transaction is required');
    const targets = await MediaReferenceModel.find({ mediaId: asset._id }).session(session).lean();
    for (const target of targets) {
      if (String(target.familyId) !== String(asset.familyId) || String(target.childId) !== String(asset.childId)
        || target.resourceType !== 'growth_task' || target.field !== FIELD) throw inconsistent();
      const operation = await OperationModel.findOne(operationKey(target)).session(session).lean();
      if (!operation) throw inconsistent();
      const command = normalize({ familyId: String(operation.familyId), childId: String(operation.childId),
        resourceType: operation.resourceType, resourceId: String(operation.resourceId), operationId: operation.operationId,
        commandHash: operation.commandHash, references: operation.references.map(r => ({ mediaId: String(r.mediaId), field: r.field })) }, 'abort');
      validateIdentity(command, operation);
      if (!command.references.some(r => r.mediaId === String(asset._id))) throw inconsistent();
      if (await MediaReferenceModel.exists({ ...operationKey(command),
        mediaId: { $nin: command.references.map(r => r.mediaId) } }).session(session)) throw inconsistent();
      if (operation.state === 'PREPARED') {
        const rows = await readReferences(command, session);
        const time = currentTime();
        await transition(command, operation, rows, session, time, 'ABORTED',
          time >= operation.leaseExpiresAt ? 'MEDIA_OPERATION_EXPIRED' : 'RESOURCE_NOT_FOUND');
      } else if (target.state === 'bound' && operation.state === 'COMMITTED') {
        const changed = await OperationModel.updateOne({ ...operationKey(command), state: 'COMMITTED', version: operation.version },
          { $inc: { version: 1 } }, { session });
        if (changed.matchedCount !== 1) throw inconsistent();
        const releasedAt = currentTime();
        await Receipt.create([{ familyId: asset.familyId, childId: asset.childId, mediaId: asset._id,
          resourceType: target.resourceType, resourceId: target.resourceId, field: FIELD,
          bindingOperationId: target.operationId, releasedAt }], { session });
        const patch = { state: 'released', leaseExpiresAt: null, releasedAt, releaseOperationId: null };
        await MediaReferenceModel.hydrate({ ...target, ...patch }).validate();
        const released = await MediaReferenceModel.updateOne({ ...referenceKey(command, { mediaId: asset._id }),
          operationId: target.operationId, state: 'bound' }, { $set: patch }, { session });
        if (released.matchedCount !== 1) throw inconsistent();
      } else if (target.state !== 'released') throw inconsistent();
    }
  };

  const execute = async (input, action) => {
    const command = normalize(input, action);
    return transact(async (session) => {
      let operation = await OperationModel.findOne(operationKey(command)).session(session).lean();
      let rows = await readReferences(command, session);
      if (operation) {
        validateIdentity(command, operation);
        const extra = await MediaReferenceModel.exists({ ...operationKey(command),
          mediaId: { $nin: command.references.map((ref) => ref.mediaId) } }).session(session);
        if (extra) throw inconsistent();
        if (operation.state === 'PREPARED') {
          validatePrepared(operation, rows);
          const time = currentTime();
          if (time >= operation.leaseExpiresAt || action === 'abort') {
            operation = await transition(command, operation, rows, session, time, 'ABORTED',
              time >= operation.leaseExpiresAt ? 'MEDIA_OPERATION_EXPIRED' : 'MEDIA_OPERATION_ABORTED');
          } else if (action === 'commit') {
            if (await validateAssets(command, session)) throw inconsistent();
            await fenceAssets(command, session);
            const decisionTime = currentTime();
            const expired = decisionTime >= operation.leaseExpiresAt;
            operation = await transition(command, operation, rows, session, decisionTime,
              expired ? 'ABORTED' : 'COMMITTED', expired ? 'MEDIA_OPERATION_EXPIRED' : null);
          }
        } else if (operation.state === 'COMMITTED') {
          // Later generations/retention can change current refs, never the historical terminal.
          // The caller must still verify exact bindings or privacy receipts before publishing.
          if (rows.some((ref) => ref?.operationId === operation.operationId && !['bound', 'released'].includes(ref.state))) {
            throw inconsistent();
          }
        } else if (rows.some((ref) => ref?.operationId === operation.operationId && ref.state !== 'released')) {
          throw inconsistent();
        }
      } else if (action === 'commit') {
        throw error(409, 'MEDIA_OPERATION_NOT_PREPARED');
      } else if (action === 'abort') {
        if (rows.some((ref) => ref?.operationId === command.operationId && ref.state !== 'released')) throw inconsistent();
        operation = await insertOperation(command, session, 'ABORTED', currentTime(), 'MEDIA_OPERATION_ABORTED');
      } else {
        const failureCode = await validateAssets(command, session)
          || (rows.some((ref) => ref && (ref.state !== 'released' || ref.operationId === command.operationId)) ? 'RESOURCE_CONFLICT' : null);
        operation = await insertOperation(command, session, failureCode ? 'ABORTED' : 'PREPARED', currentTime(), failureCode);
        if (!failureCode) {
          await fenceAssets(command, session);
          for (let index = 0; index < command.references.length; index += 1) {
            const key = referenceKey(command, command.references[index]);
            const value = { operationId: command.operationId, state: 'prepared', leaseExpiresAt: operation.leaseExpiresAt,
              releasedAt: null, releaseOperationId: null };
            if (rows[index]) {
              const result = await MediaReferenceModel.updateOne({ ...key, state: 'released', operationId: rows[index].operationId },
                { $set: value }, { session, runValidators: true });
              if (result.matchedCount !== 1) throw retryRace();
            } else {
              await MediaReferenceModel.create([{ ...key, ...value }], { session });
            }
          }
        }
      }
      rows = await readReferences(command, session);
      const proofs = await readProofs(command, rows, session);
      return response(command, operation, rows, currentTime(), proofs);
    });
  };

  const unbind = async (input) => {
    const command = normalize(input, 'unbind');
    return transact(async (session) => {
      const rows = await readReferences(command, session), operations = new Map();
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index], ref = command.references[index];
        if (!row) continue;
        if (row.operationId !== ref.bindingOperationId || row.state === 'prepared') throw error(409, 'RESOURCE_CONFLICT');
        if (row.state === 'released') continue;
        if (row.state !== 'bound') throw inconsistent();
        if (!operations.has(row.operationId)) {
          const key = { ...operationKey(command), operationId: row.operationId };
          const operation = await OperationModel.findOne(key).session(session).lean();
          if (!operation || operation.state !== 'COMMITTED') throw inconsistent();
          let original;
          try {
            original = normalize({ familyId: command.familyId, childId: command.childId,
              resourceType: command.resourceType, resourceId: command.resourceId, operationId: operation.operationId,
              commandHash: operation.commandHash,
              references: operation.references.map(r => ({ mediaId: String(r.mediaId), field: r.field })) }, 'commit');
            validateIdentity(original, operation);
          } catch (_cause) { throw inconsistent(); }
          if (await MediaReferenceModel.exists({ ...key, $or: [
            { mediaId: { $nin: original.references.map(r => r.mediaId) } }, { state: { $nin: ['bound', 'released'] } }
          ] }).session(session)) throw inconsistent();
          operations.set(row.operationId, { operation, original });
        }
        if (!operations.get(row.operationId).original.references.some(r => r.mediaId === ref.mediaId)) throw inconsistent();
      }
      // Fence each old terminal once, sharing the serialization point with privacy deletion.
      for (const { operation, original } of operations.values()) {
        const updated = await OperationModel.updateOne({ ...operationKey(original), state: 'COMMITTED', version: operation.version },
          { $inc: { version: 1 } }, { session });
        if (updated.matchedCount !== 1) throw retryRace();
      }
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (row?.state !== 'bound') continue;
        const patch = { state: 'released', leaseExpiresAt: null, releasedAt: currentTime(), releaseOperationId: command.operationId };
        await MediaReferenceModel.hydrate({ ...row, ...patch }).validate();
        const updated = await MediaReferenceModel.updateOne({ ...referenceKey(command, command.references[index]),
          operationId: row.operationId, state: 'bound' }, { $set: patch }, { session });
        if (updated.matchedCount !== 1) throw retryRace();
      }
      // Release IDs are audit-only; proofs are selected per requested old binding, including absent rows.
      const { operationId, ...projection } = command;
      const released = await readReferences(projection, session);
      const proofs = await readProofs(projection, released, session);
      return response(projection, null, released, currentTime(), proofs);
    });
  };

  const status = async (input) => {
    const command = normalize(input, 'status');
    return transact(async (session) => {
      const operation = command.operationId ? await OperationModel.findOne(operationKey(command)).session(session).lean() : null;
      if (operation) validateIdentity(command, operation);
      const rows = await readReferences(command, session);
      const proofs = await readProofs(command, rows, session);
      return response(command, operation, rows, currentTime(), proofs);
    });
  };
  return { prepare: (input) => execute(input, 'prepare'), commit: (input) => execute(input, 'commit'),
    abort: (input) => execute(input, 'abort'), status, unbind, releaseForPrivacyDeletion };
};

module.exports = { createMediaReferenceOperationService };
