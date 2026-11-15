const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const M = require('../models/Ai3');
const C = require('./ai3Contract');
const E = require('../../../common/services/ai3ReviewEvidence');
const { assertPublishedAncestor } = require('./ai3SubmissionService');
const same = (a, b) => String(a) === String(b);
const plain = value => JSON.parse(JSON.stringify(value));
const conflict = () => C.error(409, 'AI3_VERSION_CONFLICT');
const unavailable = () => C.error(503, 'AI3_EVIDENCE_UNAVAILABLE');
const pendingError = () => C.error(503, 'AI3_OPERATION_UNRESOLVED');
const kinds = ['mistake', 'mastery'];
const terminal = ['not_requested', 'applied', 'not_applied_conflict', 'not_applied_missing'];
const targetFor = (snapshot, kind) => snapshot.targets[kind === 'mistake' ? 'mistake' : 'knowledgePoint'];
const pathFor = (roundId, attemptId) => `/api/ai3/practice-rounds/${roundId}/attempts/${attemptId}/review`;
function effectRequest(c, kind) {
  const s = c.finalReview, t = targetFor(s, kind);
  return E.normalizeEffectRequest({ schemaVersion: 'ai3-review-effect-v1', effectId: t.effectId, finalReviewId: s.id,
    finalReviewHash: c.finalReviewHash, familyId: s.familyId, childId: s.childId, reviewedByParentId: s.reviewedByParentId,
    targetId: t.id, expectedStateRevision: t.stateRevision });
}
function validateReviewCommand(c) {
  try {
    const b = C.normalize('review', c.payload);
    if (c.endpointOperation !== 'ai3.review' || !['EFFECTS_PENDING', 'SUCCEEDED'].includes(c.phase)
      || c.operationId !== b.operationId || C.hash(b) !== C.hash(c.payload)
      || c.requestHash !== C.requestHash('review', pathFor(c.roundId, c.attemptId), b)
      || !same(c.resultReference?.roundId, c.roundId) || !same(c.resultReference?.attemptId, c.attemptId)) throw unavailable();
    if (b.decision === 'revise') {
      if (c.phase !== 'SUCCEEDED' || c.finalReview || c.finalReviewHash) throw unavailable();
      return c;
    }
    const s = E.validateFinalReview(c.finalReview);
    if (C.hash(s) !== c.finalReviewHash || s.id !== String(c._id) || s.roundId !== String(c.roundId)
      || s.attemptId !== String(c.attemptId) || s.familyId !== String(c.familyId) || s.childId !== String(c.childId)
      || s.reviewedByParentId !== String(c.actorId) || c.resultReference.finalReviewId !== s.id
      || s.contentId !== b.contentId || s.contentVersion !== b.contentVersion || s.contentHash !== b.contentHash
      || s.attemptVersion !== b.expectedAttemptVersion || s.attemptPayloadHash !== b.attemptPayloadHash
      || ['comment', 'evidenceSummary', 'masteryConfirmed', 'reviewReminderDate'].some(key => s[key] !== b[key])
      || !c.effects || Object.keys(c.effects).sort().join(',') !== 'mastery,mistake') throw unavailable();
    for (const kind of kinds) {
      const value = c.effects[kind], target = targetFor(s, kind);
      if (!value || Object.keys(value).sort().join(',') !== 'receipt,status'
        || ![...terminal, 'pending', 'unknown'].includes(value.status)
        || !target && (value.status !== 'not_requested' || value.receipt !== null)
        || target && value.status === 'not_requested') throw unavailable();
      if (target && terminal.includes(value.status)) {
        E.validateReceipt(value.receipt, effectRequest(c, kind));
        if (value.receipt.status !== value.status || value.receipt.reviewedAt !== s.reviewedAt) throw unavailable();
      } else if (value.receipt !== null) throw unavailable();
    }
    if (c.phase === 'SUCCEEDED' && kinds.some(kind => !terminal.includes(c.effects[kind].status))) throw unavailable();
    return c;
  } catch (_) { throw C.error(503, 'AI3_NOT_READY'); }
}

