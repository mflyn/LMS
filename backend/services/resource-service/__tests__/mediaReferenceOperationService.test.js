const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const MediaAsset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createMediaReferenceService } = require('../services/mediaReferenceService');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');

jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId();
const START = Date.parse('2026-10-22T00:00:00.000Z');
let mongo, runner, service, legacy, time, scope;
const makeService = (options = {}) => createMediaReferenceOperationService({ transactionRunner: runner, now: () => time, ...options });
const fixture = async (count = 2, assetPatch = {}) => {
  const assets = await MediaAsset.create(Array.from({ length: count }, () => ({
    familyId: scope.familyId, childId: scope.childId, uploadedBy: id(), purpose: 'task_completion',
    mimeType: 'image/jpeg', sizeBytes: 100, storageKey: randomUUID(), ...assetPatch
  })));
  return { ...scope, operationId: randomUUID(), commandHash: 'a'.repeat(64),
    references: assets.map((asset) => ({ mediaId: String(asset._id), field: 'completionMediaIds' })) };
};
const status = (command) => service.status({ ...command, mode: 'operation' });
const row = (command) => Operation.findOne({ operationId: command.operationId }).lean();
const refs = (command) => Reference.find({ resourceId: command.resourceId }).sort({ mediaId: 1 }).lean();
const removal = (command) => ({ ...scope, operationId: randomUUID(),
  references: command.references.map(ref => ({ ...ref, bindingOperationId: command.operationId })) });

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  await MediaAsset.init(); await Reference.init(); await Operation.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  await Reference.deleteMany({}); await Operation.deleteMany({}); await MediaAsset.deleteMany({});
  time = START;
  scope = { familyId: String(id()), childId: String(id()), resourceType: 'growth_task', resourceId: String(id()) };
  service = makeService();
  legacy = createMediaReferenceService({ transactionRunner: runner, now: () => time });
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

