const { randomUUID } = require('crypto');
const FormData = require('form-data');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');

// Only the already-approved AI2 source is seeded. AI3, media, proof and both
// consumers use the production factories over real HTTP and real transactions.
// AI1 stays off; this suite does not claim to exercise the AI1 -> AI2 bridge.
let runtime, fixture, parent, coparent, child, sibling, outsider, A, M, C;
const wire = [];
const envelope = () => ({ schemaVersion: 'ai3-min-v1', operationId: randomUUID() });
const plain = value => JSON.parse(JSON.stringify(value));
const effectPaths = { mistake: '/api/internal/ai3/mistake-review-effects', mastery: '/api/internal/ai3/mastery-effects' };
const serviceNames = { mistake: 'analytics-service', mastery: 'progress-service' };

beforeAll(async () => {
  runtime = await createT2Runtime({ beforeStart: () => Object.assign(process.env,
    { AI3_MODE: 'enabled', AI3_STORE_CONTINUOUS: 'true', AI2_STORE_CONTINUOUS: 'true' }) });
  fixture = await runtime.seed();
  [parent, coparent, child, sibling, outsider] = await Promise.all(
    ['parent', 'coparent', 'child', 'sibling', 'outsider'].map(runtime.login));
  A = require('../../services/homework-service/models/Ai2');
  M = require('../../services/homework-service/models/Ai3');
  C = require('../../services/homework-service/services/ai3Contract');
  for (const { name, server } of runtime.servers) server.prependListener('request', (req, res) => {
    if (!req.url.startsWith('/api/internal/ai3/')) return;
    const entry = { service: name, method: req.method, path: req.url };
    wire.push(entry);
    res.on('finish', () => { entry.status = res.statusCode; });
  });
  expect(process.env.AI1_MODE).toBe('off');
  expect(runtime.prechecks).toEqual(expect.arrayContaining(['ai3-progress', 'ai3-analytics', 'homework', 'resource']));
  expect(runtime.modelConnectionsMatch).toBe(true);
});
afterAll(async () => {
  try {
    if (M) {
      expect(await M.Command.countDocuments({ endpointOperation: 'ai3.generate' })).toBe(0);
      expect(await require('../../services/homework-service/models/Ai1').Job.countDocuments()).toBe(0);
    }
  } finally { await runtime?.stop(); }
});

