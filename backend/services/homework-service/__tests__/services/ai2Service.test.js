const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const A = require('../../models/Ai1');
const M = require('../../models/Ai2');
const { createAi1Service } = require('../../services/ai1Service');
const { createAi2Service } = require('../../services/ai2Service');
const C = require('../../services/ai2Contract');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const id = () => String(new mongoose.Types.ObjectId());
const cmd = () => ({ schemaVersion: 'ai2-min-v1', operationId: randomUUID() });
let parent, coparent, child, sibling, outsider, family, source, reader, mediaReader, config, service, ai1;
const makeService = extra => createAi2Service({ getRuntime: () => config, sourceReader: { require: reader },
  mediaReader: { inspect: mediaReader }, ...extra });
beforeAll(async () => { for (const model of [...Object.values(A), ...Object.values(M), Family, User]) await model.init(); });
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic AI2', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id] });
  await Family.create({ familyName: 'Other synthetic', ownerParentId: outsider.id, memberParentIds: [outsider.id] });
  for (const actor of [child, sibling]) Object.assign(actor, { childId: actor.id, familyId: String(family._id) });
  await User.collection.insertMany([parent, coparent, outsider, child, sibling].map(u => ({ _id: new mongoose.Types.ObjectId(u.id),
    role: u.role, username: u.id, email: `${u.id}@example.test`, ...(u.role === 'student'
      ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  source = id(); config = { enabled: true, continuousStore: true };
  reader = jest.fn(async q => ({ id: q.sourceTaskId || q.sourceMistakeId, familyId: String(family._id), childId: child.id,
    subject: 'math', title: 'SOURCE_PRIVATE_TITLE' }));
  // Read-only media port double. This is NOT AI2-3 media binding or end-to-end submission evidence.
  mediaReader = jest.fn(async q => q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 100, status: 'available' })));
  service = makeService();
  ai1 = createAi1Service({ now: () => Date.parse('2026-11-03T01:00:00Z'), getRuntime: () => config,
    getProfile: () => ({ model: 'synthetic-no-provider', modelProfileVersion: 'test-1', pricingProfileVersion: 'test-1',
      checkedAt: '2026-11-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z', callWindowMs: 60000, clockMarginMs: 5000,
      inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000 }),
    getLimits: () => ({ singleMicros: 184320, dayMicros: 1843200, monthMicros: 1843200, experimentMicros: 1843200 }),
    sourceReader: { require: reader } });
});
async function approved(type = 'task') {
  const command = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID() });
  const c = await ai1.create({ identity: parent, body: { ...command(), childId: child.id, source: { type, id: source },
    input: { questionText: '124 * 23', answerText: 'PRIVATE_ANSWER', parentContext: 'PRIVATE_CONTEXT' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic',
      chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true } });
  const g = await ai1.generate({ identity: parent, cycleId: c.cycle.id, body: { ...command(), expectedCycleStateVersion: 1,
    generationInputHash: c.preview.generationInputHash, modelProfileVersion: c.preview.modelProfileVersion,
    pricingProfileVersion: c.preview.pricingProfileVersion, maxAuthorizedCostMicros: c.preview.reservedCeilingMicros, externalSendConfirmed: true } });
  await ai1.claim({ identity: parent, jobId: g.job.id });
  const j = await A.Job.findById(g.job.id).lean();
  const result = await ai1.applyOutcome({ jobId: j._id, evidence: { remoteOperationId: j.remoteOperationId,
    generationInputHash: j.preview.generationInputHash, modelProfileVersion: j.preview.modelProfileVersion,
    pricingProfileVersion: j.preview.pricingProfileVersion, sendNotAfter: j.sendNotAfter.toISOString(),
    status: 'succeeded', text: 'Synthetic explanation', usage: { inputTokens: 10, outputTokens: 10 } } });
  const seen = r => ({ ...command(), expectedCycleStateVersion: r.cycleStateVersion, artifactId: r.artifact.id,
    artifactVersion: r.artifact.version, artifactContentHash: r.artifact.contentHash, expectedArtifactReviewVersion: r.artifact.reviewVersion });
  const revision = await ai1.revise({ identity: parent, cycleId: c.cycle.id,
    body: { ...seen(result), revisedText: 'Reviewed synthetic explanation', revisionReason: 'Clarify place value' } });
  await ai1.review({ identity: coparent, cycleId: c.cycle.id, body: { ...seen(revision), decision: 'approve', comment: '',
    checks: { mathCorrect: true, gradeAppropriate: true, chapterAppropriate: true, wordingReviewed: true } } });
  return c.cycle.id;
}
const publishBody = async cycleId => ({ ...cmd(), ...(await service.preview({ identity: parent, cycleId })).preview,
  childContentConfirmed: true });
