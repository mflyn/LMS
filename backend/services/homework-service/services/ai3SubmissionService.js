const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const M = require('../models/Ai3');
const A = require('../models/Ai2');
const C = require('./ai3Contract');
const { referenceSetHash } = require('../../../common/services/completionMediaProtocol');
const FIELD = 'practiceMediaIds';
const TYPE = 'ai3_attempt';
const TERMINAL = ['SUCCEEDED', 'FAILED'];
const ACTIVE = ['RESERVED', 'MEDIA_PREPARED', 'MEDIA_COMMITTED', 'RESOLVING'];
const same = (a, b) => String(a) === String(b);
const pendingError = () => C.error(503, 'AI3_COMMAND_PENDING');
const conflict = code => C.error(409, code || 'AI3_VERSION_CONFLICT');
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const commandView = c => ({ id: String(c._id), operationId: c.operationId, endpointOperation: c.endpointOperation,
  roundId: String(c.roundId), phase: c.phase, resultReference: c.resultReference || null, failureCode: c.failureCode || null, createdAt: c.createdAt });

const scope = c => ({ familyId: String(c.familyId), childId: String(c.childId), resourceType: TYPE, resourceId: String(c.attemptId) });
const mappingHash = c => C.hash({ ...scope(c), references: c.references, serverContentBinding: c.serverContentBinding });
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const dense = value => Array.isArray(value) && Object.keys(value).length === value.length
  && Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean);
const validContentBinding = b => b && Object.keys(b).sort().join(',') === 'childSnapshotHash,contentId,contentVersion,fullContentHash'
  && C.isId(b.contentId) && Number.isSafeInteger(b.contentVersion) && b.contentVersion >= 1
  && /^[a-f0-9]{64}$/.test(b.fullContentHash) && /^[a-f0-9]{64}$/.test(b.childSnapshotHash);
const attemptPayload = a => ({ note: a.note, mediaIds: a.mediaIds.map(String), bindings: a.mediaBindings,
  submittedBy: String(a.submittedBy), attemptVersion: a.attemptVersion, serverContentBinding: a.serverContentBinding });