async function prepare(sourceType = 'mistake') {
  const childId = fixture.actors.child.childId, actorId = fixture.actors.parent.userId;
  const point = expectData(await parent.post('/api/knowledge-points', { childId, dimension: 'academic',
    subject: 'Math', name: 'Synthetic AI3 review ' + randomUUID(), masteryLevel: 'learning' }), 201).knowledgePoint;
  const mistake = expectData(await parent.post('/api/mistakes', { childId, subject: 'Math', reason: 'calculation',
    knowledgePointId: point.knowledgePointId, questionMediaIds: [], childAnswerMediaIds: [] }), 201).mistake;
  if (sourceType === 'task') expectData(await parent.patch('/api/growth-tasks/' + fixture.tasks.child.taskId, { subject: 'Math' }));
  const id = () => String(new A.Package.db.base.Types.ObjectId());
  const childSnapshot = { questionText: '124 * 23', explanationText: 'Synthetic approved source', chapter: {
    provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
    chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' } };
  const pkg = await A.Package.create({ familyId: fixture.familyId, childId, ai1CycleId: id(),
    source: { type: sourceType, id: sourceType === 'mistake' ? mistake.mistakeId : fixture.tasks.child.taskId, subject: 'math' },
    artifact: { id: id(), version: 1, contentHash: C.hash('seed') },
    childSnapshot, childSnapshotHash: C.hash(childSnapshot), publishedBy: actorId, publishedAt: new Date(),
    visibility: 'published', learningState: 'approved', stateVersion: 3 });
  const sourceAttempt = await A.Attempt.create({ familyId: fixture.familyId, childId, packageId: pkg._id,
    attemptVersion: 1, submitCommandId: id(), submittedBy: childId, submittedAt: new Date(), note: '',
    mediaIds: [id()], mediaBindings: [], payloadHash: C.hash('synthetic-approved-source'),
    review: { decision: 'approve', reviewerId: actorId, reviewedAt: new Date().toISOString() } });
  await A.Package.updateOne({ _id: pkg._id }, { $set: { currentAttemptId: sourceAttempt._id, currentAttemptVersion: 1 } });
  const created = expectData(await parent.post('/api/ai3/practice-rounds', { ...envelope(), sourcePackageId: String(pkg._id),
    expectedSourcePackageVersion: 3, sourceAttemptId: String(sourceAttempt._id), expectedSourceAttemptVersion: 1,
    sourceAttemptPayloadHash: sourceAttempt.payloadHash, sourceReviewHash: C.hash(sourceAttempt.review),
    exerciseCount: 2, knowledgePointId: point.knowledgePointId }), 201);
  const roundId = created.command.roundId, path = '/api/ai3/practice-rounds/' + roundId;
  const draft = expectData(await parent.get(path)).round;
  expectData(await parent.post(path + '/content-revisions', { ...envelope(), expectedRoundVersion: draft.stateVersion,
    expectedContentId: null, expectedContentVersion: null, expectedContentHash: null, reason: 'Synthetic manual questions',
    content: { instructions: 'Show partial products.', exercises: [1, 2].map(n => ({ exerciseId: 'q' + n,
      questionText: '132 * 24', answerForParent: '3168', rubricForParent: 'Check place value.' })) } }), 201);
  const { content, childSnapshot: projection, roundId: previewId, ...preview } = expectData(await parent.get(path + '/publication-preview')).preview;
  expect(previewId).toBe(roundId); expect(content.exercises).toHaveLength(2); expect(projection.exercises).toHaveLength(2);
  expectData(await parent.post(path + '/publish', { ...envelope(), ...preview, childContentConfirmed: true, answersChecked: true }), 201);
  const published = expectData(await child.get(path)).round;
  const form = new FormData(); form.append('purpose', 'ai3_practice');
  form.append('file', fixture.image.bytes, { filename: fixture.image.name, contentType: fixture.image.mimeType });
  const mediaId = expectData(await child.post('/api/media', form, { headers: form.getHeaders() }), 201).media.mediaId;
  const submission = { ...envelope(), expectedRoundVersion: published.stateVersion, contentId: published.contentId,
    contentVersion: published.contentVersion, childSnapshotHash: published.childSnapshotHash, note: 'Synthetic full working', mediaIds: [mediaId] };
  expectData(await child.post(path + '/attempts', submission), 201);
  const detail = expectData(await parent.get(path)).round, attemptId = detail.currentAttemptId;
  const reviewPath = `${path}/attempts/${attemptId}/review`;
  const context = expectData(await parent.get(reviewPath + '-context'));
  const { roundId: ignoredRound, attemptId: ignoredAttempt, targets, ...binding } = context;
  expect(ignoredRound).toBe(roundId); expect(ignoredAttempt).toBe(attemptId);
  if (sourceType === 'mistake') expect(targets.mistake.id).toBe(mistake.mistakeId);
  else expect(targets.mistake).toBeNull();
  expect(targets.knowledgePoint.id).toBe(point.knowledgePointId);
  return { roundId, path, reviewPath, attemptId, mediaId, pointId: point.knowledgePointId, mistakeId: mistake.mistakeId,
    submission, body: { ...envelope(), ...binding, decision: 'approve', comment: 'Both checked.',
      evidenceSummary: 'Every exercise and partial product checked.', masteryConfirmed: true, reviewReminderDate: '2026-11-08' } };
}

const row = commandId => M.Command.findById(commandId).lean();
const review = async (f, actor = parent, status = 200) => expectData(await actor.post(f.reviewPath, f.body), status);
const recover = (f, id, actor = parent) => actor.post(`/api/ai3/commands/${id}/recover`,
  { schemaVersion: f.body.schemaVersion, operationId: f.body.operationId });
const receipts = async command => {
  const snapshot = await runtime.snapshot();
  return ['Ai3MistakeReceipt', 'Ai3MasteryReceipt'].map((key, i) => snapshot.database[key].filter(receipt =>
    receipt.effectId === command.finalReview.targets[i ? 'knowledgePoint' : 'mistake']?.effectId));
};
async function assertEffectsOnce(command) {
  const both = await receipts(command), snapshot = await runtime.snapshot();
  for (const [i, entries] of both.entries()) {
    if (!command.finalReview.targets[i ? 'knowledgePoint' : 'mistake']) { expect(entries).toEqual([]); continue; }
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: 'applied', reviewedByParentId: fixture.actors.parent.userId,
      finalReviewId: command.finalReview.id, finalReviewHash: command.finalReviewHash });
    const events = snapshot.database[i ? 'KnowledgePointMasteryEvent' : 'MistakeStateEvent'];
    expect(events.filter(event => event._id === entries[0].eventId)).toHaveLength(1);
  }
}

