const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const M = require('../models/Ai3');
const A = require('../models/Ai2');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
const { subjectAlias } = require('./ai1Contract');
const { pagination } = require('./ai2Contract');
const { addLocalDateDays } = require('../../../common/utils/familyDate');
const { assertAi3Ready } = require('./ai3Readiness');
const C = require('./ai3Contract');
const Budget = require('../models/Ai1');
const { createAiGenerationBudget } = require('./aiGenerationBudget');
const { assertAi1Indexes } = require('./ai1Readiness');
const { buildGenerationPreview } = require('./ai3GenerationPreview');
const { buildRequest, validateMapping, validateOperation } = require('./ai3Operation');
const { costCeiling } = require('./ai1Contract');
const { createAi3SubmissionService, validateAttempt, validateMapping: validateSubmissionMapping,
  assertPublishedAncestor } = require('./ai3SubmissionService');
const { createAi3ReviewService, validateReviewCommand } = require('./ai3ReviewService');
const { createAi3ContentHistoryService } = require('./ai3ContentHistoryService');
const same = (a, b) => String(a) === String(b);
const plain = v => JSON.parse(JSON.stringify(v));
const conflict = (code = 'AI3_VERSION_CONFLICT') => C.error(409, code);
const commandView = c => ({ id: String(c._id), operationId: c.operationId, endpointOperation: c.endpointOperation,
  roundId: String(c.roundId), phase: c.phase, resultReference: plain(c.resultReference), createdAt: c.createdAt });

