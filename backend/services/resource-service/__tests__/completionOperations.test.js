const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { promisify } = require('util');
const execFile = promisify(require('child_process').execFile);
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const { checkCompletionOperations, runCompletionCleanup } = require('../services/completionOperations');
const cli = path.resolve(__dirname, '../../../../scripts/completion-operations.js');
const models = [Asset, Reference, Operation, Tombstone, Receipt];
const id = () => new mongoose.Types.ObjectId();
let mongo, root, env;
jest.setTimeout(30000);
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  for (const model of models) await model.init();
});
beforeEach(async () => {
  for (const model of models) await model.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'completion-ops-')));
  await fs.chmod(root, 0o700);
  env = { MONGO_URI: mongo.getUri(), PRIVATE_MEDIA_ROOT: path.join(root, 'media'),
    COMPLETION_DELETION_JOURNAL_ROOT: path.join(root, 'journal'), COMPLETION_STORAGE_CONFIRMED: 'true' };
  await fs.mkdir(env.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
  await fs.mkdir(env.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
const options = () => ({ connection: mongoose.connection, writesPaused: true, env });
const snapshot = async () => Promise.all(models.map(async model => ({
  rows: await model.collection.find().sort({ _id: 1 }).toArray(), indexes: await model.collection.listIndexes().toArray()
})));
const deleted = async () => {
  const asset = { _id: id(), familyId: id(), childId: id(), purpose: 'task_completion', status: 'deleted',
    privacyDeletionRecorded: true, deletedAt: new Date(Date.now() - 31 * 86400000), mimeType: 'image/jpeg',
    storageKey: randomUUID(), __v: 0 };
  await Asset.collection.insertOne(asset);
  await Tombstone.create({ mediaId: asset._id, familyId: asset.familyId, childId: asset.childId, actorId: id(),
    role: 'parent', purpose: 'task_completion', reason: 'user_requested', deletedAt: asset.deletedAt });
  await fs.writeFile(path.join(env.PRIVATE_MEDIA_ROOT, asset.storageKey), 'synthetic-image', { mode: 0o600 });
  return asset;
};

test('check is read-only for database, never enables routes, and can be rerun after stopping the CLI', async () => {
  const before = await snapshot();
  const result = await checkCompletionOperations(options());
  expect(result).toEqual({ ready: true, service: 'resource-service', protocol: 'task-completion-v1', productionEnabled: false });
  for (let i = 0; i < 2; i += 1) {
    const child = await execFile(process.execPath, [cli, 'check', 'resource', '--writes-paused'], { env: { ...process.env, ...env } });
    expect(JSON.parse(child.stdout)).toEqual({ success: true, ...result });
  }
  expect(await snapshot()).toEqual(before);
});
test('actual missing index blocks cleanup without repair, then explicit synthetic index preparation unblocks', async () => {
  const asset = await deleted();
  await Operation.collection.dropIndexes();
  const before = await snapshot();
  try {
    await expect(runCompletionCleanup({ ...options(), execute: true })).rejects.toMatchObject({ code: 'COMPLETION_REFERENCES_NOT_READY' });
    expect(await snapshot()).toEqual(before);
    expect(await fs.readFile(path.join(env.PRIVATE_MEDIA_ROOT, asset.storageKey), 'utf8')).toBe('synthetic-image');
  } finally {
    for (const [key, settings] of Operation.schema.indexes()) await Operation.collection.createIndex(key, settings);
  }
  expect(await runCompletionCleanup({ ...options(), execute: true })).toEqual({ cleaned: 1 });
  expect(await Tombstone.countDocuments()).toBe(1);
});
test.each(['not paused', 'no execute', 'bad limit', 'unconfirmed storage', 'standalone'])('cleanup rejects %s before destructive work', async kind => {
  const asset = await deleted(); const before = await snapshot();
  const input = { ...options(), execute: true };
  if (kind === 'not paused') input.writesPaused = false;
  if (kind === 'no execute') input.execute = false;
  if (kind === 'bad limit') input.limit = 0;
  if (kind === 'unconfirmed storage') env.COMPLETION_STORAGE_CONFIRMED = 'false';
  if (kind === 'standalone') jest.spyOn(mongoose.connection.db, 'admin').mockReturnValue({ command: async () => ({ isWritablePrimary: true, maxWireVersion: 17 }) });
  await expect(runCompletionCleanup(input)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
  expect(await fs.readFile(path.join(env.PRIVATE_MEDIA_ROOT, asset.storageKey), 'utf8')).toBe('synthetic-image');
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual([]);
});
test('journal publication failure retains body and metadata; retry cleans once while preserving first audit', async () => {
  const asset = await deleted(), before = await snapshot();
  const link = fs.link.bind(fs);
  jest.spyOn(fs, 'link').mockImplementation((from, to) => to.endsWith(`${asset._id}.json`)
    ? Promise.reject(Error('synthetic-private-failure')) : link(from, to));
  await expect(runCompletionCleanup({ ...options(), execute: true })).rejects.toMatchObject({ code: 'COMPLETION_CLEANUP_FAILED' });
  expect(await snapshot()).toEqual(before);
  expect(await fs.readFile(path.join(env.PRIVATE_MEDIA_ROOT, asset.storageKey), 'utf8')).toBe('synthetic-image');
  jest.restoreAllMocks();
  expect(await runCompletionCleanup({ ...options(), execute: true })).toEqual({ cleaned: 1 });
  const journal = await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, `${asset._id}.json`), 'utf8');
  expect(await runCompletionCleanup({ ...options(), execute: true })).toEqual({ cleaned: 0 });
  expect(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, `${asset._id}.json`), 'utf8')).toBe(journal);
  expect(await Tombstone.countDocuments()).toBe(1);
  expect(await Asset.countDocuments()).toBe(0);
});
test('cleanup CLI emits counts only and needs explicit execution, with rerun rather than silent retry', async () => {
  const asset = await deleted();
  const child = await execFile(process.execPath, [cli, 'cleanup', 'resource', '--writes-paused', '--execute', '--limit=1'],
    { env: { ...process.env, ...env } });
  expect(JSON.parse(child.stdout)).toEqual({ success: true, cleaned: 1 });
  expect(child.stdout).not.toContain(String(asset._id));
  expect(await Asset.countDocuments()).toBe(0);
});
test('metadata rollback after durable journal and body removal recovers without replacing evidence', async () => {
  const asset = await deleted(), before = await snapshot();
  jest.spyOn(Asset, 'deleteOne').mockRejectedValueOnce(Error('synthetic-metadata-transaction-failure'));
  await expect(runCompletionCleanup({ ...options(), execute: true })).rejects.toMatchObject({ code: 'COMPLETION_CLEANUP_FAILED' });
  expect(await snapshot()).toEqual(before);
  await expect(fs.readFile(path.join(env.PRIVATE_MEDIA_ROOT, asset.storageKey))).rejects.toMatchObject({ code: 'ENOENT' });
  const destination = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, `${asset._id}.json`);
  const evidence = await fs.readFile(destination, 'utf8');
  jest.restoreAllMocks();
  expect(await runCompletionCleanup({ ...options(), execute: true })).toEqual({ cleaned: 1 });
  expect(await fs.readFile(destination, 'utf8')).toBe(evidence);
  expect(await Tombstone.countDocuments()).toBe(1);
  expect(await Asset.countDocuments()).toBe(0);
});
test('partial batch failure stops later candidates and explicit retry preserves every first audit', async () => {
  const assets = [await deleted(), await deleted(), await deleted()];
  assets.sort((a, b) => a.deletedAt - b.deletedAt || String(a._id).localeCompare(String(b._id)));
  const before = await Tombstone.find().sort({ _id: 1 }).lean();
  const link = fs.link.bind(fs);
  jest.spyOn(fs, 'link').mockImplementation((from, to) => to.endsWith(`${assets[1]._id}.json`)
    ? Promise.reject(Error('synthetic-middle-item-failure')) : link(from, to));
  await expect(runCompletionCleanup({ ...options(), execute: true })).rejects.toMatchObject({ code: 'COMPLETION_CLEANUP_FAILED' });
  expect(await Asset.findById(assets[0]._id)).toBeNull();
  for (const asset of assets.slice(1)) {
    expect(await Asset.findById(asset._id)).not.toBeNull();
    expect(await fs.readFile(path.join(env.PRIVATE_MEDIA_ROOT, asset.storageKey), 'utf8')).toBe('synthetic-image');
  }
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual([`${assets[0]._id}.json`]);
  const firstFile = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, `${assets[0]._id}.json`);
  const firstEvidence = await fs.readFile(firstFile, 'utf8');
  jest.restoreAllMocks();
  expect(await runCompletionCleanup({ ...options(), execute: true })).toEqual({ cleaned: 2 });
  expect(await fs.readFile(firstFile, 'utf8')).toBe(firstEvidence);
  expect(await Tombstone.find().sort({ _id: 1 }).lean()).toEqual(before);
  expect(await Asset.countDocuments()).toBe(0);
  expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual([]);
  expect(await runCompletionCleanup({ ...options(), execute: true })).toEqual({ cleaned: 0 });
});
test('homework CLI checks actual indexes and mappings on its own database without repairing rows', async () => {
  const db = mongoose.connection.useDb('synthetic_homework_ops').db;
  await db.createCollection('growthtaskcompletionoperations');
  const ledger = db.collection('growthtaskcompletionoperations');
  const run = () => execFile(process.execPath, [cli, 'check', 'homework', '--writes-paused'],
    { env: { ...process.env, MONGO_URI: mongo.getUri('synthetic_homework_ops') } });
  try {
    await expect(run()).rejects.toMatchObject({ code: 1 });
    expect(await ledger.listIndexes().toArray()).toHaveLength(1);
    await ledger.createIndex({ familyId: 1, childId: 1, taskId: 1, actorId: 1, action: 1, operationId: 1 }, { unique: true });
    await ledger.createIndex({ remoteOperationId: 1 }, { unique: true });
    expect(JSON.parse((await run()).stdout)).toEqual({ success: true, ready: true, service: 'homework-service',
      protocol: 'task-completion-v1', productionEnabled: false });
    await ledger.insertOne({ remoteOperationId: 'invalid-private-value' });
    let failure; try { await run(); } catch (error) { failure = error; }
    expect(failure.code).toBe(1);
    expect(JSON.parse(failure.stdout)).toEqual({ success: false, code: 'COMPLETION_PROTOCOL_NOT_READY' });
    expect(failure.stdout + failure.stderr).not.toContain('invalid-private-value');
    expect(await ledger.countDocuments()).toBe(1);
  } finally { await db.dropDatabase(); }
});
test('pre-activation synthetic index rehearsal can stop and restore exactly the original index set', async () => {
  const db = mongoose.connection.useDb('synthetic_pre_activation_rollback').db;
  await db.createCollection('growthtaskcompletionoperations');
  const ledger = db.collection('growthtaskcompletionoperations');
  const original = await ledger.listIndexes().toArray();
  try {
    const names = [];
    names.push(await ledger.createIndex({ familyId: 1, childId: 1, taskId: 1, actorId: 1, action: 1, operationId: 1 }, { unique: true }));
    names.push(await ledger.createIndex({ remoteOperationId: 1 }, { unique: true }));
    const result = await execFile(process.execPath, [cli, 'check', 'homework', '--writes-paused'],
      { env: { ...process.env, MONGO_URI: mongo.getUri('synthetic_pre_activation_rollback') } });
    expect(JSON.parse(result.stdout).productionEnabled).toBe(false);
    // No writer was enabled and no operation exists. Undo only this rehearsal's new indexes.
    expect(await ledger.countDocuments()).toBe(0);
    for (const name of names) await ledger.dropIndex(name);
    expect(await ledger.listIndexes().toArray()).toEqual(original);
    expect(await ledger.countDocuments()).toBe(0);
  } finally { await db.dropDatabase(); }
});