test('formal proof and both consumers apply once; terminal GETs have no database or media writes', async () => {
  const f = await prepare(), start = wire.length, result = await review(f), saved = await row(result.command.id);
  expect(result.command.phase).toBe('SUCCEEDED');
  await assertEffectsOnce(saved);
  for (const kind of ['mistake', 'mastery']) {
    expect(wire.slice(start).filter(w => w.method === 'POST' && w.path === effectPaths[kind])).toHaveLength(1);
    const effectId = saved.finalReview.targets[kind === 'mastery' ? 'knowledgePoint' : 'mistake'].effectId;
    expect(wire.slice(start).filter(w => w.service === 'homework-service' && w.method === 'GET'
      && w.path.includes('/final-reviews/') && w.path.includes(effectId))).toEqual([expect.objectContaining({ status: 200 })]);
  }
  const before = await runtime.snapshot();
  for (const actor of [parent, coparent, child]) expectData(await actor.get(f.path));
  expectData(await parent.get('/api/ai3/commands/' + saved._id));
  expectData(await parent.get(`/api/ai3/commands?childId=${fixture.actors.child.childId}&scope=mine`));
  expect(await runtime.snapshot()).toEqual(before);
});

test.each([['mistake', 'mistake'], ['mastery', 'mistake'], ['mastery', 'task']])(
  '%s commit loses HTTP response with %s source; original receipt recovers without a second apply', async (kind, sourceType) => {
  const f = await prepare(sourceType), start = wire.length;
  runtime.dropNextResponse({ service: serviceNames[kind], method: 'POST', path: effectPaths[kind] });
  const result = await review(f, parent, 202), saved = await row(result.command.id);
  expect(result.command.phase).toBe('EFFECTS_PENDING'); expect(saved.effects[kind].status).toBe('unknown');
  expect(saved.effects[kind === 'mistake' ? 'mastery' : 'mistake'].status).toBe(sourceType === 'task' ? 'not_requested' : 'applied');
  await assertEffectsOnce(saved);
  expect(runtime.droppedResponses).toContainEqual({ service: serviceNames[kind], method: 'POST', path: effectPaths[kind], status: 200 });
  const before = await runtime.snapshot();
  expectData(await parent.get('/api/ai3/commands/' + saved._id)); expectData(await parent.get(f.path));
  expect((await recover(f, saved._id, coparent)).status).toBe(404);
  expect(await runtime.snapshot()).toEqual(before);
  // Use the production lease and real time; never force a command owner/phase in Mongo.
  await new Promise(resolve => setTimeout(resolve, Math.max(0, new Date(saved.leaseExpiresAt).getTime() - Date.now()) + 50));
  const recovered = expectData(await recover(f, saved._id));
  expect(recovered.command.phase).toBe('SUCCEEDED');
  const after = await row(saved._id);
  expect(after.finalReview).toEqual(saved.finalReview); expect(after.finalReviewHash).toBe(saved.finalReviewHash);
  await assertEffectsOnce(after);
  for (const target of ['mistake', 'mastery']) {
    expect(wire.slice(start).filter(w => w.method === 'POST' && w.path === effectPaths[target]))
      .toHaveLength(target === 'mistake' && sourceType === 'task' ? 0 : 1);
  }
  const effectId = saved.finalReview.targets[kind === 'mistake' ? 'mistake' : 'knowledgePoint'].effectId;
  expect(wire.slice(start).some(w => w.method === 'GET' && w.path.startsWith(effectPaths[kind] + '/' + effectId))).toBe(true);
  const settled = await runtime.snapshot();
  expectData(await recover(f, saved._id)); expectData(await parent.post(f.reviewPath, f.body));
  expect(await runtime.snapshot()).toEqual(settled);
});

