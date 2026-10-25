const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Retirement = require('../models/MediaOrphanRetirement');
const { orphanInventory, runOrphanCleanup } = require('../services/orphanRetentionOperations');
let mongo;
jest.setTimeout(30000);
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
});
beforeEach(async () => { for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({}); });
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
const snapshot = () => Promise.all(Object.values(mongoose.connection.collections).map(c => c.find().sort({ _id: 1 }).toArray()));
test('T2-G-008 inventory reads legacy and policy candidates without guard or retirement writes', async () => {
  const base = { familyId: new mongoose.Types.ObjectId(), childId: new mongoose.Types.ObjectId(),
    uploadedBy: new mongoose.Types.ObjectId(), purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 1 };
  for (let i = 0; i < 3; i += 1) await Asset.create({ ...base, storageKey: require('crypto').randomUUID(),
    ...(i ? { retentionPolicyVersion: 1, orphanEligibleAt: new Date(Date.now() + (i === 1 ? -10000 : 10000)) } : {}) });
  const before = await snapshot();
  expect(await orphanInventory({ connection: mongoose.connection, writesPaused: true }))
    .toEqual({ eligible: 1, missing_policy: 1, retained: 1, in_use: 0, inconsistent: 0 });
  expect(await snapshot()).toEqual(before); expect(await Retirement.countDocuments()).toBe(0);
});
test.each([{}, { COMPLETION_ORPHAN_CLEANUP_ENABLED: 'false' }, { COMPLETION_ORPHAN_CLEANUP_ENABLED: 'TRUE' },
  { COMPLETION_ORPHAN_CLEANUP_ENABLED: 'true', COMPLETION_PROTOCOL_MODE: 'legacy' }])
('T2-G-008 cleanup refuses default or invalid activation before database access %j', async env => {
  await expect(runOrphanCleanup({ connection: null, writesPaused: true, execute: true, env }))
    .rejects.toMatchObject({ code: 'COMPLETION_RETENTION_DISABLED' });
});
test.each([0, 101, -1, 1.5])('T2-G-008 invalid limit %s fails before accessing storage', async limit => {
  await expect(runOrphanCleanup({ connection: null, writesPaused: true, execute: true, limit,
    env: { COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_ORPHAN_CLEANUP_ENABLED: 'true' } }))
    .rejects.toMatchObject({ code: 'INVALID_OPERATIONS_ARGUMENTS' });
});
test('inventory cursor close failure is sanitized and never repairs the database', async () => {
  const close = jest.fn(async () => { throw Error('synthetic-private-path-token'); });
  const cursor = { async *[Symbol.asyncIterator]() {}, close };
  const connection = { db: { collection: jest.fn(() => ({ find: () => cursor })) } };
  await expect(orphanInventory({ connection, writesPaused: true }))
    .rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY', message: 'COMPLETION_RETENTION_NOT_READY' });
  expect(close).toHaveBeenCalledTimes(1);
});