function validateAttempt(a) {
  if (!a || !C.isId(String(a._id)) || !C.isId(String(a.roundId)) || !C.isId(String(a.familyId))
    || !C.isId(String(a.childId)) || !C.isId(String(a.submitCommandId)) || !same(a.submittedBy, a.childId)
    || !Number.isSafeInteger(a.attemptVersion) || a.attemptVersion < 1 || typeof a.note !== 'string'
    || !validContentBinding(a.serverContentBinding) || !dense(a.mediaIds) || a.mediaIds.length < 1 || a.mediaIds.length > 10
    || new Set(a.mediaIds.map(String)).size !== a.mediaIds.length || !a.mediaIds.every(v => C.isId(String(v)))
    || !dense(a.mediaBindings) || a.mediaBindings.length !== a.mediaIds.length
    || a.mediaBindings.some((r, i) => !r || Object.keys(r).sort().join(',') !== 'bindingOperationId,field,mediaId,resourceId,resourceType'
      || r.mediaId !== String(a.mediaIds[i]) || r.resourceType !== TYPE || r.resourceId !== String(a._id)
      || r.field !== FIELD || !uuid(r.bindingOperationId) || r.bindingOperationId !== a.mediaBindings[0].bindingOperationId)
    || a.payloadHash !== C.hash(attemptPayload(a))) throw C.error(409, 'AI3_MEDIA_UNAVAILABLE');
  try {
    const b = a.serverContentBinding;
    const normalized = C.normalize('submit', { schemaVersion: 'ai3-min-v1', operationId: a.mediaBindings[0].bindingOperationId,
      expectedRoundVersion: 1, contentId: b.contentId, contentVersion: b.contentVersion, childSnapshotHash: b.childSnapshotHash,
      note: a.note, mediaIds: a.mediaIds.map(String) });
    if (normalized.note !== a.note) throw new Error('Noncanonical note');
  } catch (_) { throw C.error(409, 'AI3_MEDIA_UNAVAILABLE'); }
  return a;
}
async function assertPublishedAncestor(r, { session = null, touch = false } = {}) {
  const p = await A.Package.findOne({ _id: r.sourcePackageId, familyId: r.familyId, childId: r.childId }).session(session).lean();
  const a = p && await A.Attempt.findOne({ _id: p.currentAttemptId, packageId: p._id,
    familyId: r.familyId, childId: r.childId, attemptVersion: p.currentAttemptVersion }).session(session).lean();
  if (!p || p.visibility !== 'published' || p.learningState !== 'approved' || p.activeCommandId || !a
    || a.review?.decision !== 'approve' || !same(a._id, r.sourceAttemptId) || a.attemptVersion !== r.sourceAttemptVersion
    || a.payloadHash !== r.sourceAttemptPayloadHash || C.hash(a.review) !== r.sourceReviewHash) throw conflict('AI3_SOURCE_NOT_APPROVED');
  if (touch) {
    if (!session?.inTransaction()) throw C.error(503, 'AI3_NOT_READY');
    const changed = await A.Package.updateOne({ _id: p._id, familyId: r.familyId, childId: r.childId,
      stateVersion: p.stateVersion, visibility: 'published', learningState: 'approved', activeCommandId: null,
      currentAttemptId: a._id, currentAttemptVersion: a.attemptVersion }, { $inc: { stateVersion: 1 } }, { session });
    if (changed.matchedCount !== 1) throw conflict('AI3_SOURCE_NOT_APPROVED');
  }
  return p;
}
async function contentBinding(r, payload, expected = null, session = null) {
  const publication = r.publication;
  if (!same(r.currentContentId, payload.contentId) || r.currentContentVersion !== payload.contentVersion
    || !publication || publication.contentId !== payload.contentId || publication.contentVersion !== payload.contentVersion
    || publication.childSnapshotHash !== payload.childSnapshotHash || publication.contentHash !== r.currentContentHash) throw conflict();
  const content = await M.Content.findOne({ _id: payload.contentId, roundId: r._id, familyId: r.familyId, childId: r.childId,
    version: payload.contentVersion }).session(session).lean();
  if (!content || content.contentHash !== publication.contentHash || content.childSnapshotHash !== payload.childSnapshotHash
    || C.hash(content.content) !== content.contentHash || C.hash(content.childSnapshot) !== content.childSnapshotHash
    || C.hash(C.childSnapshot(content.content)) !== content.childSnapshotHash) throw C.error(503, 'AI3_NOT_READY');
  const binding = { contentId: String(content._id), contentVersion: content.version,
    fullContentHash: content.contentHash, childSnapshotHash: content.childSnapshotHash };
  if (expected && C.hash(expected) !== C.hash(binding)) throw conflict();
  return binding;
}
function validateMapping(c) {
  const payload = C.normalize('submit', c.payload);
  if (c.operationId !== payload.operationId || c.requestHash !== C.requestHash('submit',
    `/api/ai3/practice-rounds/${c.roundId}/attempts`, payload) || C.hash(payload) !== C.hash(c.payload)
    || c.endpointOperation !== 'ai3.submit' || !validContentBinding(c.serverContentBinding)
    || c.serverContentBinding.contentId !== payload.contentId || c.serverContentBinding.contentVersion !== payload.contentVersion
    || c.serverContentBinding.childSnapshotHash !== payload.childSnapshotHash
    || c.expectedRoundVersion !== payload.expectedRoundVersion || c.reservedRoundVersion !== c.expectedRoundVersion + 1
    || !Number.isSafeInteger(c.reservedRoundVersion) || !same(c.actorId, c.childId)
    || !C.isId(String(c.attemptId)) || !Number.isSafeInteger(c.attemptVersion) || c.attemptVersion < 1
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(c.remoteOperationId)
    || !Array.isArray(c.payload?.mediaIds) || c.payload.mediaIds.length < 1 || c.payload.mediaIds.length > 10
    || new Set(c.payload.mediaIds).size !== c.payload.mediaIds.length || !dense(c.references)
    || c.references.length !== c.payload.mediaIds.length || c.references.some((r, i) => !r
      || Object.keys(r).sort().join(',') !== 'bindingOperationId,field,mediaId,resourceId,resourceType'
      || r.mediaId !== c.payload.mediaIds[i] || !C.isId(r.mediaId) || r.resourceType !== TYPE
      || r.resourceId !== String(c.attemptId) || r.field !== FIELD || r.bindingOperationId !== c.remoteOperationId)
    || c.referencesHash !== mappingHash(c)) throw pendingError();
  return c;
}

