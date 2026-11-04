const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const M = require('../../models/Ai2');
const C = require('../../services/ai2Contract');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { typedScope, referenceSetHash } = require('../../../../common/services/completionMediaProtocol');
const { createAi2SubmissionService } = require('../../services/ai2SubmissionService');
const id = () => String(new mongoose.Types.ObjectId());
const transact = work => runMongoTransaction({ mongooseInstance: mongoose, work });
let identity, familyId, p, body, runtime, clock, client, remote, helpers;
const time = () => new Date(clock).toISOString();
function reply(q, state, refs) {
  return { operation: { ...typedScope(q), referenceSetHash: state === 'ABSENT' ? null
    : referenceSetHash({ ...q, references: [...q.references].sort((a, b) => a.mediaId.localeCompare(b.mediaId)) }),
    operationId: q.remoteOperationId, state, commandHash: state === 'ABSENT' ? null : q.commandHash,
    leaseExpiresAt: state === 'PREPARED' ? new Date(clock + 60000).toISOString() : null,
    leaseExpired: state === 'PREPARED' ? false : null, failureCode: state === 'ABORTED' ? 'MEDIA_OPERATION_ABORTED' : null },
  references: refs || q.references.map(r => ({ ...typedScope(q), ...r, state: { ABSENT: 'absent', PREPARED: 'prepared', COMMITTED: 'bound', ABORTED: 'released' }[state],
    ...(state !== 'ABSENT' ? { bindingOperationId: q.remoteOperationId } : {}), privacyDeletion: null })) };
}
const make = extra => createAi2SubmissionService({ ...helpers, ...extra });
const submit = service => service.submit({ identity, packageId: String(p._id), body });
const recover = (service, c, actor = identity) => service.recover({ identity: actor, commandId: String(c._id),
  body: { schemaVersion: 'ai2-min-v1', operationId: c.operationId } });
const row = () => M.Command.findOne({ endpointOperation: 'ai2.submit' }).lean();
async function reservePending(state = 'ABSENT') {
  client.status.mockImplementationOnce(async q => { remote.set(q.remoteOperationId, reply(q, state)); throw new Error('network unknown'); });
  const result = await submit(make());
  expect(result.pending).toBe(true);
  return row();
}
beforeAll(async () => { for (const m of Object.values(M)) await m.init(); });
beforeEach(async () => {
  identity = { id: id(), role: 'student' }; identity.childId = identity.id;
  familyId = id(); identity.familyId = familyId;
  runtime = { enabled: true, continuousStore: true }; clock = Date.parse('2026-11-03T02:00:00Z'); remote = new Map();
  p = await M.Package.create({ familyId, childId: identity.id, ai1CycleId: id(), source: { type: 'task', id: id() },
    artifact: { id: id() }, childSnapshot: { questionText: 'Synthetic question' }, childSnapshotHash: C.hash('snapshot'),
    publishedBy: id(), publishedAt: new Date(clock), visibility: 'published', learningState: 'open', stateVersion: 1 });
  body = { schemaVersion: 'ai2-min-v1', operationId: randomUUID(), expectedPackageVersion: 1,
    note: 'Synthetic correction', mediaIds: [id(), id()] };
  client = {
    status: jest.fn(async q => remote.get(q.remoteOperationId) || reply(q, 'ABSENT')),
    prepare: jest.fn(async q => { const r = reply(q, 'PREPARED'); remote.set(q.remoteOperationId, r); return r; }),
    commit: jest.fn(async q => { const r = reply(q, 'COMMITTED'); remote.set(q.remoteOperationId, r); return r; }),
    abort: jest.fn(async q => {
      if (remote.get(q.remoteOperationId)?.operation.state === 'COMMITTED') return remote.get(q.remoteOperationId);
      const r = reply(q, 'ABORTED'); remote.set(q.remoteOperationId, r); return r;
    }),
    unbind: jest.fn(async q => ({ operation: null, references: q.references.map(r => ({ ...typedScope(q), ...r, state: 'released', privacyDeletion: null })) }))
  };
  const authorize = async (actor, childId) => {
    if (!actor || actor.id !== identity.id || actor.role !== 'student' || String(childId) !== identity.id) throw C.error(403, 'CHILD_ACCESS_DENIED');
    return { familyId, child: { _id: identity.id } };
  };
  helpers = { authorize, resource: async (model, actor, key, session = null, includeWithdrawn = false) => {
    await authorize(actor, identity.id);
    const value = await model.findOne({ _id: key, familyId, childId: identity.id }).session(session).lean();
    if (!value || model === M.Package && !includeWithdrawn && value.visibility !== 'published') throw C.error(404, 'RESOURCE_NOT_FOUND');
    return value;
  }, previous: async (actor, childId, action, path, command, session = null) => {
    await authorize(actor, childId);
    const key = { familyId, actorId: actor.id, endpointOperation: `ai2.${action}`, operationId: command.operationId };
    const found = await M.Command.findOne(key).session(session).lean();
    if (found && found.requestHash !== C.requestHash(action, path, command)) throw C.error(409, 'IDEMPOTENCY_CONFLICT');
    return { found, key };
  }, transact, writeView: async c => ({ command: { id: String(c._id), phase: c.phase },
    attempt: await M.Attempt.findById(c.resultReference.attemptId).lean() }),
  continuous: () => { if (!runtime.continuousStore) throw C.error(503, 'AI2_STORE_ISOLATED'); },
  enabled: () => { if (!runtime.enabled) throw C.error(503, 'AI2_DISABLED'); },
  getRuntime: () => runtime, assertReady: async () => {}, now: () => clock, mediaReferenceClient: client, leaseMs: 1000 };
});

