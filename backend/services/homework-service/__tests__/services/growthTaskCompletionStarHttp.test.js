const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Ledger = require('../../../progress-service/models/StarLedgerEntry');
const internalStars = require('../../../progress-service/routes/internalStars');
const { calculateBalance } = require('../../../progress-service/services/starLedgerService');
const { createStarAwardClient } = require('../../services/starAwardClient');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionConfirmationService } = require('../../services/growthTaskCompletionConfirmationService');
const { createGrowthTaskCompletionRouter } = require('../../routes/growthTaskCompletion');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');

const id = () => String(new mongoose.Types.ObjectId());
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const http = axios.create({ proxy: false, timeout: 5000, validateStatus: () => true });
let servers, progressUrl, homeworkUrl, family, parent, second, child, outsider, task, client, confirmer;
let remoteFault, publicDrop, transactionFault, calls, leaveAfterAward;
const makeApp = () => { const app = express(); app.locals.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }; app.use(express.json()); return app; };
const listen = async app => {
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  }); servers.push(server); return 'http://127.0.0.1:' + server.address().port;
};
const patch = (action, body, identity = parent) => {
  const target = `/api/growth-tasks/${task._id}/${action}`;
  return http.patch(homeworkUrl + target, body, { headers: createIdentityHeaders({ method: 'PATCH', originalUrl: target,
    user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET }) });
};
const confirm = (identity = parent, body = {}) => patch('confirm', { expectedCompletionVersion: 1, ...body }, identity);
const complete = async (version = 0) => {
  const response = await patch('complete', { operationId: randomUUID(), expectedCompletionVersion: version,
    expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [] }, child);
  expect(response.status).toBe(200); return response;
};
const fail = (response, status, code) => {
  expect(response.status).toBe(status); expect(response.data).toMatchObject({ success: false, error: { code, details: [] } });
  expect(JSON.stringify(response.data)).not.toMatch(/private-sentinel|remoteOperationId|commandHash|stack|config/);
  expect(JSON.stringify(response.data)).not.toContain(TOKEN);
};
const taskRow = () => Task.collection.findOne({ _id: task._id });
const audit = row => ({ parent: String(row.confirmedByParentId), at: row.confirmedAt, feedback: row.parentFeedback });
const oneAward = async () => {
  const rows = await Ledger.find().lean(); expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ type: 'earn', amount: 1, sourceType: 'task_confirmation',
    sourceId: String(task._id), createdBy: 'homework-service' });
  expect(String(rows[0].familyId)).toBe(String(family._id)); expect(String(rows[0].childId)).toBe(child.id);
  expect(await calculateBalance({ familyId: family._id, childId: new mongoose.Types.ObjectId(child.id) })).toBe(1);
  return rows[0];
};
const makeClient = (token = TOKEN, options = {}) => createStarAwardClient({ progressServiceUrl: progressUrl, internalServiceToken: token,
  axiosInstance: axios.create({ proxy: false, timeout: 3000 }), timeout: 3000, retryAttempts: 0, ...options });
const makeConfirmer = () => createGrowthTaskCompletionConfirmationService({
  transactionRunner: async (work, label) => {
    const fault = transactionFault?.label === label ? transactionFault : null;
    if (fault) transactionFault = null;
    const result = await runner(async session => {
      const value = await work(session);
      if (fault?.kind === 'rollback') throw Error('private-sentinel rollback');
      return value;
    });
    if (fault?.kind === 'lost-ack') throw Error('private-sentinel lost acknowledgement');
    return result;
  }, awardTaskStar: async payload => {
    const result = await client.awardTaskStar(payload);
    if (leaveAfterAward) {
      const parentId = leaveAfterAward; leaveAfterAward = null;
      await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: parentId } });
    }
    return result;
  }
});

