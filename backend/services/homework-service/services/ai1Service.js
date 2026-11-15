const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const M = require('../models/Ai1');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
const C = require('./ai1Contract');
const { assertAi1Indexes } = require('./ai1Readiness');
const { buildRequest, validateOperation } = require('./ai1Operation');
const { createAiGenerationBudget } = require('./aiGenerationBudget');
const objectId = () => new mongoose.Types.ObjectId();
const id = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const same = (a, b) => String(a) === String(b);
const conflict = () => C.error(409, 'AI_VERSION_CONFLICT');
const unresolved = () => C.error(409, 'AI_OPERATION_UNRESOLVED');
const cycleView = c => ({ id: String(c._id), childId: String(c.childId), source: { type: c.sourceType, id: String(c.sourceId) },
  status: c.status, stateVersion: c.stateVersion, currentArtifactId: c.currentArtifactId ? String(c.currentArtifactId) : null,
  approvedArtifactId: c.approvedArtifactId ? String(c.approvedArtifactId) : null, activeJobId: c.activeJobId ? String(c.activeJobId) : null,
  createdBy: String(c.createdBy), createdAt: c.createdAt });
const artifactView = a => ({ id: String(a._id), cycleId: String(a.cycleId), version: a.version,
  text: a.text, contentHash: a.contentHash, status: a.status, reviewVersion: a.reviewVersion, origin: a.origin,
  derivedFromArtifactId: a.derivedFromArtifactId ? String(a.derivedFromArtifactId) : null,
  revisionReason: a.revisionReason || null,
  createdBy: String(a.createdBy), createdAt: a.createdAt, generation: a.generation, review: a.review || null });

