const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createGrowthTaskCompletionMutationService } = require('../../services/growthTaskCompletionMutationService');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionConfirmationService } = require('../../services/growthTaskCompletionConfirmationService');
const { createGrowthTaskCompletionRouter } = require('../../routes/growthTaskCompletion');
const { createStarAwardClient } = require('../../services/starAwardClient');
const internalStars = require('../../../progress-service/routes/internalStars');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Ledger = require('../../../progress-service/models/StarLedgerEntry');

const id = () => String(new mongoose.Types.ObjectId());
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const http = axios.create({ proxy: false, timeout: 5000, validateStatus: () => true });
let servers, base, parent, second, child, outsider, family, task, mutation, createRouter;
let time, transactionFault, dropPublic, starUnavailable, starCalls;
let pauseCompletion, pauseConfirmation;
const barrier = () => {
  let arrive, release;
  const reached = new Promise(resolve => { arrive = resolve; });
  const block = new Promise(resolve => { release = resolve; });
  return { reached, block, arrive, release };
};
const reachedBeforeResponse = (gate, request) => Promise.race([gate.reached, request.then(() => {
  throw Error('Request ended before the transaction barrier');
})]);
const app = () => {
  const result = express(); result.locals.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  result.use(express.json()); return result;
};
const listen = async instance => {
  const server = await new Promise((resolve, reject) => {
    const s = instance.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  }); servers.push(server); return 'http://127.0.0.1:' + server.address().port;
};
const path = suffix => `/api/growth-tasks/${task._id}${suffix}`;
const headers = (method, suffix, identity = parent) => createIdentityHeaders({ method, originalUrl: path(suffix),
  user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET });
const send = (method, body, identity = parent, suffix = '', supplied) => http.request({ method, url: base + path(suffix),
  data: body, headers: supplied || headers(method, suffix, identity) });
const edit = (body = { title: ' Revised ' }, identity = parent) => send('PATCH', body, identity);
const remove = (identity = parent) => send('DELETE', undefined, identity);
const command = () => ({ operationId: randomUUID(), expectedCompletionVersion: 0,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], childNote: 'Synthetic note' });
const complete = body => send('PATCH', body, child, '/complete');
const confirm = () => send('PATCH', { expectedCompletionVersion: 1, parentFeedback: 'first feedback' }, second, '/confirm');
const row = () => Task.collection.findOne({ _id: task._id });
const safeBody = body => {
  expect(JSON.stringify(body)).not.toMatch(/activeCompletionOperation|completionPending|remoteOperationId|commandHash|bindingOperationId|synthetic-private-error/);
  expect(JSON.stringify(body)).not.toContain(process.env.INTERNAL_SERVICE_TOKEN);
};
const fail = (response, status, code) => {
  expect(response.status).toBe(status); expect(response.data).toMatchObject({ success: false, error: { code, details: [] } });
  safeBody(response.data);
};
const makeMutation = () => createGrowthTaskCompletionMutationService({ now: () => time,
  transactionRunner: async (work, label) => {
    const fault = transactionFault?.label === label ? transactionFault : null;
    if (fault) transactionFault = null;
    const result = await runner(async session => {
      const value = await work(session);
      if (fault?.kind === 'rollback') throw Error('synthetic-private-error rollback');
      return value;
    });
    if (fault?.kind === 'lost-ack') throw Error('synthetic-private-error lost acknowledgement');
    return result;
  }
});

