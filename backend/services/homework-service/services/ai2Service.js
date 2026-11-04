const mongoose = require('mongoose');
const M = require('../models/Ai2');
const A = require('../models/Ai1');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { runMongoTransaction } = require('../../../common/services/mongoTransaction');
const { subjectAlias } = require('./ai1Contract');
const { assertAi2Ready } = require('./ai2Readiness');
const C = require('./ai2Contract');
const { createAi2SubmissionService } = require('./ai2SubmissionService');
const same = (a, b) => String(a) === String(b);
const plain = value => JSON.parse(JSON.stringify(value));
const conflict = code => C.error(409, code || 'AI2_STATE_CONFLICT');
const commandView = c => ({ id: String(c._id), operationId: c.operationId, endpointOperation: c.endpointOperation,
  phase: c.phase, resultReference: c.resultReference || null, failureCode: c.failureCode || null, createdAt: c.createdAt });

// Explicit local factory; no Provider port. Media inspection is read-only.
function createAi2Service({ now = Date.now, getRuntime = () => ({ enabled: false, continuousStore: false }),
  sourceReader, mediaReader, mediaReferenceClient,
  transactionRunner = work => runMongoTransaction({ mongooseInstance: mongoose, work }) } = {}) {
  const enabled = () => { if (getRuntime()?.enabled !== true) throw C.error(503, 'AI2_DISABLED'); };
  const continuous = () => { if (getRuntime()?.continuousStore !== true) throw C.error(503, 'AI2_STORE_ISOLATED'); };
  const parentOnly = identity => {
    if (!identity) throw C.error(401, 'UNAUTHENTICATED');
    if (identity.role !== 'parent') throw C.error(403, 'CHILD_ACCESS_DENIED');
  };
  async function familyScope(identity, session = null) {
    if (!identity) throw C.error(401, 'UNAUTHENTICATED');
    if (!C.isId(identity.id) || !['parent', 'student'].includes(identity.role)) throw C.error(403, 'CHILD_ACCESS_DENIED');
    const actor = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
    if (!actor) throw C.error(403, 'CHILD_ACCESS_DENIED');
    let family;
    if (identity.role === 'parent') {
      family = await Family.findOne({ $or: [{ ownerParentId: identity.id }, { memberParentIds: identity.id }] }).session(session).lean();
    } else {
      if (!same(identity.id, identity.childId) || !same(actor.familyId, identity.familyId)
        || !Number.isInteger(identity.tokenVersion) || actor.childProfile?.tokenVersion !== identity.tokenVersion) {
        throw C.error(401, 'STALE_CHILD_TOKEN');
      }
      family = await Family.findOne({ _id: actor.familyId, childIds: actor._id }).session(session).lean();
    }
    if (!family) throw C.error(403, 'CHILD_ACCESS_DENIED');
    return family;
  }
  async function authorize(identity, childId, session = null) {
    await familyScope(identity, session);
    if (!C.isId(String(childId))) throw C.error(403, 'CHILD_ACCESS_DENIED');
    const access = await resolveChildAccess(identity, childId, {
      FamilyModel: { findOne: q => Family.findOne(q).session(session) },
      UserModel: { findOne: q => User.findOne(q).session(session) }
    });
    if (!access) throw C.error(403, 'CHILD_ACCESS_DENIED');
    return access;
  }
  async function resource(model, identity, resourceId, session = null, includeWithdrawn = false) {
    const family = await familyScope(identity, session);
    if (!C.isId(resourceId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const query = { _id: resourceId, familyId: family._id };
    if (identity.role === 'student') query.childId = identity.id;
    const row = await model.findOne(query).session(session).lean();
    if (!row || (model === M.Package && identity.role === 'student' && !includeWithdrawn && row.visibility !== 'published')) {
      throw C.error(404, 'RESOURCE_NOT_FOUND');
    }
    await authorize(identity, String(row.childId), session);
    return row;
  }
  async function transact(work) {
    try {
      return await transactionRunner(async session => {
        if (!session?.inTransaction()) throw C.error(503, 'AI2_NOT_READY');
        return work(session);
      });
    } catch (cause) {
      if (cause?.statusCode || cause?.code === 11000) throw cause;
      throw C.error(503, 'SERVICE_UNAVAILABLE');
    }
  }
  async function sourceCheck(row) {
    if (!sourceReader?.require) throw C.error(503, 'SOURCE_SERVICE_UNAVAILABLE');
    const source = row.source || { type: row.sourceType, id: String(row.sourceId) };
    let value;
    try {
      value = await sourceReader.require({ familyId: String(row.familyId), childId: String(row.childId),
        ...(source.type === 'task' ? { sourceTaskId: String(source.id) } : { sourceMistakeId: String(source.id) }) });
    } catch (cause) {
      if (cause?.statusCode === 404) throw C.error(404, 'RESOURCE_NOT_FOUND');
      throw C.error(503, 'SOURCE_SERVICE_UNAVAILABLE');
    }
    if (!value || !same(value.id, source.id) || !same(value.familyId, row.familyId) || !same(value.childId, row.childId)) {
      throw C.error(404, 'RESOURCE_NOT_FOUND');
    }
    try { subjectAlias(value.subject); } catch (_) { throw C.error(409, 'AI2_PUBLICATION_STALE'); }
    return value;
  }
  async function approvedSnapshot(identity, cycleId, session = null) {
    parentOnly(identity);
    const c = await resource(A.Cycle, identity, cycleId, session);
    if (!c.active || c.status !== 'approved' || !c.approvedArtifactId || !same(c.currentArtifactId, c.approvedArtifactId)) {
      throw conflict('AI2_PUBLICATION_STALE');
    }
    const a = await A.Artifact.findOne({ _id: c.approvedArtifactId, cycleId: c._id, familyId: c.familyId,
      childId: c.childId, status: 'parent_approved' }).session(session).lean();
    if (!a) throw conflict('AI2_PUBLICATION_STALE');
    const childSnapshot = { questionText: c.input.questionText, explanationText: a.text,
      chapter: Object.fromEntries(['provenance', 'subject', 'grade', 'term', 'textbookLabel', 'chapterLabel'].map(k => [k, c.chapter[k]])),
      source: { type: c.sourceType, id: String(c.sourceId) } };
    return { c, a, preview: { cycleId: String(c._id), expectedCycleStateVersion: c.stateVersion,
      artifactId: String(a._id), artifactVersion: a.version, artifactContentHash: a.contentHash,
      expectedArtifactReviewVersion: a.reviewVersion, childSnapshot, childSnapshotHash: C.hash(childSnapshot) } };
  }
  async function previous(identity, childId, action, path, body, session = null) {
    const access = await authorize(identity, childId, session);
    const key = { familyId: access.familyId, actorId: identity.id, endpointOperation: `ai2.${action}`, operationId: body.operationId };
    const found = await M.Command.findOne(key).session(session).lean();
    if (found && found.requestHash !== C.requestHash(action, path, body)) throw conflict('IDEMPOTENCY_CONFLICT');
    return { found, key };
  }
  async function mutate({ identity, childId, action, path, body, work }) {
    continuous();
    try { await assertAi2Ready(); } catch (_) { throw C.error(503, 'AI2_NOT_READY'); }
    try {
      return await transact(async session => {
        const { found, key } = await previous(identity, childId, action, path, body, session);
        if (found) return found;
        continuous(); if (action !== 'withdraw') enabled();
        const commandId = new mongoose.Types.ObjectId();
        const result = await work(session, commandId);
        const [saved] = await M.Command.create([{ _id: commandId, ...key, childId, packageId: result.packageId,
          requestHash: C.requestHash(action, path, body), payload: body, phase: 'SUCCEEDED', resultReference: result }], { session });
        return saved.toObject();
      });
    } catch (cause) {
      if (cause?.code !== 11000) throw cause;
      const { found } = await previous(identity, childId, action, path, body);
      if (found) return found;
      throw conflict(action === 'publish' ? 'AI2_PACKAGE_ALREADY_PUBLISHED' : 'AI2_REVIEW_CONFLICT');
    }
  }
  async function inspect(a, identity) {
    if (!Array.isArray(a.mediaIds) || a.mediaIds.length < 1 || a.mediaIds.length > 10
      || new Set(a.mediaIds.map(String)).size !== a.mediaIds.length || !Array.isArray(a.mediaBindings)
      || a.mediaBindings.length !== a.mediaIds.length || a.mediaBindings.some((b, i) => !b
        || b.mediaId !== String(a.mediaIds[i]) || b.resourceType !== 'ai2_attempt' || b.resourceId !== String(a._id)
        || b.field !== 'correctionMediaIds' || typeof b.bindingOperationId !== 'string'
        || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(b.bindingOperationId))
      || a.payloadHash !== C.hash({ note: a.note, mediaIds: a.mediaIds.map(String), bindings: a.mediaBindings,
        submittedBy: String(a.submittedBy), attemptVersion: a.attemptVersion })) throw conflict('AI2_MEDIA_UNAVAILABLE');
    if (!mediaReader?.inspect) throw C.error(503, 'MEDIA_SERVICE_UNAVAILABLE');
    let items;
    try { items = await mediaReader.inspect({ familyId: String(a.familyId), childId: String(a.childId), identity,
      mediaIds: a.mediaIds.map(String), bindings: plain(a.mediaBindings) }); }
    catch (_) { throw C.error(503, 'MEDIA_SERVICE_UNAVAILABLE'); }
    if (!Array.isArray(items) || items.length !== a.mediaIds.length || items.some((m, i) => !m || m.mediaId !== String(a.mediaIds[i])
      || !['image/jpeg', 'image/png', 'image/webp'].includes(m.mimeType) || !Number.isSafeInteger(m.sizeBytes)
      || m.sizeBytes < 1 || m.sizeBytes > 10 * 1024 * 1024 || !['available', 'deleted'].includes(m.status))) {
      throw conflict('AI2_MEDIA_UNAVAILABLE');
    }
    return items.map(m => ({ mediaId: m.mediaId, mimeType: m.mimeType, sizeBytes: m.sizeBytes, status: m.status }));
  }
  function attemptSummary(a, identity) {
    const result = { id: String(a._id), attemptVersion: a.attemptVersion, note: a.note, submittedAt: a.submittedAt,
      review: a.review ? { decision: a.review.decision, comment: a.review.comment, reviewedAt: a.review.reviewedAt } : null };
    if (identity.role === 'parent') Object.assign(result, { attemptPayloadHash: a.payloadHash, submittedBy: String(a.submittedBy),
      mediaBindings: plain(a.mediaBindings), review: a.review ? plain(a.review) : null });
    return result;
  }
  async function attemptView(a, identity) {
    return { ...attemptSummary(a, identity), media: await inspect(a, identity) };
  }
  function packageSummary(p, identity) {
    const result = { id: String(p._id), source: { type: p.source.type, id: p.source.id, subject: p.source.subject },
      childSnapshot: plain(p.childSnapshot), childSnapshotHash: p.childSnapshotHash,
      artifact: { id: p.artifact.id, version: p.artifact.version, contentHash: p.artifact.contentHash },
      visibility: p.visibility, learningState: p.learningState, stateVersion: p.stateVersion,
      currentAttemptId: p.currentAttemptId ? String(p.currentAttemptId) : null, currentAttemptVersion: p.currentAttemptVersion,
      publishedAt: p.publishedAt, pending: Boolean(p.activeCommandId) };
    if (identity.role === 'parent') Object.assign(result, { publishedBy: String(p.publishedBy), withdrawal: p.withdrawal });
    return result;
  }
  async function getPackage({ identity, packageId }) {
    const snapshot = await transact(async session => {
      const p = await resource(M.Package, identity, packageId, session);
      const a = p.currentAttemptId ? await M.Attempt.findOne({ _id: p.currentAttemptId, packageId: p._id,
        familyId: p.familyId, childId: p.childId, attemptVersion: p.currentAttemptVersion }).session(session).lean() : null;
      if (p.currentAttemptId && !a) throw C.error(503, 'AI2_NOT_READY');
      return { p, a };
    });
    const { p, a } = snapshot; let sourceAvailability = 'available';
    try { await sourceCheck(p); } catch (cause) { sourceAvailability = cause.statusCode === 404 ? 'missing' : 'unavailable'; }
    const attempts = a ? [await attemptView(a, identity)] : [];
    await resource(M.Package, identity, packageId);
    return { package: { ...packageSummary(p, identity), attempts, sourceAvailability } };
  }
  async function getAttempt({ identity, packageId, attemptId }) {
    const p = await resource(M.Package, identity, packageId);
    if (!C.isId(attemptId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const a = await M.Attempt.findOne({ _id: attemptId, packageId: p._id, familyId: p.familyId, childId: p.childId }).lean();
    if (!a) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const attempt = await attemptView(a, identity);
    await resource(M.Package, identity, packageId);
    return { attempt };
  }
  async function writeView(record, identity) {
    const { packageId, attemptId } = record.resultReference;
    // A durable acknowledgement must not become a failure because optional media/source reads failed.
    return transact(async session => {
      const p = await resource(M.Package, identity, packageId, session);
      const a = attemptId ? await M.Attempt.findOne({ _id: attemptId, packageId: p._id,
        familyId: p.familyId, childId: p.childId }).session(session).lean() : null;
      if (attemptId && !a) throw C.error(503, 'AI2_NOT_READY');
      return { command: commandView(record), package: packageSummary(p, identity),
        ...(a ? { attempt: attemptSummary(a, identity) } : {}) };
    });
  }
  async function preview({ identity, cycleId }) {
    const result = await approvedSnapshot(identity, cycleId); await sourceCheck(result.c);
    return { preview: result.preview };
  }
  async function publish({ identity, body }) {
    parentOnly(identity); await familyScope(identity);
    const command = C.normalize('publish', body), initial = await resource(A.Cycle, identity, command.cycleId);
    const path = '/api/ai2/learning-packages';
    const old = await previous(identity, String(initial.childId), 'publish', path, command);
    if (old.found) return writeView(old.found, identity);
    enabled(); continuous(); await sourceCheck(initial);
    const saved = await mutate({ identity, childId: String(initial.childId), action: 'publish', path, body: command,
      work: async session => {
        const { c, a, preview: seen } = await approvedSnapshot(identity, command.cycleId, session);
        if (['cycleId', 'expectedCycleStateVersion', 'artifactId', 'artifactVersion', 'artifactContentHash',
          'expectedArtifactReviewVersion', 'childSnapshotHash'].some(k => command[k] !== seen[k])) throw conflict('AI2_PUBLICATION_STALE');
        if (await M.Package.exists({ familyId: c.familyId, childId: c.childId, ai1CycleId: c._id, visibility: 'published' }).session(session)) {
          throw conflict('AI2_PACKAGE_ALREADY_PUBLISHED');
        }
        const cas = await A.Cycle.updateOne({ _id: c._id, active: true, status: 'approved', stateVersion: c.stateVersion,
          approvedArtifactId: a._id, currentArtifactId: a._id }, { $inc: { stateVersion: 1 } }, { session });
        if (cas.matchedCount !== 1) throw conflict('AI2_PUBLICATION_STALE');
        const [p] = await M.Package.create([{ familyId: c.familyId, childId: c.childId, ai1CycleId: c._id,
          source: { type: c.sourceType, id: String(c.sourceId), subject: 'math' },
          artifact: { id: String(a._id), version: a.version, contentHash: a.contentHash, reviewVersion: a.reviewVersion },
          childSnapshot: seen.childSnapshot, childSnapshotHash: seen.childSnapshotHash, publishedBy: identity.id,
          publishedAt: new Date(Number(now())), visibility: 'published', learningState: 'open', stateVersion: 1 }], { session });
        return { packageId: String(p._id), attemptId: null };
      } });
    return writeView(saved, identity);
  }
  async function withdraw({ identity, packageId, body }) {
    parentOnly(identity);
    const initial = await resource(M.Package, identity, packageId), command = C.normalize('withdraw', body);
    const saved = await mutate({ identity, childId: String(initial.childId), action: 'withdraw',
      path: `/api/ai2/learning-packages/${packageId}/withdraw`, body: command, work: async session => {
        const p = await resource(M.Package, identity, packageId, session);
        const changed = await M.Package.updateOne({ _id: p._id, visibility: 'published', stateVersion: command.expectedPackageVersion },
          { $set: { visibility: 'withdrawn', withdrawal: { actorId: identity.id, reason: command.reason, at: new Date(Number(now())).toISOString() } },
            $inc: { stateVersion: 1 } }, { session });
        if (changed.matchedCount !== 1) throw conflict();
        return { packageId, attemptId: null };
      } });
    return writeView(saved, identity);
  }
  async function review({ identity, packageId, attemptId, body }) {
    parentOnly(identity);
    const initial = await resource(M.Package, identity, packageId), command = C.normalize('review', body);
    const path = `/api/ai2/learning-packages/${packageId}/attempts/${attemptId}/review`;
    const old = await previous(identity, String(initial.childId), 'review', path, command);
    if (old.found) return writeView(old.found, identity);
    enabled(); continuous();
    if (!C.isId(attemptId)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const a = await M.Attempt.findOne({ _id: attemptId, packageId, familyId: initial.familyId, childId: initial.childId }).lean();
    if (!a) throw C.error(404, 'RESOURCE_NOT_FOUND');
    let mediaEvidence = null;
    if (command.decision === 'approve') {
      const media = await inspect(a, identity);
      if (media.some(m => m.status !== 'available')) throw conflict('AI2_MEDIA_UNAVAILABLE');
      mediaEvidence = { bindingsHash: C.hash(a.mediaBindings), checkedAt: new Date(Number(now())).toISOString() };
    }
    const saved = await mutate({ identity, childId: String(initial.childId), action: 'review', path, body: command,
      work: async (session, commandId) => {
        const p = await resource(M.Package, identity, packageId, session);
        if (p.visibility !== 'published' || p.learningState !== 'submitted' || p.stateVersion !== command.expectedPackageVersion
          || p.activeCommandId || !same(p.currentAttemptId, attemptId) || p.currentAttemptVersion !== command.expectedAttemptVersion) {
          throw conflict('AI2_REVIEW_CONFLICT');
        }
        const changed = await M.Attempt.updateOne({ _id: attemptId, packageId: p._id, familyId: p.familyId, childId: p.childId,
          attemptVersion: command.expectedAttemptVersion, payloadHash: command.attemptPayloadHash, review: null },
        { $set: { review: { decision: command.decision, comment: command.comment, reviewerId: identity.id,
          reviewedAt: new Date(Number(now())).toISOString(), reviewOperationId: command.operationId, commandId: String(commandId), mediaEvidence } } }, { session });
        if (changed.matchedCount !== 1 || a.payloadHash !== command.attemptPayloadHash) throw conflict('AI2_REVIEW_CONFLICT');
        const cas = await M.Package.updateOne({ _id: p._id, visibility: 'published', learningState: 'submitted', stateVersion: p.stateVersion,
          activeCommandId: null, currentAttemptId: a._id }, { $set: { learningState: command.decision === 'approve' ? 'approved' : 'revise' },
          $inc: { stateVersion: 1 } }, { session });
        if (cas.matchedCount !== 1) throw conflict('AI2_REVIEW_CONFLICT');
        return { packageId, attemptId };
      } });
    return writeView(saved, identity);
  }
  async function listPackages({ identity, childId, page, pageSize }) {
    const access = await authorize(identity, childId || (identity?.role === 'student' ? identity.id : null));
    const paging = C.pagination(page, pageSize);
    const rows = await M.Package.find({ familyId: access.familyId, childId: access.child._id,
      ...(identity.role === 'student' ? { visibility: 'published' } : {}) }).sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.pageSize).lean();
    return { items: rows.map(p => packageSummary(p, identity)), page: paging.page, pageSize: paging.pageSize };
  }
  async function listAttempts({ identity, packageId, page, pageSize }) {
    const p = await resource(M.Package, identity, packageId), paging = C.pagination(page, pageSize);
    const rows = await M.Attempt.find({ packageId: p._id, familyId: p.familyId, childId: p.childId })
      .sort({ attemptVersion: -1, _id: -1 }).skip(paging.skip).limit(paging.pageSize).lean();
    return { items: rows.map(a => ({ id: String(a._id), attemptVersion: a.attemptVersion, submittedAt: a.submittedAt,
      review: a.review ? { decision: a.review.decision, comment: a.review.comment, reviewedAt: a.review.reviewedAt } : null })),
    page: paging.page, pageSize: paging.pageSize };
  }
  async function listCommands({ identity, childId, page, pageSize }) {
    const access = await authorize(identity, childId || (identity?.role === 'student' ? identity.id : null)), paging = C.pagination(page, pageSize);
    const rows = await M.Command.find({ familyId: access.familyId, childId: access.child._id, actorId: identity.id })
      .sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.pageSize).lean();
    return { items: rows.map(commandView), page: paging.page, pageSize: paging.pageSize };
  }
  async function getCommand({ identity, commandId }) {
    const c = await resource(M.Command, identity, commandId);
    if (!same(c.actorId, identity.id)) throw C.error(404, 'RESOURCE_NOT_FOUND');
    const p = await resource(M.Package, identity, String(c.packageId), null, true);
    return { command: { ...commandView(c), ...(identity.role === 'parent' || p.visibility === 'published' ? { payload: plain(c.payload) } : {}) } };
  }
  const submission = createAi2SubmissionService({ authorize, resource, transact, writeView, previous,
    continuous, enabled, getRuntime, assertReady: assertAi2Ready, now, mediaReferenceClient });
  return { preview, publish, withdraw, review, getPackage, getAttempt, listPackages, listAttempts, listCommands, getCommand,
    ...submission };
}
module.exports = { createAi2Service };