function createAi3ReviewService({ authorize, resource, parentOnly, transact, previous, continuous, enabled, assertReady,
  attemptInRound, inspectAttempt, commandView, now = Date.now, leaseMs = 30000,
  mistakeEvidenceClient, masteryEvidenceClient } = {}) {
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError('Invalid AI3 review lease');
  const clock = () => {
    const value = Number(now());
    if (!Number.isSafeInteger(value) || !Number.isFinite(new Date(value + leaseMs).getTime())) throw C.error(503, 'AI3_NOT_READY');
    return value;
  };
  const instant = () => new Date(clock()), expiry = () => new Date(clock() + leaseMs);
  const read = c => M.Command.findById(c._id).read('primary').readConcern('majority').lean();
  const ownerQuery = c => ({ _id: c._id, owner: c.owner, phase: 'EFFECTS_PENDING', leaseExpiresAt: { $gt: instant() } });
  const ports = { mistake: mistakeEvidenceClient, mastery: masteryEvidenceClient };
  async function ready() {
    continuous();
    try { await assertReady(); } catch (_) { throw C.error(503, 'AI3_NOT_READY'); }
  }
  function reviewable(r, a, b = null) {
    if (r.visibility !== 'published' || r.cancelledAt || !r.active || r.activeCommandId || r.learningState !== 'submitted'
      || !same(r.currentAttemptId, a._id) || r.currentAttemptVersion !== a.attemptVersion || a.review !== null) throw conflict();
    if (b && (r.stateVersion !== b.expectedRoundVersion || !same(r.currentContentId, b.contentId)
      || r.currentContentVersion !== b.contentVersion || r.currentContentHash !== b.contentHash
      || a.attemptVersion !== b.expectedAttemptVersion || a.payloadHash !== b.attemptPayloadHash)) throw conflict();
  }
  async function local(identity, roundId, attemptId, b = null, session = null) {
    const r = await resource(M.Round, identity, roundId, session), a = await attemptInRound(r, attemptId, session);
    reviewable(r, a, b); await assertPublishedAncestor(r, { session }); return { r, a };
  }
  async function targetContext(identity, r) {
    const input = { familyId: String(r.familyId), childId: String(r.childId), actorId: identity.id };
    async function get(kind, targetId) {
      if (typeof ports[kind]?.getContext !== 'function') throw unavailable();
      const value = await ports[kind].getContext({ ...input, targetId });
      const keys = kind === 'mistake' ? 'id,knowledgePointId,stateRevision' : 'id,stateRevision';
      if (!value || Object.keys(value).sort().join(',') !== keys || value.id !== targetId
        || !Number.isSafeInteger(value.stateRevision) || value.stateRevision < 0
        || kind === 'mistake' && value.knowledgePointId !== null && !C.isId(value.knowledgePointId)) throw unavailable();
      return plain(value);
    }
    const mistake = r.source.type === 'mistake' ? await get('mistake', r.source.id) : null;
    const point = r.knowledgePointId ? String(r.knowledgePointId) : null;
    if (mistake && mistake.knowledgePointId !== point) throw conflict();
    const knowledgePoint = point ? await get('mastery', point) : null;
    return { mistake, knowledgePoint };
  }
  function contextValue(r, a, targets) {
    const value = { roundId: String(r._id), expectedRoundVersion: r.stateVersion, contentId: String(r.currentContentId),
      contentVersion: r.currentContentVersion, contentHash: r.currentContentHash, attemptId: String(a._id),
      expectedAttemptVersion: a.attemptVersion, attemptPayloadHash: a.payloadHash, targets };
    return { ...value, reviewContextHash: C.hash(value) };
  }
  async function reviewContext({ identity, roundId, attemptId }) {
    parentOnly(identity); continuous();
    const first = await local(identity, roundId, attemptId), targets = await targetContext(identity, first.r);
    const current = await local(identity, roundId, attemptId);
    if (first.r.stateVersion !== current.r.stateVersion) throw conflict();
    return contextValue(current.r, current.a, targets);
  }
  async function view(c, identity) {
    continuous(); await authorize(identity, String(c.childId));
    if (!same(c.actorId, identity.id)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    validateReviewCommand(c);
    return { command: commandView(c), reviewSaved: true, finalReviewId: c.finalReview?.id || null,
      effects: Object.fromEntries(kinds.map(kind => [kind, c.effects?.[kind]?.status || 'not_requested'])),
      pending: c.phase === 'EFFECTS_PENDING' };
  }
  async function owned(c, identity) {
    continuous(); await authorize(identity, String(c.childId));
    const current = await M.Command.findOneAndUpdate(ownerQuery(c), { $set: { leaseExpiresAt: expiry() } }, { new: true }).lean();
    if (!current) throw pendingError(); validateReviewCommand(current); return current;
  }
  async function remember(c, identity, kind, status, receipt = null) {
    await owned(c, identity);
    const current = await M.Command.findOneAndUpdate({ ...ownerQuery(c), [`effects.${kind}.status`]: { $in: ['pending', 'unknown'] } },
      { $set: { [`effects.${kind}`]: { status, receipt }, leaseExpiresAt: expiry() } }, { new: true }).lean();
    if (!current) throw pendingError(); return current;
  }
  async function finish(c, identity) {
    await transact(async session => {
      continuous(); await authorize(identity, String(c.childId), session);
      const current = await M.Command.findOne(ownerQuery(c)).session(session).lean();
      if (!current) throw pendingError(); validateReviewCommand(current);
      if (kinds.some(kind => !terminal.includes(current.effects[kind].status))) throw pendingError();
      const changed = await M.Command.updateOne(ownerQuery(c), { $set: { phase: 'SUCCEEDED', owner: null, leaseExpiresAt: null } }, { session });
      if (changed.matchedCount !== 1) throw pendingError();
      const released = await M.Round.updateOne({ _id: c.roundId, familyId: c.familyId, childId: c.childId,
        finalReviewId: c._id, activeCommandId: c._id, learningState: 'passed' },
      { $set: { activeCommandId: null, active: false }, $inc: { stateVersion: 1 } }, { session });
      if (released.matchedCount !== 1) throw pendingError();
    });
  }
  async function drive(initial, identity) {
    let c = initial;
    try {
      validateReviewCommand(c);
      if (c.phase === 'SUCCEEDED') return view(c, identity);
      continuous(); await authorize(identity, String(c.childId));
      const owner = randomUUID();
      c = await M.Command.findOneAndUpdate({ _id: c._id, phase: 'EFFECTS_PENDING',
        $or: [{ owner: null }, { leaseExpiresAt: { $lte: instant() } }] },
      { $set: { owner, leaseExpiresAt: expiry() } }, { new: true }).lean();
      if (!c) return view(await read(initial), identity);
      validateReviewCommand(c);
      for (const kind of kinds) {
        if (terminal.includes(c.effects[kind].status)) continue;
        const request = effectRequest(c, kind), port = ports[kind];
        try {
          let receipt, maySend = c.effects[kind].status === 'pending';
          if (c.effects[kind].status === 'unknown') {
            c = await owned(c, identity);
            if (!port?.getReceipt) throw unavailable();
            try { receipt = await port.getReceipt({ familyId: request.familyId, childId: request.childId,
              actorId: request.reviewedByParentId, effectId: request.effectId }); }
            catch (e) {
              if (e.statusCode !== 404 || e.code !== 'RESOURCE_NOT_FOUND') throw e;
              maySend = true;
            }
          }
          if (maySend) {
            // Persist send uncertainty before POST; a crashed or expired sender must query this exact effect next time.
            c = await remember(c, identity, kind, 'unknown'); c = await owned(c, identity);
            if (!port?.apply) throw unavailable();
            receipt = await port.apply({ body: request });
          }
          E.validateReceipt(receipt, request);
          if (receipt.reviewedAt !== c.finalReview.reviewedAt) throw unavailable();
          c = await remember(c, identity, kind, receipt.status, plain(receipt));
        } catch (e) {
          if ([401, 403].includes(e.statusCode)) throw e;
          // Keep the original evidence and uncertainty. Another side may still converge independently.
          c = await owned(c, identity);
        }
      }
      if (kinds.every(kind => terminal.includes(c.effects[kind].status))) await finish(c, identity);
    } catch (e) { if ([401, 403, 404].includes(e.statusCode)) throw e; }
    return view(await read(initial), identity);
  }
  async function review({ identity, roundId, attemptId, body }) {
    parentOnly(identity); continuous();
    const b = C.normalize('review', body), initial = await resource(M.Round, identity, roundId);
    const path = pathFor(roundId, attemptId), old = await previous(identity, String(initial.childId), 'review', path, b);
    if (old.found) return view(old.found, identity);
    enabled(); await ready();
    const first = await local(identity, roundId, attemptId, b);
    let targets = { mistake: null, knowledgePoint: null };
    if (b.decision === 'approve') {
      targets = await targetContext(identity, first.r);
      if (contextValue(first.r, first.a, targets).reviewContextHash !== b.reviewContextHash) throw conflict();
      if (b.masteryConfirmed && !targets.knowledgePoint) throw conflict();
      const media = await inspectAttempt(first.a, identity);
      if (media.some(item => item.status !== 'available')) throw C.error(409, 'AI3_MEDIA_UNAVAILABLE');
    }
    const commandId = new mongoose.Types.ObjectId(), effectIds = { mistake: randomUUID(), mastery: randomUUID() };
    let saved;
    try {
      saved = await transact(async session => {
        const { found, key } = await previous(identity, String(initial.childId), 'review', path, b, session);
        if (found) return found;
        continuous(); enabled();
        const { r, a } = await local(identity, roundId, attemptId, b, session);
        await assertPublishedAncestor(r, { session, touch: true });
        const reviewedAt = instant().toISOString(), approve = b.decision === 'approve';
        const finalReview = approve ? E.validateFinalReview({ schemaVersion: 'ai3-final-review-v1', id: String(commandId),
          familyId: String(r.familyId), childId: String(r.childId), roundId, sourcePackageId: String(r.sourcePackageId),
          sourceAttemptId: String(r.sourceAttemptId), sourceAttemptVersion: r.sourceAttemptVersion,
          sourceAttemptPayloadHash: r.sourceAttemptPayloadHash, sourceReviewHash: r.sourceReviewHash,
          source: { type: r.source.type, id: r.source.id }, contentId: b.contentId, contentVersion: b.contentVersion, contentHash: b.contentHash,
          childSnapshotHash: a.serverContentBinding.childSnapshotHash, attemptId, attemptVersion: a.attemptVersion,
          attemptPayloadHash: a.payloadHash, reviewedByParentId: identity.id, reviewedAt, evidenceSummary: b.evidenceSummary,
          comment: b.comment, masteryConfirmed: b.masteryConfirmed, reviewReminderDate: b.reviewReminderDate,
          targets: { mistake: targets.mistake ? { ...targets.mistake, effectId: effectIds.mistake } : null,
            knowledgePoint: b.masteryConfirmed ? { ...targets.knowledgePoint, effectId: effectIds.mastery } : null } }) : null;
        const effects = Object.fromEntries(kinds.map(kind => [kind, { status: finalReview && targetFor(finalReview, kind) ? 'pending' : 'not_requested', receipt: null }]));
        const pending = kinds.some(kind => effects[kind].status === 'pending');
        const reviewed = await M.Attempt.updateOne({ _id: a._id, familyId: r.familyId, childId: r.childId, roundId: r._id,
          attemptVersion: a.attemptVersion, payloadHash: a.payloadHash, review: null }, { $set: { review: {
          decision: b.decision, comment: b.comment, reviewedByParentId: identity.id, reviewedAt,
          ...(approve ? { finalReviewId: String(commandId) } : {}) } } }, { session });
        if (reviewed.matchedCount !== 1) throw conflict();
        const updated = await M.Round.updateOne({ _id: r._id, familyId: r.familyId, childId: r.childId, stateVersion: b.expectedRoundVersion,
          currentAttemptId: a._id, currentAttemptVersion: a.attemptVersion, currentContentId: r.currentContentId,
          currentContentVersion: b.contentVersion, currentContentHash: b.contentHash, activeCommandId: null,
          visibility: 'published', learningState: 'submitted', cancelledAt: null, active: true }, { $set: {
          learningState: approve ? 'passed' : 'revise', activeCommandId: pending ? commandId : null, active: !approve || pending,
          ...(approve ? { finalReviewId: commandId, reviewReminderDate: b.reviewReminderDate } : {}) }, $inc: { stateVersion: 1 } }, { session });
        if (updated.matchedCount !== 1) throw conflict();
        const [c] = await M.Command.create([{ _id: commandId, ...key, childId: r.childId, roundId: r._id, attemptId: a._id,
          payload: b, requestHash: C.requestHash('review', path, b), phase: pending ? 'EFFECTS_PENDING' : 'SUCCEEDED',
          owner: null, leaseExpiresAt: null, effects,
          ...(finalReview ? { finalReview, finalReviewHash: C.hash(finalReview) } : {}),
          resultReference: { roundId, attemptId, stateVersion: r.stateVersion + 1, ...(approve ? { finalReviewId: String(commandId) } : {}) } }], { session });
        return c.toObject();
      });
    } catch (cause) {
      const replay = await previous(identity, String(initial.childId), 'review', path, b);
      if (replay.found) return view(replay.found, identity);
      throw cause;
    }
    return saved.phase === 'EFFECTS_PENDING' ? drive(saved, identity) : view(saved, identity);
  }
  async function recover({ identity, commandId, body }) {
    parentOnly(identity); continuous();
    const c = await resource(M.Command, identity, commandId);
    if (c.endpointOperation !== 'ai3.review' || !same(c.actorId, identity.id)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    if (C.normalize('recover', body).operationId !== c.operationId) throw C.error(409, 'IDEMPOTENCY_CONFLICT');
    await ready(); return drive(c, identity);
  }
  async function getFinalReview({ familyId, childId, finalReviewId, effectId }) {
    continuous();
    if (![familyId, childId, finalReviewId].every(C.isId) || typeof effectId !== 'string') throw C.error(400, 'VALIDATION_ERROR');
    const c = await M.Command.findOne({ _id: finalReviewId, familyId, childId, endpointOperation: 'ai3.review',
      phase: { $in: ['EFFECTS_PENDING', 'SUCCEEDED'] } }).read('primary').readConcern('majority').lean();
    if (!c?.finalReview) throw C.error(404, 'RESOURCE_NOT_FOUND'); validateReviewCommand(c);
    const kind = kinds.find(value => targetFor(c.finalReview, value)?.effectId === effectId);
    if (!kind) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const request = effectRequest(c, kind);
    return { finalReview: plain(c.finalReview), finalReviewHash: c.finalReviewHash,
      effect: { kind, effectId, targetId: request.targetId, expectedStateRevision: request.expectedStateRevision } };
  }
  return { reviewContext, review, recover, view, getFinalReview };
}
module.exports = { createAi3ReviewService, validateReviewCommand };
