const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const M = require('../models/Ai2');
const C = require('./ai2Contract');
const { referenceSetHash } = require('../../../common/services/completionMediaProtocol');
const FIELD = 'correctionMediaIds';
const TYPE = 'ai2_attempt';
const TERMINAL = ['SUCCEEDED', 'FAILED'];
const ACTIVE = ['RESERVED', 'MEDIA_PREPARED', 'MEDIA_COMMITTED', 'RESOLVING'];
const same = (a, b) => String(a) === String(b);
const pendingError = () => C.error(503, 'AI2_COMMAND_PENDING');
const conflict = code => C.error(409, code || 'AI2_STATE_CONFLICT');
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const commandView = c => ({ id: String(c._id), operationId: c.operationId, endpointOperation: c.endpointOperation,
  phase: c.phase, resultReference: c.resultReference || null, failureCode: c.failureCode || null, createdAt: c.createdAt });

function createAi2SubmissionService({ authorize, resource, transact, writeView, previous, continuous, enabled,
  getRuntime, assertReady, now = Date.now, mediaReferenceClient: client, leaseMs = 30000 } = {}) {
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError('Invalid AI2 submission lease');
  const clock = () => {
    const value = Number(now());
    if (!Number.isSafeInteger(value) || !Number.isFinite(new Date(value + leaseMs).getTime())) throw C.error(503, 'AI2_NOT_READY');
    return value;
  };
  const instant = () => new Date(clock());
  const expiry = () => new Date(clock() + leaseMs);
  const childOnly = identity => {
    if (!identity) throw C.error(401, 'UNAUTHENTICATED');
    if (identity.role !== 'student' || !same(identity.id, identity.childId)) throw C.error(403, 'CHILD_ACCESS_DENIED');
  };
  const scope = c => ({ familyId: String(c.familyId), childId: String(c.childId), resourceType: TYPE, resourceId: String(c.attemptId) });
  const mappingHash = c => C.hash({ ...scope(c), references: c.references });
  const wire = c => ({ ...scope(c), remoteOperationId: c.remoteOperationId, commandHash: c.referencesHash,
    references: c.references.map(r => ({ mediaId: r.mediaId, field: FIELD })) });
  const ownerQuery = c => ({ _id: c._id, owner: c.owner, phase: c.phase, leaseExpiresAt: { $gt: instant() } });
  const read = c => M.Command.findById(c._id).read('primary').readConcern('majority').lean();
  async function ready() {
    continuous();
    try { await assertReady(); } catch (_) { throw C.error(503, 'AI2_NOT_READY'); }
  }
  async function owned(c, identity) {
    continuous(); await authorize(identity, String(c.childId));
    const value = await M.Command.findOneAndUpdate(ownerQuery(c), { $set: { leaseExpiresAt: expiry() } }, { new: true }).lean();
    if (!value) throw pendingError();
    return value;
  }
  async function phase(c, next, identity) {
    await owned(c, identity);
    const value = await M.Command.findOneAndUpdate(ownerQuery(c), { $set: { phase: next, leaseExpiresAt: expiry() } }, { new: true }).lean();
    if (!value) throw pendingError();
    return value;
  }
  function validateMapping(c) {
    const payload = C.normalize('submit', c.payload);
    if (c.operationId !== payload.operationId || c.requestHash !== C.requestHash('submit',
      `/api/ai2/learning-packages/${c.packageId}/attempts`, payload) || C.hash(payload) !== C.hash(c.payload)
      || c.expectedPackageVersion !== payload.expectedPackageVersion || c.reservedPackageVersion !== c.expectedPackageVersion + 1
      || !Number.isSafeInteger(c.reservedPackageVersion) || !same(c.actorId, c.childId)
      || !C.isId(String(c.attemptId)) || !Number.isSafeInteger(c.attemptVersion) || c.attemptVersion < 1
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(c.remoteOperationId)
      || !Array.isArray(c.payload?.mediaIds) || c.payload.mediaIds.length < 1 || c.payload.mediaIds.length > 10
      || new Set(c.payload.mediaIds).size !== c.payload.mediaIds.length || !Array.isArray(c.references)
      || c.references.length !== c.payload.mediaIds.length || c.references.some((r, i) => !r
        || r.mediaId !== c.payload.mediaIds[i] || !C.isId(r.mediaId) || r.resourceType !== TYPE
        || r.resourceId !== String(c.attemptId) || r.field !== FIELD || r.bindingOperationId !== c.remoteOperationId)
      || c.referencesHash !== mappingHash(c)) throw pendingError();
  }
  function proofValid(proof, ref, c) {
    return proof && proof.mediaId === ref.mediaId && proof.resourceType === TYPE
      && proof.resourceId === String(c.attemptId) && proof.field === FIELD
      && proof.bindingOperationId === c.remoteOperationId && date(proof.deletedAt) && date(proof.releasedAt);
  }
  function inspect(result, c, cleanup = false) {
    const op = result?.operation;
    const refHash = referenceSetHash({ ...wire(c), references: wire(c).references.sort((a, b) => a.mediaId.localeCompare(b.mediaId)) });
    if (!op || op.operationId !== c.remoteOperationId || !['ABSENT', 'PREPARED', 'COMMITTED', 'ABORTED'].includes(op.state)
      || op.resourceType !== TYPE || op.resourceId !== String(c.attemptId) || op.field !== FIELD
      || op.referenceSetHash !== (op.state === 'ABSENT' ? null : refHash)
      || op.commandHash !== (op.state === 'ABSENT' ? null : c.referencesHash)
      || !Array.isArray(result.references) || result.references.length !== c.references.length
      || op.state === 'PREPARED' && (!date(op.leaseExpiresAt) || typeof op.leaseExpired !== 'boolean')) throw pendingError();
    const remaining = new Set(c.references.map(r => r.mediaId));
    for (const ref of result.references) {
      if (!ref || !remaining.delete(ref.mediaId) || ref.field !== FIELD
        || ref.resourceType !== TYPE || ref.resourceId !== String(c.attemptId)
        || !['absent', 'prepared', 'bound', 'released'].includes(ref.state)
        || ref.state !== 'absent' && ref.bindingOperationId !== c.remoteOperationId
        || ref.state === 'absent' && ref.bindingOperationId !== undefined
        || ref.privacyDeletion && !proofValid(ref.privacyDeletion, ref, c)) throw pendingError();
      if (op.state === 'ABSENT' && ref.state !== 'absent'
        || op.state === 'PREPARED' && ref.state !== 'prepared'
        || op.state === 'ABORTED' && !['released', 'absent'].includes(ref.state)) throw pendingError();
      if (op.state === 'COMMITTED' && (cleanup
        ? !['bound', 'released', 'absent'].includes(ref.state)
        : ref.state !== 'bound' && (!['released', 'absent'].includes(ref.state) || !proofValid(ref.privacyDeletion, ref, c)))) throw pendingError();
    }
    if (remaining.size) throw pendingError();
    return op;
  }
  async function remote(c, identity, action, cleanup = false) {
    await owned(c, identity);
    if (['prepare', 'commit'].includes(action)) enabled();
    if (typeof client?.[action] !== 'function') throw pendingError();
    const result = await client[action]({ ...wire(c), ...(action === 'status' ? { mode: 'operation' } : {}) });
    inspect(result, c, cleanup);
    return result;
  }
  async function view(c, identity) {
    await authorize(identity, String(c.childId));
    const p = await resource(M.Package, identity, String(c.packageId), null, true);
    if (c.phase === 'SUCCEEDED' && p.visibility === 'published') return writeView(c, identity);
    return { command: commandView(c), pending: !TERMINAL.includes(c.phase) };
  }
  async function resolving(c, identity, code) {
    // This transaction fences final publication on the same command row before any compensation.
    try {
      await transact(async session => {
        continuous(); await authorize(identity, String(c.childId), session);
        const locked = await M.Package.updateOne({ _id: c.packageId, activeCommandId: c._id },
          { $inc: { stateVersion: 1 } }, { session });
        if (locked.matchedCount !== 1) throw pendingError();
        const changed = await M.Command.updateOne(ownerQuery(c),
          { $set: { phase: 'RESOLVING', failureCode: code, leaseExpiresAt: expiry() } }, { session });
        if (changed.matchedCount !== 1) throw pendingError();
      });
    } catch (_) {
      // A failed/unknown transaction is not permission to clean up. Confirm the durable branch below.
    }
    const stored = await read(c);
    if (!stored || stored.phase !== 'RESOLVING' || stored.owner !== c.owner
      || Number(stored.leaseExpiresAt) <= Number(now())) throw pendingError();
    return stored;
  }
  async function finishFailure(c, identity) {
    await transact(async session => {
      continuous(); await authorize(identity, String(c.childId), session);
      const changed = await M.Command.updateOne(ownerQuery(c),
        { $set: { phase: 'FAILED', owner: null, leaseExpiresAt: null } }, { session });
      if (c.phase !== 'RESOLVING' || changed.matchedCount !== 1) throw pendingError();
      const unlocked = await M.Package.updateOne({ _id: c.packageId, activeCommandId: c._id },
        { $set: { activeCommandId: null }, $inc: { stateVersion: 1 } }, { session });
      if (unlocked.matchedCount !== 1) throw pendingError();
    });
  }
  async function cleanup(c, identity) {
    let result = await remote(c, identity, 'status', true), op = result.operation;
    if (['ABSENT', 'PREPARED'].includes(op.state)) {
      result = await remote(c, identity, 'abort', true); op = result.operation;
    }
    if (op.state === 'COMMITTED') {
      await owned(c, identity);
      const released = await client.unbind({ ...scope(c), remoteOperationId: c.remoteOperationId,
        references: c.references.map(r => ({ mediaId: r.mediaId, field: FIELD, bindingOperationId: c.remoteOperationId })) });
      if (released?.operation !== null || !Array.isArray(released.references)
        || released.references.length !== c.references.length) throw pendingError();
      const remaining = new Set(c.references.map(r => r.mediaId));
      for (const ref of released.references) {
        if (!ref || !remaining.delete(ref.mediaId) || ref.field !== FIELD || !['released', 'absent'].includes(ref.state)
          || ref.resourceType !== TYPE || ref.resourceId !== String(c.attemptId)
          || ref.state === 'released' && ref.bindingOperationId !== c.remoteOperationId
          || ref.state === 'absent' && ref.bindingOperationId !== undefined
          || ref.privacyDeletion && !proofValid(ref.privacyDeletion, ref, c)) throw pendingError();
      }
      if (remaining.size) throw pendingError();
    } else if (op.state !== 'ABORTED') throw pendingError();
    await finishFailure(c, identity);
  }
  async function publish(c, identity) {
    await transact(async session => {
      continuous(); await authorize(identity, String(c.childId), session);
      const changed = await M.Command.updateOne(ownerQuery(c), { $set: { phase: 'SUCCEEDED', owner: null,
        leaseExpiresAt: null, resultReference: { packageId: String(c.packageId), attemptId: String(c.attemptId) } } }, { session });
      if (c.phase !== 'MEDIA_COMMITTED' || changed.matchedCount !== 1) throw pendingError();
      const published = await M.Package.updateOne({ _id: c.packageId, familyId: c.familyId, childId: c.childId,
        activeCommandId: c._id, stateVersion: c.reservedPackageVersion, visibility: 'published', learningState: { $in: ['open', 'revise'] } },
      { $set: { activeCommandId: null, learningState: 'submitted', currentAttemptId: c.attemptId, currentAttemptVersion: c.attemptVersion },
        $inc: { stateVersion: 1 } }, { session });
      if (published.matchedCount !== 1) throw pendingError();
      await M.Attempt.create([{ _id: c.attemptId, familyId: c.familyId, childId: c.childId, packageId: c.packageId,
        attemptVersion: c.attemptVersion, submitCommandId: c._id, submittedBy: c.actorId, submittedAt: c.createdAt,
        note: c.payload.note, mediaIds: c.payload.mediaIds, mediaBindings: c.references,
        payloadHash: C.hash({ note: c.payload.note, mediaIds: c.payload.mediaIds, bindings: c.references,
          submittedBy: String(c.actorId), attemptVersion: c.attemptVersion }), review: null }], { session });
    });
  }
  async function drive(initial, identity, owner) {
    let c = initial;
    try {
      if (TERMINAL.includes(c.phase)) return view(c, identity);
      if (!owner) {
        owner = randomUUID();
        c = await M.Command.findOneAndUpdate({ _id: c._id, phase: { $in: ACTIVE },
          $or: [{ owner: null }, { leaseExpiresAt: { $lte: instant() } }] },
        { $set: { owner, leaseExpiresAt: expiry() } }, { new: true }).lean();
        if (!c) return view(await read(initial), identity);
      }
      validateMapping(c);
      if (c.phase === 'RESOLVING') { await cleanup(c, identity); return view(await read(c), identity); }
      const p = await resource(M.Package, identity, String(c.packageId), null, true);
      if (p.visibility !== 'published' || p.stateVersion !== c.reservedPackageVersion
        || !same(p.activeCommandId, c._id) || !['open', 'revise'].includes(p.learningState)) {
        c = await resolving(c, identity, p.visibility === 'withdrawn' ? 'AI2_PACKAGE_WITHDRAWN' : 'AI2_STATE_CONFLICT');
        await cleanup(c, identity); return view(await read(c), identity);
      }
      let result = await remote(c, identity, 'status'), op = result.operation;
      if (op.state === 'ABSENT' && c.phase !== 'RESERVED'
        || op.state === 'PREPARED' && c.phase === 'MEDIA_COMMITTED') throw pendingError();
      if (op.state !== 'COMMITTED' && (getRuntime()?.enabled !== true || op.state === 'ABORTED'
        || op.state === 'PREPARED' && op.leaseExpired)) {
        const code = getRuntime()?.enabled !== true ? 'AI2_DISABLED'
          : op.state === 'ABORTED' ? op.failureCode || 'AI2_MEDIA_UNAVAILABLE' : 'MEDIA_OPERATION_EXPIRED';
        c = await resolving(c, identity, code); await cleanup(c, identity); return view(await read(c), identity);
      }
      if (op.state === 'ABSENT') { result = await remote(c, identity, 'prepare'); op = result.operation; }
      if (op.state === 'PREPARED') {
        if (c.phase === 'RESERVED') c = await phase(c, 'MEDIA_PREPARED', identity);
        result = await remote(c, identity, 'status'); op = result.operation;
        if (op.state === 'PREPARED' && !op.leaseExpired && getRuntime()?.enabled === true) {
          result = await remote(c, identity, 'commit'); op = result.operation;
        }
      }
      if (op.state !== 'COMMITTED') {
        if (op.state === 'ABORTED' || op.state === 'PREPARED' && (op.leaseExpired || getRuntime()?.enabled !== true)) {
          c = await resolving(c, identity, getRuntime()?.enabled !== true ? 'AI2_DISABLED' : op.failureCode || 'MEDIA_OPERATION_EXPIRED');
          await cleanup(c, identity);
        }
        return view(await read(c), identity);
      }
      if (c.phase !== 'MEDIA_COMMITTED') c = await phase(c, 'MEDIA_COMMITTED', identity);
      const current = await resource(M.Package, identity, String(c.packageId), null, true);
      if (current.visibility !== 'published' || current.stateVersion !== c.reservedPackageVersion) {
        c = await resolving(c, identity, current.visibility === 'withdrawn' ? 'AI2_PACKAGE_WITHDRAWN' : 'AI2_STATE_CONFLICT');
        await cleanup(c, identity);
      } else await publish(c, identity);
    } catch (cause) {
      if ([401, 403, 404].includes(cause?.statusCode)) throw cause;
      // Network/CAS/commit ambiguity only permits reading persisted state, never compensation.
    }
    return view(await read(initial), identity);
  }
  async function submit({ identity, packageId, body }) {
    childOnly(identity);
    const initial = await resource(M.Package, identity, packageId, null, true);
    const payload = C.normalize('submit', body), path = `/api/ai2/learning-packages/${packageId}/attempts`;
    const old = await previous(identity, String(initial.childId), 'submit', path, payload);
    if (old.found) { await ready(); return drive(old.found, identity); }
    enabled(); await ready();
    const owner = randomUUID(); let saved;
    try {
      saved = await transact(async session => {
        const { found, key } = await previous(identity, String(initial.childId), 'submit', path, payload, session);
        if (found) return found;
        enabled(); continuous();
        const p = await resource(M.Package, identity, packageId, session, true);
        if (p.activeCommandId) throw conflict('AI2_COMMAND_PENDING');
        if (p.visibility !== 'published' || !['open', 'revise'].includes(p.learningState)
          || p.stateVersion !== payload.expectedPackageVersion) throw conflict();
        const _id = new mongoose.Types.ObjectId(), attemptId = new mongoose.Types.ObjectId(), remoteOperationId = randomUUID();
        const record = { _id, ...key, childId: p.childId, packageId: p._id, requestHash: C.requestHash('submit', path, payload),
          payload, expectedPackageVersion: payload.expectedPackageVersion, reservedPackageVersion: p.stateVersion + 1,
          attemptId, attemptVersion: (p.currentAttemptVersion || 0) + 1, remoteOperationId,
          references: payload.mediaIds.map(mediaId => ({ mediaId, resourceType: TYPE, resourceId: String(attemptId),
            field: FIELD, bindingOperationId: remoteOperationId })), phase: 'RESERVED', owner, leaseExpiresAt: expiry() };
        record.referencesHash = mappingHash(record);
        const locked = await M.Package.updateOne({ _id: p._id, activeCommandId: null, stateVersion: p.stateVersion, visibility: 'published' },
          { $set: { activeCommandId: _id }, $inc: { stateVersion: 1 } }, { session });
        if (locked.matchedCount !== 1) throw conflict();
        const [value] = await M.Command.create([record], { session }); return value.toObject();
      });
    } catch (cause) {
      const replay = await previous(identity, String(initial.childId), 'submit', path, payload);
      if (!replay.found) throw cause;
      // An ambiguous reservation is returned, not sent remotely until an explicit retry.
      return view(replay.found, identity);
    }
    return drive(saved, identity, saved.owner === owner ? owner : undefined);
  }
  async function recover({ identity, commandId, body }) {
    childOnly(identity);
    const c = await resource(M.Command, identity, commandId);
    if (!same(c.actorId, identity.id) || c.endpointOperation !== 'ai2.submit') throw C.error(404, 'RESOURCE_NOT_FOUND');
    if (C.normalize('recover', body).operationId !== c.operationId) throw conflict('IDEMPOTENCY_CONFLICT');
    await ready(); return drive(c, identity);
  }
  return { submit, recover };
}
module.exports = { createAi2SubmissionService };