beforeAll(async () => { for (const model of [Task, Operation, Family, User, Ledger]) await model.init(); });
beforeEach(async () => {
  servers = []; time = Date.parse('2026-10-22T00:00:00Z'); transactionFault = null;
  dropPublic = null; starUnavailable = false; starCalls = 0;
  pauseCompletion = null; pauseConfirmation = null;
  parent = { id: id(), role: 'parent' }; second = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic mutation HTTP', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [child.id] });
  Object.assign(child, { familyId: String(family._id), childId: child.id });
  await User.collection.insertMany([parent, second, child, outsider].map(u => ({ _id: new mongoose.Types.ObjectId(u.id),
    role: u.role, username: u.id, email: u.id + '@example.test',
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    title: 'Synthetic task', dimension: 'physical', taskType: 'practice', dueDate: '2026-10-22', estimatedMinutes: 10 });
  const progress = app();
  progress.use((req, res, next) => {
    starCalls += 1;
    if (starUnavailable) return res.status(503).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
    next();
  });
  progress.use('/api/internal/stars', internalStars); progress.use(errorHandler);
  const progressUrl = await listen(progress);
  const client = createStarAwardClient({ progressServiceUrl: progressUrl, internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN,
    axiosInstance: axios.create({ proxy: false }), timeout: 3000, retryAttempts: 0 });
  mutation = makeMutation();
  const homework = app();
  homework.use((req, res, next) => {
    const json = res.json;
    res.json = function emit(body) {
      if (dropPublic === req.method && body.success) { dropPublic = null; this.destroy(); return this; }
      return json.call(this, body);
    }; next();
  });
  ({ createGrowthTaskCompletionMutationRouter: createRouter } = require('../../routes/growthTaskCompletionMutation'));
  homework.use('/api/growth-tasks', createRouter({ mutationService: {
    edit: input => mutation.edit(input), remove: input => mutation.remove(input)
  } }));
  const unusedMedia = Object.fromEntries(['prepare', 'commit', 'abort', 'status', 'unbind'].map(k =>
    [k, async () => { throw Error('Unexpected media call in mutation HTTP batch'); }]));
  homework.use('/api/growth-tasks', createGrowthTaskCompletionRouter({
    completionService: createGrowthTaskCompletionService({ mediaReferenceClient: unusedMedia,
      transactionRunner: async (work, label) => {
        const result = await runner(work);
        if (label === 'claim' && pauseCompletion) {
          const gate = pauseCompletion; pauseCompletion = null; gate.arrive(); await gate.block;
        }
        return result;
      }
    }),
    confirmationService: createGrowthTaskCompletionConfirmationService({ awardTaskStar: client.awardTaskStar,
      transactionRunner: async (work, label) => {
        const result = await runner(work);
        if (label === 'confirm' && pauseConfirmation) {
          const gate = pauseConfirmation; pauseConfirmation = null; gate.arrive(); await gate.block;
        }
        return result;
      }
    })
  }));
  homework.use(errorHandler); base = await listen(homework);
});
afterEach(async () => {
  for (const s of servers || []) { s.closeAllConnections(); await new Promise((resolve, reject) => s.close(e => e ? reject(e) : resolve())); }
});

test('factory requires both mutation methods', () => {
  for (const mutationService of [undefined, {}, { edit() {} }, { remove() {} }]) {
    expect(() => createRouter({ mutationService })).toThrow();
  }
});
test('coparent edits through HTTP with casting, optional null and public projection', async () => {
  const response = await edit({ title: ' Revised ', estimatedMinutes: '12', description: null }, second);
  expect(response.status).toBe(200); safeBody(response.data);
  expect(response.data).toMatchObject({ success: true, data: { task: { taskId: String(task._id), title: 'Revised',
    estimatedMinutes: 12, description: null, completionVersion: 0, status: 'pending' } } });
  const before = await row(); expect((await edit({})).status).toBe(200); expect(await row()).toEqual(before);
  expect(await Operation.countDocuments()).toBe(0); expect(starCalls).toBe(0);
});

test.each(['PATCH', 'DELETE'])('%s rejects unsigned and tampered identities and envelope replay', async method => {
  const before = await row();
  fail(await send(method, {}, parent, '', {}), 401, 'INVALID_IDENTITY_ENVELOPE');
  const signed = headers(method, '');
  fail(await send(method, {}, parent, '', { ...signed, 'x-user-role': 'student' }), 401, 'INVALID_IDENTITY_ENVELOPE');
  const valid = headers(method, ''); expect((await send(method, {}, parent, '', valid)).status).toBe(200);
  const after = await row(); fail(await send(method, {}, parent, '', valid), 401, 'IDENTITY_ENVELOPE_REPLAYED');
  expect(await row()).toEqual(after); if (method === 'PATCH') expect(after).toEqual(before);
});
test.each(['PATCH', 'DELETE'].flatMap(method => ['child', 'outsider', 'departed'].map(kind => [method, kind])))
  ('%s denies %s before body validation', async (method, kind) => {
    if (kind === 'departed') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
    const identity = kind === 'child' ? child : kind === 'outsider' ? outsider : second, before = await row();
    fail(await send(method, { status: 'injected' }, identity), 403, 'CHILD_ACCESS_DENIED');
    expect(await row()).toEqual(before); expect(starCalls).toBe(0);
  });
test.each(['PATCH', 'DELETE'])('%s does not disclose an absent task', async method => {
  task = { _id: new mongoose.Types.ObjectId() };
  fail(await send(method, { status: 'invalid' }), 403, 'CHILD_ACCESS_DENIED');
  expect(await Task.countDocuments()).toBe(1); expect(starCalls).toBe(0);
});

test.each([
  ['single cast', { estimatedMinutes: 'bad' }, 'VALIDATION_ERROR'],
  ['all casts', { estimatedMinutes: 'bad', targetAmount: 'bad' }, 'VALIDATION_ERROR'],
  ['required null', { title: null }, 'VALIDATION_ERROR'],
  ['protected field', { completionVersion: 99 }, 'VALIDATION_ERROR'],
  ['array', [], 'VALIDATION_ERROR'],
  ['materials', { attachmentMediaIds: [] }, 'MEDIA_NOT_ENABLED'],
  ['repeat', { repeatRule: {} }, 'REPEAT_RULE_NOT_SUPPORTED']
])('%s invalid edit is not disguised as a retryable owner conflict', async (label, body, code) => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { activeCompletionOperation: { operationId: randomUUID() } } });
  const before = await row(), cast = jest.spyOn(Task, 'castObject');
  try {
    fail(await edit(body), 400, code); expect(await row()).toEqual(before);
    if (['single cast', 'all casts'].includes(label)) {
      expect(cast).toHaveBeenCalledTimes(1); expect(cast).toHaveBeenCalledWith(body);
      expect(cast.mock.results[0].type).toBe('throw');
      const errors = cast.mock.results[0].value.errors;
      expect(Object.keys(errors).sort()).toEqual(Object.keys(body).sort());
      for (const field of Object.keys(body)) expect(errors[field].name).toBe('CastError');
    }
  } finally { cast.mockRestore(); }
});
test.each(['PATCH', 'DELETE'].flatMap(method => [
  ['activeCompletionOperation', { operationId: randomUUID() }],
  ['completionPending', { phase: 'PREPUBLISH' }],
  ['completionMediaReferenceState', 'pending_recovery'], ['mediaReferenceState', 'pending']
].map(([field, value]) => [method, field, value])))('%s blocks %s without helping or clearing intent', async (method, field, value) => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { [field]: value } }); const before = await row();
  fail(await send(method, { title: 'Revised' }), 503, 'MEDIA_REFERENCE_PENDING');
  expect(await row()).toEqual(before); expect(await Operation.countDocuments()).toBe(0); expect(starCalls).toBe(0);
});