test('real target revision invalidates the prior review context without finalReview or effects', async () => {
  const f = await prepare('task');
  expectData(await coparent.patch('/api/knowledge-points/' + f.pointId, { masteryLevel: 'basic' }));
  const before = await runtime.snapshot();
  const rejected = await parent.post(f.reviewPath, f.body);
  expect(rejected.status).toBe(409); expect(rejected.data.error.code).toBe('AI3_VERSION_CONFLICT');
  expect(await runtime.snapshot()).toEqual(before);
  expect(await M.Command.countDocuments({ roundId: f.roundId, endpointOperation: 'ai3.review' })).toBe(0);
});

test('target changes after final proof is read: consumer records conflict without overwriting the newer state', async () => {
  const f = await prepare('task');
  const server = runtime.servers.find(s => s.name === 'homework-service').server;
  let mutation, intercepted = 0;
  const gate = (req, res) => {
    if (!req.url.startsWith('/api/internal/ai3/final-reviews/') || intercepted) return;
    intercepted++;
    const end = res.end.bind(res);
    // Deliver the genuine proof unchanged, but only after a real co-parent HTTP
    // mutation commits. No consumer/service return value is replaced.
    res.end = (...args) => {
      mutation = coparent.patch('/api/knowledge-points/' + f.pointId, { masteryLevel: 'needs_review' })
        .then(response => { expectData(response); return end(...args); });
      mutation.catch(() => res.destroy());
      return res;
    };
  };
  server.prependListener('request', gate);
  try {
    const result = await review(f);
    await mutation;
    expect(intercepted).toBe(1); expect(result.command.phase).toBe('SUCCEEDED');
    const saved = await row(result.command.id), snapshot = await runtime.snapshot();
    expect(saved.effects.mastery.status).toBe('not_applied_conflict');
    const receipt = snapshot.database.Ai3MasteryReceipt.filter(r => r.effectId === saved.finalReview.targets.knowledgePoint.effectId);
    expect(receipt).toHaveLength(1); expect(receipt[0]).toMatchObject({ status: 'not_applied_conflict', eventId: null });
    expect(snapshot.database.KnowledgePoint.find(p => p._id === f.pointId).masteryLevel).toBe('needs_review');
    expect(saved.finalReview.reviewedByParentId).toBe(fixture.actors.parent.userId);
    expectData(await recover(f, saved._id));
    expect(await runtime.snapshot()).toEqual(snapshot);
  } finally { server.removeListener('request', gate); }
});