// Deliberately unmounted; remote operations require explicit injected clients.
function createAi3Service({ getRuntime = () => ({ enabled: false, continuousStore: false }), now = Date.now,
  sourceReader, knowledgePointReader, getProfile = () => null, getLimits = () => null, operationClient = null,
  mediaReferenceClient, mediaInspectClient, submissionLeaseMs = 30000,
  mistakeEvidenceClient, masteryEvidenceClient, reviewLeaseMs = 30000,
  transactionRunner = work => runMongoTransaction({ mongooseInstance: mongoose, work }) } = {}) {
  const continuous = () => { if (getRuntime()?.continuousStore !== true) throw C.error(503, 'AI3_STORE_ISOLATED'); };
  const enabled = () => { if (getRuntime()?.enabled !== true) throw C.error(503, 'AI3_NOT_ENABLED'); };
  const budget = createAiGenerationBudget({ now, getLimits });
  const parentOnly = identity => {
    if (!identity) throw C.error(401, 'UNAUTHENTICATED');
    if (identity.role !== 'parent') throw C.error(403, 'CHILD_ACCESS_DENIED');
  };
  async function familyScope(identity, session = null) {
    if (!identity) throw C.error(401, 'UNAUTHENTICATED');
    if (!C.isId(identity.id) || !['parent', 'student'].includes(identity.role)) throw C.error(403, 'CHILD_ACCESS_DENIED');
    const user = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
    if (!user) throw C.error(403, 'CHILD_ACCESS_DENIED');
    let family;
    if (identity.role === 'parent') family = await Family.findOne({ $or: [{ ownerParentId: identity.id }, { memberParentIds: identity.id }] }).session(session).lean();
    else {
      if (!same(identity.id, identity.childId) || !same(identity.familyId, user.familyId)
        || !Number.isInteger(identity.tokenVersion) || user.childProfile?.tokenVersion !== identity.tokenVersion) throw C.error(401, 'STALE_CHILD_TOKEN');
      family = await Family.findOne({ _id: user.familyId, childIds: user._id }).session(session).lean();
    }
    if (!family) throw C.error(403, 'CHILD_ACCESS_DENIED');
    return family;
  }
  async function authorize(identity, childId, session = null) {
    await familyScope(identity, session);
    const access = await resolveChildAccess(identity, childId, { FamilyModel: { findOne: q => Family.findOne(q).session(session) },
      UserModel: { findOne: q => User.findOne(q).session(session) } });
    if (!access) throw C.error(403, 'CHILD_ACCESS_DENIED');
    return access;
  }
  async function resource(model, identity, resourceId, session = null) {
    const family = await familyScope(identity, session);
    if (!C.isId(resourceId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const row = await model.findOne({ _id: resourceId, familyId: family._id,
      ...(identity.role === 'student' ? { childId: identity.id } : {}) }).session(session).lean();
    if (!row) throw C.error(404, 'RESOURCE_NOT_FOUND');
    await authorize(identity, String(row.childId), session); return row;
  }
  async function transact(work) {
    continuous();
    try {
      return await transactionRunner(async session => {
        continuous();
        if (!session?.inTransaction()) throw C.error(503, 'AI3_NOT_READY');
        return work(session);
      });
    } catch (cause) {
      if (cause?.statusCode || cause?.code === 11000) throw cause;
      throw C.error(503, 'SERVICE_UNAVAILABLE');
    }
  }
  async function sourceCheck(identity, p, knowledgePointId) {
    let s;
    try {
      if (!sourceReader?.require) throw new Error('Missing source reader');
      s = await sourceReader.require({ familyId: String(p.familyId), childId: String(p.childId), actorId: identity.id,
        ...(p.source.type === 'task' ? { sourceTaskId: p.source.id } : { sourceMistakeId: p.source.id }) });
    } catch (e) {
      if (e.statusCode === 403 && e.code === 'CHILD_ACCESS_DENIED') throw C.error(403, 'CHILD_ACCESS_DENIED');
      throw C.error(e.statusCode === 404 ? 404 : 503, e.statusCode === 404 ? 'RESOURCE_NOT_FOUND' : 'SOURCE_SERVICE_UNAVAILABLE');
    }
    if (!s || !same(s.id, p.source.id) || !same(s.familyId, p.familyId) || !same(s.childId, p.childId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    try { subjectAlias(s.subject); } catch (_) { throw conflict('AI3_SOURCE_NOT_APPROVED'); }
    const chapter = p.childSnapshot?.chapter || p.chapter;
    if (!chapter || chapter.grade !== 4 || chapter.term !== 'upper' || chapter.provenance !== 'parent_declared'
      || chapter.chapterLabel !== '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570') throw conflict('AI3_SOURCE_NOT_APPROVED');
    try { subjectAlias(chapter.subject); } catch (_) { throw conflict('AI3_SOURCE_NOT_APPROVED'); }
    if (p.source.type === 'mistake') {
      if (!Object.hasOwn(s, 'knowledgePointId')) throw C.error(503, 'SOURCE_SERVICE_UNAVAILABLE');
      if (!same(s.knowledgePointId, knowledgePointId)) throw conflict('AI3_SOURCE_NOT_APPROVED');
    }
    if (knowledgePointId !== null) {
      let point;
      try { point = await knowledgePointReader?.read({ familyId: String(p.familyId), childId: String(p.childId), actorId: identity.id, knowledgePointId }); }
      catch (e) {
        if (e.statusCode === 403 && e.code === 'CHILD_ACCESS_DENIED') throw C.error(403, 'CHILD_ACCESS_DENIED');
        throw C.error(e.statusCode === 404 ? 404 : 503, e.statusCode === 404 ? 'RESOURCE_NOT_FOUND' : 'SOURCE_SERVICE_UNAVAILABLE');
      }
      if (!point) throw C.error(503, 'SOURCE_SERVICE_UNAVAILABLE');
      if (!same(point.id, knowledgePointId) || !same(point.familyId, p.familyId) || !same(point.childId, p.childId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
      if (point.dimension !== 'academic') throw conflict('AI3_SOURCE_NOT_APPROVED');
      try { subjectAlias(point.subject); } catch (_) { throw conflict('AI3_SOURCE_NOT_APPROVED'); }
    }
  }
  async function approved(p, expected, session = null, touch = false) {
    const a = await A.Attempt.findOne({ _id: p.currentAttemptId, packageId: p._id, familyId: p.familyId,
      childId: p.childId, attemptVersion: p.currentAttemptVersion }).session(session).lean();
    if (p.visibility !== 'published' || p.learningState !== 'approved' || p.activeCommandId || !a || a.review?.decision !== 'approve'
      || !same(a._id, expected.sourceAttemptId) || a.attemptVersion !== expected.sourceAttemptVersion
      || a.payloadHash !== expected.sourceAttemptPayloadHash || C.hash(a.review) !== expected.sourceReviewHash) throw conflict('AI3_SOURCE_NOT_APPROVED');
    if (touch) {
      const written = await A.Package.updateOne({ _id: p._id, stateVersion: p.stateVersion, visibility: 'published', learningState: 'approved',
        currentAttemptId: a._id, activeCommandId: null }, { $inc: { stateVersion: 1 } }, { session });
      if (written.matchedCount !== 1) throw conflict();
    }
  }
  async function ancestor(identity, r, session = null, touch = false) {
    await authorize(identity, String(r.childId), session);
    return assertPublishedAncestor(r, { session, touch });
  }
  async function previous(identity, childId, action, path, body, session = null) {
    const access = await authorize(identity, childId, session);
    const key = { familyId: access.familyId, actorId: identity.id, endpointOperation: `ai3.${action}`, operationId: body.operationId };
    const found = await M.Command.findOne(key).session(session).lean();
    if (found && found.requestHash !== C.requestHash(action, path, body)) throw conflict('IDEMPOTENCY_CONFLICT');
    return { found, key };
  }
  async function mutate(identity, childId, action, path, body, work) {
    continuous();
    try { await assertAi3Ready(); } catch (_) { throw C.error(503, 'AI3_NOT_READY'); }
    try {
      return await transact(async session => {
        const { found, key } = await previous(identity, childId, action, path, body, session);
        if (found) return found;
        if (action !== 'withdraw') enabled();
        const result = await work(session);
        const [c] = await M.Command.create([{ ...key, childId, roundId: result.roundId,
          payload: body, requestHash: C.requestHash(action, path, body), phase: 'SUCCEEDED', resultReference: result }], { session });
        return c.toObject();
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
      const old = await previous(identity, childId, action, path, body);
      if (old.found) return old.found;
      throw conflict('AI3_OPERATION_UNRESOLVED');
    }
  }
  const roundView = r => ({ id: String(r._id), sourcePackageId: String(r.sourcePackageId), source: plain(r.source), chapter: plain(r.chapter),
    exerciseCount: r.exerciseCount, visibility: r.visibility, learningState: r.learningState, stateVersion: r.stateVersion,
    preparation: r.preparation, currentContentId: r.currentContentId ? String(r.currentContentId) : null,
    currentContentVersion: r.currentContentVersion, currentContentHash: r.currentContentHash, cancelledAt: r.cancelledAt,
    knowledgePointId: r.knowledgePointId ? String(r.knowledgePointId) : null, pending: Boolean(r.activeCommandId),
    currentAttemptId: r.currentAttemptId ? String(r.currentAttemptId) : null, currentAttemptVersion: r.currentAttemptVersion });
  async function acknowledge(identity, c) {
    const r = await resource(M.Round, identity, String(c.roundId));
    return { command: commandView(c), round: roundView(r) };
  }
  const ref = (r, extra = {}) => ({ roundId: String(r._id), stateVersion: r.stateVersion + 1, ...extra });
  function writable(r, body) {
    if (r.cancelledAt || !r.active || r.activeCommandId || r.preparation === 'generating') throw conflict('AI3_OPERATION_UNRESOLVED');
    if (r.stateVersion !== body.expectedRoundVersion) throw conflict();
  }
  async function change(r, fields, session) {
    const updated = await M.Round.updateOne({ _id: r._id, stateVersion: r.stateVersion, activeCommandId: r.activeCommandId,
      visibility: r.visibility, cancelledAt: r.cancelledAt }, { $set: fields, $inc: { stateVersion: 1 } }, { session });
    if (updated.matchedCount !== 1) throw conflict();
  }
  async function create({ identity, body }) {
    parentOnly(identity); await familyScope(identity);
    const b = C.normalize('create', body), p = await resource(A.Package, identity, b.sourcePackageId);
    const path = '/api/ai3/practice-rounds';
    const old = await previous(identity, String(p.childId), 'create', path, b);
    if (old.found) { continuous(); return acknowledge(identity, old.found); }
    enabled(); continuous(); await sourceCheck(identity, p, b.knowledgePointId);
    const c = await mutate(identity, String(p.childId), 'create', path, b, async session => {
      const current = await resource(A.Package, identity, b.sourcePackageId, session);
      if (current.stateVersion !== b.expectedSourcePackageVersion) throw conflict();
      const expected = { sourceAttemptId: b.sourceAttemptId, sourceAttemptVersion: b.expectedSourceAttemptVersion,
        sourceAttemptPayloadHash: b.sourceAttemptPayloadHash, sourceReviewHash: b.sourceReviewHash };
      await approved(current, expected, session, true);
      const [r] = await M.Round.create([{ familyId: current.familyId, childId: current.childId, sourcePackageId: current._id,
        ...expected, source: plain(current.source), chapter: plain(current.childSnapshot.chapter), knowledgePointId: b.knowledgePointId,
        exerciseCount: b.exerciseCount, createdBy: identity.id, stateVersion: 1, active: true,
        preparation: 'ready', visibility: 'draft', learningState: 'open' }], { session });
      return { roundId: String(r._id), stateVersion: 1 };
    });
    return acknowledge(identity, c);
  }
  async function edit(action, identity, roundId, body) {
    parentOnly(identity); await familyScope(identity);
    const b = C.normalize(action, body), initial = await resource(M.Round, identity, roundId);
    const suffix = { revise_content: 'content-revisions', reject_content: 'reject-content', publish: 'publish', cancel: 'cancel', withdraw: 'withdraw' }[action];
    const path = `/api/ai3/practice-rounds/${roundId}/${suffix}`;
    const old = await previous(identity, String(initial.childId), action, path, b);
    if (old.found) { continuous(); return acknowledge(identity, old.found); }
    continuous(); if (action !== 'withdraw') enabled();
    if (action === 'publish') await sourceCheck(identity, initial, initial.knowledgePointId ? String(initial.knowledgePointId) : null);
    const c = await mutate(identity, String(initial.childId), action, path, b, async session => {
      const r = await resource(M.Round, identity, roundId, session);
      if (action === 'withdraw') {
        if (r.visibility !== 'published' || r.cancelledAt || r.stateVersion !== b.expectedRoundVersion) throw conflict();
        if (r.activeCommandId) {
          const pending = await M.Command.findOne({ _id: r.activeCommandId, roundId: r._id, familyId: r.familyId,
            childId: r.childId, endpointOperation: { $in: ['ai3.submit', 'ai3.review'] } }).session(session).lean();
          if (!pending) throw conflict('AI3_OPERATION_UNRESOLVED');
          try {
            if (pending.endpointOperation === 'ai3.submit') {
              if (!same(pending.actorId, r.childId) || !['RESERVED', 'MEDIA_PREPARED', 'MEDIA_COMMITTED', 'RESOLVING'].includes(pending.phase)) throw conflict();
              validateSubmissionMapping(pending);
            } else {
              if (pending.phase !== 'EFFECTS_PENDING' || !same(r.finalReviewId, pending._id) || r.learningState !== 'passed') throw conflict();
              validateReviewCommand(pending);
            }
          } catch (_) { throw conflict('AI3_OPERATION_UNRESOLVED'); }
        }
        // Pending submission cleanup or review effects retain their original command's active slot.
        await change(r, { visibility: 'withdrawn', active: Boolean(r.activeCommandId),
          withdrawal: { actorId: identity.id, reason: b.reason, at: new Date(now()) } }, session);
        return ref(r);
      }
      writable(r, b);
      if (r.visibility !== 'draft') throw conflict();
      if (action === 'cancel') {
        await change(r, { cancelledAt: new Date(now()), cancellation: { actorId: identity.id, reason: b.reason }, active: false }, session);
        return ref(r);
      }
      if (action === 'revise_content') {
        if (!same(r.currentContentId, b.expectedContentId) || r.currentContentVersion !== b.expectedContentVersion
          || r.currentContentHash !== b.expectedContentHash || b.content.exercises.length !== r.exerciseCount) throw conflict();
        const childSnapshot = C.childSnapshot(b.content);
        const [content] = await M.Content.create([{ familyId: r.familyId, childId: r.childId, roundId: r._id,
          version: (r.currentContentVersion || 0) + 1, content: b.content, contentHash: C.hash(b.content), childSnapshot,
          childSnapshotHash: C.hash(childSnapshot), createdBy: identity.id, origin: r.currentContentId ? 'parent_revision' : 'parent_manual',
          derivedFromContentId: r.currentContentId, reason: b.reason }], { session });
        await change(r, { preparation: 'candidate', currentContentId: content._id, currentContentVersion: content.version, currentContentHash: content.contentHash }, session);
        return ref(r, { contentId: String(content._id), contentVersion: content.version, contentHash: content.contentHash });
      }
      if (r.preparation !== 'candidate' || !same(r.currentContentId, b.contentId) || r.currentContentVersion !== b.contentVersion
        || r.currentContentHash !== b.contentHash) throw conflict();
      if (action === 'reject_content') {
        await change(r, { preparation: 'rejected' }, session); return ref(r, { contentId: b.contentId });
      }
      const content = await currentContent(r, session);
      if (content.childSnapshotHash !== b.childSnapshotHash) throw conflict();
      await ancestor(identity, r, session, true);
      await change(r, { visibility: 'published', publishedBy: identity.id, publishedAt: new Date(now()),
        publication: { contentId: String(content._id), contentVersion: content.version, contentHash: content.contentHash,
          childSnapshotHash: content.childSnapshotHash, actorId: identity.id } }, session);
      return ref(r, { contentId: String(content._id), contentVersion: content.version, contentHash: content.contentHash });
    });
    return acknowledge(identity, c);
  }
  async function currentContent(r, session = null) {
    const c = await M.Content.findOne({ _id: r.currentContentId, roundId: r._id, familyId: r.familyId, childId: r.childId,
      version: r.currentContentVersion, contentHash: r.currentContentHash }).session(session).lean();
    if (!c || C.hash(c.content) !== c.contentHash || C.hash(C.childSnapshot(c.content)) !== c.childSnapshotHash
      || C.hash(c.childSnapshot) !== c.childSnapshotHash) throw C.error(503, 'AI3_NOT_READY');
    return c;
  }
  async function getRound({ identity, roundId }) {
    const initial = await visibleRound(identity, roundId);
    let sourceAvailability = 'unavailable';
    try {
      const availability = await sourceReader?.availability?.({ familyId: String(initial.familyId), childId: String(initial.childId),
        actorId: identity.id, ...(initial.source.type === 'task' ? { sourceTaskId: initial.source.id } : { sourceMistakeId: initial.source.id }) });
      if (['available', 'missing', 'unavailable'].includes(availability)) sourceAvailability = availability;
    } catch (cause) {
      if (cause.statusCode === 403 && cause.code === 'CHILD_ACCESS_DENIED') throw C.error(403, 'CHILD_ACCESS_DENIED');
    }
    // External source reads can outlive permissions or ancestor visibility; read both again afterward.
    return transact(async session => {
      const r = await resource(M.Round, identity, roundId, session);
      if (!same(r.familyId, initial.familyId) || !same(r.childId, initial.childId)
        || r.source.type !== initial.source.type || r.source.id !== initial.source.id) throw C.error(503, 'AI3_NOT_READY');
      if (identity.role === 'student') {
        if (r.visibility !== 'published') throw C.error(404, 'RESOURCE_NOT_FOUND');
        try { await ancestor(identity, r, session); } catch (e) { if (e.statusCode === 409) throw C.error(404, 'RESOURCE_NOT_FOUND'); throw e; }
      }
      const c = r.currentContentId ? await currentContent(r, session) : null;
      let final = null;
      if (r.finalReviewId) {
        final = await M.Command.findOne({ _id: r.finalReviewId, roundId: r._id, familyId: r.familyId, childId: r.childId }).session(session).lean();
        if (!final) throw C.error(503, 'AI3_NOT_READY'); validateReviewCommand(final);
      }
      const effects = final ? Object.fromEntries(['mistake', 'mastery'].map(kind => [kind, final.effects[kind].status])) : null;
      if (identity.role === 'parent') return { round: { ...roundView(r), content: c ? plain(c.content) : null,
        childSnapshot: c ? plain(c.childSnapshot) : null, childSnapshotHash: c?.childSnapshotHash || null,
        sourceAvailability,
        ...(final ? { finalReview: plain(final.finalReview), reviewReminderDate: r.reviewReminderDate, effects } : {}) } };
      return { round: { id: String(r._id), sourcePackageId: String(r.sourcePackageId), source: { type: r.source.type, id: r.source.id },
        chapter: plain(r.chapter), exerciseCount: r.exerciseCount, visibility: r.visibility, learningState: r.learningState,
        stateVersion: r.stateVersion, publishedAt: r.publishedAt, contentId: String(c._id), contentVersion: c.version,
        childSnapshot: plain(c.childSnapshot), childSnapshotHash: c.childSnapshotHash,
        currentAttemptId: r.currentAttemptId ? String(r.currentAttemptId) : null, currentAttemptVersion: r.currentAttemptVersion,
        pending: Boolean(r.activeCommandId), reviewReminderDate: r.reviewReminderDate || null, sourceAvailability } };
    });
  }
  async function visibleRound(identity, roundId, session = null) {
    continuous();
    const r = await resource(M.Round, identity, roundId, session);
    if (identity.role === 'student') {
      if (r.visibility !== 'published') throw C.error(404, 'RESOURCE_NOT_FOUND');
      try { await ancestor(identity, r, session); }
      catch (e) { if (e.statusCode === 409) throw C.error(404, 'RESOURCE_NOT_FOUND'); throw e; }
    }
    return r;
  }
  async function listRounds({ identity, childId, page = 1, pageSize = 20, reviewFrom, reviewTo }) {
    continuous(); childId = childId || (identity?.role === 'student' ? identity.id : null);
    const access = await authorize(identity, childId), p = pagination(page, pageSize);
    for (const value of [reviewFrom, reviewTo]) if (value !== undefined) {
      try { if (typeof value !== 'string') throw new Error('Invalid date'); addLocalDateDays(value, 0); }
      catch (_) { throw C.error(400, 'VALIDATION_ERROR'); }
    }
    if (reviewFrom && reviewTo && reviewFrom > reviewTo) throw C.error(400, 'VALIDATION_ERROR');
    const filter = { familyId: access.familyId, childId,
      ...(identity.role === 'student' ? { visibility: 'published' } : {}),
      ...(reviewFrom !== undefined || reviewTo !== undefined ? { reviewReminderDate: {
        ...(reviewFrom !== undefined ? { $gte: reviewFrom } : {}), ...(reviewTo !== undefined ? { $lte: reviewTo } : {}) } } : {}) };
    const cursor = M.Round.find(filter).sort({ publishedAt: -1, _id: -1 }).select('_id').lean().cursor();
    const items = []; let visible = 0;
    try {
      for await (const candidate of cursor) {
        let r;
        try { ({ round: r } = await getRound({ identity, roundId: String(candidate._id) })); }
        catch (e) { if (e.statusCode === 404) continue; throw e; }
        if (visible++ < p.skip) continue;
        if (identity.role === 'student') items.push(r);
        else items.push({ id: r.id, sourcePackageId: r.sourcePackageId, source: { type: r.source.type, id: r.source.id },
          chapter: r.chapter, exerciseCount: r.exerciseCount, visibility: r.visibility, learningState: r.learningState,
          stateVersion: r.stateVersion, preparation: r.preparation, currentContentId: r.currentContentId,
          currentContentVersion: r.currentContentVersion, currentAttemptId: r.currentAttemptId,
          currentAttemptVersion: r.currentAttemptVersion, pending: r.pending, reviewReminderDate: r.reviewReminderDate || null,
          ...(r.effects ? { effects: r.effects } : {}) });
        if (items.length === p.pageSize) break;
      }
    } finally { await cursor.close(); }
    await authorize(identity, childId);
    return { items, page: p.page, pageSize: p.pageSize };
  }
  function attemptSummary(a, identity) {
    validateAttempt(a);
    const result = { id: String(a._id), attemptVersion: a.attemptVersion, note: a.note, submittedAt: a.submittedAt,
      review: a.review ? { decision: a.review.decision, comment: a.review.comment, reviewedAt: a.review.reviewedAt } : null };
    if (identity.role === 'parent') Object.assign(result, { attemptPayloadHash: a.payloadHash, submittedBy: String(a.submittedBy),
      mediaBindings: plain(a.mediaBindings), serverContentBinding: plain(a.serverContentBinding), review: a.review ? plain(a.review) : null });
    return result;
  }
  async function attemptInRound(r, attemptId, session = null) {
    if (!C.isId(attemptId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const a = await M.Attempt.findOne({ _id: attemptId, roundId: r._id, familyId: r.familyId, childId: r.childId }).session(session).lean();
    if (!a) throw C.error(404, 'RESOURCE_NOT_FOUND');
    validateAttempt(a);
    const c = await currentContent(r, session), b = a.serverContentBinding;
    if (b.contentId !== String(c._id) || b.contentVersion !== c.version || b.fullContentHash !== c.contentHash
      || b.childSnapshotHash !== c.childSnapshotHash || r.publication?.contentId !== b.contentId
      || r.publication?.contentVersion !== b.contentVersion || r.publication?.contentHash !== b.fullContentHash
      || r.publication?.childSnapshotHash !== b.childSnapshotHash) throw C.error(503, 'AI3_NOT_READY');
    return a;
  }
  async function inspectAttempt(a, identity) {
    if (!mediaInspectClient?.inspect) throw C.error(503, 'MEDIA_SERVICE_UNAVAILABLE');
    let items;
    try { items = await mediaInspectClient.inspect({ familyId: String(a.familyId), childId: String(a.childId), identity,
      mediaIds: a.mediaIds.map(String), bindings: plain(a.mediaBindings) }); }
    catch (_) { throw C.error(503, 'MEDIA_SERVICE_UNAVAILABLE'); }
    if (!Array.isArray(items) || items.length !== a.mediaIds.length || items.some((m, i) => !m || m.mediaId !== String(a.mediaIds[i])
      || !['image/jpeg', 'image/png', 'image/webp'].includes(m.mimeType) || !Number.isSafeInteger(m.sizeBytes)
      || m.sizeBytes < 1 || m.sizeBytes > 10 * 1024 * 1024 || !['available', 'deleted'].includes(m.status))) throw conflict('AI3_MEDIA_UNAVAILABLE');
    return items.map(m => ({ mediaId: m.mediaId, mimeType: m.mimeType, sizeBytes: m.sizeBytes, status: m.status }));
  }
  async function getAttempt({ identity, roundId, attemptId }) {
    const r = await visibleRound(identity, roundId), a = await attemptInRound(r, attemptId);
    const attempt = { ...attemptSummary(a, identity), media: await inspectAttempt(a, identity) };
    await visibleRound(identity, roundId); return { attempt };
  }
  async function listAttempts({ identity, roundId, page = 1, pageSize = 20 }) {
    const r = await visibleRound(identity, roundId), p = pagination(page, pageSize);
    const rows = await M.Attempt.find({ roundId: r._id, familyId: r.familyId, childId: r.childId })
      .sort({ attemptVersion: -1, _id: -1 }).skip(p.skip).limit(p.pageSize).lean();
    const items = rows.map(a => {
      validateAttempt(a);
      return { id: String(a._id), attemptVersion: a.attemptVersion, submittedAt: a.submittedAt,
        review: a.review ? { decision: a.review.decision, comment: a.review.comment, reviewedAt: a.review.reviewedAt } : null };
    });
    await visibleRound(identity, roundId); return { items, page: p.page, pageSize: p.pageSize };
  }
  async function submissionView(c, identity) {
    const r = await visibleRound(identity, String(c.roundId));
    const a = await attemptInRound(r, c.resultReference.attemptId);
    await visibleRound(identity, String(r._id));
    // Durable success acknowledgements never depend on the optional media inspector.
    return { command: commandView(c), pending: false, attempt: attemptSummary(a, identity) };
  }
  async function publicationPreview({ identity, roundId }) {
    parentOnly(identity);
    return transact(async session => {
      const r = await resource(M.Round, identity, roundId, session);
      if (r.visibility !== 'draft' || r.preparation !== 'candidate' || r.cancelledAt || r.activeCommandId) throw conflict();
      await ancestor(identity, r, session);
      const c = await currentContent(r, session);
      return { preview: { roundId, expectedRoundVersion: r.stateVersion, contentId: String(c._id), contentVersion: c.version,
        contentHash: c.contentHash, content: plain(c.content), childSnapshot: plain(c.childSnapshot), childSnapshotHash: c.childSnapshotHash } };
    });
  }
  async function generationReady() {
    continuous();
    try { await assertAi3Ready(); await assertAi1Indexes(); } catch (_) { throw C.error(503, 'AI3_NOT_READY'); }
  }
  async function generationPreview({ identity, roundId }) {
    parentOnly(identity); const initial = await resource(M.Round, identity, roundId);
    enabled(); continuous();
    await sourceCheck(identity, initial, initial.knowledgePointId ? String(initial.knowledgePointId) : null);
    return transact(async session => {
      const r = await resource(M.Round, identity, roundId, session);
      writable(r, { expectedRoundVersion: r.stateVersion });
      if (r.visibility !== 'draft' || r.generationCommandId || r.currentContentId) throw conflict();
      return { preview: buildGenerationPreview(r, await ancestor(identity, r, session), getProfile(), Number(now())) };
    });
  }
  const coldDuplicate = (e, keys) => e.code === 11000 && Object.keys(e.keyPattern || {}).join(',') === '_id'
    && e.keyPattern._id === 1 && keys.includes(e.keyValue?._id);
  async function generate({ identity, roundId, body }) {
    parentOnly(identity); const initial = await resource(M.Round, identity, roundId), b = C.normalize('generate', body);
    const path = `/api/ai3/practice-rounds/${roundId}/generate`;
    const old = await previous(identity, String(initial.childId), 'generate', path, b);
    continuous(); if (old.found) return acknowledge(identity, old.found);
    enabled(); await generationReady();
    await sourceCheck(identity, initial, initial.knowledgePointId ? String(initial.knowledgePointId) : null);
    // Allocate once outside all transaction retries; never reuse the caller UUID remotely.
    const commandId = new mongoose.Types.ObjectId(), reservationId = new mongoose.Types.ObjectId(), remoteOperationId = randomUUID();
    for (let attempt = 0; ; attempt++) {
      try {
        const c = await transact(async session => {
          const { found, key } = await previous(identity, String(initial.childId), 'generate', path, b, session);
          if (found) return found;
          enabled(); const r = await resource(M.Round, identity, roundId, session); writable(r, b);
          if (r.visibility !== 'draft' || r.generationCommandId || r.currentContentId) throw conflict();
          const p = await ancestor(identity, r, session, true), preview = buildGenerationPreview(r, p, getProfile(), Number(now()));
          if (b.generationInputHash !== preview.generationInputHash || b.modelProfileVersion !== preview.modelProfileVersion
            || b.pricingProfileVersion !== preview.pricingProfileVersion || b.maxAuthorizedCostMicros < preview.reservedCeilingMicros) throw conflict('AI_PREVIEW_STALE');
          const remoteRequestHash = buildRequest({ preview }).requestHash;
          const [made] = await M.Command.create([{ ...key, _id: commandId, roundId: r._id, childId: r.childId, payload: b,
            requestHash: C.requestHash('generate', path, b), phase: 'RESERVED', resultReference: ref(r),
            generation: { reservationId, remoteOperationId, remoteRequestHash,
              preview, sendNotAfter: preview.sendNotAfter,
              reservedCeilingMicros: preview.reservedCeilingMicros, maxAuthorizedCostMicros: b.maxAuthorizedCostMicros } }], { session });
          await budget.reserve(await authorize(identity, String(r.childId), session), r.childId, commandId, reservationId,
            preview.reservedCeilingMicros, session, 'ai3');
          await change(r, { generationCommandId: commandId, activeCommandId: commandId, preparation: 'generating' }, session);
          return made.toObject();
        });
        return acknowledge(identity, c);
      } catch (e) {
        if (e.code !== 11000) throw e;
        const saved = await previous(identity, String(initial.childId), 'generate', path, b);
        if (saved.found) return acknowledge(identity, saved.found);
        if (attempt === 0 && coldDuplicate(e, [String(initial.familyId), 'experiment'])) continue;
        throw conflict('AI3_OPERATION_UNRESOLVED');
      }
    }
  }
  async function originalGeneration(identity, commandId, session = null) {
    parentOnly(identity);
    const c = await resource(M.Command, identity, commandId, session);
    if (!same(c.actorId, identity.id) || c.endpointOperation !== 'ai3.generate') throw C.error(404, 'RESOURCE_NOT_FOUND');
    return c;
  }
  // Internal durable send authority only. No remote transport is mounted in this batch.
  async function claimGeneration({ identity, commandId }) {
    const initial = await originalGeneration(identity, commandId); continuous();
    if (initial.phase !== 'RESERVED') return { claimed: false, command: commandView(initial) };
    await generationReady();
    const initialRound = await resource(M.Round, identity, String(initial.roundId));
    let sourceFailure = false;
    try { await sourceCheck(identity, initialRound, initialRound.knowledgePointId ? String(initialRound.knowledgePointId) : null); }
    catch (e) { if (![404, 409].includes(e.statusCode)) throw e; sourceFailure = true; }
    for (let attempt = 0; ; attempt++) {
      try { return await transact(async session => {
        const c = await originalGeneration(identity, commandId, session);
        if (c.phase !== 'RESERVED') return { claimed: false, command: commandView(c) };
        // Invalid historical mappings must not become refundable through expiry or quote changes.
        validateMapping(c);
        const r = await resource(M.Round, identity, String(c.roundId), session);
        if (!same(r.activeCommandId, c._id) || !same(r.generationCommandId, c._id) || r.preparation !== 'generating') throw C.error(503, 'AI3_NOT_READY');
        let stale = sourceFailure, snapshotPackage;
        try {
          snapshotPackage = await ancestor(identity, r, session, true);
          const current = buildGenerationPreview(r, snapshotPackage, getProfile(), Number(now()));
          if (C.hash(current) !== C.hash(c.generation.preview)) stale = true;
        } catch (e) {
          if (![404, 409].includes(e.statusCode) && e.code !== 'AI_PROFILE_UNAVAILABLE') throw e;
          stale = true;
        }
        if (Number(now()) >= new Date(c.generation.sendNotAfter).getTime()) stale = true;
        if (stale) {
          const reservation = await budget.reservation('ai3', c, session);
          if (reservation.state !== 'reserved') throw C.error(503, 'AI3_NOT_READY');
          await budget.adjust(await budget.account(String(c.familyId), session), -reservation.reservedMicros, 0, session);
          await budget.adjust(await budget.account('experiment', session), -reservation.reservedMicros, 0, session);
          await Budget.Reservation.updateOne({ _id: reservation._id, state: 'reserved' }, { $set: { state: 'released' } }, { session });
          await budget.releaseSlot('ai3', c, session);
          await change(r, { activeCommandId: null, preparation: 'ready' }, session);
          const ended = await M.Command.findOneAndUpdate({ _id: c._id, phase: 'RESERVED' }, { $set: { phase: 'FAILED' } }, { new: true, session }).lean();
          if (!ended) throw conflict();
          return { claimed: false, command: commandView(ended) };
        }
        enabled();
        await budget.budgetState(await authorize(identity, String(c.childId), session), 0, session, c.generation.reservedCeilingMicros);
        await budget.claimSlot('ai3', c, session);
        // Recheck volatile authority after all budget/slot awaits, before durable send CAS.
        continuous(); enabled();
        const finalPreview = buildGenerationPreview(r, snapshotPackage, getProfile(), Number(now()));
        if (C.hash(finalPreview) !== C.hash(c.generation.preview)
          || Number(now()) >= new Date(c.generation.sendNotAfter).getTime()) throw conflict('AI_PREVIEW_STALE');
        const claimed = await M.Command.findOneAndUpdate({ _id: c._id, phase: 'RESERVED' }, { $set: { phase: 'DISPATCHING' } }, { new: true, session }).lean();
        if (!claimed) throw conflict();
        return { claimed: true, command: commandView(claimed) };
      }); } catch (e) {
        if (attempt === 0 && coldDuplicate(e, ['global'])) continue;
        throw e;
      }
    }
  }
  async function listCommands({ identity, childId, page = 1, pageSize = 20 }) {
    continuous(); childId = childId || (identity?.role === 'student' ? identity.id : null);
    const access = await authorize(identity, childId), p = pagination(page, pageSize);
    const rows = await M.Command.find({ familyId: access.familyId, childId, actorId: identity.id,
      ...(identity.role === 'student' ? { endpointOperation: 'ai3.submit' } : {}) }).sort({ createdAt: -1, _id: -1 })
      .skip(p.skip).limit(p.pageSize).lean();
    await authorize(identity, childId); return { items: rows.map(commandView), page: p.page, pageSize: p.pageSize };
  }
  async function getCommand({ identity, commandId }) {
    continuous();
    const c = await resource(M.Command, identity, commandId);
    if (!same(c.actorId, identity.id) || identity.role === 'student' && c.endpointOperation !== 'ai3.submit') throw C.error(404, 'RESOURCE_NOT_FOUND');
    if (c.endpointOperation === 'ai3.review') return reviews.view(c, identity);
    if (c.endpointOperation === 'ai3.submit') {
      const command = { ...commandView(c), failureCode: c.failureCode || null };
      let visible = true;
      try {
        await visibleRound(identity, String(c.roundId));
      } catch (e) { if (![404, 409].includes(e.statusCode)) throw e; visible = false; }
      if (visible) {
        try { validateSubmissionMapping(c); } catch (_) { throw C.error(503, 'AI3_NOT_READY'); }
        command.payload = plain(C.normalize('submit', c.payload));
      }
      return { command, pending: !['SUCCEEDED', 'FAILED'].includes(c.phase) };
    }
    return { command: commandView(c) };
  }
  async function recover({ identity, commandId, body }) {
    const result = await getCommand({ identity, commandId });
    if (C.normalize('recover', body).operationId !== result.command.operationId) throw conflict('IDEMPOTENCY_CONFLICT');
    if (result.command.endpointOperation === 'ai3.submit') return submission.recover({ identity, commandId, body });
    if (result.command.endpointOperation === 'ai3.review') return reviews.recover({ identity, commandId, body });
    if (operationClient && result.command.endpointOperation === 'ai3.generate' && ['DISPATCHING', 'UNKNOWN'].includes(result.command.phase)) {
      return runGeneration({ identity, commandId, queryOnly: true });
    }
    return result;
  }
  const remoteInvalid = () => C.error(503, 'AI_REMOTE_CONTRACT_INVALID');
  async function markGenerationUnknown(commandId) {
    await transact(async session => {
      const c = await M.Command.findById(commandId).session(session).lean();
      if (!c || !['DISPATCHING', 'UNKNOWN'].includes(c.phase)) return;
      const reservation = await budget.reservation('ai3', c, session);
      if (!['reserved', 'reserved_unknown'].includes(reservation.state)) throw remoteInvalid();
      if (c.phase === 'UNKNOWN') return;
      await M.Command.updateOne({ _id: c._id, phase: c.phase }, { $set: { phase: 'UNKNOWN' } }, { session });
      await Budget.Reservation.updateOne({ _id: reservation._id, state: reservation.state }, { $set: { state: 'reserved_unknown' } }, { session });
    });
  }
  async function haltGeneration(c) {
    await transact(async session => {
      for (const key of [String(c.familyId), 'experiment']) {
        await budget.account(key, session);
        await Budget.Account.updateOne({ _id: key }, { $set: { halted: true } }, { session });
      }
    });
  }
  async function acceptGeneration(identity, initial, raw) {
    const o = validateOperation(initial, raw);
    // Remember remote claim separately: an outcome transaction failure must not erase send evidence.
    await transact(async session => {
      const c = await originalGeneration(identity, String(initial._id), session);
      if ((o.status === 'failed_not_sent' && c.remoteClaimObserved)
        || (o.sendClaimed && c.phase === 'FAILED' && !c.remoteClaimObserved)) throw remoteInvalid();
      if (o.sendClaimed && !c.remoteClaimObserved) await M.Command.updateOne({ _id: c._id, remoteClaimObserved: false },
        { $set: { remoteClaimObserved: true } }, { session });
    });
    if (!['succeeded', 'failed_sent', 'failed_not_sent'].includes(o.status)) {
      await markGenerationUnknown(initial._id); return;
    }
    const { updatedAt: _updatedAt, ...terminal } = o, digest = C.hash(terminal);
    await transact(async session => {
      const c = await originalGeneration(identity, String(initial._id), session);
      if (c.outcomeHash) { if (c.outcomeHash !== digest) throw remoteInvalid(); return; }
      if (!['DISPATCHING', 'UNKNOWN'].includes(c.phase) || (o.status === 'failed_not_sent' && c.remoteClaimObserved)) throw remoteInvalid();
      const r = await resource(M.Round, identity, String(c.roundId), session);
      if (!same(r.activeCommandId, c._id) || !same(r.generationCommandId, c._id) || r.preparation !== 'generating'
        || r.visibility !== 'draft' || r.currentContentId || r.cancelledAt) throw C.error(503, 'AI3_NOT_READY');
      const reservation = await budget.reservation('ai3', c, session);
      if (!['reserved', 'reserved_unknown'].includes(reservation.state)) throw remoteInvalid();
      const release = o.status === 'failed_not_sent';
      const charge = o.usage === null ? null : costCeiling(o.usage.inputTokens, o.usage.outputTokens, c.generation.preview.pricing);
      let content = null, saved = null;
      if (o.status === 'succeeded') {
        try { content = C.generatedContent(o.result.text, r.exerciseCount); }
        catch (e) { if (![400, 413].includes(e.statusCode)) throw e; }
      }
      if (content) {
        const childSnapshot = C.childSnapshot(content);
        [saved] = await M.Content.create([{ familyId: c.familyId, childId: c.childId, roundId: r._id, version: 1,
          content, contentHash: C.hash(content), childSnapshot, childSnapshotHash: C.hash(childSnapshot),
          createdBy: c.actorId, origin: 'ai_generation', reason: 'Generated candidate; parent review required' }], { session });
      }
      if (release || charge !== null) {
        await budget.adjust(await budget.account(String(c.familyId), session), -reservation.reservedMicros, charge || 0, session);
        await budget.adjust(await budget.account('experiment', session), -reservation.reservedMicros, charge || 0, session);
      }
      const settled = await Budget.Reservation.updateOne({ _id: reservation._id, state: reservation.state }, { $set: {
        state: release ? 'released' : charge !== null ? 'settled' : 'reserved_unknown', settledMicros: release ? 0 : charge,
        ...(charge !== null ? { settledAt: new Date(now()) } : {}) } }, { session });
      if (settled.matchedCount !== 1) throw remoteInvalid();
      await budget.releaseSlot('ai3', c, session);
      await change(r, { activeCommandId: null, preparation: saved ? 'candidate' : 'ready',
        ...(saved ? { currentContentId: saved._id, currentContentVersion: saved.version, currentContentHash: saved.contentHash } : {}) }, session);
      const ended = await M.Command.updateOne({ _id: c._id, phase: c.phase, outcomeHash: { $exists: false } }, { $set: {
        phase: saved ? 'SUCCEEDED' : 'FAILED', outcomeHash: digest, remoteEvidence: o,
        resultReference: ref(r, saved ? { contentId: String(saved._id), contentVersion: saved.version, contentHash: saved.contentHash } : {}),
        failureCode: saved ? null : o.status === 'succeeded' ? 'AI3_OUTPUT_INVALID' : 'AI_PROVIDER_FAILED' } }, { session });
      if (ended.matchedCount !== 1) throw remoteInvalid();
    });
  }
  async function runGeneration({ identity, commandId, queryOnly = false }) {
    let c = await originalGeneration(identity, commandId); continuous();
    if (['SUCCEEDED', 'FAILED'].includes(c.phase) || (queryOnly && c.phase === 'RESERVED')) return getCommand({ identity, commandId });
    if (!operationClient) throw C.error(503, 'AI_PROFILE_UNAVAILABLE');
    let claimed = false;
    if (c.phase === 'RESERVED') {
      ({ claimed } = await claimGeneration({ identity, commandId }));
      c = await originalGeneration(identity, commandId);
      if (c.phase === 'FAILED') return getCommand({ identity, commandId });
    }
    try {
      validateMapping(c);
      if (claimed) {
        const r = await resource(M.Round, identity, String(c.roundId));
        const p = await ancestor(identity, r);
        continuous(); enabled();
        if (C.hash(buildGenerationPreview(r, p, getProfile(), Number(now()))) !== C.hash(c.generation.preview)
          || Number(now()) >= new Date(c.generation.sendNotAfter).getTime()) throw conflict('AI_PREVIEW_STALE');
      }
      const raw = await operationClient[claimed ? 'put' : 'get'](c);
      await acceptGeneration(identity, c, raw);
    } catch (e) {
      if (e.code === 'AI_REMOTE_CONTRACT_INVALID') await haltGeneration(c);
      await markGenerationUnknown(commandId);
      if (e.statusCode) throw e;
      throw C.error(503, 'AI_REMOTE_UNAVAILABLE');
    }
    return getCommand({ identity, commandId });
  }
  const submission = createAi3SubmissionService({ authorize, resource, transact, writeView: submissionView, previous,
    continuous, enabled, getRuntime, assertReady: assertAi3Ready, now, mediaReferenceClient, leaseMs: submissionLeaseMs });
  const reviews = createAi3ReviewService({ authorize, resource, parentOnly, transact, previous, continuous, enabled,
    assertReady: assertAi3Ready, attemptInRound, inspectAttempt, commandView, now, leaseMs: reviewLeaseMs,
    mistakeEvidenceClient, masteryEvidenceClient });
  const history = createAi3ContentHistoryService({ parentOnly, resource, transact });
  return { create, getRound, listRounds, getAttempt, listAttempts, submit: submission.submit,
    listContents: history.listContents, getContent: history.getContent,
    reviewContext: reviews.reviewContext, review: reviews.review, getFinalReview: reviews.getFinalReview,
    publicationPreview, generationPreview, generate, claimGeneration, runGeneration, listCommands, getCommand, recover,
    reviseContent: q => edit('revise_content', q.identity, q.roundId, q.body), rejectContent: q => edit('reject_content', q.identity, q.roundId, q.body),
    publish: q => edit('publish', q.identity, q.roundId, q.body), cancel: q => edit('cancel', q.identity, q.roundId, q.body),
    withdraw: q => edit('withdraw', q.identity, q.roundId, q.body) };
}
module.exports = { createAi3Service };