async function publish(cycleId) {
  const body = await publishBody(cycleId || await approved()); delete body.childSnapshot;
  return { body, result: await service.publish({ identity: parent, body }) };
}
// Seed only an already-submitted Attempt for batch-2 review transactions. No fake public submit method.
async function submitted(packageId, version = 1) {
  const mediaId = id(), attemptId = id();
  const fields = { familyId: family._id, childId: child.id, packageId, attemptVersion: version, submitCommandId: id(),
    submittedBy: child.id, submittedAt: new Date('2026-11-03T01:00:00Z'), note: 'Synthetic correction', mediaIds: [mediaId],
    mediaBindings: [{ mediaId, resourceType: 'ai2_attempt', resourceId: attemptId, field: 'correctionMediaIds', bindingOperationId: randomUUID() }] };
  const a = await M.Attempt.create({ _id: attemptId, ...fields, payloadHash: C.hash({ note: fields.note, mediaIds: fields.mediaIds,
    bindings: fields.mediaBindings, submittedBy: child.id, attemptVersion: version }) });
  await M.Package.updateOne({ _id: packageId }, { $set: { learningState: 'submitted', currentAttemptId: a._id, currentAttemptVersion: version }, $inc: { stateVersion: 1 } });
  const detail = await service.getPackage({ identity: parent, packageId });
  return { a, body: { ...cmd(), expectedPackageVersion: detail.package.stateVersion, expectedAttemptVersion: version,
    attemptPayloadHash: detail.package.attempts[0].attemptPayloadHash, decision: 'approve', comment: '' } };
}
test.each(['task', 'mistake'])('PUB-01/VIEW-01 real AI1 revision and approval -> %s publication, safe snapshot and no AI side effects', async type => {
  const cycleId = await approved(type), aiBefore = JSON.stringify(await A.Account.find().lean());
  const { result, body } = await publish(cycleId), packageId = result.package.id;
  expect(result.package.artifact.version).toBe(2);
  const read = await service.getPackage({ identity: child, packageId });
  expect(read.package.childSnapshot.explanationText).toBe('Reviewed synthetic explanation');
  for (const hidden of ['PRIVATE_', 'generationInputHash', 'publishedBy', 'approvedArtifactId', 'SOURCE_PRIVATE_TITLE']) {
    expect(JSON.stringify(read)).not.toContain(hidden);
  }
  expect((await service.listPackages({ identity: child })).items.map(x => x.id)).toEqual([packageId]);
  expect((await service.publish({ identity: parent, body })).command.id).toBe(result.command.id);
  expect(await M.Package.countDocuments()).toBe(1); expect(await M.Command.countDocuments()).toBe(1);
  expect(JSON.stringify(await A.Account.find().lean())).toBe(aiBefore);
});
test.each(['childSnapshotHash', 'childContentConfirmed'])('PUB-02 invalid %s cannot reserve or change approved content', async field => {
  const body = await publishBody(await approved()); delete body.childSnapshot;
  body[field] = field === 'childSnapshotHash' ? (body[field] === 'a'.repeat(64) ? 'b' : 'a').repeat(64) : false;
  const snapshot = async () => JSON.stringify(await Promise.all([...Object.values(A), ...Object.values(M)]
    .map(model => model.find().sort({ _id: 1 }).lean())));
  const before = await snapshot(); mediaReader.mockClear();
  await expect(service.publish({ identity: parent, body })).rejects.toMatchObject(field === 'childSnapshotHash'
    ? { statusCode: 409, code: 'AI2_PUBLICATION_STALE' } : { statusCode: 400 });
  expect(await snapshot()).toBe(before);
  expect(await M.Package.countDocuments()).toBe(0);
  expect(await M.Command.countDocuments()).toBe(0);
  expect(mediaReader).not.toHaveBeenCalled();
});
test('PUB-02 real AI1 unknown job retains its reservation and cannot preview or publish', async () => {
  const c = await ai1.create({ identity: parent, body: { schemaVersion: 'ai1-min-v1', operationId: randomUUID(),
    childId: child.id, source: { type: 'task', id: source }, input: { questionText: '124 * 23',
      answerText: 'PRIVATE_ANSWER', parentContext: 'PRIVATE_CONTEXT' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
      textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true } });
  const g = await ai1.generate({ identity: parent, cycleId: c.cycle.id, body: { schemaVersion: 'ai1-min-v1',
    operationId: randomUUID(), expectedCycleStateVersion: 1, generationInputHash: c.preview.generationInputHash,
    modelProfileVersion: c.preview.modelProfileVersion, pricingProfileVersion: c.preview.pricingProfileVersion,
    maxAuthorizedCostMicros: c.preview.reservedCeilingMicros, externalSendConfirmed: true } });
  const claimed = await ai1.claim({ identity: parent, jobId: g.job.id });
  await ai1.markUnknown({ jobId: g.job.id, owner: claimed.owner });
  const cycle = await A.Cycle.findById(c.cycle.id).lean(), job = await A.Job.findById(g.job.id).lean();
  expect(cycle.status).toBe('generating'); expect(job.status).toBe('unknown');
  expect(await A.Reservation.findById(job.reservationId).lean()).toMatchObject({ state: 'reserved_unknown' });
  const snapshot = async () => JSON.stringify(await Promise.all([...Object.values(A), ...Object.values(M)]
    .map(model => model.find().sort({ _id: 1 }).lean())));
  const before = await snapshot(); mediaReader.mockClear();
  await expect(service.preview({ identity: parent, cycleId: c.cycle.id }))
    .rejects.toMatchObject({ statusCode: 409, code: 'AI2_PUBLICATION_STALE' });
  await expect(service.publish({ identity: parent, body: { ...cmd(), cycleId: c.cycle.id,
    expectedCycleStateVersion: cycle.stateVersion, artifactId: id(), artifactVersion: 1,
    artifactContentHash: 'a'.repeat(64), expectedArtifactReviewVersion: 1,
    childSnapshotHash: 'b'.repeat(64), childContentConfirmed: true } }))
    .rejects.toMatchObject({ statusCode: 409, code: 'AI2_PUBLICATION_STALE' });
  expect(await snapshot()).toBe(before);
  expect(await M.Package.countDocuments()).toBe(0); expect(await M.Command.countDocuments()).toBe(0);
  expect(mediaReader).not.toHaveBeenCalled();
});
test('PUB-02/03 stale preview, unapproved and close versus publication refuse without package', async () => {
  const cycleId = await approved(), body = await publishBody(cycleId); delete body.childSnapshot;
  await ai1.close({ identity: parent, cycleId, body: { schemaVersion: 'ai1-min-v1', operationId: randomUUID(),
    expectedCycleStateVersion: body.expectedCycleStateVersion, reason: 'Synthetic close' } });
  await expect(service.publish({ identity: parent, body })).rejects.toMatchObject({ code: 'AI2_PUBLICATION_STALE' });
  expect(await M.Package.countDocuments()).toBe(0);
});
test('PUB-03 two parents same UUID compete for one active publication', async () => {
  const body = await publishBody(await approved()); delete body.childSnapshot;
  const outcomes = await Promise.allSettled([parent, coparent].map(identity => service.publish({ identity, body })));
  expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find(r => r.status === 'rejected').reason.statusCode).toBe(409);
  expect(await M.Package.countDocuments()).toBe(1); expect(await M.Command.countDocuments()).toBe(1);
});
test.each(['reviewVersion', 'approvedPointer'])('PUB-03 stale %s preview cannot publish or reserve; explicit fresh preview succeeds', async change => {
  const cycleId = await approved(), body = await publishBody(cycleId); delete body.childSnapshot;
  const original = await A.Artifact.findById(body.artifactId).lean();
  // Fault fixture, not an AI1 API: approved artifacts cannot currently be revised through that API.
  // Keep Cycle.stateVersion unchanged so its guard cannot mask the artifact tuple check.
  if (change === 'reviewVersion') {
    await A.Artifact.updateOne({ _id: original._id }, { $inc: { reviewVersion: 1 } });
  } else {
    const replacement = await A.Artifact.create({ ...original, _id: new mongoose.Types.ObjectId(), version: original.version + 1,
      text: 'Replacement approved explanation', contentHash: C.hash('Replacement approved explanation') });
    await A.Cycle.updateOne({ _id: cycleId }, { $set: { currentArtifactId: replacement._id, approvedArtifactId: replacement._id } });
  }
  const before = await A.Cycle.findById(cycleId).lean();
  await expect(service.publish({ identity: parent, body })).rejects.toMatchObject({ statusCode: 409, code: 'AI2_PUBLICATION_STALE' });
  expect(await A.Cycle.findById(cycleId).lean()).toEqual(before);
  expect(await M.Package.countDocuments()).toBe(0); expect(await M.Command.countDocuments()).toBe(0);
  const fresh = await publishBody(cycleId), expectedSnapshot = fresh.childSnapshot; delete fresh.childSnapshot;
  expect(fresh.operationId).not.toBe(body.operationId);
  const result = await service.publish({ identity: parent, body: fresh });
  const saved = await M.Package.findById(result.package.id).lean();
  expect(saved.childSnapshot).toEqual(expectedSnapshot);
  expect(saved.artifact).toEqual({ id: fresh.artifactId, version: fresh.artifactVersion,
    contentHash: fresh.artifactContentHash, reviewVersion: fresh.expectedArtifactReviewVersion });
  expect(await M.Package.countDocuments()).toBe(1); expect(await M.Command.countDocuments()).toBe(1);
});
test.each([404, 503])('PUB-04 source updates and %s preserve complete published snapshot; new publish refuses without writes', async status => {
  const { result } = await publish(), packageId = result.package.id;
  const snapshot = (await service.getPackage({ identity: child, packageId })).package.childSnapshot;
  // Separate source/cycle prevents an already-published conflict from hiding source rejection.
  source = id(); const nextBody = await publishBody(await approved()); delete nextBody.childSnapshot;
  reader.mockImplementation(async q => ({ id: q.sourceTaskId || q.sourceMistakeId, familyId: String(family._id), childId: child.id,
    subject: 'math', title: 'CHANGED_PRIVATE_TITLE', questionText: 'CHANGED_PRIVATE_QUESTION' }));
  const changed = await service.getPackage({ identity: child, packageId });
  expect(changed.package.sourceAvailability).toBe('available'); expect(changed.package.childSnapshot).toEqual(snapshot);
  expect(JSON.stringify(changed)).not.toContain('CHANGED_PRIVATE');
  reader.mockRejectedValue(Object.assign(new Error('private source error'), { statusCode: status }));
  const before = await Promise.all([...Object.values(M), ...Object.values(A)].map(model => model.find().sort({ _id: 1 }).lean()));
  const unavailable = await service.getPackage({ identity: child, packageId });
  expect(unavailable.package.sourceAvailability).toBe(status === 404 ? 'missing' : 'unavailable');
  expect(unavailable.package.childSnapshot).toEqual(snapshot);
  await expect(service.publish({ identity: parent, body: nextBody })).rejects.toMatchObject({ statusCode: status,
    code: status === 404 ? 'RESOURCE_NOT_FOUND' : 'SOURCE_SERVICE_UNAVAILABLE' });
  expect(await Promise.all([...Object.values(M), ...Object.values(A)].map(model => model.find().sort({ _id: 1 }).lean()))).toEqual(before);
});
test('PUB-04 existing snapshot remains available on missing/unavailable source; new publication fails', async () => {
  const { result } = await publish(); const packageId = result.package.id;
  reader.mockRejectedValue(Object.assign(new Error('private upstream'), { statusCode: 404, code: 'RESOURCE_NOT_FOUND' }));
  expect((await service.getPackage({ identity: child, packageId })).package.sourceAvailability).toBe('missing');
  await expect(service.preview({ identity: parent, cycleId: String((await M.Package.findById(packageId)).ai1CycleId) })).rejects.toMatchObject({ statusCode: 404 });
  reader.mockRejectedValue(new Error('private upstream'));
  expect((await service.getPackage({ identity: child, packageId })).package.sourceAvailability).toBe('unavailable');
});
test('AUTH-01 real membership, sibling, stale child and actor checks precede replay', async () => {
  const { result, body } = await publish(), packageId = result.package.id;
  for (const identity of [sibling, outsider]) await expect(service.getPackage({ identity, packageId })).rejects.toMatchObject({ statusCode: 404 });
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  await expect(service.getPackage({ identity: child, packageId })).rejects.toMatchObject({ code: 'STALE_CHILD_TOKEN' });
  await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: coparent.id, memberParentIds: [coparent.id] } });
  await expect(service.publish({ identity: parent, body })).rejects.toMatchObject({ statusCode: 403 });
  expect(await M.Command.countDocuments()).toBe(1);
});
test.each(['review', 'withdraw'])('AUTH-01 revoked co-parent cannot replay terminal %s or read its command', async action => {
  const { result } = await publish(), packageId = result.package.id;
  const { a, body: reviewBody } = await submitted(packageId);
  const args = action === 'review'
    ? { identity: coparent, packageId, attemptId: String(a._id), body: reviewBody }
    : { identity: coparent, packageId, body: { ...cmd(), expectedPackageVersion: 2, reason: 'Original stop' } };
  const first = await service[action](args);
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  const models = [...Object.values(M), ...Object.values(A)];
  const before = await Promise.all(models.map(model => model.find().sort({ _id: 1 }).lean()));
  mediaReader.mockClear(); const restored = makeService();
  await expect(restored[action](args)).rejects.toMatchObject({ statusCode: 403, code: 'CHILD_ACCESS_DENIED' });
  await expect(restored.getCommand({ identity: coparent, commandId: first.command.id }))
    .rejects.toMatchObject({ statusCode: 403, code: 'CHILD_ACCESS_DENIED' });
  expect(await Promise.all(models.map(model => model.find().sort({ _id: 1 }).lean()))).toEqual(before);
  expect(mediaReader).not.toHaveBeenCalled();
});
test('WITHDRAW-01 withdraw preserves old package, child denied, parent replay and fresh republication', async () => {
  const { result } = await publish(), packageId = result.package.id;
  const body = { ...cmd(), expectedPackageVersion: 1, reason: 'Withdraw synthetic package' };
  const first = await service.withdraw({ identity: coparent, packageId, body });
  expect(first.package.visibility).toBe('withdrawn');
  expect((await service.withdraw({ identity: coparent, packageId, body })).command.id).toBe(first.command.id);
  await expect(service.getPackage({ identity: child, packageId })).rejects.toMatchObject({ statusCode: 404 });
  expect((await service.listPackages({ identity: child })).items).toEqual([]);
  const next = await publish(String((await M.Package.findById(packageId)).ai1CycleId));
  expect(next.result.package.id).not.toBe(packageId); expect(await M.Package.countDocuments()).toBe(2);
});
test('REVIEW-01/02 both parents same UUID race: first audit wins; old body replay cannot approve newer attempt', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  body.decision = 'revise'; body.comment = 'Check the tens column';
  const outcomes = await Promise.allSettled([parent, coparent].map(identity => service.review({ identity, packageId, attemptId: String(a._id), body })));
  expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  const first = await M.Attempt.findById(a._id).lean(), actor = [parent, coparent].find(p => p.id === first.review.reviewerId);
  const newer = await submitted(packageId, 2);
  const replay = await service.review({ identity: actor, packageId, attemptId: String(a._id), body });
  expect(replay.attempt.id).toBe(String(a._id)); expect(replay.package.currentAttemptId).toBe(String(newer.a._id));
  expect((await M.Attempt.findById(newer.a._id)).review).toBeNull();
  expect((await M.Attempt.findById(a._id)).review).toEqual(first.review);
});
test('REVIEW-01 stale hash/version and active submit lock never change review', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  for (const changed of [{ ...body, expectedAttemptVersion: 2 }, { ...body, attemptPayloadHash: '0'.repeat(64) }, { ...body, expectedPackageVersion: 1 }]) {
    await expect(service.review({ identity: parent, packageId, attemptId: String(a._id), body: changed })).rejects.toMatchObject({ code: 'AI2_REVIEW_CONFLICT' });
  }
  await M.Package.updateOne({ _id: packageId }, { $set: { activeCommandId: new mongoose.Types.ObjectId() } });
  await expect(service.review({ identity: parent, packageId, attemptId: String(a._id), body })).rejects.toMatchObject({ code: 'AI2_REVIEW_CONFLICT' });
  expect((await M.Attempt.findById(a._id)).review).toBeNull();
});
test.each(['approve', 'revise'])('REVIEW-02/IDEM-01 terminal %s rejects each changed-body replay and preserves first audit', async decision => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  Object.assign(body, { decision, comment: 'First audit feedback' });
  const request = { identity: coparent, packageId, attemptId: String(a._id), body };
  const first = await service.review(request);
  const snapshot = async () => Promise.all([...Object.values(M), ...Object.values(A)].map(model => model.find().sort({ _id: 1 }).lean()));
  const before = await snapshot();
  expect((await M.Command.findById(first.command.id)).phase).toBe('SUCCEEDED');
  const restored = makeService();
  mediaReader.mockClear();
  for (const change of [{ decision: decision === 'approve' ? 'revise' : 'approve' }, { comment: 'Changed feedback' },
    { expectedPackageVersion: body.expectedPackageVersion + 1 }, { expectedAttemptVersion: body.expectedAttemptVersion + 1 },
    { attemptPayloadHash: 'f'.repeat(64) }]) {
    await expect(restored.review({ ...request, body: { ...body, ...change } }))
      .rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(await snapshot()).toEqual(before);
    expect(mediaReader).not.toHaveBeenCalled();
  }
  const replay = await restored.review(request);
  expect(replay.command).toEqual(first.command); expect(replay.attempt).toEqual(first.attempt);
  expect(await snapshot()).toEqual(before);
  expect(mediaReader).not.toHaveBeenCalled();
});

