const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const A = require('../../models/Ai2');
const M = require('../../models/Ai3');
const C = require('../../services/ai3Contract');
const { createAi3Service } = require('../../services/ai3Service');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { referenceSetHash } = require('../../../../common/services/completionMediaProtocol');
const id = () => String(new mongoose.Types.ObjectId());
const transact = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const envelope = () => ({ schemaVersion: 'ai3-min-v1', operationId: randomUUID() });
let child, parent, sibling, outsider, family, pkg, round, content, body, clock, runtime, client, inspector, remote;
const factory = extra => createAi3Service({ getRuntime: () => runtime, now: () => clock,
  mediaReferenceClient: client, mediaInspectClient: inspector, submissionLeaseMs: 1000, ...extra });
const submit = (service = factory(), input = body, actor = child) => service.submit({ identity: actor, roundId: String(round._id), body: input });
const row = () => M.Command.findOne({ endpointOperation: 'ai3.submit' }).lean();
const recover = (c, service = factory(), actor = child) => service.recover({ identity: actor, commandId: String(c._id),
  body: { schemaVersion: 'ai3-min-v1', operationId: c.operationId } });
const getAttempt = (a, actor = child, service = factory()) => service.getAttempt({ identity: actor, roundId: String(round._id), attemptId: String(a._id) });
const scope = q => ({ resourceType: 'ai3_attempt', resourceId: q.resourceId, field: 'practiceMediaIds' });
function reply(q, state) {
  return { operation: { ...scope(q), operationId: q.remoteOperationId, state,
    commandHash: state === 'ABSENT' ? null : q.commandHash,
    referenceSetHash: state === 'ABSENT' ? null : referenceSetHash({ ...q,
      references: [...q.references].sort((a, b) => a.mediaId.localeCompare(b.mediaId)) }),
    leaseExpiresAt: state === 'PREPARED' ? new Date(clock + 60000).toISOString() : null,
    leaseExpired: state === 'PREPARED' ? false : null, failureCode: state === 'ABORTED' ? 'MEDIA_OPERATION_ABORTED' : null },
  references: q.references.map(r => ({ ...scope(q), ...r,
    state: { ABSENT: 'absent', PREPARED: 'prepared', COMMITTED: 'bound', ABORTED: 'released' }[state],
    ...(state === 'ABSENT' ? {} : { bindingOperationId: q.remoteOperationId }), privacyDeletion: null })) };
}
async function pending(state = 'ABSENT') {
  client.status.mockImplementationOnce(async q => { remote.set(q.remoteOperationId, reply(q, state)); throw new Error('lost status'); });
  expect((await submit()).pending).toBe(true); return row();
}
const expire = c => { clock = Number(c.leaseExpiresAt) + 1; };
const withdrawAncestor = () => A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
beforeAll(async () => { for (const model of [...Object.values(M), ...Object.values(A), Family, User]) await model.init(); });
beforeEach(async () => {
  clock = Date.parse('2026-11-04T00:00:00Z'); runtime = { enabled: true, continuousStore: true }; remote = new Map();
  parent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic submission', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [child.id, sibling.id] });
  await Family.create({ familyName: 'Other synthetic', ownerParentId: outsider.id, memberParentIds: [outsider.id] });
  for (const actor of [child, sibling]) Object.assign(actor, { childId: actor.id, familyId: String(family._id) });
  await User.collection.insertMany([parent, outsider, child, sibling].map(actor => ({ _id: new mongoose.Types.ObjectId(actor.id),
    role: actor.role, username: actor.id, ...(actor.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  const chapter = { subject: 'math', grade: 4, term: 'upper', provenance: 'parent_declared', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' };
  pkg = await A.Package.create({ familyId: family._id, childId: child.id, ai1CycleId: id(), source: { type: 'task', id: id() },
    artifact: { id: id() }, childSnapshot: { chapter }, childSnapshotHash: C.hash({ chapter }), publishedBy: parent.id,
    publishedAt: new Date(clock), visibility: 'published', learningState: 'approved', stateVersion: 3 });
  const a = await A.Attempt.create({ familyId: family._id, childId: child.id, packageId: pkg._id, attemptVersion: 1,
    submitCommandId: id(), submittedBy: child.id, submittedAt: new Date(clock), note: '', mediaIds: [id()], mediaBindings: [],
    payloadHash: 'b'.repeat(64), review: { decision: 'approve', reviewerId: parent.id, reviewedAt: new Date(clock).toISOString() } });
  await A.Package.updateOne({ _id: pkg._id }, { $set: { currentAttemptId: a._id, currentAttemptVersion: 1 } });
  round = await M.Round.create({ familyId: family._id, childId: child.id, sourcePackageId: pkg._id, sourceAttemptId: a._id,
    sourceAttemptVersion: 1, sourceAttemptPayloadHash: a.payloadHash, sourceReviewHash: C.hash(a.review), source: pkg.source,
    chapter, exerciseCount: 2, createdBy: parent.id, stateVersion: 3, active: true, preparation: 'candidate',
    visibility: 'published', learningState: 'open', publishedAt: new Date(clock), publishedBy: parent.id });
  const value = { instructions: 'Show steps.', exercises: ['q1', 'q2'].map(exerciseId => ({ exerciseId,
    questionText: '132 * 24', answerForParent: 'SECRET_3168', rubricForParent: 'SECRET_RUBRIC' })) };
  content = await M.Content.create({ familyId: family._id, childId: child.id, roundId: round._id, version: 1,
    content: value, contentHash: C.hash(value), childSnapshot: C.childSnapshot(value), childSnapshotHash: C.hash(C.childSnapshot(value)),
    createdBy: parent.id, origin: 'parent_manual', reason: 'Synthetic approved fixture' });
  await M.Round.updateOne({ _id: round._id }, { $set: { currentContentId: content._id, currentContentVersion: 1,
    currentContentHash: content.contentHash, publication: { contentId: String(content._id), contentVersion: 1,
      contentHash: content.contentHash, childSnapshotHash: content.childSnapshotHash, actorId: parent.id } } });
  body = { ...envelope(), expectedRoundVersion: 3, contentId: String(content._id), contentVersion: 1,
    childSnapshotHash: content.childSnapshotHash, note: '', mediaIds: [id(), id()] };
  client = {
    status: jest.fn(async q => remote.get(q.remoteOperationId) || reply(q, 'ABSENT')),
    prepare: jest.fn(async q => { const result = reply(q, 'PREPARED'); remote.set(q.remoteOperationId, result); return result; }),
    commit: jest.fn(async q => { const result = reply(q, 'COMMITTED'); remote.set(q.remoteOperationId, result); return result; }),
    abort: jest.fn(async q => { const prior = remote.get(q.remoteOperationId); if (prior?.operation.state === 'COMMITTED') return prior;
      const result = reply(q, 'ABORTED'); remote.set(q.remoteOperationId, result); return result; }),
    unbind: jest.fn(async q => ({ operation: null, references: q.references.map(ref => ({ ...scope(q), ...ref, state: 'released', privacyDeletion: null })) }))
  };
  inspector = { inspect: jest.fn(async q => q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42, status: 'available' }))) };
});

test('closed client submit contract accepts child snapshot and rejects parent hashes/duplicate or invalid image sets', () => {
  expect(C.normalize('submit', body)).toEqual(body);
  for (const invalid of [{ ...body, contentHash: content.contentHash }, { ...body, fullContentHash: content.contentHash },
    { ...body, mediaIds: [] }, { ...body, mediaIds: [id(), ...Array.from({ length: 10 }, id)] },
    { ...body, mediaIds: [body.mediaIds[0], body.mediaIds[0]] }, { ...body, contentVersion: 0 }]) {
    expect(() => C.normalize('submit', invalid)).toThrow('VALIDATION_ERROR');
  }
});
test.each(['x'.repeat(1001), '\uD800', 'line\r\nline'])('persisted noncanonical note fails validation even when rehashed', async note => {
  await submit(); const a = await M.Attempt.findOne().lean();
  a.note = note; a.payloadHash = C.hash({ note, mediaIds: a.mediaIds.map(String), bindings: a.mediaBindings,
    submittedBy: String(a.submittedBy), attemptVersion: a.attemptVersion, serverContentBinding: a.serverContentBinding });
  expect(() => require('../../services/ai3SubmissionService').validateAttempt(a)).toThrow('AI3_MEDIA_UNAVAILABLE');
});
test('client note uses 1000 Unicode code points and persisted refs reject additional fields', async () => {
  expect(() => C.normalize('submit', { ...body, note: 'x'.repeat(1001) })).toThrow('VALIDATION_ERROR');
  expect(C.normalize('submit', { ...body, note: '\u{1f600}'.repeat(1000) }).note).toHaveLength(2000);
  const c = await pending(); c.references[0].extra = 'not canonical';
  c.referencesHash = C.hash({ familyId: String(c.familyId), childId: String(c.childId), resourceType: 'ai3_attempt',
    resourceId: String(c.attemptId), references: c.references, serverContentBinding: c.serverContentBinding });
  expect(() => require('../../services/ai3SubmissionService').validateMapping(c)).toThrow('AI3_COMMAND_PENDING');
});
test('submit binds original content and ordered full references; immutable payload and replay create one Attempt', async () => {
  const result = await submit(), c = await row();
  expect(result.command.phase).toBe('SUCCEEDED');
  expect(c.remoteOperationId).not.toBe(body.operationId);
  expect(c.payload).toEqual(body); expect(c.actorId.toString()).toBe(child.id);
  expect(c.serverContentBinding).toEqual({ contentId: String(content._id), contentVersion: 1,
    fullContentHash: content.contentHash, childSnapshotHash: content.childSnapshotHash });
  expect(c.references).toEqual(body.mediaIds.map(mediaId => ({ mediaId, resourceType: 'ai3_attempt', resourceId: String(c.attemptId),
    field: 'practiceMediaIds', bindingOperationId: c.remoteOperationId })));
  const a = await M.Attempt.findOne().lean();
  expect(a.payloadHash).toBe(C.hash({ note: '', mediaIds: body.mediaIds, bindings: c.references, submittedBy: child.id,
    attemptVersion: 1, serverContentBinding: c.serverContentBinding }));
  expect((await A.Package.findById(pkg._id)).stateVersion).toBe(5);
  expect(await M.Round.findById(round._id).lean()).toMatchObject({ stateVersion: 5, learningState: 'submitted', activeCommandId: null, currentAttemptId: a._id });
  await M.Attempt.updateOne({ _id: a._id }, { $set: { note: 'mutation', serverContentBinding: { ...a.serverContentBinding, contentVersion: 2 } } });
  expect((await M.Attempt.findById(a._id)).note).toBe('');
  expect((await M.Attempt.findById(a._id)).serverContentBinding).toEqual(a.serverContentBinding);
  expect((await submit()).command.id).toBe(result.command.id); expect(await M.Attempt.countDocuments()).toBe(1);
  expect(inspector.inspect).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain(content.contentHash); expect(JSON.stringify(result)).not.toContain('SECRET');
  await expect(submit(factory(), { ...body, note: 'changed' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
test('one-image whole-set submission creates one canonical Attempt', async () => {
  body = { ...body, mediaIds: [body.mediaIds[0]] };
  expect((await submit()).command.phase).toBe('SUCCEEDED');
  const a = await M.Attempt.findOne().lean();
  expect(a.mediaIds.map(String)).toEqual(body.mediaIds); expect(a.mediaBindings).toHaveLength(1);
  expect(require('../../services/ai3SubmissionService').validateAttempt(a)).toBe(a);
});
test('new UUID cannot bypass active command; original actor discovery/recovery excludes parent, sibling and outsider', async () => {
  const c = await pending();
  await expect(submit(factory(), { ...body, operationId: randomUUID() })).rejects.toMatchObject({ statusCode: 409, code: 'AI3_OPERATION_UNRESOLVED' });
  await expect(submit(factory(), { ...body, note: 'changed' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  const listing = await factory().listCommands({ identity: child, childId: child.id });
  expect(listing.items.map(x => x.id)).toEqual([String(c._id)]);
  for (const actor of [parent, sibling, outsider]) await expect(recover(c, factory(), actor)).rejects.toMatchObject({ statusCode: 404 });
  expect((await factory().listCommands({ identity: parent, childId: child.id })).items).toEqual([]);
  expire(c); expect((await recover(c)).command.phase).toBe('SUCCEEDED');
  expect((await row()).remoteOperationId).toBe(c.remoteOperationId);
});
test.each(['parent', 'sibling', 'outsider', 'stale'])('unauthorized %s cannot submit or create mappings', async who => {
  const actor = { parent, sibling, outsider, stale: { ...child, tokenVersion: 99 } }[who];
  await expect(submit(factory(), body, actor)).rejects.toHaveProperty('statusCode');
  expect(await M.Command.countDocuments()).toBe(0); expect(client.status).not.toHaveBeenCalled();
});
test.each(['contentId', 'contentVersion', 'childSnapshotHash'])('stale child %s rejects before reservation', async key => {
  const value = { contentId: id(), contentVersion: 2, childSnapshotHash: '0'.repeat(64) }[key];
  await expect(submit(factory(), { ...body, [key]: value })).rejects.toMatchObject({ statusCode: 409, code: 'AI3_VERSION_CONFLICT' });
  expect(await M.Command.countDocuments()).toBe(0); expect(client.prepare).not.toHaveBeenCalled();
});
test('Attempt child detail is whitelisted with deletion placeholders; parent gets original binding and hash', async () => {
  await submit(); const a = await M.Attempt.findOne().lean();
  inspector.inspect.mockImplementation(async q => q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42,
    status: 'deleted', storageKey: 'SECRET' })));
  const result = (await getAttempt(a)).attempt;
  expect(Object.keys(result).sort()).toEqual(['id', 'attemptVersion', 'note', 'submittedAt', 'media', 'review'].sort());
  expect(result.media).toEqual(body.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42, status: 'deleted' })));
  expect(JSON.stringify(result)).not.toContain('SECRET'); expect(JSON.stringify(result)).not.toContain(content.contentHash);
  expect((await getAttempt(a, parent)).attempt).toMatchObject({ attemptPayloadHash: a.payloadHash, serverContentBinding: a.serverContentBinding });
  expect((await factory().listAttempts({ identity: child, roundId: String(round._id) })).items).toHaveLength(1);
  const r = (await factory().getRound({ identity: child, roundId: String(round._id) })).round;
  expect(r).toMatchObject({ currentAttemptId: String(a._id), currentAttemptVersion: 1, pending: false });
  await withdrawAncestor();
  await expect(getAttempt(a)).rejects.toMatchObject({ statusCode: 404 });
  expect((await getAttempt(a, parent)).attempt.id).toBe(String(a._id));
  const ack = await recover(await row()); expect(Object.keys(ack).sort()).toEqual(['command', 'pending']);
});
test('media await rechecks live child authority and ancestor; submission ack ignores inspector failures', async () => {
  inspector.inspect.mockRejectedValue(new Error('offline'));
  expect((await submit()).command.phase).toBe('SUCCEEDED'); const a = await M.Attempt.findOne().lean();
  await expect(getAttempt(a)).rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE' });
  inspector.inspect.mockImplementationOnce(async q => { await withdrawAncestor();
    return q.mediaIds.map(mediaId => ({ mediaId, mimeType: 'image/png', sizeBytes: 42, status: 'available' })); });
  await expect(getAttempt(a)).rejects.toMatchObject({ statusCode: 404 });
});

test.each(['ABSENT', 'PREPARED', 'COMMITTED'])('disabled recovery converges original %s without new prepare/commit', async state => {
  const c = await pending(state); expire(c); runtime.enabled = false;
  const result = await recover(c);
  expect(result.command.phase).toBe(state === 'COMMITTED' ? 'SUCCEEDED' : 'FAILED');
  expect((await row()).remoteOperationId).toBe(c.remoteOperationId);
  expect(client.prepare).not.toHaveBeenCalled(); expect(client.commit).not.toHaveBeenCalled();
  await expect(submit(factory(), { ...body, operationId: randomUUID() })).rejects.toMatchObject({ code: 'AI3_NOT_ENABLED' });
  if (state !== 'COMMITTED') await expect(submit(factory(), { ...body, note: 'changed' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
test('new reservation and final publication both conditionally touch approved AI2 ancestor', async () => {
  await withdrawAncestor();
  await expect(submit()).rejects.toMatchObject({ statusCode: 409 });
  expect(await M.Command.countDocuments()).toBe(0); expect(client.status).not.toHaveBeenCalled();
  await A.Package.updateOne({ _id: pkg._id }, { $set: { visibility: 'published' } });
  const commit = client.commit.getMockImplementation();
  client.commit.mockImplementationOnce(async q => { const result = await commit(q); await withdrawAncestor(); return result; });
  client.unbind.mockImplementationOnce(async q => {
    expect((await row()).phase).toBe('RESOLVING');
    expect(q.references.every(ref => ref.bindingOperationId === q.remoteOperationId)).toBe(true);
    throw new Error('lost exact cleanup');
  });
  expect((await submit()).command.phase).toBe('RESOLVING');
  const c = await row(); expire(c);
  expect((await recover(c)).command.phase).toBe('FAILED');
  expect(await M.Attempt.countDocuments()).toBe(0); expect((await M.Round.findById(round._id)).activeCommandId).toBeNull();
});
test.each(['committed', 'rolled-back'])('unknown final transaction %s only reads persisted outcome, never unbinds', async outcome => {
  let triggered = false;
  const transactionRunner = async work => {
    const result = await transact(async session => {
      const value = await work(session);
      if (!triggered && await M.Command.exists({ phase: 'SUCCEEDED' }).session(session)) {
        triggered = true; if (outcome === 'rolled-back') throw new Error('rolled back final');
      }
      return value;
    });
    if (triggered) throw new Error('commit result unknown'); return result;
  };
  const result = await submit(factory({ transactionRunner }));
  expect(triggered).toBe(true); expect(result.command.phase).toBe(outcome === 'committed' ? 'SUCCEEDED' : 'MEDIA_COMMITTED');
  expect(client.abort).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled();
  expect(await M.Attempt.countDocuments()).toBe(outcome === 'committed' ? 1 : 0);
  const c = await row(); expire(c); expect((await recover(c)).command.phase).toBe('SUCCEEDED');
  expect(await M.Attempt.countDocuments()).toBe(1);
});
test.each(['committed', 'rolled-back'])('unknown RESOLVING %s requires durable confirmation before cleanup', async outcome => {
  const c = await pending('COMMITTED'); expire(c); await withdrawAncestor(); let triggered = false;
  const transactionRunner = async work => {
    const result = await transact(async session => {
      const value = await work(session);
      if (!triggered && await M.Command.exists({ phase: 'RESOLVING' }).session(session)) {
        triggered = true; if (outcome === 'rolled-back') throw new Error('rolled back resolving');
      }
      return value;
    });
    if (triggered) throw new Error('commit result unknown'); return result;
  };
  const result = await recover(c, factory({ transactionRunner }));
  expect(triggered).toBe(true); expect(result.command.phase).toBe(outcome === 'committed' ? 'FAILED' : 'RESERVED');
  expect(client.unbind).toHaveBeenCalledTimes(outcome === 'committed' ? 1 : 0);
  expect(await M.Attempt.countDocuments()).toBe(0);
});
test('expired owner may resume mapping; live owner and losing publisher cannot compensate', async () => {
  const c = await pending('COMMITTED');
  expect((await recover(c)).pending).toBe(true); expect(await M.Attempt.countDocuments()).toBe(0);
  expire(c);
  const status = client.status.getMockImplementation();
  client.status.mockImplementationOnce(async q => {
    const result = await status(q);
    await M.Command.updateOne({ _id: c._id }, { $set: { owner: 'successor', leaseExpiresAt: new Date(clock + 5000) } });
    await withdrawAncestor(); return result;
  });
  expect((await recover(c)).pending).toBe(true);
  expect(client.unbind).not.toHaveBeenCalled(); expect(client.abort).not.toHaveBeenCalled();
  expect(await M.Attempt.countDocuments()).toBe(0);
});
test.each(['payload', 'references', 'serverContentBinding', 'requestHash', 'actorId', 'remoteOperationId'])(
  'corrupt persisted %s cannot drive remote writes or publication', async key => {
    const c = await pending('COMMITTED'); expire(c);
    const value = { payload: { ...c.payload, note: 'corrupt' }, references: [], requestHash: '0'.repeat(64), actorId: new mongoose.Types.ObjectId(),
      serverContentBinding: { ...c.serverContentBinding, fullContentHash: '0'.repeat(64) }, remoteOperationId: randomUUID() }[key];
    await M.Command.collection.updateOne({ _id: c._id }, { $set: { [key]: value } });
    client.status.mockClear();
    if (key === 'actorId') await expect(recover(c)).rejects.toMatchObject({ statusCode: 404 });
    else await expect(recover(c)).rejects.toMatchObject({ statusCode: 503 });
    expect(client.status).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled(); expect(await M.Attempt.countDocuments()).toBe(0);
  });
test.each(['resourceType', 'resourceId', 'field', 'referenceSetHash'])('wrong remote operation %s retains lock', async key => {
  const c = await pending('COMMITTED'); expire(c); remote.get(c.remoteOperationId).operation[key] = 'wrong';
  expect((await recover(c)).pending).toBe(true); expect(await M.Attempt.countDocuments()).toBe(0);
  expect((await M.Round.findById(round._id)).activeCommandId).not.toBeNull();
});
test.each([false, true])('committed deleted reference needs exact deletion receipt: valid=%s', async valid => {
  const c = await pending('COMMITTED'); expire(c);
  const ref = remote.get(c.remoteOperationId).references[0]; ref.state = 'released';
  ref.privacyDeletion = { mediaId: ref.mediaId, ...scope({ resourceId: String(c.attemptId) }),
    bindingOperationId: valid ? c.remoteOperationId : randomUUID(), deletedAt: new Date(clock).toISOString(), releasedAt: new Date(clock).toISOString() };
  const result = await recover(c); expect(result.command.phase).toBe(valid ? 'SUCCEEDED' : 'RESERVED');
  expect(await M.Attempt.countDocuments()).toBe(valid ? 1 : 0); expect(client.unbind).not.toHaveBeenCalled();
});
test('concurrent fresh UUIDs reserve exactly one command and Attempt', async () => {
  client.status.mockRejectedValue(new Error('held status'));
  const outcomes = await Promise.allSettled([submit(), submit(factory(), { ...body, operationId: randomUUID() })]);
  expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find(x => x.status === 'rejected').reason.statusCode).toBe(409);
  expect(await M.Command.countDocuments()).toBe(1); expect(await M.Attempt.countDocuments()).toBe(0);
  expect((await A.Package.findById(pkg._id)).stateVersion).toBe(4);
});
test('ancestor withdrawal wins against publisher held after ancestor read but before conditional touch', async () => {
  let entered, release;
  const arrived = new Promise(resolve => { entered = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const original = A.Package.findOne.bind(A.Package);
  let held = false;
  const spy = jest.spyOn(A.Package, 'findOne').mockImplementation((...args) => {
    const query = original(...args), exec = query.exec.bind(query);
    query.exec = async (...execArgs) => {
      const result = await exec(...execArgs);
      if (!held && query.getOptions().session && (await row())?.phase === 'MEDIA_COMMITTED') {
        held = true; entered(); await hold;
      }
      return result;
    };
    return query;
  });
  const running = submit();
  try { await arrived; await withdrawAncestor(); } finally { release(); }
  const result = await running; spy.mockRestore();
  expect(result.command.phase).not.toBe('SUCCEEDED'); expect(await M.Attempt.countDocuments()).toBe(0);
  const c = await row(); expire(c); expect((await recover(c)).command.phase).toBe('FAILED');
});
test.each(['ai3_attempt_version', 'ai3_attempt_command', 'ai3_submission_remote_operation'])('missing readiness index %s prevents reservation and remote effects', async name => {
  const model = name === 'ai3_submission_remote_operation' ? M.Command : M.Attempt;
  await model.collection.dropIndex(name);
  try {
    await expect(submit()).rejects.toMatchObject({ code: 'AI3_NOT_READY' });
    expect(await M.Command.countDocuments()).toBe(0); expect(client.status).not.toHaveBeenCalled();
  } finally { await model.createIndexes(); }
});
test('expired publisher cannot overtake successor RESOLVING cleanup', async () => {
  let entered, release, held = false;
  const arrived = new Promise(resolve => { entered = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const service = factory({ transactionRunner: work => transact(async session => {
    if (!held && (await row())?.phase === 'MEDIA_COMMITTED') { held = true; entered(); await hold; }
    return work(session);
  }) });
  const running = submit(service); await arrived;
  try {
    const c = await row(); expire(c); await withdrawAncestor();
    expect((await recover(c)).command.phase).toBe('FAILED');
  } finally { release(); }
  expect((await running).command.phase).toBe('FAILED'); expect(await M.Attempt.countDocuments()).toBe(0);
  expect(client.unbind).toHaveBeenCalledTimes(1);
});
test('durable success defeats concurrent recovery while transaction owns command row', async () => {
  let entered, release, held = false;
  const arrived = new Promise(resolve => { entered = resolve; }), hold = new Promise(resolve => { release = resolve; });
  const service = factory({ transactionRunner: work => transact(async session => {
    const result = await work(session);
    if (!held && await M.Command.exists({ phase: 'SUCCEEDED' }).session(session)) { held = true; entered(); await hold; }
    return result;
  }) });
  const running = submit(service); await arrived;
  const c = await row(); expire(c); const recovering = recover(c); release();
  expect((await Promise.all([running, recovering])).map(result => result.command.phase)).toEqual(['SUCCEEDED', 'SUCCEEDED']);
  expect(await M.Attempt.countDocuments()).toBe(1); expect(client.unbind).not.toHaveBeenCalled();
});
test('revise creates a new immutable version; old success replays original Attempt, not latest', async () => {
  const first = await submit(), original = await M.Attempt.findOne().lean();
  await M.Attempt.updateOne({ _id: original._id }, { $set: { review: { decision: 'revise', comment: 'Try again', reviewedAt: new Date(clock) } } });
  await M.Round.updateOne({ _id: round._id }, { $set: { learningState: 'revise' }, $inc: { stateVersion: 1 } });
  const second = await submit(factory(), { ...body, operationId: randomUUID(), expectedRoundVersion: 6, note: 'Second work' });
  expect(second.attempt.attemptVersion).toBe(2); expect(second.attempt.id).not.toBe(first.attempt.id);
  expect((await submit()).attempt.id).toBe(first.attempt.id);
  expect(await M.Attempt.countDocuments()).toBe(2);
});
test.each(['Attempt', 'Command'])('rehashed sparse %s reference set is rejected', async kind => {
  const c = await pending('COMMITTED'); expire(c); await recover(c);
  const a = kind === 'Attempt' ? await M.Attempt.findOne().lean() : await row();
  if (kind === 'Attempt') {
    delete a.mediaBindings[1]; a.payloadHash = C.hash({ note: a.note, mediaIds: a.mediaIds.map(String), bindings: a.mediaBindings,
      submittedBy: String(a.submittedBy), attemptVersion: a.attemptVersion, serverContentBinding: a.serverContentBinding });
    expect(() => require('../../services/ai3SubmissionService').validateAttempt(a)).toThrow('AI3_MEDIA_UNAVAILABLE');
  } else {
    delete a.references[1]; a.referencesHash = C.hash({ familyId: String(a.familyId), childId: String(a.childId), resourceType: 'ai3_attempt',
      resourceId: String(a.attemptId), references: a.references, serverContentBinding: a.serverContentBinding });
    expect(() => require('../../services/ai3SubmissionService').validateMapping(a)).toThrow('AI3_COMMAND_PENDING');
  }
});
const withdrawRound = async (service = factory()) => service.withdraw({ identity: parent, roundId: String(round._id),
  body: { ...envelope(), expectedRoundVersion: (await M.Round.findById(round._id)).stateVersion, reason: 'Withdraw incorrect questions' } });
const createNextRound = async () => {
  const current = await A.Package.findById(pkg._id).lean();
  return factory({ sourceReader: { require: async () => ({ id: pkg.source.id, familyId: String(family._id), childId: child.id, subject: 'math' }) } })
    .create({ identity: parent, body: { ...envelope(), sourcePackageId: String(pkg._id), expectedSourcePackageVersion: current.stateVersion,
      sourceAttemptId: String(round.sourceAttemptId), expectedSourceAttemptVersion: 1, sourceAttemptPayloadHash: round.sourceAttemptPayloadHash,
      sourceReviewHash: round.sourceReviewHash, exerciseCount: 2, knowledgePointId: null } });
};
test.each(['ABSENT', 'PREPARED', 'COMMITTED'])('own Round withdrawal wins over active %s, preserves slot until exact cleanup', async state => {
  const c = await pending(state);
  const ack = await withdrawRound(); expect(ack.round.visibility).toBe('withdrawn');
  expect(await M.Round.findById(round._id).lean()).toMatchObject({ active: true, activeCommandId: c._id });
  expect(await row()).toEqual(c);
  await expect(createNextRound()).rejects.toMatchObject({ code: 'AI3_OPERATION_UNRESOLVED' });
  if (state === 'COMMITTED') client.unbind.mockRejectedValueOnce(new Error('cleanup reply lost'));
  else client.abort.mockRejectedValueOnce(new Error('abort reply lost'));
  expire(c); expect((await recover(c)).command.phase).toBe('RESOLVING');
  expect(await M.Round.findById(round._id).lean()).toMatchObject({ active: true, activeCommandId: c._id });
  await expect(createNextRound()).rejects.toMatchObject({ code: 'AI3_OPERATION_UNRESOLVED' });
  expire(await row()); expect((await recover(c)).command.phase).toBe('FAILED');
  expect(await M.Round.findById(round._id).lean()).toMatchObject({ active: false, activeCommandId: null });
  expect(await M.Attempt.countDocuments()).toBe(0);
  const withdrawal = await M.Command.findById(ack.command.id).lean();
  const replay = await factory().withdraw({ identity: parent, roundId: String(round._id), body: withdrawal.payload });
  expect(replay.command.id).toBe(ack.command.id); expect((await M.Round.findById(round._id)).active).toBe(false);
  expect((await submit()).command).toMatchObject({ id: String(c._id), phase: 'FAILED' });
  expect((await row()).remoteOperationId).toBe(c.remoteOperationId);
  expect((await row()).references).toEqual(c.references);
  expect((await createNextRound()).round.id).not.toBe(String(round._id));
});
test('own Round withdrawal during commit prevents publication and releases slot after exact cleanup', async () => {
  const commit = client.commit.getMockImplementation();
  client.commit.mockImplementationOnce(async q => { const result = await commit(q); await withdrawRound(); return result; });
  expect((await submit()).command.phase).toBe('FAILED');
  expect(await M.Attempt.countDocuments()).toBe(0); expect((await M.Round.findById(round._id)).active).toBe(false);
  expect(client.unbind).toHaveBeenCalledTimes(1);
});
test.each(['familyId', 'childId', 'roundId', 'phase', 'endpointOperation', 'referencesHash'])(
  'withdrawal cannot bypass mismatched active command %s', async key => {
    const c = await pending();
    const value = { familyId: new mongoose.Types.ObjectId(), childId: new mongoose.Types.ObjectId(), roundId: new mongoose.Types.ObjectId(),
      phase: 'SUCCEEDED', endpointOperation: 'ai3.generate', referencesHash: '0'.repeat(64) }[key];
    await M.Command.collection.updateOne({ _id: c._id }, { $set: { [key]: value } });
    await expect(withdrawRound()).rejects.toHaveProperty('statusCode');
    expect((await M.Round.findById(round._id)).visibility).toBe('published'); expect(client.unbind).not.toHaveBeenCalled();
  });
test('getCommand propagates ancestor dependency failure instead of returning a cropped success', async () => {
  const c = await pending();
  const original = A.Package.findOne.bind(A.Package);
  const spy = jest.spyOn(A.Package, 'findOne').mockImplementation((...args) => {
    const query = original(...args); query.exec = async () => { throw C.error(503, 'ANCESTOR_UNAVAILABLE'); }; return query;
  });
  try { await expect(factory().getCommand({ identity: child, commandId: String(c._id) })).rejects.toMatchObject({ statusCode: 503 }); }
  finally { spy.mockRestore(); }
  expect((await row()).phase).toBe('RESERVED'); expect(client.prepare).not.toHaveBeenCalled();
});
test('getCommand rejects malformed persisted mapping but crops confirmed withdrawal', async () => {
  const c = await pending();
  await M.Command.collection.updateOne({ _id: c._id }, { $set: { referencesHash: '0'.repeat(64) } });
  await expect(factory().getCommand({ identity: child, commandId: String(c._id) })).rejects.toMatchObject({ statusCode: 503 });
  await M.Command.collection.updateOne({ _id: c._id }, { $set: { referencesHash: c.referencesHash } });
  await withdrawAncestor();
  const result = await factory().getCommand({ identity: child, commandId: String(c._id) });
  expect(result.command.id).toBe(String(c._id)); expect(result.command).not.toHaveProperty('payload');
});