test('pending DELETE soft-cancels once, preserving first cancellation on coparent retry', async () => {
  const response = await remove(); expect(response.status).toBe(200); safeBody(response.data);
  expect(response.data).toMatchObject({ success: true, data: { deleted: false, task: { status: 'cancelled' } } });
  const before = await row(); expect(before.cancelledAt).toEqual(new Date(time)); time += 1000;
  expect((await remove(second)).status).toBe(200); expect(await row()).toEqual(before); expect(await Task.countDocuments()).toBe(1);
  fail(await complete(command()), 409, 'TASK_STATE_CONFLICT'); expect(await Ledger.countDocuments()).toBe(0);
});
test.each([false, true])('archive completed task (confirmed=%s) preserves evidence, first audit and original command replay', async confirmed => {
  const body = command(), completed = await complete(body); expect(completed.status).toBe(200);
  if (confirmed) expect((await confirm()).status).toBe(200);
  const before = await row(), ledger = await Ledger.find().lean(), op = await Operation.find().lean(), calls = starCalls;
  const response = await remove(); expect(response.status).toBe(200); safeBody(response.data);
  expect(response.data.data).toMatchObject({ deleted: false, task: { status: 'archived', completionVersion: 1 } });
  const archived = await row();
  for (const key of ['completionEvidence', 'completionVersion', 'completedAt', 'confirmedByParentId', 'confirmedAt', 'parentFeedback', 'starAwardState']) {
    expect(archived[key]).toEqual(before[key]);
  }
  expect((await remove(second)).status).toBe(200); expect((await complete(body)).data).toEqual(completed.data);
  expect(await row()).toEqual(archived); expect(await Operation.find().lean()).toEqual(op);
  expect(await Ledger.find().lean()).toEqual(ledger); expect(ledger).toHaveLength(confirmed ? 1 : 0); expect(starCalls).toBe(calls);
  fail(await edit(), 409, 'TASK_STATE_CONFLICT');
});
test('pending star outcome blocks archive until the existing confirmation retry settles', async () => {
  expect((await complete(command())).status).toBe(200); starUnavailable = true;
  fail(await confirm(), 503, 'STAR_AWARD_PENDING'); const before = await row();
  fail(await remove(), 409, 'STAR_AWARD_PENDING'); expect(await row()).toEqual(before); expect(await Ledger.countDocuments()).toBe(0);
  starUnavailable = false; expect((await confirm()).status).toBe(200);
  expect((await remove()).status).toBe(200); expect((await row()).confirmedByParentId).toEqual(before.confirmedByParentId);
  expect((await row()).confirmedAt).toEqual(before.confirmedAt); expect(await Ledger.countDocuments()).toBe(1);
});