test('factory exposes only durable submit and explicit recover', () => {
  expect(typeof createAi2SubmissionService).toBe('function');
  expect(Object.keys(make()).sort()).toEqual(['recover', 'submit']);
});
test.each([['open', false], ['revise', false], ['open', true]])('ATTEMPT-03 distinct fresh UUIDs from %s snapshot; earlyFailure=%s', async (state, earlyFailure) => {
  if (state === 'revise') {
    await submit(make());
    await M.Attempt.updateOne({ packageId: p._id }, { $set: { review: { decision: 'revise', comment: 'Synthetic feedback' } } });
    await M.Package.updateOne({ _id: p._id }, { $set: { learningState: 'revise' }, $inc: { stateVersion: 1 } });
  }
  const before = await M.Package.findById(p._id).lean();
  const history = await M.Attempt.find({ packageId: p._id }).sort({ attemptVersion: 1 }).lean();
  const priorCommands = await M.Command.find().sort({ _id: 1 }).lean();
  for (const fn of Object.values(client)) fn.mockClear();
  const inputs = ['first', 'second'].map(note => ({ ...body, operationId: randomUUID(), note,
    expectedPackageVersion: before.stateVersion }));
  let arrived = 0, release, deadlineReached = false;
  const bothRead = new Promise(resolve => { release = resolve; });
  const deadline = setTimeout(() => { deadlineReached = true; release(); }, 5000);
  const resource = async (...args) => {
    const value = await helpers.resource(...args);
    if (args[0] === M.Package && args[3] && arrived < 2) {
      if (earlyFailure && arrived === 1) throw new Error('synthetic failure before second barrier');
      arrived++;
      if (arrived === 2) release();
      await bothRead;
    }
    return value;
  };
  // Unknown status retains the winning reservation for inspection before explicit recovery.
  const status = client.status.getMockImplementation();
  client.status.mockRejectedValue(new Error('synthetic status response lost'));
  let outcomes;
  try {
    outcomes = await Promise.allSettled(inputs.map(input => make({ resource }).submit({ identity, packageId: String(p._id), body: input }).finally(release)));
  } finally { clearTimeout(deadline); release(); client.status.mockImplementation(status); }
  expect(deadlineReached).toBe(false);
  expect(arrived).toBe(earlyFailure ? 1 : 2);
  expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find(r => r.status === 'fulfilled').value.pending).toBe(true);
  expect(outcomes.find(r => r.status === 'rejected').reason).toMatchObject(earlyFailure
    ? { message: 'synthetic failure before second barrier' } : { statusCode: 409, code: 'AI2_COMMAND_PENDING' });
  const winner = await M.Command.findOne({ operationId: { $in: inputs.map(b => b.operationId) } }).lean();
  expect(winner.phase).toBe('RESERVED');
  expect(winner.payload).toEqual(inputs[outcomes.findIndex(r => r.status === 'fulfilled')]);
  expect(await M.Command.countDocuments()).toBe(priorCommands.length + 1);
  expect(await M.Package.findById(p._id).lean()).toMatchObject({ activeCommandId: winner._id,
    stateVersion: before.stateVersion + 1, currentAttemptVersion: before.currentAttemptVersion });
  expect(await M.Attempt.find({ packageId: p._id }).sort({ attemptVersion: 1 }).lean()).toEqual(history);
  expect(client.status).toHaveBeenCalledTimes(1);
  for (const action of ['prepare', 'commit', 'abort', 'unbind']) expect(client[action]).not.toHaveBeenCalled();
  clock = Number(winner.leaseExpiresAt) + 1;
  expect((await recover(make(), winner)).command.phase).toBe('SUCCEEDED');
  const after = await M.Package.findById(p._id).lean();
  const attempt = await M.Attempt.findById(winner.attemptId).lean();
  expect(after).toMatchObject({ activeCommandId: null, learningState: 'submitted', stateVersion: before.stateVersion + 2,
    currentAttemptId: attempt._id, currentAttemptVersion: before.currentAttemptVersion + 1 });
  expect(attempt.mediaBindings).toEqual(winner.references);
  expect(attempt.note).toBe(winner.payload.note);
  expect(await M.Attempt.countDocuments()).toBe(history.length + 1);
  for (const old of history) expect(await M.Attempt.findById(old._id).lean()).toEqual(old);
  for (const old of priorCommands) expect(await M.Command.findById(old._id).lean()).toEqual(old);
  expect(client.prepare).toHaveBeenCalledTimes(1); expect(client.commit).toHaveBeenCalledTimes(1);
  expect(client.abort).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled();
  await expect(M.Attempt.collection.insertOne({ ...attempt, _id: new mongoose.Types.ObjectId(), submitCommandId: new mongoose.Types.ObjectId() }))
    .rejects.toMatchObject({ code: 11000 });
  expect(await M.Attempt.countDocuments()).toBe(history.length + 1);
});