beforeAll(async () => { for (const model of [Task, Operation, Family, User, Ledger]) await model.init(); });
beforeEach(async () => {
  servers = []; calls = []; remoteFault = null; publicDrop = false; transactionFault = null; leaveAfterAward = null;
  parent = { id: id(), role: 'parent' }; second = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic star HTTP', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [child.id] });
  Object.assign(child, { familyId: String(family._id), childId: child.id });
  await User.collection.insertMany([parent, second, outsider, child].map(u => ({ _id: new mongoose.Types.ObjectId(u.id),
    role: u.role, username: u.id, email: u.id + '@example.test',
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    title: 'Synthetic task', dimension: 'physical', taskType: 'practice', dueDate: '2026-10-22' });
  const progress = makeApp();
  progress.use((req, res, next) => {
    calls.push({ body: req.body, tokenAccepted: req.get('x-service-token') === TOKEN });
    if (remoteFault === 'unavailable') { remoteFault = null; return res.status(503).json({ success: false, error: { code: 'INTERNAL_ERROR' } }); }
    const json = res.json;
    res.json = function emit(body) {
      if (body.success && remoteFault) {
        const fault = remoteFault; remoteFault = null;
        if (fault === 'drop') { this.destroy(); return this; }
        if (fault === 'missing-ledger') delete body.data.ledgerEntryId;
        if (fault === 'bad-balance') body.data.starBalance = -1;
        if (fault === 'bad-awarded') body.data.awarded = 'true';
      }
      return json.call(this, body);
    }; next();
  });
  progress.use('/api/internal/stars', internalStars); progress.use(errorHandler); progressUrl = await listen(progress);
  client = makeClient(); confirmer = makeConfirmer();
  const homework = makeApp();
  homework.use((req, res, next) => {
    const json = res.json;
    res.json = function emit(body) {
      if (publicDrop && req.path.endsWith('/confirm') && body.success) { publicDrop = false; this.destroy(); return this; }
      return json.call(this, body);
    }; next();
  });
  const unusedMedia = Object.fromEntries(['prepare', 'commit', 'abort', 'status', 'unbind'].map(k => [k, async () => { throw Error('Media outside this batch'); }]));
  homework.use('/api/growth-tasks', createGrowthTaskCompletionRouter({
    completionService: createGrowthTaskCompletionService({ transactionRunner: runner, mediaReferenceClient: unusedMedia }),
    confirmationService: { confirm: command => confirmer.confirm(command) }
  }));
  homework.use(errorHandler); homeworkUrl = await listen(homework);
});
afterEach(async () => {
  for (const s of servers || []) { s.closeAllConnections(); await new Promise((resolve, reject) => s.close(e => e ? reject(e) : resolve())); }
  jest.restoreAllMocks();
});

test('version confirmation awards through the real client, credential route and immutable ledger once', async () => {
  expect((await complete()).status).toBe(200);
  const response = await confirm(parent, { parentFeedback: 'first audit' }); expect(response.status).toBe(200);
  const row = await oneAward();
  expect(response.data.data.starAward).toEqual({ awarded: true, ledgerEntryId: String(row._id), starBalance: 1 });
  expect(response.data.data.task).toMatchObject({ status: 'confirmed', completionVersion: 1, starAwardState: 'awarded', confirmedByParentId: parent.id });
  expect(calls).toHaveLength(1); expect(calls[0]).toEqual({ tokenAccepted: true,
    body: { familyId: String(family._id), childId: child.id, taskId: String(task._id), confirmedByParentId: parent.id } });
  const before = await taskRow(); expect((await confirm(second, { parentFeedback: 'ignored' })).status).toBe(200);
  expect(await taskRow()).toEqual(before); expect(calls).toHaveLength(1); expect(await oneAward()).toEqual(row);
});

test('old completion version is rejected without a remote award or local confirmation', async () => {
  await complete(); await complete(1); const before = await taskRow();
  fail(await confirm(), 409, 'VERSION_CONFLICT'); expect(calls).toHaveLength(0);
  expect(await Ledger.countDocuments()).toBe(0); expect(await taskRow()).toEqual(before);
});

test('legacy completed version zero is confirmed and awarded once without incrementing completion version', async () => {
  await Task.updateOne({ _id: task._id }, { $set: { status: 'completed', completedAt: new Date() } });
  const response = await confirm(parent, { expectedCompletionVersion: 0 }); expect(response.status).toBe(200);
  expect(response.data.data.task.completionVersion).toBe(0); await oneAward();
  expect((await confirm(second, { expectedCompletionVersion: 0 })).status).toBe(200); expect(calls).toHaveLength(1);
});

test.each(['child', 'outsider', 'departed'])('%s cannot initiate confirmation or a star HTTP request', async kind => {
  await complete(); if (kind === 'departed') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  fail(await confirm(kind === 'child' ? child : kind === 'outsider' ? outsider : second), 403, 'CHILD_ACCESS_DENIED');
  expect(calls).toHaveLength(0); expect(await Ledger.countDocuments()).toBe(0);
});

test('pending completion owner blocks confirmation before star HTTP', async () => {
  await complete(); await Task.collection.updateOne({ _id: task._id }, { $set: { activeCompletionOperation: { operationId: randomUUID() } } });
  fail(await confirm(), 503, 'MEDIA_REFERENCE_PENDING'); expect(calls).toHaveLength(0); expect(await Ledger.countDocuments()).toBe(0);
});

test('lost public confirmation response replays awarded state without another remote call', async () => {
  await complete(); publicDrop = true;
  await expect(confirm(parent, { parentFeedback: 'first' })).rejects.toMatchObject({ code: 'ECONNRESET' });
  expect(publicDrop).toBe(false); const before = await taskRow(), ledger = await oneAward();
  expect(before.starAwardState).toBe('awarded'); expect((await confirm(second)).status).toBe(200);
  expect(await taskRow()).toEqual(before); expect(await oneAward()).toEqual(ledger); expect(calls).toHaveLength(1);
});

test('remote ledger committed then response lost is recovered by current coparent after first confirmer leaves', async () => {
  await complete(); remoteFault = 'drop'; fail(await confirm(second, { parentFeedback: 'first' }), 503, 'STAR_AWARD_PENDING');
  expect(remoteFault).toBeNull(); const before = await taskRow(), ledger = await oneAward(); expect(before.starAwardState).toBe('pending');
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  fail(await confirm(second), 403, 'CHILD_ACCESS_DENIED'); expect(calls).toHaveLength(1);
  client = makeClient(); confirmer = makeConfirmer();
  const response = await confirm(parent, { parentFeedback: 'do not replace' }); expect(response.status).toBe(200);
  expect(response.data.data.starAward).toEqual({ awarded: false, ledgerEntryId: String(ledger._id), starBalance: 1 });
  expect(audit(await taskRow())).toEqual(audit(before)); expect((await taskRow()).starAwardState).toBe('awarded');
  expect(calls.map(c => c.body.confirmedByParentId)).toEqual([second.id, parent.id]); expect(await oneAward()).toEqual(ledger);
});

test.each(['unavailable', 'bad-credential'])('%s before remote award remains pending and can retry', async kind => {
  await complete(); if (kind === 'unavailable') remoteFault = kind; else client = makeClient('synthetic-invalid-service-token-32-characters');
  fail(await confirm(), 503, 'STAR_AWARD_PENDING'); expect(await Ledger.countDocuments()).toBe(0);
  const before = await taskRow(); expect(before.status).toBe('confirmed'); expect(before.starAwardState).toBe('pending');
  client = makeClient(); expect((await confirm(second)).status).toBe(200); await oneAward();
  expect(audit(await taskRow())).toEqual(audit(before));
});

test.each(['missing-ledger', 'bad-balance', 'bad-awarded'])('malformed %s after actual ledger write cannot mark local awarded', async fault => {
  await complete(); remoteFault = fault; fail(await confirm(), 503, 'STAR_AWARD_PENDING'); expect(remoteFault).toBeNull();
  const before = await taskRow(), ledger = await oneAward(); expect(before.starAwardState).toBe('pending');
  const response = await confirm(second); expect(response.status).toBe(200); expect(response.data.data.starAward.awarded).toBe(false);
  expect(audit(await taskRow())).toEqual(audit(before)); expect(await oneAward()).toEqual(ledger);
});

test.each(['rollback', 'lost-ack'])('local award transaction %s recovers after actual remote award without duplicates', async kind => {
  await complete(); transactionFault = { label: 'award', kind };
  fail(await confirm(parent, { parentFeedback: 'first' }), 503, 'STAR_AWARD_PENDING'); expect(transactionFault).toBeNull();
  const before = await taskRow(), ledger = await oneAward(); expect(before.starAwardState).toBe(kind === 'rollback' ? 'pending' : 'awarded');
  const response = await confirm(second, { parentFeedback: 'ignored' }); expect(response.status).toBe(200);
  expect(audit(await taskRow())).toEqual(audit(before)); expect(await oneAward()).toEqual(ledger);
  expect(calls).toHaveLength(kind === 'rollback' ? 2 : 1);
});

test.each(['rollback', 'lost-ack'])('local confirmation transaction %s never awards before confirmed intent is known', async kind => {
  await complete(); transactionFault = { label: 'confirm', kind };
  fail(await confirm(second, { parentFeedback: 'first' }), 503, 'STAR_AWARD_PENDING'); expect(transactionFault).toBeNull();
  const before = await taskRow(); expect(calls).toHaveLength(0); expect(await Ledger.countDocuments()).toBe(0);
  expect(before.status).toBe(kind === 'rollback' ? 'completed' : 'confirmed');
  expect((await confirm(parent, { parentFeedback: 'retry' })).status).toBe(200); await oneAward();
  if (kind === 'lost-ack') expect(audit(await taskRow())).toEqual(audit(before));
  else expect(String((await taskRow()).confirmedByParentId)).toBe(parent.id);
});

test('concurrent coparent confirmations converge to one ledger entry and one first confirmation audit', async () => {
  await complete();
  const results = await Promise.all([confirm(parent, { parentFeedback: 'parent' }), confirm(second, { parentFeedback: 'second' })]);
  for (const r of results) {
    expect([200, 503]).toContain(r.status);
    if (r.status === 503) fail(r, 503, 'STAR_AWARD_PENDING');
  }
  const firstAudit = audit(await taskRow()); expect([parent.id, second.id]).toContain(firstAudit.parent);
  expect(firstAudit.feedback).toBe(firstAudit.parent === parent.id ? 'parent' : 'second');
  expect((await confirm()).status).toBe(200); const row = await oneAward();
  expect(audit(await taskRow())).toEqual(firstAudit); expect((await taskRow()).starAwardState).toBe('awarded');
  for (const r of results.filter(r => r.status === 200)) {
    expect(r.data.data.task.confirmedByParentId).toBe(firstAudit.parent);
    if (r.data.data.starAward) expect(r.data.data.starAward.ledgerEntryId).toBe(String(row._id));
  }
});

test('real internal route rejects absent credentials and mismatched family scope without ledger writes', async () => {
  const payload = { familyId: String(family._id), childId: child.id, taskId: String(task._id), confirmedByParentId: parent.id };
  fail(await http.post(progressUrl + '/api/internal/stars/award', payload), 401, 'INVALID_SERVICE_CREDENTIAL');
  fail(await http.post(progressUrl + '/api/internal/stars/award', { ...payload, confirmedByParentId: outsider.id },
    { headers: { 'x-service-token': TOKEN } }), 403, 'CHILD_ACCESS_DENIED');
  expect(await Ledger.countDocuments()).toBe(0);
});

test('configured client retry handles a dropped committed award response within the same public request', async () => {
  await complete(); client = makeClient(TOKEN, { retryAttempts: 1, sleep: async () => {} }); remoteFault = 'drop';
  const response = await confirm(); expect(response.status).toBe(200); expect(remoteFault).toBeNull();
  const row = await oneAward(); expect(response.data.data.starAward).toEqual({ awarded: false, ledgerEntryId: String(row._id), starBalance: 1 });
  expect(calls).toHaveLength(2); expect(calls[1].body).toEqual(calls[0].body);
  expect((await taskRow()).starAwardState).toBe('awarded');
});

test('unsigned public confirmation cannot reach progress even for a valid completed task', async () => {
  await complete();
  fail(await http.patch(homeworkUrl + `/api/growth-tasks/${task._id}/confirm`, { expectedCompletionVersion: 1 }),
    401, 'INVALID_IDENTITY_ENVELOPE');
  expect(calls).toHaveLength(0); expect(await Ledger.countDocuments()).toBe(0);
});

test.each(['familyId', 'childId'])('internal award rejects mismatched %s with valid service credentials', async field => {
  const payload = { familyId: String(family._id), childId: child.id, taskId: String(task._id), confirmedByParentId: parent.id, [field]: id() };
  fail(await http.post(progressUrl + '/api/internal/stars/award', payload, { headers: { 'x-service-token': TOKEN } }), 403, 'CHILD_ACCESS_DENIED');
  expect(await Ledger.countDocuments()).toBe(0);
});

test('membership removed after remote award blocks local finalize and another current parent can recover', async () => {
  await complete(); leaveAfterAward = second.id;
  fail(await confirm(second, { parentFeedback: 'first' }), 403, 'CHILD_ACCESS_DENIED'); expect(leaveAfterAward).toBeNull();
  const before = await taskRow(), ledger = await oneAward(); expect(before.starAwardState).toBe('pending');
  expect((await confirm(parent, { parentFeedback: 'ignored' })).status).toBe(200);
  expect(audit(await taskRow())).toEqual(audit(before)); expect((await taskRow()).starAwardState).toBe('awarded');
  expect(await oneAward()).toEqual(ledger); expect(calls.map(c => c.body.confirmedByParentId)).toEqual([second.id, parent.id]);
});