test('co-parent cannot take over first actor command or duplicate its final review', async () => {
  const f = await prepare('task'), result = await review(f), saved = await row(result.command.id), before = await runtime.snapshot();
  expect((await coparent.get('/api/ai3/commands/' + saved._id)).status).toBe(404);
  expect((await recover(f, saved._id, coparent)).status).toBe(404);
  expect((await coparent.post(f.reviewPath, f.body)).status).toBe(409);
  expect((await coparent.post(f.reviewPath, { ...f.body, operationId: randomUUID() })).status).toBe(409);
  expectData(await parent.post(f.reviewPath, f.body));
  expect(await runtime.snapshot()).toEqual(before);
  expect(String(saved.finalReview.reviewedByParentId)).toBe(fixture.actors.parent.userId);
});

test('real PIN reset revokes the old child token before round reads or submissions', async () => {
  const f = await prepare('task'), stale = child;
  expectData(await parent.post(`/api/children/${fixture.actors.child.childId}/pin`, { pin: fixture.actors.child.pin }));
  const before = await runtime.snapshot();
  try {
    expect((await stale.get(f.path)).status).toBe(401);
    expect((await stale.post(f.path + '/attempts', { ...f.submission, operationId: randomUUID() })).status).toBe(401);
    expect(await runtime.snapshot()).toEqual(before);
  } finally { child = await runtime.login('child'); }
  expectData(await child.get(f.path));
});

test('sibling and foreign family cannot read or review another child round, media or proof', async () => {
  const f = await prepare('task'), result = await review(f), saved = await row(result.command.id), before = await runtime.snapshot();
  for (const actor of [sibling, outsider]) {
    expect((await actor.get(f.path)).status).toBe(404);
    expect([403, 404]).toContain((await actor.get(`/api/media/${f.mediaId}/access`)).status);
    expect([403, 404]).toContain((await actor.post(f.reviewPath, f.body)).status);
  }
  const effectId = saved.finalReview.targets.knowledgePoint.effectId;
  const proof = `/api/internal/ai3/final-reviews/${saved.finalReview.id}?familyId=${fixture.familyId}&childId=${fixture.actors.child.childId}&effectId=${effectId}`;
  expect((await fetch(runtime.urls['homework-service'] + proof)).status).toBe(401);
  expect((await parent.get(proof)).status).toBe(404);
  const headers = { 'x-ai3-evidence-token': process.env.AI3_EVIDENCE_TOKEN };
  expect((await fetch(runtime.urls['homework-service'] + proof, { headers })).status).toBe(200);
  expect((await fetch(runtime.urls['homework-service'] + proof.replace(fixture.actors.child.childId,
    fixture.actors.sibling.childId), { headers })).status).toBe(404);
  expect(await runtime.snapshot()).toEqual(before);
});

test('normal privacy deletion removes media access, not finalReview or applied effects; subsequent GETs stay read-only', async () => {
  const f = await prepare('task'), result = await review(f), saved = await row(result.command.id);
  expectData(await child.get(`/api/media/${f.mediaId}/access`));
  const before = await runtime.snapshot();
  expect((await child.delete('/api/media/' + f.mediaId)).status).toBe(204);
  const deleted = await runtime.snapshot();
  for (const key of ['Ai3Round', 'Ai3Attempt', 'Ai3Command', 'Ai3MistakeReceipt', 'Ai3MasteryReceipt',
    'Mistake', 'MistakeStateEvent', 'KnowledgePoint', 'KnowledgePointMasteryEvent', 'Ledger']) {
    expect(deleted.database[key]).toEqual(before.database[key]);
  }
  expect(deleted.database.Tombstone.filter(r => r.mediaId === f.mediaId)).toHaveLength(1);
  expect((await parent.get(`/api/media/${f.mediaId}/access`)).status).toBe(404);
  expectData(await child.get(f.path)); expectData(await parent.get(f.path));
  expectData(await parent.get('/api/ai3/commands/' + saved._id));
  expect((await coparent.delete('/api/media/' + f.mediaId)).status).toBe(204);
  expect(await runtime.snapshot()).toEqual(deleted);
  expect(plain((await row(saved._id)).finalReview)).toEqual(plain(saved.finalReview));
});