test.each(['submitted', 'approved', 'withdrawn'])('ATTEMPT-03 fresh UUID in %s rejects without reservation, remote calls or history changes', async state => {
  await submit(make());
  if (state === 'approved') {
    await M.Attempt.updateOne({ packageId: p._id }, { $set: { review: { decision: 'approve', comment: 'Original audit' } } });
    await M.Package.updateOne({ _id: p._id }, { $set: { learningState: 'approved' }, $inc: { stateVersion: 1 } });
  } else if (state === 'withdrawn') {
    await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
  }
  const snapshot = async () => Promise.all(Object.values(M).map(model => model.find().sort({ _id: 1 }).lean()));
  const before = await snapshot(), current = await M.Package.findById(p._id).lean();
  const remoteBefore = [...remote.entries()];
  for (const fn of Object.values(client)) fn.mockClear();
  await expect(make().submit({ identity, packageId: String(p._id), body: { ...body,
    operationId: randomUUID(), expectedPackageVersion: current.stateVersion } }))
    .rejects.toMatchObject({ statusCode: 409, code: 'AI2_STATE_CONFLICT' });
  expect(await snapshot()).toEqual(before);
  expect([...remote.entries()]).toEqual(remoteBefore);
  for (const fn of Object.values(client)) expect(fn).not.toHaveBeenCalled();
});
test('expired unchanged owner cannot publish or compensate after a delayed commit response; original mapping remains recoverable', async () => {
  let entered, release;
  const arrived = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  const commit = client.commit.getMockImplementation();
  client.commit.mockImplementationOnce(async q => {
    const result = await commit(q); entered(); await held; return result;
  });
  const submitting = submit(make());
  let before, result;
  try {
    await Promise.race([arrived, submitting.then(() => { throw new Error('Submission finished before the commit-response barrier'); })]);
    before = await row();
    expect(before.phase).toBe('MEDIA_PREPARED');
    expect(remote.get(before.remoteOperationId).operation.state).toBe('COMMITTED');
    clock = Number(before.leaseExpiresAt) + 1;
  } finally { release(); result = await submitting; }
  const expired = await row();
  expect(result.pending).toBe(true);
  expect(expired.owner).toBe(before.owner);
  expect(expired.phase).toBe('MEDIA_PREPARED');
  expect(Number(expired.leaseExpiresAt)).toBeLessThan(clock);
  expect((await M.Package.findById(p._id)).activeCommandId.toString()).toBe(String(before._id));
  expect(await M.Attempt.countDocuments()).toBe(0);
  expect(client.abort).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled();
  expect((await recover(make(), expired)).command.phase).toBe('SUCCEEDED');
  const restored = await row(), attempt = await M.Attempt.findOne().lean();
  for (const key of ['operationId', 'remoteOperationId', 'requestHash', 'referencesHash']) expect(restored[key]).toBe(before[key]);
  expect(restored.references).toEqual(before.references);
  expect(attempt.mediaBindings).toEqual(before.references);
  expect(await M.Attempt.countDocuments()).toBe(1);
  expect(client.prepare).toHaveBeenCalledTimes(1); expect(client.commit).toHaveBeenCalledTimes(1);
  expect(client.abort).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled();
});
test.each(['prepare', 'commit'])('off during the final owned check prevents %s and preserves the original command for cleanup', async action => {
  let entered, release, statuses = 0, armed = false;
  const arrived = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  const status = client.status.getMockImplementation(), authorize = helpers.authorize;
  client.status.mockImplementation(async q => {
    const result = await status(q);
    statuses += 1;
    if (statuses === (action === 'prepare' ? 1 : 2)) armed = true;
    return result;
  });
  const service = make({ authorize: async (...args) => {
    const result = await authorize(...args);
    if (armed) { armed = false; entered(); await held; }
    return result;
  } });
  const submitting = submit(service);
  let before, result;
  try {
    await Promise.race([arrived, submitting.then(() => { throw new Error('Submission finished before the owned barrier'); })]);
    before = await row();
    expect(before.phase).toBe(action === 'prepare' ? 'RESERVED' : 'MEDIA_PREPARED');
    expect(client[action]).not.toHaveBeenCalled();
    runtime.enabled = false;
  } finally { release(); result = await submitting; }
  const pending = await row();
  expect(client[action]).not.toHaveBeenCalled();
  expect(result.pending).toBe(true);
  expect(pending.phase).toBe(before.phase); expect(pending.owner).toBe(before.owner);
  for (const key of ['operationId', 'remoteOperationId', 'requestHash', 'referencesHash']) expect(pending[key]).toBe(before[key]);
  expect(pending.references).toEqual(before.references);
  expect((await M.Package.findById(p._id)).activeCommandId.toString()).toBe(String(before._id));
  expect(await M.Attempt.countDocuments()).toBe(0);
  expect(client.prepare).toHaveBeenCalledTimes(action === 'prepare' ? 0 : 1);
  expect(client.commit).not.toHaveBeenCalled();
  clock = Number(pending.leaseExpiresAt) + 1;
  expect((await recover(make(), pending)).command.phase).toBe('FAILED');
  const failed = await row();
  expect(failed.remoteOperationId).toBe(before.remoteOperationId); expect(failed.references).toEqual(before.references);
  expect((await M.Package.findById(p._id)).activeCommandId).toBeNull();
  expect(await M.Attempt.countDocuments()).toBe(0);
  expect(client.prepare).toHaveBeenCalledTimes(action === 'prepare' ? 0 : 1);
  expect(client.commit).not.toHaveBeenCalled(); expect(client.abort).toHaveBeenCalledTimes(1);
  expect(client.unbind).not.toHaveBeenCalled();
});
test('submit persists random remote mapping, full references and ordered immutable Attempt exactly once', async () => {
  const s = make(), result = await submit(s), c = await row();
  expect(result.command.phase).toBe('SUCCEEDED');
  expect(c.remoteOperationId).not.toBe(body.operationId);
  expect(c.references).toEqual(body.mediaIds.map(mediaId => ({ mediaId, resourceType: 'ai2_attempt', resourceId: String(c.attemptId),
    field: 'correctionMediaIds', bindingOperationId: c.remoteOperationId })));
  expect(c.reservedPackageVersion).toBe(2);
  expect(c.requestHash).toBe(C.requestHash('submit', `/api/ai2/learning-packages/${p._id}/attempts`, body));
  const a = await M.Attempt.findOne().lean();
  expect(a.mediaIds.map(String)).toEqual(body.mediaIds);
  expect(a.mediaBindings).toEqual(c.references);
  expect(a.payloadHash).toBe(C.hash({ note: body.note, mediaIds: body.mediaIds, bindings: c.references,
    submittedBy: identity.id, attemptVersion: 1 }));
  const stored = await M.Package.findById(p._id).lean();
  expect(stored).toMatchObject({ stateVersion: 3, activeCommandId: null, learningState: 'submitted' });
  expect((await submit(s)).command.id).toBe(result.command.id);
  expect(await M.Attempt.countDocuments()).toBe(1);
  expect(client.prepare).toHaveBeenCalledTimes(1);
});
test('reservation is committed before any remote effect and unknown network retains mapping and lock', async () => {
  client.prepare.mockImplementationOnce(async q => {
    const c = await row(); expect(c.remoteOperationId).toBe(q.remoteOperationId);
    expect(String((await M.Package.findById(p._id)).activeCommandId)).toBe(String(c._id));
    remote.set(q.remoteOperationId, reply(q, 'PREPARED')); throw new Error('lost prepare reply');
  });
  expect((await submit(make())).pending).toBe(true);
  const c = await row(); clock += 1001;
  expect((await recover(make(), c)).command.phase).toBe('SUCCEEDED');
  expect((await row()).remoteOperationId).toBe(c.remoteOperationId);
  expect(client.prepare).toHaveBeenCalledTimes(1);
});
test('only original child actor can recover and changed payload cannot reuse a key', async () => {
  const c = await reservePending();
  await expect(recover(make(), c, { id: id(), role: 'parent' })).rejects.toMatchObject({ statusCode: 403 });
  body = { ...body, note: 'changed' };
  await expect(submit(make())).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  expect(client.prepare).not.toHaveBeenCalled();
});
test('live owner prevents takeover; expired owner can resume same mapping', async () => {
  const c = await reservePending();
  await M.Command.updateOne({ _id: c._id }, { $set: { owner: 'other-owner', leaseExpiresAt: new Date(clock + 5000) } });
  expect((await recover(make(), c)).pending).toBe(true); expect(client.prepare).not.toHaveBeenCalled();
  clock += 5001;
  expect((await recover(make(), c)).command.phase).toBe('SUCCEEDED');
});
test('off refuses new reservation but converges committed and aborts prepared original commands', async () => {
  runtime.enabled = false;
  await expect(submit(make())).rejects.toMatchObject({ code: 'AI2_DISABLED' });
  expect(await M.Command.countDocuments()).toBe(0);
  runtime.enabled = true;
  const c = await reservePending('PREPARED'); runtime.enabled = false; clock += 1001;
  const result = await recover(make(), c);
  expect(result.command.phase).toBe('FAILED'); expect(result.command.failureCode).toBe('AI2_DISABLED');
  expect(client.prepare).not.toHaveBeenCalled(); expect(client.commit).not.toHaveBeenCalled();
  expect((await M.Package.findById(p._id)).activeCommandId).toBeNull();
});
test('off still finalizes already committed operation', async () => {
  const c = await reservePending('COMMITTED'); runtime.enabled = false; clock += 1001;
  expect((await recover(make(), c)).command.phase).toBe('SUCCEEDED');
  expect(client.commit).not.toHaveBeenCalled(); expect(client.abort).not.toHaveBeenCalled();
});
test('off PREPARED abort observing in-flight COMMITTED stays RESOLVING until exact cleanup is confirmed', async () => {
  const c = await reservePending('PREPARED'); runtime.enabled = false; clock += 1001;
  client.abort.mockImplementationOnce(async q => {
    expect((await row()).phase).toBe('RESOLVING');
    const committed = reply(q, 'COMMITTED'); remote.set(q.remoteOperationId, committed); return committed;
  });
  client.unbind.mockImplementationOnce(async q => {
    const current = await row(); expect(current.phase).toBe('RESOLVING');
    expect(q).toEqual({ familyId, childId: identity.id, resourceType: 'ai2_attempt', resourceId: String(c.attemptId),
      remoteOperationId: c.remoteOperationId,
      references: body.mediaIds.map(mediaId => ({ mediaId, field: 'correctionMediaIds', bindingOperationId: c.remoteOperationId })) });
    throw new Error('exact cleanup response lost');
  });
  const unresolved = await recover(make(), c);
  expect(unresolved.command.phase).toBe('RESOLVING'); expect(unresolved.pending).toBe(true);
  expect(unresolved.command.failureCode).toBe('AI2_DISABLED');
  expect(String((await M.Package.findById(p._id)).activeCommandId)).toBe(String(c._id));
  expect(await M.Attempt.countDocuments()).toBe(0);
  clock += 1001;
  const resolved = await recover(make(), c);
  expect(resolved.command.phase).toBe('FAILED'); expect(resolved.command.failureCode).toBe('AI2_DISABLED');
  expect((await M.Package.findById(p._id)).activeCommandId).toBeNull();
  expect(await M.Attempt.countDocuments()).toBe(0);
  expect(client.prepare).not.toHaveBeenCalled(); expect(client.commit).not.toHaveBeenCalled();
  expect(client.abort).toHaveBeenCalledTimes(1); expect(client.unbind).toHaveBeenCalledTimes(2);
});
test('withdraw after remote commit enters durable RESOLVING before exact unbind and clears lock only afterwards', async () => {
  const original = client.commit.getMockImplementation();
  client.commit.mockImplementationOnce(async q => {
    const result = await original(q);
    await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
    return result;
  });
  client.unbind.mockImplementationOnce(async q => {
    const c = await row(); expect(c.phase).toBe('RESOLVING');
    expect(String((await M.Package.findById(p._id)).activeCommandId)).toBe(String(c._id));
    expect(q.references.every(r => r.bindingOperationId === c.remoteOperationId)).toBe(true);
    throw new Error('cleanup unknown');
  });
  expect((await submit(make())).command.phase).toBe('RESOLVING');
  const c = await row(); clock += 1001;
  expect((await recover(make(), c)).command.phase).toBe('FAILED');
  expect(await M.Attempt.countDocuments()).toBe(0);
  expect((await M.Package.findById(p._id)).activeCommandId).toBeNull();
});
test('unknown final transaction commit reads back success without compensation', async () => {
  const result = await submit(make({ transact: async work => {
    const value = await transact(work);
    if ((await row())?.phase === 'SUCCEEDED') throw new Error('unknown committed transaction');
    return value;
  } }));
  expect(result.command.phase).toBe('SUCCEEDED'); expect(await M.Attempt.countDocuments()).toBe(1);
  expect(client.abort).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled();
});
test.each(['wrong-generation', 'wrong-type', 'missing-proof'])('committed released binding with %s stays pending', async corruption => {
  const c = await reservePending('COMMITTED'), result = remote.get(c.remoteOperationId), ref = result.references[0];
  ref.state = 'released';
  ref.privacyDeletion = { mediaId: ref.mediaId, resourceType: 'ai2_attempt', resourceId: String(c.attemptId),
    field: 'correctionMediaIds', bindingOperationId: c.remoteOperationId, deletedAt: time(), releasedAt: time() };
  if (corruption === 'wrong-generation') ref.privacyDeletion.bindingOperationId = randomUUID();
  if (corruption === 'wrong-type') ref.privacyDeletion.resourceType = 'growth_task';
  if (corruption === 'missing-proof') ref.privacyDeletion = null;
  clock += 1001;
  expect((await recover(make(), c)).pending).toBe(true);
  expect(await M.Attempt.countDocuments()).toBe(0); expect(client.unbind).not.toHaveBeenCalled();
});
test('exact deletion receipt permits historical committed submission without rewriting original media', async () => {
  const c = await reservePending('COMMITTED'), result = remote.get(c.remoteOperationId), ref = result.references[0];
  ref.state = 'released'; ref.privacyDeletion = { mediaId: ref.mediaId, resourceType: 'ai2_attempt', resourceId: String(c.attemptId),
    field: 'correctionMediaIds', bindingOperationId: c.remoteOperationId, deletedAt: time(), releasedAt: time() };
  clock += 1001;
  expect((await recover(make(), c)).command.phase).toBe('SUCCEEDED');
  expect((await M.Attempt.findOne()).mediaIds.map(String)).toEqual(body.mediaIds);
});
test('recover requires the closed original command envelope, not an optional body', async () => {
  const c = await reservePending();
  await expect(make().recover({ identity, commandId: String(c._id) })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  await expect(make().recover({ identity, commandId: String(c._id), body: { schemaVersion: 'ai2-min-v1', operationId: randomUUID() } }))
    .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
test.each(['resourceType', 'resourceId', 'field', 'referenceSetHash'])('typed operation %s mismatch never publishes', async field => {
  const c = await reservePending('COMMITTED'); remote.get(c.remoteOperationId).operation[field] = 'wrong'; clock += 1001;
  expect((await recover(make(), c)).pending).toBe(true); expect(await M.Attempt.countDocuments()).toBe(0);
});
test.each(['resourceType', 'resourceId'])('typed reference %s mismatch never publishes', async field => {
  const c = await reservePending('COMMITTED'); remote.get(c.remoteOperationId).references[0][field] = 'wrong'; clock += 1001;
  expect((await recover(make(), c)).pending).toBe(true); expect(await M.Attempt.countDocuments()).toBe(0);
});
test('lost owner after remote commit cannot publish or compensate even if package is withdrawn', async () => {
  const original = client.commit.getMockImplementation();
  client.commit.mockImplementationOnce(async q => {
    const result = await original(q), c = await row();
    await M.Command.updateOne({ _id: c._id }, { $set: { owner: 'successor', leaseExpiresAt: new Date(clock + 5000) } });
    await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
    return result;
  });
  const result = await submit(make());
  expect(result.pending).toBe(true); expect(result).not.toHaveProperty('attempt');
  expect(await M.Attempt.countDocuments()).toBe(0);
  expect(client.abort).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled();
  expect((await row()).owner).toBe('successor');
});
test.each(['committed', 'rolled-back'])('RESOLVING transaction %s unknown never authorizes speculative cleanup', async outcome => {
  const c = await reservePending('COMMITTED'); clock += 1001;
  await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
  let triggered = false;
  const service = make({ transact: async work => {
    const result = await transact(async session => {
      const value = await work(session);
      const current = await M.Command.findById(c._id).session(session).lean();
      if (!triggered && current.phase === 'RESOLVING') {
        triggered = true;
        if (outcome === 'rolled-back') throw new Error('resolving transaction aborted');
      }
      return value;
    });
    if (triggered) throw new Error('transaction result unknown');
    return result;
  } });
  const result = await recover(service, c);
  expect(triggered).toBe(true);
  expect(result.command.phase).toBe(outcome === 'committed' ? 'FAILED' : 'RESERVED');
  expect(client.unbind).toHaveBeenCalledTimes(outcome === 'committed' ? 1 : 0);
  expect(await M.Attempt.countDocuments()).toBe(0);
  if (outcome === 'rolled-back') {
    expect((await M.Package.findById(p._id)).activeCommandId).not.toBeNull();
    clock += 1001; expect((await recover(make(), c)).command.phase).toBe('FAILED');
  }
});
test('RESOLVING never returns to publishing even when package visibility later changes', async () => {
  const c = await reservePending('COMMITTED'); clock += 1001;
  await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
  client.unbind.mockRejectedValueOnce(new Error('unknown cleanup'));
  expect((await recover(make(), c)).command.phase).toBe('RESOLVING');
  const saved = await row();
  await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'published', stateVersion: c.reservedPackageVersion } });
  clock += 1001;
  expect((await recover(make(), saved)).command.phase).toBe('FAILED');
  expect(await M.Attempt.countDocuments()).toBe(0); expect(client.prepare).not.toHaveBeenCalled();
});
test('rolled-back final publication remains committed pending and later recovers without compensation', async () => {
  const s = make({ transact: work => transact(async session => {
    const result = await work(session);
    const c = await M.Command.findOne({ phase: 'SUCCEEDED' }).session(session).lean();
    if (c) throw new Error('rollback final transaction');
    return result;
  }) });
  const result = await submit(s), c = await row();
  expect(result.command.phase).toBe('MEDIA_COMMITTED'); expect(await M.Attempt.countDocuments()).toBe(0);
  expect(client.abort).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled();
  clock += 1001;
  expect((await recover(make(), c)).command.phase).toBe('SUCCEEDED');
  expect(await M.Attempt.countDocuments()).toBe(1); expect(client.commit).toHaveBeenCalledTimes(1);
});
test('successor RESOLVING defeats an old final publisher held before its transaction writes', async () => {
  let entered, release;
  const arrived = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  const old = make({ transact: work => transact(async session => {
    if ((await row())?.phase === 'MEDIA_COMMITTED') { entered(); await held; }
    return work(session);
  }) });
  const submitting = submit(old);
  await arrived;
  try {
    const c = await row(); clock += 1001;
    await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
    expect((await recover(make(), c)).command.phase).toBe('FAILED');
  } finally { release(); }
  expect((await submitting).command.phase).toBe('FAILED');
  expect(await M.Attempt.countDocuments()).toBe(0);
});
test('final SUCCEEDED transaction defeats a competing recovery while the command row is locked', async () => {
  let entered, release;
  const arrived = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  const old = make({ transact: work => transact(async session => {
    const result = await work(session);
    if (await M.Command.exists({ phase: 'SUCCEEDED' }).session(session)) { entered(); await held; }
    return result;
  }) });
  const submitting = submit(old); await arrived;
  const c = await row(); clock += 1001;
  const recovering = recover(make(), c);
  release();
  const results = await Promise.all([submitting, recovering]);
  expect(results.map(r => r.command.phase)).toEqual(['SUCCEEDED', 'SUCCEEDED']);
  expect(await M.Attempt.countDocuments()).toBe(1); expect(client.unbind).not.toHaveBeenCalled();
});
test('bad cleanup receipt keeps RESOLVING lock instead of claiming failure completion', async () => {
  const c = await reservePending('COMMITTED'); clock += 1001;
  await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
  const original = client.unbind.getMockImplementation();
  client.unbind.mockImplementationOnce(async q => {
    const result = await original(q); result.references[0].resourceId = id(); return result;
  });
  expect((await recover(make(), c)).command.phase).toBe('RESOLVING');
  expect((await M.Package.findById(p._id)).activeCommandId).not.toBeNull();
});
test('terminal succeeded replay after withdrawal reveals only command acknowledgement', async () => {
  await submit(make()); const c = await row();
  await M.Package.updateOne({ _id: p._id }, { $set: { visibility: 'withdrawn' }, $inc: { stateVersion: 1 } });
  const result = await recover(make(), c);
  expect(result.command.phase).toBe('SUCCEEDED'); expect(Object.keys(result).sort()).toEqual(['command', 'pending']);
  expect(JSON.stringify(result)).not.toContain(body.note);
});
test('same public operation UUID for distinct child actors has independent random remote mappings', async () => {
  await submit(make()); const first = await row();
  identity = { ...identity, id: id() }; identity.childId = identity.id;
  p = await M.Package.create({ ...p.toObject(), _id: new mongoose.Types.ObjectId(), childId: identity.id });
  const second = await submit(make());
  const c = await M.Command.findById(second.command.id).lean();
  expect(c.operationId).toBe(first.operationId); expect(c.remoteOperationId).not.toBe(first.remoteOperationId);
  expect(await M.Command.countDocuments()).toBe(2); expect(await M.Attempt.countDocuments()).toBe(2);
});
test.each([0, -1, 1.5, NaN, Infinity])('invalid leaseMs %s is rejected before any persistence', leaseMs => {
  expect(() => make({ leaseMs })).toThrow('Invalid AI2 submission lease');
});
test.each([NaN, Infinity, 8640000000000000])('invalid or overflowing clock %s fails before reservation', async value => {
  await expect(submit(make({ now: () => value }))).rejects.toMatchObject({ code: 'AI2_NOT_READY' });
  expect(await M.Command.countDocuments()).toBe(0); expect(client.prepare).not.toHaveBeenCalled();
});
test.each(['payload', 'requestHash', 'expectedPackageVersion', 'reservedPackageVersion', 'referencesHash'])(
  'persisted %s corruption never drives remote writes or publishes', async field => {
    const c = await reservePending('COMMITTED');
    const value = { payload: { ...c.payload, note: 'CORRUPTED' }, requestHash: '0'.repeat(64),
      expectedPackageVersion: 99, reservedPackageVersion: 99, referencesHash: '0'.repeat(64) }[field];
    await M.Command.collection.updateOne({ _id: c._id }, { $set: { [field]: value } }); clock += 1001;
    client.status.mockClear();
    const result = await recover(make(), c);
    expect(result.pending).toBe(true); expect(result.command.phase).toBe('RESERVED');
    expect(client.status).not.toHaveBeenCalled(); expect(client.unbind).not.toHaveBeenCalled();
    expect(await M.Attempt.countDocuments()).toBe(0);
  });