test('IDEM-01 terminal withdraw rejects changed reason/version after service recreation without changing first result', async () => {
  const { result } = await publish(), packageId = result.package.id;
  await submitted(packageId);
  const current = await M.Package.findById(packageId).lean();
  const body = { ...cmd(), expectedPackageVersion: current.stateVersion, reason: 'Original withdrawal audit' };
  const request = { identity: coparent, packageId, body };
  const first = await service.withdraw(request);
  const snapshot = async () => Promise.all([...Object.values(M), ...Object.values(A)].map(model => model.find().sort({ _id: 1 }).lean()));
  const before = await snapshot();
  expect((await M.Command.findById(first.command.id)).phase).toBe('SUCCEEDED');
  const restored = makeService();
  mediaReader.mockClear();
  for (const change of [{ reason: 'Replacement audit' }, { expectedPackageVersion: body.expectedPackageVersion + 1 }]) {
    await expect(restored.withdraw({ ...request, body: { ...body, ...change } }))
      .rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(await snapshot()).toEqual(before);
    expect(mediaReader).not.toHaveBeenCalled();
  }
  expect((await restored.withdraw(request)).command).toEqual(first.command);
  expect(await snapshot()).toEqual(before);
});
test('REVIEW-03 deleted/missing/wrong media fail approve; revise still works and preserves submission', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  const before = await M.Attempt.findById(a._id).lean();
  mediaReader.mockResolvedValue([]);
  await expect(service.review({ identity: parent, packageId, attemptId: String(a._id), body })).rejects.toMatchObject({ code: 'AI2_MEDIA_UNAVAILABLE' });
  mediaReader.mockRejectedValue(new Error('private media endpoint'));
  await expect(service.review({ identity: parent, packageId, attemptId: String(a._id), body })).rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE' });
  mediaReader.mockImplementation(async q => q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 100, status: 'deleted' })));
  await expect(service.review({ identity: parent, packageId, attemptId: String(a._id), body })).rejects.toMatchObject({ code: 'AI2_MEDIA_UNAVAILABLE' });
  await service.review({ identity: parent, packageId, attemptId: String(a._id), body: { ...body, decision: 'revise', comment: 'Please upload again' } });
  const after = await M.Attempt.findById(a._id).lean();
  for (const key of ['note', 'mediaIds', 'mediaBindings', 'payloadHash', 'submittedAt', 'submittedBy']) expect(after[key]).toEqual(before[key]);
});
test('IDEM/RECOVER local transaction rollback then unknown commit replay preserves one command', async () => {
  const body = await publishBody(await approved()); delete body.childSnapshot;
  const rollback = makeService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose,
    work: async session => { await work(session); throw new Error('synthetic rollback'); } }) });
  await expect(rollback.publish({ identity: parent, body })).rejects.toMatchObject({ statusCode: 503 });
  expect(await M.Package.countDocuments()).toBe(0); expect(await M.Command.countDocuments()).toBe(0);
  const unknown = makeService({ transactionRunner: async work => { await runMongoTransaction({ mongooseInstance: mongoose, work }); throw new Error('lost commit response'); } });
  await expect(unknown.publish({ identity: parent, body })).rejects.toMatchObject({ statusCode: 503 });
  const replay = await service.publish({ identity: parent, body });
  expect(await M.Package.countDocuments()).toBe(1); expect(await M.Command.countDocuments()).toBe(1);
  const list = await service.listCommands({ identity: parent, childId: child.id });
  expect(list.items.map(c => c.id)).toEqual([replay.command.id]);
  expect((await service.getCommand({ identity: parent, commandId: replay.command.id })).command.phase).toBe('SUCCEEDED');
  await expect(service.getCommand({ identity: coparent, commandId: replay.command.id })).rejects.toMatchObject({ statusCode: 404 });
  await expect(service.publish({ identity: parent, body: { ...body, artifactVersion: 99 } })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
test('OFF-01 new writes disabled but authorized history/replay/withdraw stay available', async () => {
  const { result, body } = await publish(), packageId = result.package.id;
  config.enabled = false;
  await expect(service.publish({ identity: parent, body: { ...body, operationId: randomUUID() } })).rejects.toMatchObject({ code: 'AI2_DISABLED' });
  expect((await service.publish({ identity: parent, body })).command.id).toBe(result.command.id);
  expect((await service.getPackage({ identity: child, packageId })).package.id).toBe(packageId);
  await service.withdraw({ identity: parent, packageId, body: { ...cmd(), expectedPackageVersion: 1, reason: 'Stop' } });
  const defaults = createAi2Service();
  await expect(defaults.publish({ identity: parent, body: { ...body, operationId: randomUUID() } })).rejects.toMatchObject({ code: 'AI2_DISABLED' });
});
test('OFF-02 missing unique index refuses mutation without repairing it', async () => {
  const body = await publishBody(await approved()); delete body.childSnapshot;
  await M.Package.collection.dropIndex('ai2_active_publication');
  try {
    await expect(service.publish({ identity: parent, body })).rejects.toMatchObject({ code: 'AI2_NOT_READY' });
    expect(await M.Package.countDocuments()).toBe(0);
  } finally { await M.Package.createIndexes(); }
});
test.each(['candidate', 'rejected', 'closed', 'generating'])('PUB-02 cycle %s is never publishable', async status => {
  const cycleId = await approved(); await A.Cycle.updateOne({ _id: cycleId }, { $set: { status } });
  await expect(service.preview({ identity: parent, cycleId })).rejects.toMatchObject({ code: 'AI2_PUBLICATION_STALE' });
  expect(await M.Package.countDocuments()).toBe(0);
});
test.each([true, false])('PUB-03 true transaction competition with AI1 close, publishFirst=%s', async publishFirst => {
  const cycleId = await approved(), body = await publishBody(cycleId); delete body.childSnapshot;
  let firstReady, release, entered;
  const ready = new Promise(resolve => { firstReady = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const second = new Promise(resolve => { entered = resolve; });
  const runner = first => work => runMongoTransaction({ mongooseInstance: mongoose, work: async session => {
    if (!first) entered(); const result = await work(session); if (first) { firstReady(); await held; } return result;
  } });
  const publisher = makeService({ transactionRunner: runner(publishFirst) });
  const closer = createAi1Service({ transactionRunner: runner(!publishFirst) });
  const close = () => closer.close({ identity: coparent, cycleId, body: { schemaVersion: 'ai1-min-v1', operationId: randomUUID(),
    expectedCycleStateVersion: body.expectedCycleStateVersion, reason: 'Close concurrently' } });
  const pub = () => publisher.publish({ identity: parent, body });
  const first = (publishFirst ? pub() : close()).then(value => ({ value }), error => ({ error }));
  await ready;
  const next = (publishFirst ? close() : pub()).then(value => ({ value }), error => ({ error }));
  try { await second; } finally { release(); }
  const results = await Promise.all([first, next]);
  expect(results[0].error).toBeUndefined(); expect(results[1].error.statusCode).toBe(409);
  expect(await M.Package.countDocuments()).toBe(publishFirst ? 1 : 0);
  expect((await A.Cycle.findById(cycleId)).status).toBe(publishFirst ? 'approved' : 'closed');
});
test('REVIEW-02 rolled back audit is absent; committed unknown replay keeps original reviewer and one result', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  const args = { identity: coparent, packageId, attemptId: String(a._id), body };
  const rollback = makeService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose,
    work: async session => { await work(session); throw new Error('rollback audit'); } }) });
  await expect(rollback.review(args)).rejects.toMatchObject({ statusCode: 503 });
  expect((await M.Attempt.findById(a._id)).review).toBeNull();
  expect((await M.Package.findById(packageId)).learningState).toBe('submitted');
  const unknown = makeService({ transactionRunner: async work => { await runMongoTransaction({ mongooseInstance: mongoose, work }); throw new Error('unknown commit'); } });
  await expect(unknown.review(args)).rejects.toMatchObject({ statusCode: 503 });
  const before = (await M.Attempt.findById(a._id)).review;
  const replay = await service.review(args);
  expect(replay.attempt.review.reviewerId).toBe(coparent.id);
  expect((await M.Attempt.findById(a._id)).review).toEqual(before);
  expect(await M.Command.countDocuments({ endpointOperation: 'ai2.review' })).toBe(1);
});
test('WITHDRAW-02 withdraw during media pre-read prevents review without clearing pending ownership', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  let ready, release; const inspected = new Promise(resolve => { ready = resolve; }), held = new Promise(resolve => { release = resolve; });
  const original = mediaReader.getMockImplementation();
  mediaReader.mockImplementationOnce(async q => { ready(); await held; return original(q); });
  const reviewing = service.review({ identity: parent, packageId, attemptId: String(a._id), body }).catch(e => e);
  await inspected;
  const withdrawn = await service.withdraw({ identity: coparent, packageId,
    body: { ...cmd(), expectedPackageVersion: body.expectedPackageVersion, reason: 'Do not publish review' } });
  release(); expect((await reviewing).code).toBe('AI2_REVIEW_CONFLICT');
  expect(withdrawn.package.visibility).toBe('withdrawn'); expect((await M.Attempt.findById(a._id)).review).toBeNull();
});
test('GET package/history/command/list have zero persisted side effects and child historical review is redacted', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  await service.review({ identity: parent, packageId, attemptId: String(a._id), body });
  const snapshot = async () => JSON.stringify(await Promise.all(Object.values(M).map(m => m.find().sort({ _id: 1 }).lean())));
  const before = await snapshot();
  const details = await service.getPackage({ identity: child, packageId });
  expect(details.package.learningState).toBe('approved'); expect(details.package.attempts[0].review).toEqual(expect.objectContaining({ decision: 'approve' }));
  for (const key of ['reviewerId', 'mediaEvidence', 'bindingOperationId', 'submitCommandId', 'attemptPayloadHash']) expect(JSON.stringify(details)).not.toContain(key);
  await service.getAttempt({ identity: child, packageId, attemptId: String(a._id) });
  await service.listAttempts({ identity: child, packageId }); await service.listPackages({ identity: child });
  await service.listCommands({ identity: parent, childId: child.id }); await service.getCommand({ identity: parent, commandId: result.command.id });
  expect(await snapshot()).toBe(before);
});
test('AI3 source review hash is parent-only, persisted-review based and independent of media availability', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  await service.review({ identity: parent, packageId, attemptId: String(a._id), body });
  const persisted = await M.Attempt.findById(a._id).lean();
  const expected = C.hash(JSON.parse(JSON.stringify(persisted.review)));
  const before = JSON.stringify(await M.Attempt.findById(a._id).lean());
  const p = await service.getAttempt({ identity: parent, packageId, attemptId: String(a._id) });
  expect(p.attempt.sourceReviewHash).toBe(expected);
  mediaReader.mockImplementation(async q => q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 100, status: 'deleted' })));
  const deleted = await service.getAttempt({ identity: parent, packageId, attemptId: String(a._id) });
  expect(deleted.attempt.media[0].status).toBe('deleted');
  expect(deleted.attempt.sourceReviewHash).toBe(expected);
  const c = await service.getAttempt({ identity: child, packageId, attemptId: String(a._id) });
  expect(c.attempt).not.toHaveProperty('sourceReviewHash');
  expect(JSON.stringify(await M.Attempt.findById(a._id).lean())).toBe(before);
});
test('review never approves an empty persisted correction even when the media port returns empty', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  await M.Attempt.collection.updateOne({ _id: a._id }, { $set: { mediaIds: [], mediaBindings: [] } });
  await expect(service.review({ identity: parent, packageId, attemptId: String(a._id), body })).rejects.toMatchObject({ code: 'AI2_MEDIA_UNAVAILABLE' });
  expect((await M.Attempt.findById(a._id)).review).toBeNull();
});
test.each(['missing', 'unavailable'])('review P2 durable revise/withdraw and replay do not depend on %s media details', async failure => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  if (failure === 'missing') mediaReader.mockResolvedValue([]);
  else mediaReader.mockRejectedValue(new Error('media unavailable'));
  const args = { identity: parent, packageId, attemptId: String(a._id), body: { ...body, decision: 'revise', comment: 'Please submit again' } };
  const revised = await service.review(args); expect(revised.command.phase).toBe('SUCCEEDED');
  expect(revised.attempt).not.toHaveProperty('media'); expect(revised.package).not.toHaveProperty('attempts');
  expect((await service.review(args)).command.id).toBe(revised.command.id);
  const withdrawArgs = { identity: parent, packageId, body: { ...cmd(), expectedPackageVersion: revised.package.stateVersion, reason: 'Stop' } };
  const withdrawn = await service.withdraw(withdrawArgs);
  expect(withdrawn.package.visibility).toBe('withdrawn');
  expect((await service.withdraw(withdrawArgs)).command.id).toBe(withdrawn.command.id);
  expect(await M.Command.countDocuments({ endpointOperation: 'ai2.review' })).toBe(1);
  expect(await M.Command.countDocuments({ endpointOperation: 'ai2.withdraw' })).toBe(1);
  await expect(service.getAttempt({ identity: parent, packageId, attemptId: String(a._id) })).rejects.toMatchObject({ code:
    failure === 'missing' ? 'AI2_MEDIA_UNAVAILABLE' : 'MEDIA_SERVICE_UNAVAILABLE' });
});
test('review P2 approve checks media before commit exactly once; replay does not recheck unavailable media', async () => {
  const { result } = await publish(), packageId = result.package.id, { a, body } = await submitted(packageId);
  const original = mediaReader.getMockImplementation(); mediaReader.mockReset();
  mediaReader.mockImplementationOnce(original).mockRejectedValue(new Error('after commit unavailable'));
  const args = { identity: parent, packageId, attemptId: String(a._id), body };
  const approved = await service.review(args);
  expect(approved.package.learningState).toBe('approved'); expect(mediaReader).toHaveBeenCalledTimes(1);
  expect((await service.review(args)).command.id).toBe(approved.command.id); expect(mediaReader).toHaveBeenCalledTimes(1);
});
