const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Operation = require('../../models/GrowthTaskCompletionOperation');

const objectId = () => new mongoose.Types.ObjectId();
const command = (overrides = {}) => ({
  familyId: objectId(), childId: objectId(), taskId: objectId(), actorId: objectId(),
  action: 'complete', operationId: randomUUID(), remoteOperationId: randomUUID(),
  commandHash: 'a'.repeat(64), targetCompletionVersion: 1, ...overrides
});
const response = (value) => ({
  success: true,
  data: { task: {
    taskId: value.taskId, status: 'completed', checklistVersion: 0,
    completionVersion: value.targetCompletionVersion, completionMediaIds: [],
    completionMediaReferenceState: 'stable', parentConfirmed: false,
    completedAt: new Date('2026-10-22T00:00:00.000Z')
  } }
});

beforeAll(async () => { await Operation.init(); });

test('persists the complete scope and remote identity across reads', async () => {
  const value = command();
  await Operation.create(value);
  const stored = await Operation.findOne({ operationId: value.operationId }).lean();
  expect(stored).toMatchObject({
    remoteOperationId: value.remoteOperationId, commandHash: value.commandHash,
    phase: 'PREPUBLISH', version: 0, successResponse: null, failureCode: null
  });
  expect(String(stored.actorId)).toBe(String(value.actorId));
});

test('allows different actors to use the same client UUID with distinct remote identities', async () => {
  const value = command();
  await Operation.create(value);
  const second = await Operation.create({ ...value, actorId: objectId(), remoteOperationId: randomUUID() });
  expect(second.operationId).toBe(value.operationId);
  expect(second.remoteOperationId).not.toBe(value.remoteOperationId);
});

test('rejects duplicate business keys even with a fresh remote identity', async () => {
  const value = command();
  await Operation.create(value);
  await expect(Operation.create({ ...value, remoteOperationId: randomUUID() })).rejects.toMatchObject({ code: 11000 });
});

test('rejects reuse of a remote identity by a different command', async () => {
  const value = command();
  await Operation.create(value);
  await expect(Operation.create(command({ remoteOperationId: value.remoteOperationId }))).rejects.toMatchObject({ code: 11000 });
});

test('does not allow an ORM update to rewrite command identity or digest', async () => {
  const value = command();
  const stored = await Operation.create(value);
  await Operation.updateOne({ _id: stored.id }, { $set: {
    remoteOperationId: randomUUID(), commandHash: 'b'.repeat(64)
  } }, { runValidators: true });
  const read = await Operation.findById(stored.id).lean();
  expect(read.remoteOperationId).toBe(value.remoteOperationId);
  expect(read.commandHash).toBe(value.commandHash);
});

test.each(['familyId', 'childId', 'taskId', 'actorId', 'operationId'])('keeps %s in the business uniqueness scope', async (key) => {
  const value = command();
  await Operation.create(value);
  await expect(Operation.create({ ...value, remoteOperationId: randomUUID(),
    [key]: key === 'operationId' ? randomUUID() : objectId()
  })).resolves.toBeDefined();
});

test.each([0, 1, 10])('publishes a previously reserved command with %i ordered media IDs', async (count) => {
  const value = command();
  const stored = await Operation.create(value);
  stored.phase = 'SUCCEEDED';
  stored.successResponse = response(value);
  stored.successResponse.data.task.completionMediaIds = Array.from({ length: count }, objectId);
  await stored.save();
  const read = await Operation.findById(stored.id).lean();
  expect(read.remoteOperationId).toBe(value.remoteOperationId);
  expect(read.successResponse.data.task.completionMediaIds.map(String))
    .toEqual(stored.successResponse.data.task.completionMediaIds.map(String));
});

test.each([
  ['missing remote mapping', { remoteOperationId: undefined }],
  ['invalid client UUID', { operationId: 'not-a-uuid' }],
  ['invalid remote UUID', { remoteOperationId: 'not-a-uuid' }],
  ['invalid digest', { commandHash: 'not-a-hash' }],
  ['invalid action', { action: 'confirm' }],
  ['invalid phase', { phase: 'ABSENT' }],
  ['zero target version', { targetCompletionVersion: 0 }],
  ['fractional target version', { targetCompletionVersion: 1.5 }],
  ['fractional CAS version', { version: 0.5 }],
  ['negative CAS version', { version: -1 }],
  ['published without snapshot', { phase: 'PUBLISHED_CLEANUP' }],
  ['success without snapshot', { phase: 'SUCCEEDED' }],
  ['failure without stable result', { phase: 'FAILED' }],
  ['failure data on pending command', { failureCode: 'MEDIA_OPERATION_ABORTED', failureStatus: 409 }]
])('rejects %s', async (_label, patch) => {
  await expect(new Operation(command(patch)).validate()).rejects.toThrow();
});

test.each(['PUBLISHED_CLEANUP', 'SUCCEEDED'])('round-trips the fixed success snapshot in %s', async (phase) => {
  const value = command({ phase });
  value.successResponse = response(value);
  value.successResponse.data.task.completionMediaIds = [objectId(), objectId()];
  const stored = await Operation.create(value);
  const read = await Operation.findById(stored.id).lean();
  expect(JSON.parse(JSON.stringify(read.successResponse))).toEqual(JSON.parse(JSON.stringify(value.successResponse)));
});

test.each(['PREPUBLISH', 'FAILED'])('rejects a success snapshot in %s', async (phase) => {
  const value = command({ phase, ...(phase === 'FAILED' ? { failureCode: 'MEDIA_OPERATION_ABORTED', failureStatus: 409 } : {}) });
  await expect(new Operation({ ...value, successResponse: response(value) }).validate()).rejects.toThrow();
});

test.each(['wrong task', 'wrong version', 'duplicate media', 'eleven media', 'scalar media', 'wrong status', 'confirmed', 'unsuccessful'])('rejects snapshot with %s', async (kind) => {
  const value = command({ phase: 'SUCCEEDED' });
  value.successResponse = response(value);
  const task = value.successResponse.data.task;
  if (kind === 'wrong task') task.taskId = objectId();
  if (kind === 'wrong version') task.completionVersion = 2;
  if (kind === 'duplicate media') { const id = objectId(); task.completionMediaIds = [id, id]; }
  if (kind === 'eleven media') task.completionMediaIds = Array.from({ length: 11 }, objectId);
  if (kind === 'scalar media') task.completionMediaIds = objectId();
  if (kind === 'wrong status') task.status = 'confirmed';
  if (kind === 'confirmed') task.parentConfirmed = true;
  if (kind === 'unsuccessful') value.successResponse.success = false;
  await expect(new Operation(value).validate()).rejects.toThrow();
});

test('rejects non-contract data instead of persisting private content in snapshots', () => {
  const value = command({ phase: 'SUCCEEDED' });
  value.successResponse = response(value);
  value.successResponse.data.task.signedUrl = 'https://example.invalid/private';
  expect(new Operation(value).validateSync()).toBeDefined();
  expect(() => new Operation(command({ rawRequest: 'not allowed' }))).toThrow();
});

test('persists a minimal stable failure result without a success snapshot', async () => {
  const stored = await Operation.create(command({ phase: 'FAILED', failureCode: 'MEDIA_OPERATION_EXPIRED', failureStatus: 409 }));
  expect(stored.failureCode).toBe('MEDIA_OPERATION_EXPIRED');
  expect(stored.successResponse).toBeNull();
});

test('does not TTL-delete mappings or replay results', () => {
  expect(Operation.schema.indexes().every(([, options]) => options.expireAfterSeconds === undefined)).toBe(true);
});