test.each(['PATCH', 'DELETE'])('lost public %s response recovers from persisted state', async method => {
  dropPublic = method;
  await expect(send(method, { title: 'Revised' })).rejects.toMatchObject({ code: 'ECONNRESET' });
  expect(dropPublic).toBeNull(); const before = await row(); time += 1000; mutation = makeMutation();
  const replay = await send(method, { title: 'Revised' }, second); expect(replay.status).toBe(200);
  const after = await row();
  if (method === 'DELETE') expect(after).toEqual(before);
  else { expect(after.title).toBe('Revised'); expect(after.completionVersion).toEqual(before.completionVersion); }
  expect(await Ledger.countDocuments()).toBe(0); expect(await Operation.countDocuments()).toBe(0);
});
test.each(['edit', 'remove'].flatMap(label => ['rollback', 'lost-ack'].map(kind => [label, kind])))
  ('%s transaction %s is not a false success and retries current state', async (label, kind) => {
    const before = await row(); transactionFault = { label, kind };
    fail(await (label === 'edit' ? edit() : remove()), 503, 'MEDIA_REFERENCE_PENDING'); expect(transactionFault).toBeNull();
    const persisted = await row();
    if (kind === 'rollback') expect(persisted).toEqual(before);
    else expect(persisted[label === 'edit' ? 'title' : 'status']).toBe(label === 'edit' ? 'Revised' : 'cancelled');
    time += 1000; mutation = makeMutation();
    expect((await (label === 'edit' ? edit({ title: ' Revised ' }, second) : remove(second))).status).toBe(200);
    expect((await row())[label === 'edit' ? 'title' : 'status']).toBe(label === 'edit' ? 'Revised' : 'cancelled');
    if (label === 'remove' && kind === 'lost-ack') expect(await row()).toEqual(persisted);
    expect(await Ledger.countDocuments()).toBe(0); expect(await Operation.countDocuments()).toBe(0);
  });
test('unknown edit result cannot overwrite a task completed before the edit retry', async () => {
  transactionFault = { label: 'edit', kind: 'lost-ack' }; fail(await edit(), 503, 'MEDIA_REFERENCE_PENDING');
  expect((await complete(command())).status).toBe(200); const completed = await row();
  fail(await edit({ title: 'Must not overwrite' }), 409, 'TASK_STATE_CONFLICT'); expect(await row()).toEqual(completed);
});

test('real in-flight completion owns the task until publication and cannot be edited or cancelled', async () => {
  const gate = barrier(); pauseCompletion = gate;
  const work = complete(command());
  try {
    await reachedBeforeResponse(gate, work); const claimed = await row();
    expect(claimed.activeCompletionOperation).toBeDefined(); expect(await Operation.countDocuments()).toBe(1);
    fail(await edit(), 503, 'MEDIA_REFERENCE_PENDING'); fail(await remove(), 503, 'MEDIA_REFERENCE_PENDING');
    expect(await row()).toEqual(claimed); expect(starCalls).toBe(0);
    gate.release(); expect((await work).status).toBe(200);
    fail(await edit(), 409, 'TASK_STATE_CONFLICT'); expect((await remove()).status).toBe(200);
    expect((await row()).status).toBe('archived'); expect(await Ledger.countDocuments()).toBe(0);
  } finally { gate.release(); await Promise.allSettled([work]); }
});
test('in-flight confirmed intent blocks archive before real star HTTP and preserves its audit afterward', async () => {
  expect((await complete(command())).status).toBe(200);
  const gate = barrier(); pauseConfirmation = gate; const work = confirm();
  try {
    await reachedBeforeResponse(gate, work); const pending = await row();
    expect(pending.status).toBe('confirmed'); expect(pending.starAwardState).toBe('pending');
    expect(starCalls).toBe(0); fail(await remove(), 409, 'STAR_AWARD_PENDING'); expect(await row()).toEqual(pending);
    gate.release(); expect((await work).status).toBe(200); expect((await remove()).status).toBe(200);
    const archived = await row(); expect(archived.status).toBe('archived'); expect(archived.starAwardState).toBe('awarded');
    for (const key of ['confirmedByParentId', 'confirmedAt', 'parentFeedback', 'completedAt', 'completionVersion']) {
      expect(archived[key]).toEqual(pending[key]);
    }
    expect(await Ledger.countDocuments()).toBe(1); expect(starCalls).toBe(1);
  } finally { gate.release(); await Promise.allSettled([work]); }
});
test.each(['PATCH', 'DELETE'])('%s rejects a signature for another path before mutation', async method => {
  const before = await row(), signed = createIdentityHeaders({ method, originalUrl: '/api/growth-tasks/other',
    user: parent, secret: process.env.GATEWAY_IDENTITY_SECRET });
  fail(await send(method, {}, parent, '', signed), 401, 'INVALID_IDENTITY_ENVELOPE'); expect(await row()).toEqual(before);
});
test.each(['sync', 'async'])('%s unexpected service failure uses the shared safe error envelope', async kind => {
  const before = await row(), cause = Error('synthetic-private-error ' + process.env.INTERNAL_SERVICE_TOKEN);
  mutation.edit = kind === 'sync' ? () => { throw cause; } : async () => { throw cause; };
  fail(await edit(), 500, 'INTERNAL_ERROR'); expect(await row()).toEqual(before);
});