describe('exact-generation unbind', () => {
  const committed = async (count = 2) => {
    const command = await fixture(count); await service.prepare(command); await service.commit(command); return command;
  };
  test.each([1, 10])('atomically releases %i refs without creating an audit operation or rewriting terminal facts', async count => {
    const c = await committed(count), input = removal(c), before = await row(c);
    const result = await service.unbind(input);
    expect(result.operation).toBeNull();
    expect(result.references).toHaveLength(count);
    expect(result.references.every(r => r.state === 'released' && r.bindingOperationId === c.operationId && r.privacyDeletion === null)).toBe(true);
    expect(await row(c)).toMatchObject({ state: 'COMMITTED', terminalAt: before.terminalAt,
      commandHash: before.commandHash, referenceSetHash: before.referenceSetHash, references: before.references, version: before.version + 1 });
    expect(await Operation.countDocuments()).toBe(1);
    expect((await refs(c)).every(r => r.releaseOperationId === input.operationId && r.releasedAt.getTime() === time)).toBe(true);
    expect(await MediaAsset.countDocuments({ status: 'active' })).toBe(count);
    const released = await refs(c), terminal = await row(c);
    time += 1000;
    await service.unbind({ ...input, operationId: randomUUID() });
    expect(await refs(c)).toEqual(released); expect(await row(c)).toEqual(terminal);
    for (const action of ['prepare', 'commit', 'abort']) {
      expect((await service[action](c)).operation.state).toBe('COMMITTED');
      expect((await refs(c)).every(r => r.state === 'released')).toBe(true);
    }
  });
  test('mixed bound/released/absent and distinct old generations converge without fabricated bindings', async () => {
    const a = await committed(2), b = await committed(1);
    await service.unbind({ ...removal(a), references: [removal(a).references[0]] });
    const absent = { mediaId: String(id()), field: 'completionMediaIds', bindingOperationId: randomUUID() };
    const input = { ...removal(a), references: [...removal(a).references, ...removal(b).references, absent] };
    const result = await service.unbind(input);
    expect(result.references.filter(r => r.state === 'released')).toHaveLength(3);
    expect(result.references.find(r => r.mediaId === absent.mediaId)).toEqual({ mediaId: absent.mediaId,
      field: absent.field, state: 'absent', privacyDeletion: null });
    expect(await Operation.countDocuments()).toBe(2);
  });
  test.each([false, true])('prepared is never partially released (expired=%s)', async expired => {
    const a = await committed(1), b = await fixture(2); await service.prepare(b);
    if (expired) time += 900000;
    const before = await refs(a), terminal = await row(a);
    await expect(service.unbind({ ...removal(a), references: [...removal(a).references, removal(b).references[0]] }))
      .rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
    expect(await refs(a)).toEqual(before); expect(await row(a)).toEqual(terminal);
    expect((await row(b)).state).toBe('PREPARED');
  });
  test.each(['prepared', 'bound', 'released'])('delayed old unbind cannot touch a newer %s generation', async state => {
    const a = await committed(), old = removal(a); await service.unbind(old);
    const b = { ...a, operationId: randomUUID() }; await service.prepare(b);
    if (state !== 'prepared') await service.commit(b);
    if (state === 'released') await service.unbind(removal(b));
    const before = await refs(b), op = await row(b);
    await expect(service.unbind(old)).rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
    expect(await refs(b)).toEqual(before); expect(await row(b)).toEqual(op);
    expect((await service.commit(a)).operation.state).toBe('COMMITTED');
    expect(await refs(b)).toEqual(before);
  });
  test('a failure after the second reference write rolls back all refs and operation fences', async () => {
    const c = await committed(), before = await refs(c), terminal = await row(c);
    const update = Reference.updateOne.bind(Reference); let writes = 0;
    const spy = jest.spyOn(Reference, 'updateOne').mockImplementation(async (...args) => {
      const result = await update(...args); if (++writes === 2) throw new Error('synthetic write failure'); return result;
    });
    await expect(service.unbind(removal(c))).rejects.toThrow('synthetic write failure'); spy.mockRestore();
    expect(await refs(c)).toEqual(before); expect(await row(c)).toEqual(terminal);
    expect((await service.unbind(removal(c))).references.every(r => r.state === 'released')).toBe(true);
  });
  test('concurrent retries retain one release audit and increment each old operation only once', async () => {
    const c = await committed(), before = await row(c), a = removal(c), b = removal(c);
    const results = await Promise.all([service.unbind(a), service.unbind(b)]);
    expect(results.every(r => r.references.every(ref => ref.state === 'released'))).toBe(true);
    const rows = await refs(c);
    expect(new Set(rows.map(r => r.releaseOperationId)).size).toBe(1);
    expect([a.operationId, b.operationId]).toContain(rows[0].releaseOperationId);
    expect((await row(c)).version).toBe(before.version + 1);
  });
  test('reference CAS miss rolls back prior release and old operation fence before retry', async () => {
    const c = await committed(), before = await row(c), input = removal(c);
    const update = Reference.updateOne.bind(Reference); let writes = 0;
    const spy = jest.spyOn(Reference, 'updateOne').mockImplementation((...args) => {
      if (++writes === 2) return Promise.resolve({ matchedCount: 0 });
      return update(...args);
    });
    expect((await service.unbind(input)).references.every(r => r.state === 'released')).toBe(true);
    spy.mockRestore();
    expect(writes).toBe(4); expect((await row(c)).version).toBe(before.version + 1);
    expect((await refs(c)).every(r => r.releaseOperationId === input.operationId)).toBe(true);
  });
  test('exhausted operation CAS retries remain pending and change no refs', async () => {
    const c = await committed(), before = await refs(c), terminal = await row(c);
    const spy = jest.spyOn(Operation, 'updateOne').mockResolvedValue({ matchedCount: 0 });
    await expect(service.unbind(removal(c))).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING', statusCode: 503 });
    expect(spy).toHaveBeenCalledTimes(5); spy.mockRestore();
    expect(await refs(c)).toEqual(before); expect(await row(c)).toEqual(terminal);
  });
  test.each(['missing operation', 'wrong terminal', 'wrong hash', 'extra ref'])('corrupt %s is rejected atomically', async kind => {
    const c = await committed();
    if (kind === 'missing operation') await Operation.deleteMany({});
    if (kind === 'wrong terminal') await Operation.collection.updateOne({ operationId: c.operationId }, { $set: { state: 'ABORTED' } });
    if (kind === 'wrong hash') await Operation.collection.updateOne({ operationId: c.operationId }, { $set: { referenceSetHash: 'f'.repeat(64) } });
    if (kind === 'extra ref') await Reference.create({ ...scope, ...c.references[0], mediaId: id(),
      state: 'bound', operationId: c.operationId, leaseExpiresAt: null });
    const before = await refs(c);
    await expect(service.unbind(removal(c))).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
    expect(await refs(c)).toEqual(before);
  });
  test.each(['familyId', 'childId', 'resourceId'])('different %s cannot release existing refs', async field => {
    const c = await committed(), before = await refs(c);
    const result = await service.unbind({ ...removal(c), [field]: String(id()) });
    expect(result.references.every(r => r.state === 'absent')).toBe(true); expect(await refs(c)).toEqual(before);
  });
  test.each([
    ['missing binding', c => { delete c.references[0].bindingOperationId; }],
    ['invalid binding', c => { c.references[0].bindingOperationId = 'not-a-uuid'; }],
    ['command hash', c => { c.commandHash = 'a'.repeat(64); }],
    ['empty refs', c => { c.references = []; }],
    ['duplicate', c => { c.references.push({ ...c.references[0] }); }],
    ['sparse', c => { c.references.length += 1; }]
  ])('rejects %s before writes', async (_name, mutate) => {
    const c = await committed(), input = removal(c), before = await refs(c); mutate(input);
    await expect(service.unbind(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(await refs(c)).toEqual(before);
  });
});

test.each(['prepare', 'commit', 'abort', 'status'])('%s rejects sparse provider references without entering a transaction', async action => {
  const c = await fixture(); delete c.references[0];
  const run = jest.fn(); const isolated = makeService({ transactionRunner: run });
  await expect(isolated[action]({ ...c, ...(action === 'status' ? { mode: 'operation' } : {}) }))
    .rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  expect(run).not.toHaveBeenCalled();
});

test('status of ABSENT is read-only and returns no private storage metadata', async () => {
  const command = await fixture();
  const result = await status(command);
  expect(result.operation).toEqual({ operationId: command.operationId, state: 'ABSENT', commandHash: null,
    leaseExpiresAt: null, leaseExpired: null, failureCode: null });
  expect(result.references).toEqual(expect.arrayContaining(command.references.map((ref) => ({ ...ref, state: 'absent', privacyDeletion: null }))));
  expect(await Operation.countDocuments()).toBe(0);
  expect(await Reference.countDocuments()).toBe(0);
});

test.each([1, 10])('prepares and commits %i references atomically, preserving original lease on retry', async (count) => {
  const command = await fixture(count);
  const prepared = await service.prepare(command);
  expect(prepared.operation).toMatchObject({ state: 'PREPARED', leaseExpiresAt: new Date(START + 900000).toISOString(), leaseExpired: false });
  time += 1000;
  expect((await service.prepare({ ...command, references: [...command.references].reverse() })).operation).toEqual(prepared.operation);
  const committed = await service.commit(command);
  expect(committed.operation).toMatchObject({ state: 'COMMITTED', leaseExpiresAt: null, failureCode: null });
  expect(committed.references).toHaveLength(count);
  expect(committed.references.every((ref) => ref.state === 'bound' && ref.bindingOperationId === command.operationId)).toBe(true);
  expect((await refs(command)).every((ref) => ref.state === 'bound')).toBe(true);
  expect((await row(command)).state).toBe('COMMITTED');
});

test.each(['prepare', 'commit', 'abort'])('%s at exact lease deadline aborts the whole group without a worker', async (action) => {
  const command = await fixture();
  await service.prepare(command);
  time += 900000;
  const before = await row(command);
  expect((await status(command)).operation).toMatchObject({ state: 'PREPARED', leaseExpired: true });
  expect(await row(command)).toEqual(before);
  const result = await service[action](command);
  expect(result.operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED', leaseExpiresAt: null });
  expect((await refs(command)).every((ref) => ref.state === 'released')).toBe(true);
  const terminal = await row(command);
  time += 1000;
  await service.prepare(command); await service.commit(command); await service.abort(command);
  expect(await row(command)).toEqual(terminal);
});

test.each(['prepare', 'abort'])('%s resamples the lease clock after the integrity query crosses the deadline', async (action) => {
  const command = await fixture(); await service.prepare(command);
  const deadline = START + 900000;
  time = deadline - 1;
  const original = Reference.exists.bind(Reference);
  const delayed = jest.spyOn(Reference, 'exists').mockImplementation((...args) => {
    const query = original(...args);
    const execute = query.exec.bind(query);
    query.exec = async (...options) => {
      const result = await execute(...options);
      time = deadline;
      return result;
    };
    return query;
  });
  const result = await service[action](command);
  delayed.mockRestore();
  expect(result.operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED',
    leaseExpiresAt: null, leaseExpired: null });
  expect(result.references).toHaveLength(2);
  expect(result.references.every((ref) => ref.state === 'released' && ref.bindingOperationId === command.operationId)).toBe(true);
  const terminal = await row(command), released = await refs(command);
  expect(terminal).toMatchObject({ state: 'ABORTED', version: 1, failureCode: 'MEDIA_OPERATION_EXPIRED',
    terminalAt: new Date(deadline), leaseExpiresAt: null });
  expect(released).toHaveLength(2);
  for (const ref of released) expect(ref).toMatchObject({ state: 'released', operationId: command.operationId,
    leaseExpiresAt: null, releasedAt: new Date(deadline), releaseOperationId: command.operationId });
  time += 1000;
  for (const replay of ['prepare', 'commit', 'abort']) {
    expect((await service[replay](command)).operation).toEqual(result.operation);
  }
  expect(await row(command)).toEqual(terminal);
  expect(await refs(command)).toEqual(released);
});

test('prepare calculates leaseExpired using the clock after its final reference read', async () => {
  const command = await fixture(); await service.prepare(command);
  const originalOperation = await row(command), originalRefs = await refs(command);
  time = START + 899999;
  const original = Reference.find.bind(Reference);
  let reads = 0;
  const delayed = jest.spyOn(Reference, 'find').mockImplementation((...args) => {
    const query = original(...args);
    const execute = query.exec.bind(query);
    query.exec = async (...options) => {
      const result = await execute(...options);
      if (++reads === 2) time += 1;
      return result;
    };
    return query;
  });
  const result = await service.prepare(command);
  delayed.mockRestore();
  expect(result.operation).toMatchObject({ state: 'PREPARED', leaseExpired: true,
    leaseExpiresAt: new Date(START + 900000).toISOString() });
  expect(await row(command)).toEqual(originalOperation);
  expect(await refs(command)).toEqual(originalRefs);
  expect((await status(command)).operation).toEqual(result.operation);
  expect((await service.commit(command)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED' });
  expect((await refs(command)).every((ref) => ref.state === 'released')).toBe(true);
});

test('commit before deadline succeeds and never expires or reverses on later abort', async () => {
  const command = await fixture(); await service.prepare(command);
  time += 899999;
  await service.commit(command);
  const terminal = await row(command);
  time += 100000;
  expect((await service.abort(command)).operation.state).toBe('COMMITTED');
  expect(await row(command)).toEqual(terminal);
  expect((await refs(command)).every((ref) => ref.state === 'bound')).toBe(true);
});

test('abort ABSENT persists a tombstone; late prepare and commit cannot resurrect it', async () => {
  const command = await fixture();
  expect((await service.abort(command)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_ABORTED' });
  const original = await row(command);
  await service.prepare(command); await service.commit(command);
  expect(await row(command)).toEqual(original);
  expect(await Reference.countDocuments()).toBe(0);
});

test('commit ABSENT refuses without creating a terminal record', async () => {
  const command = await fixture();
  await expect(service.commit(command)).rejects.toMatchObject({ statusCode: 409, code: 'MEDIA_OPERATION_NOT_PREPARED' });
  expect(await Operation.countDocuments()).toBe(0);
});

test.each(['missing', 'deleted', 'other child', 'other family', 'purpose'])('prepare %s media persists a stable ABORTED with no partial references', async (kind) => {
  const command = await fixture();
  const mediaId = command.references[1].mediaId;
  const patch = kind === 'deleted' ? { status: 'deleted', deletedAt: new Date(time) }
    : kind === 'other child' ? { childId: id() } : kind === 'other family' ? { familyId: id() } : { purpose: 'task_attachment' };
  if (kind === 'missing') await MediaAsset.deleteOne({ _id: mediaId });
  else await MediaAsset.updateOne({ _id: mediaId }, { $set: patch });
  const expected = kind === 'purpose' ? 'MEDIA_PURPOSE_MISMATCH'
    : kind.startsWith('other') ? 'CHILD_ACCESS_DENIED' : 'RESOURCE_NOT_FOUND';
  const result = await service.prepare(command);
  expect(result.operation).toMatchObject({ state: 'ABORTED', failureCode: expected });
  expect(await Reference.countDocuments()).toBe(0);
  expect((await service.prepare(command)).operation).toEqual(result.operation);
});

test.each(['prepare', 'commit', 'abort', 'status'])('%s rejects changed digest or set without changing operation or refs', async (action) => {
  const command = await fixture(); await service.prepare(command);
  const oldOperation = await row(command), oldRefs = await refs(command);
  for (const patch of [{ commandHash: 'b'.repeat(64) }, { references: command.references.slice(0, 1) }]) {
    await expect(service[action]({ ...command, ...patch, ...(action === 'status' ? { mode: 'operation' } : {}) }))
      .rejects.toMatchObject({ code: 'MEDIA_OPERATION_CONFLICT' });
  }
  expect(await row(command)).toEqual(oldOperation); expect(await refs(command)).toEqual(oldRefs);
});

test.each([null, {}, { references: [] }, { references: 'bad' }, { commandHash: 'bad' }, { operationId: 'bad' }, { extra: 'private' }, { mode: 'operation' }])('rejects invalid write input without persistence: %j', async (patch) => {
  const command = await fixture();
  const input = patch === null ? null : Object.keys(patch).length ? { ...command, ...patch } : {};
  await expect(service.prepare(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await Operation.countDocuments()).toBe(0);
});

test.each(['duplicate', 'eleven', 'old field', 'binding', 'null reference'])('rejects %s references before creating an operation', async (kind) => {
  const command = await fixture();
  command.references = kind === 'duplicate' ? [command.references[0], command.references[0]]
    : kind === 'eleven' ? Array.from({ length: 11 }, () => ({ mediaId: String(id()), field: 'completionMediaIds' }))
      : kind === 'old field' ? [{ ...command.references[0], field: 'attachmentMediaIds' }]
        : kind === 'binding' ? [{ ...command.references[0], bindingOperationId: randomUUID() }] : [null];
  await expect(service.prepare(command)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await Operation.countDocuments()).toBe(0);
});

test('concurrent first prepare requests converge on one operation and one group', async () => {
  const command = await fixture();
  const results = await Promise.all(Array.from({ length: 4 }, () => service.prepare(command)));
  expect(results.every((result) => result.operation.state === 'PREPARED')).toBe(true);
  expect(await Operation.countDocuments()).toBe(1); expect(await Reference.countDocuments()).toBe(2);
});

test.each([1, 2, 3])('commit and abort compete on the same record with no mixed references (%i)', async () => {
  const command = await fixture(); await service.prepare(command);
  await Promise.all([service.commit(command), service.abort(command)]);
  const terminal = await row(command);
  expect(['COMMITTED', 'ABORTED']).toContain(terminal.state);
  expect((await refs(command)).every((ref) => ref.state === (terminal.state === 'COMMITTED' ? 'bound' : 'released'))).toBe(true);
  await service.prepare(command);
  expect(await row(command)).toEqual(terminal);
});

test('abort racing the first prepare is durable and leaves no prepared references', async () => {
  const command = await fixture();
  await Promise.all([service.prepare(command), service.abort(command)]);
  expect((await row(command)).state).toBe('ABORTED');
  expect((await refs(command)).every((ref) => ref.state === 'released')).toBe(true);
});

test('a different command cannot steal another operation even after its lease expires', async () => {
  const command = await fixture(); await service.prepare(command); time += 900000;
  const next = { ...command, operationId: randomUUID(), commandHash: 'b'.repeat(64) };
  expect((await service.prepare(next)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_CONFLICT' });
  expect((await row(command)).state).toBe('PREPARED');
  expect((await refs(command)).every((ref) => ref.operationId === command.operationId && ref.state === 'prepared')).toBe(true);
});

test('new generation can bind after abort; replaying the old tombstone never rebinds or hides actual ownership', async () => {
  const command = await fixture(); await service.prepare(command); await service.abort(command);
  const next = { ...command, operationId: randomUUID(), commandHash: 'b'.repeat(64) };
  await service.prepare(next); await service.commit(next);
  const result = await service.prepare(command);
  expect(result.operation.state).toBe('ABORTED');
  expect(result.references.every((ref) => ref.bindingOperationId === next.operationId && ref.state === 'bound')).toBe(true);
});

test.each(['missing', 'other generation', 'unexpected bound'])('commit/abort refuse inconsistent %s rows without partial transitions', async (kind) => {
  const command = await fixture(); await service.prepare(command);
  const query = { mediaId: command.references[0].mediaId };
  if (kind === 'missing') await Reference.deleteOne(query);
  else await Reference.updateOne(query, { $set: kind === 'other generation' ? { operationId: randomUUID() } : { state: 'bound', leaseExpiresAt: null } });
  const original = await row(command), originalRefs = await refs(command);
  await expect(service.commit(command)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
  await expect(service.abort(command)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
  expect(await row(command)).toEqual(original); expect(await refs(command)).toEqual(originalRefs);
});

test('transaction failure rolls back the ledger and every reference', async () => {
  const command = await fixture();
  const broken = makeService({ transactionRunner: (work) => runner(async (session) => {
    await work(session); throw new Error('injected before commit');
  }) });
  await expect(broken.prepare(command)).rejects.toThrow('injected before commit');
  expect(await Operation.countDocuments()).toBe(0); expect(await Reference.countDocuments()).toBe(0);
});

test('failure after commit changes inside the transaction rolls back both state and references', async () => {
  const command = await fixture(); await service.prepare(command);
  const broken = makeService({ transactionRunner: (work) => runner(async (session) => {
    await work(session); throw new Error('injected before commit');
  }) });
  await expect(broken.commit(command)).rejects.toThrow('injected before commit');
  expect((await row(command)).state).toBe('PREPARED');
  expect((await refs(command)).every((ref) => ref.state === 'prepared')).toBe(true);
});

test('a lost success response recovers the persisted terminal without redoing writes', async () => {
  const command = await fixture(); await service.prepare(command);
  const uncertain = makeService({ transactionRunner: async (work) => { await runner(work); throw new Error('response lost'); } });
  await expect(uncertain.commit(command)).rejects.toThrow('response lost');
  const terminal = await row(command), committedRefs = await refs(command);
  expect((await makeService().commit(command)).operation.state).toBe('COMMITTED');
  expect(await row(command)).toEqual(terminal); expect(await refs(command)).toEqual(committedRefs);
});

test('transaction retry samples the clock again and aborts if the lease expired', async () => {
  const command = await fixture(); await service.prepare(command); time += 899999;
  let first = true;
  const retrying = makeService({ transactionRunner: (work) => runner(async (session) => {
    const result = await work(session);
    if (first) {
      first = false; time += 1;
      const error = new mongoose.mongo.MongoServerError({ message: 'retry transaction', code: 112 });
      error.addErrorLabel('TransientTransactionError'); throw error;
    }
    return result;
  }) });
  expect((await retrying.commit(command)).operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED' });
  expect((await refs(command)).every((ref) => ref.state === 'released')).toBe(true);
});

test('references status reports actual binding generations without command identity and never writes', async () => {
  const command = await fixture(); await service.prepare(command);
  const { operationId, commandHash: _commandHash, ...input } = command;
  const before = await refs(command);
  const result = await service.status({ ...input, mode: 'references' });
  expect(result.operation).toBeNull();
  expect(result.references.every((ref) => ref.bindingOperationId === operationId)).toBe(true);
  expect(await refs(command)).toEqual(before);
  await expect(service.status({ ...command, mode: 'references' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});

test.each(['prepare', 'commit', 'unbind'])('legacy %s cannot bypass the completion operation protocol', async (action) => {
  const command = await fixture(); await service.prepare(command);
  const { commandHash: _commandHash, ...input } = command;
  if (action === 'unbind') input.references = input.references.map((ref) => ({ ...ref, bindingOperationId: input.operationId }));
  await expect(legacy[action](input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect((await refs(command)).every((ref) => ref.state === 'prepared')).toBe(true);
});

test('legacy expiry cleanup cannot delete new protocol prepared rows', async () => {
  const command = await fixture(); await service.prepare(command); time += 900000;
  expect(await legacy.reclaimExpiredPrepared()).toEqual({ reclaimed: 0 });
  expect(await Reference.countDocuments()).toBe(2);
  expect((await row(command)).state).toBe('PREPARED');
});

test('legacy single-media release cannot partially release a completion group', async () => {
  const command = await fixture(); await service.prepare(command);
  await runner((session) => legacy.releasePreparedForDeletedMedia({ mediaId: command.references[0].mediaId,
    releasedAt: new Date(time), session }));
  expect((await refs(command)).every((ref) => ref.state === 'prepared')).toBe(true);
});

test('commit rechecks the deadline after acquiring the asset write fence', async () => {
  const command = await fixture(); await service.prepare(command); time += 899999;
  const original = MediaAsset.updateMany.bind(MediaAsset);
  jest.spyOn(MediaAsset, 'updateMany').mockImplementation(async (...args) => {
    const result = await original(...args); time += 1; return result;
  });
  const result = await service.commit(command);
  expect(result.operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED' });
  expect((await refs(command)).every((ref) => ref.state === 'released')).toBe(true);
});

test('commit rejects extra references owned by the same operation rather than leaving a half group', async () => {
  const command = await fixture(); await service.prepare(command);
  await Reference.create({ ...scope, field: 'completionMediaIds', mediaId: id(), operationId: command.operationId,
    state: 'prepared', leaseExpiresAt: new Date(START + 900000) });
  await expect(service.commit(command)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
  expect((await row(command)).state).toBe('PREPARED');
  expect((await refs(command)).every((ref) => ref.state === 'prepared')).toBe(true);
});

test('COMMITTED replay after release does not recreate references or reverse the terminal', async () => {
  const command = await fixture(); await service.prepare(command); await service.commit(command);
  await Reference.updateMany({ resourceId: command.resourceId }, { $set: {
    state: 'released', releasedAt: new Date(time), releaseOperationId: randomUUID()
  } });
  const terminal = await row(command), released = await refs(command);
  await service.prepare(command); await service.commit(command); await service.abort(command);
  expect(await row(command)).toEqual(terminal); expect(await refs(command)).toEqual(released);
});

test.each(['familyId', 'childId', 'resourceId'])('status cannot expose references through another %s', async (key) => {
  const command = await fixture(); await service.prepare(command);
  const result = await status({ ...command, [key]: String(id()) });
  expect(result.operation.state).toBe('ABSENT');
  expect(result.references.every((ref) => ref.state === 'absent' && !ref.bindingOperationId)).toBe(true);
  expect(await Operation.countDocuments()).toBe(1);
});

test('case and input order normalize to the same identity without creating another generation', async () => {
  const command = await fixture(); await service.prepare(command);
  const original = await row(command);
  const variant = { ...command, operationId: command.operationId.toUpperCase(), familyId: command.familyId.toUpperCase(),
    references: [...command.references].reverse().map((ref) => ({ ...ref, mediaId: ref.mediaId.toUpperCase() })) };
  expect((await service.prepare(variant)).operation.operationId).toBe(command.operationId);
  expect(await row(command)).toEqual(original);
  expect(await Operation.countDocuments()).toBe(1);
});

test.each(['cleaned', 'rebound'])('COMMITTED replay preserves terminal evidence after old references are %s', async (kind) => {
  const command = await fixture(); await service.prepare(command); await service.commit(command);
  const terminal = await row(command);
  await Reference.updateMany({ resourceId: command.resourceId }, { $set: { state: 'released', releasedAt: new Date(time) } });
  const next = { ...command, operationId: randomUUID(), commandHash: 'b'.repeat(64) };
  if (kind === 'cleaned') await Reference.deleteMany({ resourceId: command.resourceId });
  else { await service.prepare(next); await service.commit(next); }
  const current = await refs(command);
  for (const action of ['prepare', 'commit', 'abort']) {
    const result = await service[action](command);
    expect(result.operation.state).toBe('COMMITTED');
    expect(result.references.every((ref) => kind === 'cleaned' ? ref.state === 'absent'
      : ref.state === 'bound' && ref.bindingOperationId === next.operationId)).toBe(true);
  }
  expect(await row(command)).toEqual(terminal); expect(await refs(command)).toEqual(current);
});