// No Provider imports. Remote I/O is outside every retryable Mongo transaction.
function createAi1Service({ now = Date.now, getProfile = () => null, getLimits = () => null,
  getRuntime = () => ({ enabled: false, continuousStore: false }), sourceReader, operationClient,
  transactionRunner = work => runMongoTransaction({ mongooseInstance: mongoose, work }) } = {}) {
  const budget = createAiGenerationBudget({ now, getLimits });
  const { account, adjust, budgetState, reserve } = budget;
  const continuity = () => { if (getRuntime()?.continuousStore !== true) throw C.error(503, 'AI_STORE_ISOLATED'); };
  const enabled = () => { if (getRuntime()?.enabled !== true) throw C.error(503, 'AI_DISABLED'); continuity(); };
  const parentScope = async (identity, session = null) => {
    if (!identity) throw C.error(401, 'UNAUTHENTICATED');
    if (identity.role !== 'parent' || !id(identity.id)) throw C.error(403, 'CHILD_ACCESS_DENIED');
    const actor = await User.findOne({ _id: identity.id, role: 'parent' }).session(session).lean();
    const family = await Family.findOne({ $or: [{ ownerParentId: identity.id }, { memberParentIds: identity.id }] }).session(session).lean();
    if (!actor || !family) throw C.error(403, 'CHILD_ACCESS_DENIED');
    return family;
  };
  const authorize = async (identity, childId, session = null) => {
    await parentScope(identity, session);
    if (!id(String(childId))) throw C.error(403, 'CHILD_ACCESS_DENIED');
    const access = await resolveChildAccess(identity, childId, { FamilyModel: { findOne: q => Family.findOne(q).session(session) },
      UserModel: { findOne: q => User.findOne(q).session(session) } });
    if (!access) throw C.error(403, 'CHILD_ACCESS_DENIED');
    return access;
  };
  const resource = async (model, identity, resourceId, session = null) => {
    const family = await parentScope(identity, session);
    if (!id(resourceId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const found = await model.findOne({ _id: resourceId, familyId: family._id }).session(session).lean();
    if (!found) throw C.error(404, 'RESOURCE_NOT_FOUND');
    await authorize(identity, String(found.childId), session);
    return found;
  };
  const sourceCheck = async (scope, source) => {
    if (!sourceReader) throw C.error(503, 'SOURCE_SERVICE_UNAVAILABLE');
    const found = await sourceReader.require({ familyId: String(scope.familyId), childId: String(scope.childId),
      ...(source.type === 'task' ? { sourceTaskId: source.id } : { sourceMistakeId: source.id }) });
    if (!found || !same(found.id, source.id) || !same(found.familyId, scope.familyId) || !same(found.childId, scope.childId)) {
      throw C.error(404, 'RESOURCE_NOT_FOUND');
    }
    C.subjectAlias(found.subject); return found;
  };
  const transact = async work => {
    // Duplicate upserts on new shared counters can race; only retry the local transaction, never a transport.
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw C.error(503, 'SERVICE_UNAVAILABLE');
        return work(session);
      }); } catch (cause) {
        if (cause?.code === 11000 && attempt === 0) continue;
        if (cause?.code === 11000) throw C.error(409, 'AI_SOURCE_CYCLE_ACTIVE');
        if (cause?.statusCode) throw cause;
        throw C.error(503, 'SERVICE_UNAVAILABLE');
      }
    }
  };
  const mutate = async ({ identity, childId, action, path, command, work }) => transact(async session => {
    const access = await authorize(identity, childId, session);
    const key = { familyId: access.familyId, actorId: identity.id, endpointOperation: `ai1.${action}`, operationId: command.operationId };
    const digest = C.requestHash(action, path, command), previous = await M.Command.findOne(key).session(session).lean();
    if (previous) {
      if (previous.requestHash !== digest) throw C.error(409, 'IDEMPOTENCY_KEY_REUSED');
      return replayResult(previous.result, identity, session);
    }
    const result = await work(session, access);
    // Persist JSON public snapshots, not Mongoose instances or incidental internal fields.
    const snapshot = JSON.parse(JSON.stringify(result));
    await M.Command.create([{ ...key, childId, requestHash: digest, result: snapshot }], { session });
    return snapshot;
  });
  const jobView = async (j, identity, session = null) => {
    const r = await budget.reservation('ai1', j, session);
    return { id: String(j._id), cycleId: String(j.cycleId), operationId: j.operationId, createdBy: String(j.createdBy),
      status: j.status, recoveryStatus: j.status === 'unknown' ? 'uncertain_manual_reconcile' : j.status === 'dispatching' ? 'query_pending' : 'none',
      canRecover: same(j.createdBy, identity?.id) && ['reserved', 'dispatching', 'unknown'].includes(j.status)
        && getRuntime()?.continuousStore === true && (j.status !== 'reserved' || getRuntime()?.enabled === true),
      artifactId: j.artifactId ? String(j.artifactId) : null, failureCode: j.failureCode || null,
      budget: { reservationId: String(r._id), reservedMicros: r.reservedMicros, settledMicros: r.settledMicros, state: r.state },
      createdAt: j.createdAt, updatedAt: j.updatedAt };
  };
  const replayResult = async (result, identity, session = null) => result.job
    ? { job: await jobView(await resource(M.Job, identity, result.job.id, session), identity, session) } : result;
  const replay = async (identity, childId, action, path, command) => {
    const access = await authorize(identity, childId);
    const record = await M.Command.findOne({ familyId: access.familyId, actorId: identity.id,
      endpointOperation: `ai1.${action}`, operationId: command.operationId }).lean();
    if (!record) return null;
    if (record.requestHash !== C.requestHash(action, path, command)) throw C.error(409, 'IDEMPOTENCY_KEY_REUSED');
    return replayResult(record.result, identity);
  };
  const previewCheck = cycle => {
    const current = C.buildPreview(cycle, getProfile(), Number(now()));
    if (C.hash(current) !== C.hash(cycle.preview)) throw C.error(409, 'AI_PREVIEW_STALE');
  };
  const create = async ({ identity, body }) => {
    const access = await authorize(identity, body?.childId), command = C.normalize('create', body);
    const previous = await replay(identity, command.childId, 'create', '/api/tutor-cycles', command);
    if (previous) return previous;
    enabled();
    await assertAi1Indexes();
    // No remote calls inside an automatically retried Mongo transaction.
    const source = await sourceCheck({ familyId: access.familyId, childId: command.childId }, command.source);
    return mutate({ identity, childId: command.childId, action: 'create', path: '/api/tutor-cycles', command, work: async (session, currentAccess) => {
      enabled();
      if (await M.Cycle.exists({ familyId: currentAccess.familyId, childId: command.childId, sourceType: command.source.type,
        sourceId: command.source.id, active: true }).session(session)) throw C.error(409, 'AI_SOURCE_CYCLE_ACTIVE');
      const preview = C.buildPreview(command, getProfile(), Number(now()));
      const [cycle] = await M.Cycle.create([{ familyId: currentAccess.familyId, childId: command.childId, createdBy: identity.id,
        sourceType: command.source.type, sourceId: command.source.id, sourceSubject: source.subject, subjectAliasVersion: 'ai1-subject-alias-v1',
        input: command.input, chapter: command.chapter, inputHash: C.hash({ input: command.input, chapter: command.chapter }), preview,
        status: 'ready', active: true, stateVersion: 1 }], { session });
      return { cycle: cycleView(cycle), preview };
    } });
  };
  const generate = async ({ identity, cycleId, body }) => {
    const initial = await resource(M.Cycle, identity, cycleId), command = C.normalize('generate', body);
    const previous = await replay(identity, String(initial.childId), 'generate', `/api/tutor-cycles/${cycleId}/explanation-jobs`, command);
    if (previous) return previous;
    enabled();
    await assertAi1Indexes();
    await sourceCheck(initial, { type: initial.sourceType, id: String(initial.sourceId) });
    return mutate({ identity, childId: String(initial.childId), action: 'generate', path: `/api/tutor-cycles/${cycleId}/explanation-jobs`, command,
      work: async (session, access) => {
        enabled(); const c = await resource(M.Cycle, identity, cycleId, session);
        if (c.activeJobId) throw unresolved();
        if (c.status !== 'ready' || c.stateVersion !== command.expectedCycleStateVersion) throw conflict();
        previewCheck(c);
        if (command.generationInputHash !== c.preview.generationInputHash || command.modelProfileVersion !== c.preview.modelProfileVersion
          || command.pricingProfileVersion !== c.preview.pricingProfileVersion || command.maxAuthorizedCostMicros < c.preview.reservedCeilingMicros) {
          throw C.error(409, 'AI_PREVIEW_STALE');
        }
        const jobId = objectId(), reservationId = objectId();
        await reserve(access, c.childId, jobId, reservationId, c.preview.reservedCeilingMicros, session);
        const [job] = await M.Job.create([{ _id: jobId, familyId: c.familyId, childId: c.childId, cycleId: c._id, createdBy: identity.id,
          operationId: command.operationId, requestHash: C.requestHash('generate', `/api/tutor-cycles/${cycleId}/explanation-jobs`, command),
          remoteOperationId: randomUUID(), preview: c.preview, sendNotAfter: c.preview.sendNotAfter,
          remoteRequestHash: buildRequest({ preview: c.preview }).requestHash,
          maxAuthorizedCostMicros: command.maxAuthorizedCostMicros, reservationId, status: 'reserved' }], { session });
        const changed = await M.Cycle.updateOne({ _id: c._id, stateVersion: c.stateVersion, status: 'ready', activeJobId: null },
          { $set: { activeJobId: jobId, status: 'generating' }, $inc: { stateVersion: 1 } }, { session });
        if (changed.matchedCount !== 1) throw conflict();
        return { job: await jobView(job, identity, session) };
      } });
  };
  const claim = async ({ identity, jobId }) => {
    const initial = await resource(M.Job, identity, jobId);
    if (!same(initial.createdBy, identity.id)) throw C.error(403, 'AI_ORIGINAL_ACTOR_REQUIRED');
    const cycle = await resource(M.Cycle, identity, String(initial.cycleId));
    let sourceFailure;
    try { await sourceCheck(cycle, { type: cycle.sourceType, id: String(cycle.sourceId) }); }
    catch (cause) {
      if (!['RESOURCE_NOT_FOUND', 'AI_SOURCE_SUBJECT_UNSUPPORTED'].includes(cause.code)) throw cause;
      sourceFailure = cause.code;
    }
    return transact(async session => {
      enabled(); const j = await resource(M.Job, identity, jobId, session);
      if (j.status !== 'reserved') return { claimed: false, job: await jobView(j, identity, session) };
      let failureCode = sourceFailure;
      try { previewCheck(cycle); } catch (cause) {
        if (!['AI_PREVIEW_STALE', 'AI_PROFILE_UNAVAILABLE'].includes(cause.code)) throw cause;
        failureCode = 'AI_PREVIEW_STALE';
      }
      if (Number(now()) >= j.sendNotAfter.getTime()) failureCode = 'AI_PREVIEW_STALE';
      if (failureCode) {
        await failJob(j, { release: true, charge: null, failureCode, digest: C.hash({ localNotSent: failureCode }) }, session);
        return { claimed: false, job: await jobView(await M.Job.findById(j._id).session(session).lean(), identity, session) };
      }
      await budgetState(await authorize(identity, String(j.childId), session), 0, session, j.preview.reservedCeilingMicros);
      await budget.claimSlot('ai1', j, session);
      const claimed = await M.Job.findOneAndUpdate({ _id: j._id, status: 'reserved' },
        { $set: { status: 'dispatching', owner: randomUUID(), leaseExpiresAt: new Date(Number(now()) + 30000) } }, { new: true, session }).lean();
      if (!claimed) throw unresolved();
      return { claimed: true, owner: claimed.owner, job: await jobView(claimed, identity, session) };
    });
  };
  const markUnknown = async ({ jobId, owner }) => transact(async session => {
    continuity(); const j = await M.Job.findOne({ _id: jobId, ...(owner ? { owner } : {}), status: { $in: ['dispatching', 'unknown'] } }).session(session).lean();
    if (!j || j.status === 'unknown') return;
    await budget.reservation('ai1', j, session);
    await M.Job.updateOne({ _id: j._id, status: j.status }, { $set: { status: 'unknown' } }, { session });
    await M.Reservation.updateOne({ _id: j.reservationId }, { $set: { state: 'reserved_unknown' } }, { session });
  });
  // Internal local outcome port. Batch B must authenticate and validate the remote wire envelope before calling it.
  const applyOutcome = async ({ jobId, evidence }) => transact(async session => {
    continuity(); const j = await M.Job.findById(jobId).session(session).lean();
    const invalid = () => C.error(503, 'AI_REMOTE_CONTRACT_INVALID');
    if (!j || !evidence || Object.keys(evidence).sort().join(',') !== 'generationInputHash,modelProfileVersion,pricingProfileVersion,remoteOperationId,sendNotAfter,status,text,usage'
      || evidence.remoteOperationId !== j.remoteOperationId || evidence.generationInputHash !== j.preview.generationInputHash
      || evidence.modelProfileVersion !== j.preview.modelProfileVersion || evidence.pricingProfileVersion !== j.preview.pricingProfileVersion
      || evidence.sendNotAfter !== j.sendNotAfter.toISOString() || evidence.status !== 'succeeded'
      || typeof evidence.text !== 'string' || !evidence.text.trim() || [...evidence.text].length > 12000) throw invalid();
    const digest = C.hash(evidence);
    if (j.outcomeHash) {
      if (j.outcomeHash !== digest) throw invalid();
      const a = await M.Artifact.findById(j.artifactId).session(session).lean();
      return { artifact: artifactView(a), cycleStateVersion: j.evidence.cycleStateVersion };
    }
    if (!['dispatching', 'unknown'].includes(j.status)) throw invalid();
    const reservation = await budget.reservation('ai1', j, session);
    let charge = null;
    if (evidence.usage !== null) {
      if (!evidence.usage || Object.keys(evidence.usage).sort().join(',') !== 'inputTokens,outputTokens') throw invalid();
      try { charge = C.costCeiling(evidence.usage.inputTokens, evidence.usage.outputTokens, j.preview.pricing); } catch (_) { throw invalid(); }
      if (charge > j.preview.reservedCeilingMicros) throw invalid();
    }
    const c = await M.Cycle.findOne({ _id: j.cycleId, activeJobId: j._id, status: 'generating' }).session(session).lean();
    if (!c) throw invalid();
    const text = evidence.text.replace(/\r\n/g, '\n');
    const [a] = await M.Artifact.create([{ familyId: j.familyId, childId: j.childId, cycleId: c._id, version: 1,
      text, contentHash: C.sha(text), createdBy: j.createdBy, origin: 'ai_generation', status: 'candidate', reviewVersion: 1,
      generation: { jobId: String(j._id), modelProfileVersion: j.preview.modelProfileVersion, generationInputHash: j.preview.generationInputHash } }], { session });
    if (charge !== null) {
      if (!['reserved', 'reserved_unknown'].includes(reservation.state)) throw invalid();
      await adjust(await account(String(j.familyId), session), -reservation.reservedMicros, charge, session);
      await adjust(await account('experiment', session), -reservation.reservedMicros, charge, session);
      await M.Reservation.updateOne({ _id: reservation._id }, { $set: { state: 'settled', settledMicros: charge, settledAt: new Date(Number(now())) } }, { session });
    } else await M.Reservation.updateOne({ _id: j.reservationId }, { $set: { state: 'reserved_unknown' } }, { session });
    await M.Cycle.updateOne({ _id: c._id, stateVersion: c.stateVersion },
      { $set: { status: 'candidate', currentArtifactId: a._id }, $inc: { stateVersion: 1 } }, { session });
    await M.Job.updateOne({ _id: j._id, status: j.status }, { $set: { status: 'succeeded', artifactId: a._id, outcomeHash: digest,
      evidence: { digest, cycleStateVersion: c.stateVersion + 1 } } }, { session });
    await budget.releaseSlot('ai1', j, session);
    return { artifact: artifactView(a), cycleStateVersion: c.stateVersion + 1 };
  });
  const edit = action => async ({ identity, cycleId, body }) => {
    const initial = await resource(M.Cycle, identity, cycleId), command = C.normalize(action, body);
    return mutate({ identity, childId: String(initial.childId), action,
      path: `/api/tutor-cycles/${cycleId}/${action === 'revise' ? 'explanation-revisions' : 'explanation-review'}`, command,
      work: async session => {
        const c = await resource(M.Cycle, identity, cycleId, session);
        if (c.status !== 'candidate' || c.stateVersion !== command.expectedCycleStateVersion || !same(c.currentArtifactId, command.artifactId)) throw conflict();
        const a = await M.Artifact.findOne({ _id: c.currentArtifactId, familyId: c.familyId, childId: c.childId,
          status: 'candidate', version: command.artifactVersion, contentHash: command.artifactContentHash,
          reviewVersion: command.expectedArtifactReviewVersion }).session(session).lean();
        if (!a) throw conflict();
        let saved;
        if (action === 'revise') {
          if (a.text === command.revisedText) throw C.error(400, 'VALIDATION_ERROR');
          [saved] = await M.Artifact.create([{ familyId: c.familyId, childId: c.childId, cycleId: c._id, version: a.version + 1,
            text: command.revisedText, contentHash: C.sha(command.revisedText), createdBy: identity.id,
            origin: 'parent_revision', derivedFromArtifactId: a._id, generation: a.generation,
            revisionReason: command.revisionReason, status: 'candidate', reviewVersion: 1 }], { session });
          await M.Artifact.updateOne({ _id: a._id, reviewVersion: a.reviewVersion, status: 'candidate' },
            { $set: { status: 'superseded' }, $inc: { reviewVersion: 1 } }, { session });
        } else {
          saved = await M.Artifact.findOneAndUpdate({ _id: a._id, reviewVersion: a.reviewVersion, status: 'candidate' },
            { $set: { status: command.decision === 'approve' ? 'parent_approved' : 'rejected',
              review: { reviewerId: identity.id, time: new Date(Number(now())).toISOString(), decision: command.decision,
                comment: command.comment, checks: command.checks } }, $inc: { reviewVersion: 1 } }, { session, new: true }).lean();
          if (!saved) throw conflict();
        }
        const changed = await M.Cycle.updateOne({ _id: c._id, status: 'candidate', stateVersion: command.expectedCycleStateVersion,
          currentArtifactId: a._id }, { $set: { currentArtifactId: saved._id,
            status: action === 'revise' ? 'candidate' : command.decision === 'approve' ? 'approved' : 'rejected',
            ...(action === 'review' && command.decision === 'approve' ? { approvedArtifactId: saved._id } : {}) },
          $inc: { stateVersion: 1 } }, { session });
        if (changed.matchedCount !== 1) throw conflict();
        return { artifact: artifactView(saved), cycleStateVersion: c.stateVersion + 1 };
      } });
  };
  const close = async ({ identity, cycleId, body }) => {
    const initial = await resource(M.Cycle, identity, cycleId), command = C.normalize('close', body);
    return mutate({ identity, childId: String(initial.childId), action: 'close', path: `/api/tutor-cycles/${cycleId}/cancel`, command,
      work: async session => {
        const c = await resource(M.Cycle, identity, cycleId, session);
        if (await M.Job.exists({ cycleId: c._id, status: { $in: ['reserved', 'dispatching', 'unknown'] } }).session(session)) throw unresolved();
        if (c.status === 'closed' || c.stateVersion !== command.expectedCycleStateVersion) throw conflict();
        const saved = await M.Cycle.findOneAndUpdate({ _id: c._id, stateVersion: c.stateVersion, active: true },
          { $set: { status: 'closed', active: false, closure: { actorId: identity.id, reason: command.reason, at: new Date(Number(now())).toISOString() } },
            $inc: { stateVersion: 1 } }, { session, new: true }).lean();
        if (!saved) throw conflict(); return { cycle: cycleView(saved) };
      } });
  };

  const failJob = async (j, { release, charge, failureCode, digest }, session) => {
    const r = await budget.reservation('ai1', j, session);
    if (!r || !['reserved', 'reserved_unknown'].includes(r.state)) throw C.error(503, 'AI_STORE_ISOLATED');
    if (release || charge !== null) {
      await adjust(await account(String(j.familyId), session), -r.reservedMicros, charge || 0, session);
      await adjust(await account('experiment', session), -r.reservedMicros, charge || 0, session);
    }
    await M.Reservation.updateOne({ _id: r._id, state: r.state }, { $set: {
      state: release ? 'released' : charge !== null ? 'settled' : 'reserved_unknown', settledMicros: release ? 0 : charge,
      ...(charge !== null ? { settledAt: new Date(Number(now())) } : {}) } }, { session });
    const cycle = await M.Cycle.updateOne({ _id: j.cycleId, status: 'generating', activeJobId: j._id },
      { $set: { status: 'ready' }, $inc: { stateVersion: 1 } }, { session });
    const job = await M.Job.updateOne({ _id: j._id, status: j.status },
      { $set: { status: 'failed', failureCode, outcomeHash: digest } }, { session });
    if (cycle.matchedCount !== 1 || job.matchedCount !== 1) throw conflict();
    await budget.releaseSlot('ai1', j, session);
  };
  const halt = async jobId => transact(async session => {
    continuity(); const j = await M.Job.findById(jobId).session(session).lean();
    if (!j) return;
    for (const key of [String(j.familyId), 'experiment']) {
      await account(key, session);
      await M.Account.updateOne({ _id: key }, { $set: { halted: true } }, { session });
    }
  });
  const acceptRemote = async (j, raw) => {
    let o;
    try { o = validateOperation(j, raw); } catch (cause) { await halt(j._id); throw cause; }
    if (o.sendClaimed) {
      await transact(async session => {
        continuity();
        const current = await M.Job.findById(j._id).session(session).lean();
        if (current.status === 'failed' && !current.remoteClaimObserved) throw C.error(503, 'AI_REMOTE_CONTRACT_INVALID');
        if (!current.remoteClaimObserved) await M.Job.updateOne({ _id: j._id, remoteClaimObserved: { $ne: true } },
          { $set: { remoteClaimObserved: true } }, { session });
      });
    }
    if (o.status === 'succeeded') {
      await applyOutcome({ jobId: j._id, evidence: { remoteOperationId: o.remoteOperationId,
        generationInputHash: j.preview.generationInputHash, modelProfileVersion: o.modelProfileVersion,
        pricingProfileVersion: o.pricingProfileVersion, sendNotAfter: o.sendNotAfter, status: 'succeeded',
        text: o.result.text, usage: o.usage } });
    } else if (['failed_not_sent', 'failed_sent'].includes(o.status)) {
      const { updatedAt: _updatedAt, ...terminal } = o;
      const digest = C.hash(terminal);
      await transact(async session => {
        continuity(); const current = await M.Job.findById(j._id).session(session).lean();
        if (o.status === 'failed_not_sent' && current.remoteClaimObserved) throw C.error(503, 'AI_REMOTE_CONTRACT_INVALID');
        if (current.outcomeHash) {
          if (current.outcomeHash !== digest) throw C.error(503, 'AI_REMOTE_CONTRACT_INVALID');
          return;
        }
        if (!['dispatching', 'unknown'].includes(current.status)) throw C.error(503, 'AI_REMOTE_CONTRACT_INVALID');
        await failJob(current, { release: o.status === 'failed_not_sent', charge: o.usage === null ? null
          : C.costCeiling(o.usage.inputTokens, o.usage.outputTokens, j.preview.pricing), digest,
        failureCode: o.status === 'failed_not_sent' && ['PREVIEW_STALE', 'PROFILE_UNAVAILABLE'].includes(o.error)
          ? 'AI_PREVIEW_STALE' : 'AI_PROVIDER_FAILED' }, session);
      });
    } else await markUnknown({ jobId: j._id, owner: j.owner });
  };
  const runJob = async ({ identity, jobId }) => {
    continuity();
    let j = await resource(M.Job, identity, jobId);
    if (!same(j.createdBy, identity.id)) throw C.error(403, 'AI_ORIGINAL_ACTOR_REQUIRED');
    if (['succeeded', 'failed'].includes(j.status)) return { job: await jobView(j, identity) };
    if (!operationClient) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
    let claimed = false;
    if (j.status === 'reserved') {
      const result = await claim({ identity, jobId }); claimed = result.claimed;
      j = await resource(M.Job, identity, jobId);
      if (j.status === 'failed') return { job: await jobView(j, identity) };
    }
    try {
      if (claimed) {
        // A claim never becomes sendable again, even if this last check fails.
        enabled(); previewCheck(await resource(M.Cycle, identity, String(j.cycleId)));
        if (Number(now()) >= j.sendNotAfter.getTime()) throw C.error(409, 'AI_PREVIEW_STALE');
      }
      const result = await operationClient[claimed ? 'put' : 'get'](j);
      await acceptRemote(j, result);
    } catch (cause) {
      if (cause.code === 'AI_REMOTE_CONTRACT_INVALID') await halt(j._id);
      await markUnknown({ jobId: j._id, owner: j.owner });
      if (cause.statusCode && ['AI_STORE_ISOLATED', 'AI_REMOTE_CONTRACT_INVALID', 'AI_REMOTE_UNAVAILABLE',
        'AI_PREVIEW_STALE', 'AI_DISABLED', 'CHILD_ACCESS_DENIED', 'RESOURCE_NOT_FOUND'].includes(cause.code)) throw cause;
      throw C.error(503, 'AI_REMOTE_UNAVAILABLE');
    }
    return { job: await jobView(await resource(M.Job, identity, jobId), identity) };
  };
  const recover = async ({ identity, jobId, body }) => {
    const j = await resource(M.Job, identity, jobId), command = C.normalize('recover', body);
    if (!same(j.createdBy, identity.id)) throw C.error(403, 'AI_ORIGINAL_ACTOR_REQUIRED');
    continuity();
    await mutate({ identity, childId: String(j.childId), action: 'recover', path: `/api/tutor-jobs/${jobId}/recover`, command,
      work: async session => ({ job: await jobView(await resource(M.Job, identity, jobId, session), identity, session) }) });
    return runJob({ identity, jobId });
  };
  const list = model => async ({ identity, childId, page = 1, pageSize = 20 }) => {
    const access = await authorize(identity, childId);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
      || !Number.isSafeInteger((page - 1) * pageSize)) throw C.error(400, 'VALIDATION_ERROR');
    const query = { familyId: access.familyId, childId, ...(model === M.Job ? { createdBy: identity.id, status: { $in: ['reserved', 'dispatching', 'unknown'] } } : {}) };
    const rows = await model.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean();
    return { items: model === M.Cycle ? rows.map(cycleView) : await Promise.all(rows.map(j => jobView(j, identity))), page, pageSize };
  };
  return { create, generate, claim, markUnknown, applyOutcome, revise: edit('revise'), review: edit('review'), close,
    recover, listCycles: list(M.Cycle), listJobs: list(M.Job),
    generateAndRun: async args => { const { job } = await generate(args); return runJob({ identity: args.identity, jobId: job.id }); },
    getCycle: async ({ identity, cycleId }) => transact(async session => {
      const c = await resource(M.Cycle, identity, cycleId, session);
      const artifacts = await M.Artifact.find({ cycleId: c._id, familyId: c.familyId, childId: c.childId })
        .sort({ version: 1 }).session(session).lean();
      const j = c.activeJobId ? await M.Job.findOne({ _id: c.activeJobId, familyId: c.familyId, childId: c.childId }).session(session).lean() : null;
      return { cycle: cycleView(c), preview: c.preview, artifacts: artifacts.map(artifactView), job: j ? await jobView(j, identity, session) : null };
    }),
    getJob: async ({ identity, jobId }) => ({ job: await jobView(await resource(M.Job, identity, jobId), identity) }),
    getArtifact: async ({ identity, artifactId }) => ({ artifact: artifactView(await resource(M.Artifact, identity, artifactId)) }) };
}
module.exports = { createAi1Service };