function createAi3SubmissionService({ authorize, resource, transact, writeView, previous, continuous, enabled,
  getRuntime, assertReady, now = Date.now, mediaReferenceClient: client, leaseMs = 30000 } = {}) {
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError('Invalid AI3 submission lease');
  const clock = () => {
    const value = Number(now());
    if (!Number.isSafeInteger(value) || !Number.isFinite(new Date(value + leaseMs).getTime())) throw C.error(503, 'AI3_NOT_READY');
    return value;
  };
  const instant = () => new Date(clock());
  const expiry = () => new Date(clock() + leaseMs);
  const childOnly = identity => {
    if (!identity) throw C.error(401, 'UNAUTHENTICATED');
    if (identity.role !== 'student' || !same(identity.id, identity.childId)) throw C.error(403, 'CHILD_ACCESS_DENIED');
  };
  const wire = c => ({ ...scope(c), remoteOperationId: c.remoteOperationId, commandHash: c.referencesHash,
    references: c.references.map(r => ({ mediaId: r.mediaId, field: FIELD })) });
  const ownerQuery = c => ({ _id: c._id, owner: c.owner, phase: c.phase, leaseExpiresAt: { $gt: instant() } });
  const read = c => M.Command.findById(c._id).read('primary').readConcern('majority').lean();
  async function ready() {
    continuous();
    try { await assertReady(); } catch (_) { throw C.error(503, 'AI3_NOT_READY'); }
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
    const p = await resource(M.Round, identity, String(c.roundId), null, true);
    if (c.phase === 'SUCCEEDED' && p.visibility === 'published') {
      try { await assertPublishedAncestor(p); return await writeView(c, identity); }
      catch (e) { if (![404, 409].includes(e.statusCode)) throw e; }
    }
    return { command: commandView(c), pending: !TERMINAL.includes(c.phase) };
  }
  async function resolving(c, identity, code) {
    // This transaction fences final publication on the same command row before any compensation.
    try {
      await transact(async session => {
        continuous(); await authorize(identity, String(c.childId), session);
        const locked = await M.Round.updateOne({ _id: c.roundId, activeCommandId: c._id },
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
      const roundQuery = { _id: c.roundId, familyId: c.familyId, childId: c.childId, activeCommandId: c._id };
      const r = await M.Round.findOne(roundQuery).session(session).lean();
      if (!r) throw pendingError();
      const unlocked = await M.Round.updateOne(roundQuery,
        { $set: { activeCommandId: null, ...(r.visibility === 'withdrawn' || r.cancelledAt ? { active: false } : {}) },
          $inc: { stateVersion: 1 } }, { session });
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
      const r = await resource(M.Round, identity, String(c.roundId), session);
      await contentBinding(r, c.payload, c.serverContentBinding, session);
      await assertPublishedAncestor(r, { session, touch: true });
      const changed = await M.Command.updateOne(ownerQuery(c), { $set: { phase: 'SUCCEEDED', owner: null,
        leaseExpiresAt: null, resultReference: { roundId: String(c.roundId), attemptId: String(c.attemptId) } } }, { session });
      if (c.phase !== 'MEDIA_COMMITTED' || changed.matchedCount !== 1) throw pendingError();
      const published = await M.Round.updateOne({ _id: c.roundId, familyId: c.familyId, childId: c.childId,
        activeCommandId: c._id, stateVersion: c.reservedRoundVersion, visibility: 'published', active: true, cancelledAt: null, learningState: { $in: ['open', 'revise'] } },
      { $set: { activeCommandId: null, learningState: 'submitted', currentAttemptId: c.attemptId, currentAttemptVersion: c.attemptVersion },
        $inc: { stateVersion: 1 } }, { session });
      if (published.matchedCount !== 1) throw pendingError();
      await M.Attempt.create([{ _id: c.attemptId, familyId: c.familyId, childId: c.childId, roundId: c.roundId,
        attemptVersion: c.attemptVersion, submitCommandId: c._id, submittedBy: c.actorId, submittedAt: c.createdAt,
        note: c.payload.note, mediaIds: c.payload.mediaIds, mediaBindings: c.references, serverContentBinding: c.serverContentBinding,
        payloadHash: C.hash({ note: c.payload.note, mediaIds: c.payload.mediaIds, bindings: c.references,
          submittedBy: String(c.actorId), attemptVersion: c.attemptVersion, serverContentBinding: c.serverContentBinding }), review: null }], { session });
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
      const p = await resource(M.Round, identity, String(c.roundId), null, true);
      if (p.visibility !== 'published' || !p.active || p.cancelledAt || p.stateVersion !== c.reservedRoundVersion
        || !same(p.activeCommandId, c._id) || !['open', 'revise'].includes(p.learningState)) {
        c = await resolving(c, identity, 'AI3_VERSION_CONFLICT');
        await cleanup(c, identity); return view(await read(c), identity);
      }
      try {
        await contentBinding(p, c.payload, c.serverContentBinding);
        await assertPublishedAncestor(p);
      } catch (e) {
        if (e.statusCode !== 409) throw e;
        c = await resolving(c, identity, e.code); await cleanup(c, identity); return view(await read(c), identity);
      }
      let result = await remote(c, identity, 'status'), op = result.operation;
      if (op.state === 'ABSENT' && c.phase !== 'RESERVED'
        || op.state === 'PREPARED' && c.phase === 'MEDIA_COMMITTED') throw pendingError();
      if (op.state !== 'COMMITTED' && (getRuntime()?.enabled !== true || op.state === 'ABORTED'
        || op.state === 'PREPARED' && op.leaseExpired)) {
        const code = getRuntime()?.enabled !== true ? 'AI3_NOT_ENABLED'
          : op.state === 'ABORTED' ? op.failureCode || 'AI3_MEDIA_UNAVAILABLE' : 'MEDIA_OPERATION_EXPIRED';
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
          c = await resolving(c, identity, getRuntime()?.enabled !== true ? 'AI3_NOT_ENABLED' : op.failureCode || 'MEDIA_OPERATION_EXPIRED');
          await cleanup(c, identity);
        }
        return view(await read(c), identity);
      }
      if (c.phase !== 'MEDIA_COMMITTED') c = await phase(c, 'MEDIA_COMMITTED', identity);
      const current = await resource(M.Round, identity, String(c.roundId), null, true);
      if (current.visibility !== 'published' || current.stateVersion !== c.reservedRoundVersion) {
        c = await resolving(c, identity, 'AI3_VERSION_CONFLICT');
        await cleanup(c, identity);
      } else {
        try { await contentBinding(current, c.payload, c.serverContentBinding); await assertPublishedAncestor(current); }
        catch (e) {
          if (e.statusCode !== 409) throw e;
          c = await resolving(c, identity, e.code); await cleanup(c, identity); return view(await read(c), identity);
        }
        await publish(c, identity);
      }
    } catch (cause) {
      if ([401, 403, 404].includes(cause?.statusCode)) throw cause;
      // Network/CAS/commit ambiguity only permits reading persisted state, never compensation.
    }
    return view(await read(initial), identity);
  }
  async function submit({ identity, roundId, body }) {
    childOnly(identity);
    const initial = await resource(M.Round, identity, roundId, null, true);
    const payload = C.normalize('submit', body), path = `/api/ai3/practice-rounds/${roundId}/attempts`;
    const old = await previous(identity, String(initial.childId), 'submit', path, payload);
    if (old.found) { await ready(); return drive(old.found, identity); }
    enabled(); await ready();
    const owner = randomUUID(); let saved;
    try {
      saved = await transact(async session => {
        const { found, key } = await previous(identity, String(initial.childId), 'submit', path, payload, session);
        if (found) return found;
        enabled(); continuous();
        const p = await resource(M.Round, identity, roundId, session, true);
        if (p.activeCommandId) throw conflict('AI3_OPERATION_UNRESOLVED');
        if (p.visibility !== 'published' || !p.active || p.cancelledAt || !['open', 'revise'].includes(p.learningState)
          || p.stateVersion !== payload.expectedRoundVersion) throw conflict();
        const serverContentBinding = await contentBinding(p, payload, null, session);
        await assertPublishedAncestor(p, { session, touch: true });
        const _id = new mongoose.Types.ObjectId(), attemptId = new mongoose.Types.ObjectId(), remoteOperationId = randomUUID();
        const record = { _id, ...key, childId: p.childId, roundId: p._id, requestHash: C.requestHash('submit', path, payload),
          payload, serverContentBinding, expectedRoundVersion: payload.expectedRoundVersion, reservedRoundVersion: p.stateVersion + 1,
          attemptId, attemptVersion: (p.currentAttemptVersion || 0) + 1, remoteOperationId,
          references: payload.mediaIds.map(mediaId => ({ mediaId, resourceType: TYPE, resourceId: String(attemptId),
            field: FIELD, bindingOperationId: remoteOperationId })), phase: 'RESERVED', owner, leaseExpiresAt: expiry() };
        record.referencesHash = mappingHash(record);
        const locked = await M.Round.updateOne({ _id: p._id, activeCommandId: null, stateVersion: p.stateVersion, visibility: 'published', active: true, cancelledAt: null,
          learningState: { $in: ['open', 'revise'] } },
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
    if (!same(c.actorId, identity.id) || c.endpointOperation !== 'ai3.submit') throw C.error(404, 'RESOURCE_NOT_FOUND');
    if (C.normalize('recover', body).operationId !== c.operationId) throw conflict('IDEMPOTENCY_CONFLICT');
    await ready(); return drive(c, identity);
  }
  return { submit, recover };
}
module.exports = { createAi3SubmissionService, validateMapping, validateAttempt, assertPublishedAncestor };
