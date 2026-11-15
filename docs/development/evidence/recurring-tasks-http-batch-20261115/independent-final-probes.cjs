const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const root = '<repo>';
const serviceRoot = root + '/backend/services/homework-service';
const hash = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const Plan = require(serviceRoot + '/models/RecurringTaskPlan');
const Command = require(serviceRoot + '/models/RecurringTaskPlanCommand');
const Task = require(serviceRoot + '/models/GrowthTask');
const Cursor = require(serviceRoot + '/models/RecurringTaskScanState');
const Family = require(root + '/backend/common/models/Family');
const User = require(root + '/backend/common/models/User');
const { runMongoTransaction } = require(root + '/backend/common/services/mongoTransaction');
const { createRecurringTaskPlanService } = require(serviceRoot + '/services/recurringTaskPlanService');
const { createRecurringTaskPlanScanner } = require(serviceRoot + '/services/recurringTaskPlanScanner');
const report = { scannerSha256: hash(serviceRoot + '/services/recurringTaskPlanScanner.js'), probes: [] };
const unknown = () => Object.assign(new Error('Synthetic lost reply after real commit'), { code: 'RECURRING_PLAN_WRITE_UNKNOWN' });
const outcome = promise => promise.then(() => 'RESOLVED', cause => cause.code);

(async () => {
  let mongo;
  try {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' } });
    await mongoose.connect(mongo.getUri('independent_terminal_unknown'));
    for (const Model of [Plan, Command, Task, Cursor, Family, User]) await Model.init();
    const parent = new mongoose.Types.ObjectId(), child = new mongoose.Types.ObjectId();
    const family = await Family.create({ familyName: 'Synthetic review', ownerParentId: parent, memberParentIds: [parent], childIds: [child], timezone: 'Asia/Shanghai' });
    await User.collection.insertMany([
      { _id: parent, role: 'parent', status: 'active', username: 'synthetic_parent', email: 'parent@example.test' },
      { _id: child, role: 'student', status: 'active', familyId: family._id, username: 'synthetic_child', email: 'child@example.test' }
    ]);
    let clock;
    const identity = { id: String(parent), role: 'parent' };
    const service = createRecurringTaskPlanService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose.connection, work }), now: () => clock, enabled: () => true });
    const reset = async () => {
      for (const Model of [Plan, Command, Task, Cursor]) await Model.deleteMany({});
      clock = Date.parse('2026-11-15T04:00:00Z');
      const result = await service.execute({ identity, action: 'create', body: { operationId: crypto.randomUUID(), childId: String(child),
        startDate: '2026-11-16', endDate: '2026-11-16', schedule: { kind: 'daily' },
        template: { title: 'Synthetic occurrence', dimension: 'physical', taskType: 'exercise' } } });
      assert.equal(await Task.countDocuments(), 0);
      return result.data.plan.id;
    };
    for (const state of ['ended', 'stopped']) {
      const planId = await reset(); clock = Date.parse('2026-11-16T04:00:00Z');
      let calls = 0;
      const scanner = createRecurringTaskPlanScanner({ enabled: () => true, service: { generate: async input => {
        calls++; const result = await service.generate(input); if (calls === 1) throw unknown(); return result;
      } } });
      const first = await scanner.tick(); assert.equal(first.failures, 1); assert.equal(await Task.countDocuments(), 1);
      if (state === 'stopped') await service.execute({ identity, action: 'stop', planId, body: { operationId: crypto.randomUUID(), expectedVersion: 1 } });
      const taskBefore = await Task.find().lean();
      const second = await scanner.tick(), third = await scanner.tick();
      assert.equal(second.processed, 1); assert.equal(second.healthy, true); assert.equal(third.processed, 0);
      assert.deepEqual(await Task.find().lean(), taskBefore); await scanner.stop();
      report.probes.push({ name: state + '_unknown_reconciles_from_zero_instances', passed: true, processed: [first.processed, second.processed, third.processed], taskCount: 1 });
    }
    const firstPlan = await reset();
    const template = await Plan.findById(firstPlan).lean();
    await Plan.insertMany(Array.from({ length: 50 }, () => ({ ...template, _id: new mongoose.Types.ObjectId() })));
    clock = Date.parse('2026-11-16T04:00:00Z');
    let lost = false; const visited = [];
    const paging = createRecurringTaskPlanScanner({ enabled: () => true, service: { generate: async input => {
      visited.push(input.planId); const result = await service.generate(input);
      if (input.planId === firstPlan && !lost) { lost = true; throw unknown(); } return result;
    } } });
    const pages = [await paging.tick(), await paging.tick(), await paging.tick(), await paging.tick()];
    assert.deepEqual(pages.map(page => page.processed), [50, 1, 1, 0]);
    assert.equal(new Set(visited.slice(0, 51)).size, 51); assert.equal(await Task.countDocuments(), 51);
    assert.equal(pages[2].healthy, true); await paging.stop();
    report.probes.push({ name: 'unresolved_low_id_respects_shared_50_page_cursor', passed: true, processed: pages.map(page => page.processed), uniquePlansBeforeRetry: 51, taskCount: 51 });

    for (const resultKind of ['success', 'unknown']) {
      await reset();
      let release, reached;
      const hold = new Promise(resolve => { release = resolve; }), entered = new Promise(resolve => { reached = resolve; });
      const scanner = createRecurringTaskPlanScanner({ enabled: () => true, stopTimeoutMs: 10, service: { generate: async input => {
        reached(); await hold; const result = await service.generate(input); if (resultKind === 'unknown') throw unknown(); return result;
      } } });
      const running = outcome(scanner.tick()); await entered;
      const firstStop = await outcome(scanner.stop()), secondStopInFlight = await outcome(scanner.stop());
      assert.equal(firstStop, 'RECURRING_SCAN_STOP_UNKNOWN'); assert.equal(secondStopInFlight, 'RECURRING_SCAN_STOP_UNKNOWN');
      release(); await running;
      const explicitRetry = await outcome(scanner.stop()), repeatedRetry = await outcome(scanner.stop());
      const expected = resultKind === 'success' ? 'RESOLVED' : 'RECURRING_SCAN_STOP_UNKNOWN';
      assert.equal(explicitRetry, expected); assert.equal(repeatedRetry, expected);
      report.probes.push({ name: 'timeout_then_late_' + resultKind, passed: true, firstStop, secondStopInFlight, explicitRetry, repeatedRetry });
    }
  } catch (cause) {
    report.failure = { name: cause.name, message: cause.message }; process.exitCode = 1;
  } finally {
    await mongoose.disconnect(); if (mongo) await mongo.stop();
  }
  report.success = !report.failure && report.probes.length === 5;
  report.note = 'Fresh isolated loopback Mongo replica set; real service transactions, controlled service-boundary reply loss and delays. Distinguishes late known success from explicit WRITE_UNKNOWN.';
  const output = '/tmp/recurring-b2-independent-terminal-unknown-r1-probes.json';
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, ...report }));
})().catch(cause => { console.error(cause); process.exitCode = 2; });
