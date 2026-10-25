const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('../../../../node_modules/mongodb-memory-server');
const Operation = require('../models/MediaReferenceOperation');

jest.setTimeout(30000);
const objectId = () => new mongoose.Types.ObjectId();
const command = (overrides = {}) => ({
  familyId: objectId(), childId: objectId(), resourceType: 'growth_task', resourceId: objectId(),
  field: 'completionMediaIds', operationId: randomUUID(), commandHash: 'a'.repeat(64),
  referenceSetHash: 'b'.repeat(64), references: [{ mediaId: objectId(), field: 'completionMediaIds' }],
  state: 'PREPARED', leaseExpiresAt: new Date('2026-10-22T00:15:00.000Z'), ...overrides
});
let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Operation.init();
});
beforeEach(async () => { await Operation.deleteMany({}); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('persists canonical identities, digest and the original lease without automatic renewal', async () => {
  const value = command();
  const stored = await Operation.create(value);
  const read = await Operation.findById(stored.id).lean();
  expect(read).toMatchObject({ commandHash: value.commandHash, referenceSetHash: value.referenceSetHash,
    state: 'PREPARED', version: 0, failureCode: null, terminalAt: null, leaseExpiresAt: value.leaseExpiresAt });
  expect(read.references.map((ref) => Object.keys(ref).sort())).toEqual([['field', 'mediaId']]);
});

test('enforces the remote operation business key independent of its digest', async () => {
  const value = command();
  await Operation.create(value);
  await expect(Operation.create({ ...value, commandHash: 'c'.repeat(64) })).rejects.toMatchObject({ code: 11000 });
});

test.each(['familyId', 'childId', 'resourceId', 'operationId'])('keeps %s in the uniqueness scope', async (key) => {
  const value = command();
  await Operation.create(value);
  await expect(Operation.create({ ...value, [key]: key === 'operationId' ? randomUUID() : objectId() })).resolves.toBeDefined();
});

test('prevents ORM updates from changing identity or canonical references', async () => {
  const stored = await Operation.create(command());
  await Operation.updateOne({ _id: stored.id }, { $set: {
    operationId: randomUUID(), references: [{ mediaId: objectId(), field: 'completionMediaIds' }]
  } }, { runValidators: true });
  const read = await Operation.findById(stored.id);
  expect(read.operationId).toBe(stored.operationId);
  expect(read.references.map((ref) => String(ref.mediaId))).toEqual(stored.references.map((ref) => String(ref.mediaId)));
});

test.each([
  ['ABSENT persisted', { state: 'ABSENT' }],
  ['old attachment field', { field: 'attachmentMediaIds' }],
  ['other resource type', { resourceType: 'child' }],
  ['missing lease', { leaseExpiresAt: null }],
  ['prepared failure', { failureCode: 'MEDIA_OPERATION_EXPIRED' }],
  ['prepared terminal date', { terminalAt: new Date() }],
  ['empty references', { references: [] }],
  ['missing references', { references: undefined }],
  ['invalid UUID', { operationId: 'not-a-uuid' }],
  ['invalid command hash', { commandHash: 'A'.repeat(64) }],
  ['invalid reference hash', { referenceSetHash: 'short' }],
  ['negative version', { version: -1 }],
  ['fractional version', { version: 0.5 }],
  ['committed lease', { state: 'COMMITTED', terminalAt: new Date() }],
  ['missing terminal date', { state: 'COMMITTED', leaseExpiresAt: null }],
  ['aborted without code', { state: 'ABORTED', leaseExpiresAt: null, terminalAt: new Date() }],
  ['committed failure', { state: 'COMMITTED', leaseExpiresAt: null, terminalAt: new Date(), failureCode: 'MEDIA_OPERATION_ABORTED' }]
])('rejects %s', async (_label, patch) => {
  await expect(new Operation(command(patch)).validate()).rejects.toThrow();
});

test.each(['duplicate', 'eleven', 'wrong field', 'scalar'])('rejects %s references', async (kind) => {
  const ref = { mediaId: objectId(), field: 'completionMediaIds' };
  const references = kind === 'duplicate' ? [ref, ref]
    : kind === 'eleven' ? Array.from({ length: 11 }, () => ({ ...ref, mediaId: objectId() }))
      : kind === 'wrong field' ? [{ ...ref, field: 'attachmentMediaIds' }] : ref;
  await expect(new Operation(command({ references })).validate()).rejects.toThrow();
});

test.each(['COMMITTED', 'ABORTED'])('retains minimal %s terminal evidence across reads', async (state) => {
  const value = command({ state, leaseExpiresAt: null, terminalAt: new Date(),
    failureCode: state === 'ABORTED' ? 'MEDIA_OPERATION_ABORTED' : null });
  const stored = await Operation.create(value);
  const read = await Operation.findById(stored.id).lean();
  expect(read.state).toBe(state);
  expect(read.failureCode).toBe(value.failureCode);
  expect(read.terminalAt).toEqual(value.terminalAt);
  expect(read.leaseExpiresAt).toBeNull();
});

test('rejects private data and never configures a terminal TTL', () => {
  expect(() => new Operation(command({ storageKey: 'not allowed' }))).toThrow();
  expect(Operation.schema.indexes().every(([, options]) => options.expireAfterSeconds === undefined)).toBe(true);
});
