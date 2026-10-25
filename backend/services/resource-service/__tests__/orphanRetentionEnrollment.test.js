const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Family = require('../../../common/models/Family');
const User = require('../models/FamilyUser');
const Retirement = require('../models/MediaOrphanRetirement');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createOrphanRetentionEnrollment } = require('../services/orphanRetentionEnrollment');
let mongo, runner, familyId, childId, parentId, asset, now;
const id = () => new mongoose.Types.ObjectId();
const run = options => createOrphanRetentionEnrollment({ transactionRunner: runner, now: () => now })
  .enroll({ familyId: String(familyId), childId: String(childId), mediaId: String(asset._id), writesPaused: true, execute: true, ...options });
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  familyId = id(); childId = id(); parentId = id(); now = Date.now();
  await Family.create({ _id: familyId, familyName: 'Synthetic', ownerParentId: parentId, memberParentIds: [parentId], childIds: [childId] });
  await User.create({ _id: childId, familyId, role: 'student' });
  asset = await Asset.create({ familyId, childId, uploadedBy: parentId, purpose: 'task_completion',
    storageKey: randomUUID(), mimeType: 'image/jpeg', sizeBytes: 9, createdAt: new Date(now - 30 * 86400000) });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
test('historical enrollment provides a full new grace period, repeat does not extend it or delete', async () => {
  const before = await Asset.findById(asset._id).lean();
  expect(await run()).toEqual({ enrolled: true, mediaId: String(asset._id) });
  const enrolled = await Asset.findById(asset._id).lean();
  expect(enrolled.orphanEligibleAt.getTime()).toBe(now + 86400000);
  expect(enrolled.status).toBe('active'); expect(enrolled.createdAt).toEqual(before.createdAt);
  now += 5000; expect(await run()).toEqual({ enrolled: false, mediaId: String(asset._id) });
  expect(await Asset.findById(asset._id).lean()).toEqual(enrolled);
  expect(await Retirement.countDocuments()).toBe(0);
});
test.each(['writes', 'execute', 'family', 'child', 'purpose', 'partial-policy', 'prepared', 'committed', 'released-committed'])
('historical enrollment rejects %s and preserves all collections', async kind => {
  const input = {};
  if (kind === 'writes') input.writesPaused = false;
  if (kind === 'execute') input.execute = false;
  if (kind === 'family') input.familyId = String(id());
  if (kind === 'child') await User.updateOne({ _id: childId }, { familyId: id() });
  if (kind === 'purpose') await Asset.updateOne({ _id: asset._id }, { purpose: 'task_attachment' });
  if (kind === 'partial-policy') await Asset.collection.updateOne({ _id: asset._id }, { $set: { retentionPolicyVersion: 1 } });
  if (['prepared', 'committed', 'released-committed'].includes(kind)) {
    const protocol = createMediaReferenceOperationService({ transactionRunner: runner });
    const command = { familyId: String(familyId), childId: String(childId), resourceId: String(id()), resourceType: 'growth_task',
      operationId: randomUUID(), commandHash: 'a'.repeat(64), references: [{ mediaId: String(asset._id), field: 'completionMediaIds' }] };
    await protocol.prepare(command);
    if (kind !== 'prepared') await protocol.commit(command);
    if (kind === 'released-committed') {
      const { commandHash, ...unbind } = command;
      await protocol.unbind({ ...unbind, operationId: randomUUID(),
        references: command.references.map(ref => ({ ...ref, bindingOperationId: command.operationId })) });
    }
  }
  const snapshot = () => Promise.all(Object.values(mongoose.connection.collections).map(c => c.find().sort({ _id: 1 }).toArray()));
  const before = await snapshot();
  await expect(run(input)).rejects.toBeDefined(); expect(await snapshot()).toEqual(before);
});
