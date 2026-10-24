const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createCompletionMediaReferenceClient } = require('../../../../common/services/mediaReferenceClient');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const RemoteOperation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const { createCompletionMediaPrivacyService } = require('../../../resource-service/services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../../../resource-service/services/completionMediaCleanupService');
const id = () => new mongoose.Types.ObjectId();
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const HIDDEN = '+activeCompletionOperation +completionPending +completionMediaBindings';
let service, remote, client, transport, task, parent, child, family, time;
const makeService = options => createGrowthTaskCompletionService({ transactionRunner: runner, mediaReferenceClient: client,
  now: () => time, ...options });
const body = (extra = {}) => ({ operationId: randomUUID(), expectedCompletionVersion: 0, expectedChecklistVersion: 0,
  checkedItemIds: [], completionMediaIds: [], ...extra });
const invoke = (command, who = parent, target = task) => service.complete({ identity: who, taskId: String(target._id), body: command });
const readTask = () => Task.findById(task._id).select(HIDDEN).lean();
const record = c => Operation.findOne({ taskId: task._id, operationId: c.operationId }).lean();
const media = async (patch = {}) => String((await Asset.create({ familyId: family._id, childId: child.id,
  uploadedBy: child.id, purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 1, storageKey: randomUUID(), ...patch }))._id);
const failOnce = action => {
  const post = transport.post.getMockImplementation(); let failed = false;
  transport.post.mockImplementation(async (url, ...args) => {
    if (!failed && url.endsWith('/'+action)) { failed = true; throw Error('synthetic transport failure'); }
    return post(url, ...args);
  });
};

beforeAll(async () => { for (const m of [Task, Operation, Family, User, Asset, Reference, RemoteOperation, Receipt, Tombstone]) await m.init(); });
beforeEach(async () => {
  time = Date.parse('2026-10-22T00:00:00Z');
  parent = { id: String(id()), role: 'parent' };
  child = { id: String(id()), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [child.id] });
  child.familyId = String(family._id); child.childId = child.id;
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(parent.id), role: 'parent', username: parent.id, email: parent.id+'@example.test' },
    { _id: new mongoose.Types.ObjectId(child.id), role: 'student', username: child.id, email: child.id+'@example.test',
      familyId: family._id, childProfile: { tokenVersion: 0 } }]);
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    dimension: 'academic', title: 'Synthetic', taskType: 'practice', dueDate: '2026-10-22' });
  remote = createMediaReferenceOperationService({ transactionRunner: runner, now: () => time });
  transport = { post: jest.fn(async (url, wire) => ({ status: 200,
    data: { success: true, data: JSON.parse(JSON.stringify(await remote[url.split('/').pop()](wire))) } })) };
  client = createCompletionMediaReferenceClient({ axiosInstance: transport, resourceServiceUrl: 'http://synthetic-resource',
    serviceToken: 'synthetic-homework-completion-token-32-characters' });
  service = makeService();
});

test.each([0, 1, 10])('completes %i media and preserves immutable replay without hidden state', async count => {
  const ids = []; for (let i=0;i<count;i++) ids.push(await media());
  const c = body({ completionMediaIds: ids, actualMinutes: 12, childNote: ' original ' });
  const result = await invoke(c);
  expect(result).toEqual({ success: true, data: { task: { taskId: String(task._id), status: 'completed',
    checklistVersion: 0, completionVersion: 1, completionMediaIds: ids, completionMediaReferenceState: 'stable',
    parentConfirmed: false, completedAt: new Date(time).toISOString() } } });
  const row = await readTask(), op = await record(c);
  expect(row.activeCompletionOperation).toBeUndefined(); expect(row.completionPending).toBeUndefined();
  expect(row.completionEvidence.childNote).toBe('original'); expect(op.phase).toBe('SUCCEEDED');
  expect(op.remoteOperationId).not.toBe(c.operationId); expect(JSON.stringify(op)).not.toContain('original');
  const calls = transport.post.mock.calls.length; time+=1000;
  await Task.updateOne({ _id: task._id }, { $set: { status: 'archived' } });
  await expect(invoke(c)).resolves.toEqual(result); expect(transport.post).toHaveBeenCalledTimes(calls);
  if (!count) expect(calls).toBe(0);
});
test('T2-G-002 retired media rejects an entire new claim before owner or operation persistence', async () => {
  const available = await media(), retired = await media();
  const guards = mongoose.connection.collection('completionmediaguards');
  await guards.insertOne({ familyId: family._id, childId: new mongoose.Types.ObjectId(child.id),
    mediaId: new mongoose.Types.ObjectId(retired), state: 'retired', revision: 1,
    retirementId: randomUUID(), retiredAt: new Date(time) });
  const before = await readTask();
  await expect(invoke(body({ completionMediaIds: [available, retired] })))
    .rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
  expect(await readTask()).toEqual(before);
  expect(await Operation.countDocuments()).toBe(0);
  expect(await guards.countDocuments()).toBe(1);
  expect(transport.post).not.toHaveBeenCalled();
});
test('T2-G-003 each new intent writes guards including old removed media; historical replay does not', async () => {
  const a = await media(), b = await media();
  const first = body({ completionMediaIds: [a, b] });
  const result = await invoke(first);
  const guards = mongoose.connection.collection('completionmediaguards');
  const initial = await guards.find().sort({ mediaId: 1 }).toArray();
  expect(initial).toHaveLength(2);
  expect(initial.every(g => g.state === 'available' && g.revision === 1)).toBe(true);
  await invoke(body({ expectedCompletionVersion: 1, completionMediaIds: [b] }));
  const changed = await guards.find().sort({ mediaId: 1 }).toArray();
  expect(changed.map(g => g.revision)).toEqual([2, 2]);
  await expect(invoke(first)).resolves.toEqual(result);
  expect(await guards.find().sort({ mediaId: 1 }).toArray()).toEqual(changed);
});
test('same UUID from different actors persists different remote mappings; old A replay survives B', async () => {
  const uuid = randomUUID(), a = body({ operationId: uuid, completionMediaIds: [await media()] });
  const first = await invoke(a, child);
  const b = body({ operationId: uuid, expectedCompletionVersion: 1, completionMediaIds: [await media()] });
  await invoke(b, parent);
  const ops = await Operation.find({ taskId: task._id }).lean();
  expect(new Set(ops.map(o => o.remoteOperationId)).size).toBe(2);
  await expect(invoke(a, child)).resolves.toEqual(first);
});
test('reorder and retained references preserve generation, pure removal makes no empty remote command', async () => {
  const a = await media(), b = await media(); await invoke(body({ completionMediaIds: [a,b] }));
  const old = (await readTask()).completionMediaBindings;
  transport.post.mockClear();
  await invoke(body({ expectedCompletionVersion: 1, completionMediaIds: [b,a] }));
  expect(transport.post).not.toHaveBeenCalled();
  expect((await readTask()).completionMediaBindings.map(r=>r.bindingOperationId)).toEqual(old.map(r=>r.bindingOperationId));
  await invoke(body({ expectedCompletionVersion: 2, completionMediaIds: [] }));
  expect(transport.post.mock.calls.every(([url, c])=>!/prepare|commit/.test(url)&&c.references.length>0)).toBe(true);
  expect((await Reference.find().lean()).every(r=>r.state==='released')).toBe(true);
});
test.each([
  ['extra remote mapping', c => { c.remoteOperationId=randomUUID(); }],
  ['duplicate media', c => { c.completionMediaIds=[String(id()),String(id())];c.completionMediaIds[1]=c.completionMediaIds[0]; }],
  ['11 media', c => { c.completionMediaIds=Array.from({length:11},()=>String(id())); }, 'MEDIA_ATTACHMENT_LIMIT_EXCEEDED'],
  ['sparse media', c => { c.completionMediaIds=new Array(1); }],
  ['negative version', c => { c.expectedCompletionVersion=-1; }],
  ['unknown check', c => { c.checkedItemIds=['missing']; }, 'CHECKLIST_ITEM_INVALID'],
  ['negative minutes', c => { c.actualMinutes=-1; }],
  ['client actor', c => { c.submittedByActor=String(id()); }]
])('rejects %s before claim', async (_name, mutate, code='VALIDATION_ERROR') => {
  const c=body();mutate(c);await expect(invoke(c)).rejects.toMatchObject({code,statusCode:400});
  expect(await Operation.countDocuments()).toBe(0);expect(transport.post).not.toHaveBeenCalled();
});
test.each(['confirmed','cancelled','archived'])('new command rejects %s tasks', async status => {
  await Task.updateOne({_id:task._id},{$set:{status}});
  await expect(invoke(body())).rejects.toMatchObject({code:'TASK_STATE_CONFLICT'});
  expect(await Operation.countDocuments()).toBe(0);
});
test('same key different body precedes active lock; another command cannot overwrite owner', async () => {
  const c=body({completionMediaIds:[await media()]}); failOnce('commit');
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  const before=await readTask();
  await expect(invoke({...c,actualMinutes:10})).rejects.toMatchObject({code:'IDEMPOTENCY_KEY_REUSED'});
  await expect(invoke(body(),child)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  expect(await readTask()).toEqual(before);
  await expect(invoke(c)).resolves.toMatchObject({success:true});
});
test('two expected-version commands allow only one publication', async () => {
  const results=await Promise.allSettled([invoke(body()),invoke(body(),child)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await readTask()).completionVersion).toBe(1);
});
test('concurrent identical command cannot publish twice', async () => {
  const c=body({completionMediaIds:[await media()]}); await Promise.allSettled([invoke(c),invoke(c)]);
  await invoke(c); expect((await readTask()).completionVersion).toBe(1); expect(await Operation.countDocuments()).toBe(1);
});
test.each(['prepare','commit'])('lost %s acknowledgement recovers with persisted mapping', async action => {
  const c=body({completionMediaIds:[await media()]}), post=transport.post.getMockImplementation();let lost=false;
  transport.post.mockImplementation(async(url,...args)=>{const response=await post(url,...args);if(!lost&&url.endsWith('/'+action)){lost=true;throw Error('lost');}return response;});
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  const op=await record(c); service=makeService();
  await expect(service.recover({identity:parent,taskId:String(task._id),operationId:c.operationId})).resolves.toMatchObject({success:true});
  expect((await record(c)).remoteOperationId).toBe(op.remoteOperationId);
  expect(await RemoteOperation.countDocuments()).toBe(1);expect((await readTask()).completionVersion).toBe(1);
});
test.each(['claim','mark','publish','finalize','fail'])('unknown local %s commit never sends an unpersisted identity or duplicates publication', async stage => {
  if(stage==='finalize') await invoke(body({completionMediaIds:[await media()]}));
  const c=body({expectedCompletionVersion:stage==='finalize'?1:0,
    completionMediaIds:stage==='fail'?[String(id())]:stage==='finalize'?[]:[await media()]});let lost=false;
  service=makeService({transactionRunner:async(work,label)=>{const result=await runner(work);if(!lost&&label===stage){lost=true;throw Error('unknown commit');}return result;}});
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  expect(lost).toBe(true);const op=await record(c); expect(op.remoteOperationId).toBeDefined();
  if(['claim','mark'].includes(stage)) expect(transport.post).not.toHaveBeenCalled();
  service=makeService();
  if(['mark','fail'].includes(stage)) await expect(invoke(c)).rejects.toMatchObject({code:stage==='mark'?'MEDIA_OPERATION_ABORTED':'RESOURCE_NOT_FOUND'});
  else await expect(invoke(c)).resolves.toMatchObject({success:true});
  expect((await record(c)).remoteOperationId).toBe(op.remoteOperationId);
});
test('expired prepared group fails without touching stable completion evidence', async () => {
  const c=body({completionMediaIds:[await media()]});failOnce('commit');
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});time+=900000;
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_OPERATION_EXPIRED'});
  const row=await readTask();expect(row.status).toBe('pending');expect(row.completedAt).toBeUndefined();expect(row.completionPending).toBeUndefined();
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_OPERATION_EXPIRED'});
});
test.each([{purpose:'task_attachment'},{childId:new mongoose.Types.ObjectId()},{status:'deleted',deletedAt:new Date()}])('stable media refusal converges and replays without exposing private metadata: %p', async patch => {
  const c=body({completionMediaIds:[await media(patch)]});
  await expect(invoke(c)).rejects.toMatchObject({code:'RESOURCE_NOT_FOUND',statusCode:404});
  expect((await record(c)).phase).toBe('FAILED');expect((await readTask()).completionPending).toBeUndefined();
  const calls=transport.post.mock.calls.length;
  await expect(invoke(c)).rejects.toMatchObject({code:'RESOURCE_NOT_FOUND'});expect(transport.post).toHaveBeenCalledTimes(calls);
});
test('bare conflict cannot clear recovery intent', async () => {
  const c=body({completionMediaIds:[await media()]});transport.post.mockRejectedValue({status:409,code:'RESOURCE_NOT_FOUND'});
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  expect((await record(c)).phase).toBe('PREPUBLISH');expect((await readTask()).activeCompletionOperation).toBeDefined();
});
test('remote UUID collision rolls back claim before choosing a fresh mapping', async () => {
  const first=body();await invoke(first);const remoteId=(await record(first)).remoteOperationId;
  const fresh=randomUUID(), generate=jest.fn().mockReturnValueOnce(remoteId).mockReturnValueOnce(fresh);
  service=makeService({randomUUID:generate});const c=body({expectedCompletionVersion:1});await invoke(c);
  expect(generate).toHaveBeenCalledTimes(2);expect((await record(c)).remoteOperationId).toBe(fresh);
  expect((await readTask()).completionVersion).toBe(2);
});
test('missing persisted mapping blocks recovery and never falls back to public UUID', async () => {
  const c=body({completionMediaIds:[await media()]});failOnce('commit');await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  await Operation.collection.updateOne({operationId:c.operationId},{$unset:{remoteOperationId:''}});transport.post.mockClear();
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});expect(transport.post).not.toHaveBeenCalled();
});
test('authorization precedes terminal replay and schema checks', async () => {
  const c=body();await invoke(c);
  await Family.updateOne({_id:family._id},{$set:{ownerParentId:id(),memberParentIds:[]}});
  await expect(invoke({...c,extra:true})).rejects.toMatchObject({code:'CHILD_ACCESS_DENIED'});
  await expect(invoke(c)).rejects.toMatchObject({code:'CHILD_ACCESS_DENIED'});
});
test('stale child token and another child cannot claim or replay', async () => {
  await expect(invoke(body(),{...child,tokenVersion:1})).rejects.toMatchObject({code:'CHILD_ACCESS_DENIED'});
  await expect(invoke(body(),{...child,id:String(id())})).rejects.toMatchObject({code:'CHILD_ACCESS_DENIED'});
  expect(await Operation.countDocuments()).toBe(0);
});
test('read projection has no side effects, legacy versions are zero and pending evidence stays hidden', async () => {
  const before=await readTask(); const view=await service.read({identity:parent,taskId:String(task._id)});
  expect(view).toMatchObject({completionVersion:0,checklistVersion:0,completionMediaIds:[],completionMediaReferenceState:'stable'});
  expect(await readTask()).toEqual(before);
  const c=body({completionMediaIds:[await media()],childNote:'pending secret'});failOnce('commit');await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  const calls=transport.post.mock.calls.length;const pending=await service.read({identity:parent,taskId:String(task._id)});
  expect(pending.completionMediaIds).toEqual([]);expect(JSON.stringify(pending)).not.toContain('pending secret');
  expect(transport.post).toHaveBeenCalledTimes(calls);
});

test('claim failure after ledger insert rolls back task owner and mapping before any remote call', async () => {
  const create=Operation.create.bind(Operation);const before=await readTask();
  const spy=jest.spyOn(Operation,'create').mockImplementationOnce(async(...args)=>{await create(...args);throw Error('claim rollback');});
  await expect(invoke(body({completionMediaIds:[await media()]}))).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  spy.mockRestore();expect(await readTask()).toEqual(before);expect(await Operation.countDocuments()).toBe(0);
  expect(transport.post).not.toHaveBeenCalled();
});
test('publish failure rolls back ledger snapshot and version, then recovers the original remote commit', async () => {
  const c=body({completionMediaIds:[await media()]}), update=Task.updateOne.bind(Task);let failed=false;
  const spy=jest.spyOn(Task,'updateOne').mockImplementation(async(...args)=>{
    const result=await update(...args);if(!failed&&args[1].$set?.completionVersion){failed=true;throw Error('publish rollback');}return result;
  });
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});spy.mockRestore();
  expect((await record(c))).toMatchObject({phase:'PREPUBLISH',successResponse:null});expect((await readTask()).completionVersion).toBeUndefined();
  await invoke(c);expect((await readTask()).completionVersion).toBe(1);expect(await RemoteOperation.countDocuments()).toBe(1);
});
test('stale executor cannot publish twice or clear a newer owner after another executor recovers', async () => {
  const c=body({completionMediaIds:[await media()]}), post=transport.post.getMockImplementation();
  let release, signal, held=false;const arrived=new Promise(resolve=>{signal=resolve;});const gate=new Promise(resolve=>{release=resolve;});
  transport.post.mockImplementation(async(url,...args)=>{
    const result=await post(url,...args);if(!held&&url.endsWith('/commit')){held=true;signal();await gate;}return result;
  });
  const stale=invoke(c).catch(e=>e);
  try {
    await arrived;await invoke(c);
    const next=body({expectedCompletionVersion:1,completionMediaIds:[await media()]});failOnce('commit');
    await expect(invoke(next)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
    const before=await readTask();release();expect((await stale).code).toBe('MEDIA_REFERENCE_PENDING');
    expect(await readTask()).toEqual(before);expect(before.activeCompletionOperation.operationId).toBe(next.operationId);
    await invoke(next);expect((await readTask()).completionVersion).toBe(2);
  } finally {release();await stale;}
});
test('revocation during remote commit prevents local publication and preserves intent for authorized recovery', async () => {
  const c=body({completionMediaIds:[await media()]}),post=transport.post.getMockImplementation();
  transport.post.mockImplementation(async(url,...args)=>{const result=await post(url,...args);
    if(url.endsWith('/commit'))await Family.updateOne({_id:family._id},{$set:{ownerParentId:id(),memberParentIds:[]}});return result;});
  await expect(invoke(c)).rejects.toMatchObject({code:'CHILD_ACCESS_DENIED'});
  expect((await record(c)).phase).toBe('PREPUBLISH');expect((await readTask()).completionVersion).toBeUndefined();
});
test.each(['checklistVersion','status','completionPending.commandHash','activeCompletionOperation.actorId'])('changed %s cannot be overwritten by recovery', async field => {
  const c=body({completionMediaIds:[await media()]});failOnce('commit');await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  const value=field==='checklistVersion'?1:field==='status'?'confirmed':field.includes('commandHash')?'f'.repeat(64):id();
  await Task.collection.updateOne({_id:task._id},{$set:{[field]:value}});const before=await readTask();transport.post.mockClear();
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  expect(await readTask()).toEqual(before);expect(transport.post).not.toHaveBeenCalled();
});
test('attachment pending blocks new claim, and stale expected versions are conflicts', async () => {
  await Task.collection.updateOne({_id:task._id},{$set:{mediaReferenceState:'pending'}});
  await expect(invoke(body())).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});expect(await Operation.countDocuments()).toBe(0);
  await Task.collection.updateOne({_id:task._id},{$set:{mediaReferenceState:'none'}});
  await expect(invoke(body({expectedCompletionVersion:1}))).rejects.toMatchObject({code:'VERSION_CONFLICT'});
  await expect(invoke(body({expectedChecklistVersion:1}))).rejects.toMatchObject({code:'VERSION_CONFLICT'});
});
test('checklist submission validates the referenced version but allows incomplete checks', async () => {
  await Task.updateOne({_id:task._id},{$set:{checklistVersion:1,checklistSnapshot:[
    {itemId:'a',label:'A',required:true},{itemId:'b',label:'B',required:true}]}});
  const c=body({expectedChecklistVersion:1,checkedItemIds:['b']});await invoke(c,child);
  expect((await readTask()).completionEvidence).toMatchObject({checkedItemIds:['b'],submittedByActor:{id:new mongoose.Types.ObjectId(child.id),role:'student'}});
});
test('replacement unbind failure exposes published snapshot but keeps owner; recovery performs cleanup only', async () => {
  const a=await media(),b=await media();await invoke(body({completionMediaIds:[a]}));
  const c=body({expectedCompletionVersion:1,completionMediaIds:[b]});failOnce('unbind');
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  const before=await readTask();expect(before.completionVersion).toBe(2);expect((await record(c)).phase).toBe('PUBLISHED_CLEANUP');
  expect((await service.read({identity:parent,taskId:String(task._id)})).completionMediaIds).toEqual([b]);
  transport.post.mockClear();time+=1000;await invoke(c);
  expect(transport.post.mock.calls.every(([url])=>!/prepare|commit|abort/.test(url))).toBe(true);
  expect((await readTask()).completedAt).toEqual(before.completedAt);expect((await readTask()).completionVersion).toBe(2);
});
test('ordinary released added media cannot be published without an exact privacy deletion receipt', async () => {
  const c=body({completionMediaIds:[await media()]}),post=transport.post.getMockImplementation();let lost=false;
  transport.post.mockImplementation(async(url,...args)=>{const result=await post(url,...args);if(!lost&&url.endsWith('/commit')){lost=true;throw Error('lost');}return result;});
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  const op=await record(c);await remote.unbind({familyId:String(family._id),childId:child.id,resourceType:'growth_task',resourceId:String(task._id),
    operationId:randomUUID(),references:c.completionMediaIds.map(mediaId=>({mediaId,field:'completionMediaIds',bindingOperationId:op.remoteOperationId}))});
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  expect((await record(c)).phase).toBe('PREPUBLISH');expect((await readTask()).completionVersion).toBeUndefined();
});

test.each([false,true])('exact privacy proof permits recovery after remote commit (retention cleanup=%s)', async cleaned => {
  const c=body({completionMediaIds:[await media()]}),post=transport.post.getMockImplementation();let lost=false;
  transport.post.mockImplementation(async(url,...args)=>{const result=await post(url,...args);if(!lost&&url.endsWith('/commit')){lost=true;throw Error('lost');}return result;});
  await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  // Only physical storage and journal acknowledgement are simulated; DB deletion/receipt transactions are real.
  const options={transactionRunner:runner,now:()=>time,journal:{persist:async()=>{}},mediaStore:{remove:async()=>{}}};
  await createCompletionMediaPrivacyService(options).deleteMedia({identity:parent,mediaId:c.completionMediaIds[0]});
  if(cleaned){time+=31*86400000;expect((await createCompletionMediaCleanupService(options).cleanupDeletedMedia()).cleaned).toBe(1);}
  const result=await invoke(c);expect(result.data.task.completionMediaIds).toEqual(c.completionMediaIds);
  expect((await record(c)).phase).toBe('SUCCEEDED');expect(await Receipt.countDocuments()).toBe(1);
  expect(await Asset.countDocuments({status:'active'})).toBe(0);
});
test('ABSENT status followed by a winning delayed commit is published, never treated as failure', async () => {
  const c=body({completionMediaIds:[await media()]});failOnce('prepare');await expect(invoke(c)).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  const post=transport.post.getMockImplementation();let raced=false;
  transport.post.mockImplementation(async(url,wire,...args)=>{
    const result=await post(url,wire,...args);
    if(!raced&&url.endsWith('/status')){raced=true;const {mode: _mode,...command}=wire;await remote.prepare(command);await remote.commit(command);}
    return result;
  });
  await expect(invoke(c)).resolves.toMatchObject({success:true});expect((await record(c)).phase).toBe('SUCCEEDED');
  expect(transport.post.mock.calls.some(([url])=>url.endsWith('/abort'))).toBe(true);
  expect((await Reference.find().lean()).every(r=>r.state==='bound')).toBe(true);
});

test.each(['read','complete','recover'])('%s cannot distinguish missing and unauthorized task IDs', async method => {
  const foreign=await Task.create({familyId:id(),childId:id(),createdByParentId:id(),dimension:'academic',
    title:'Synthetic foreign task',taskType:'practice',dueDate:'2026-10-22'});
  const call=taskId=>service[method]({identity:parent,taskId,body:body(),operationId:randomUUID()});
  const visibleError=async taskId=>{try{await call(taskId);throw Error('Expected denial');}catch(e){
    return {statusCode:e.statusCode,code:e.code,message:e.message,details:e.details};}};
  const missing=await visibleError(String(id())),denied=await visibleError(String(foreign._id));
  expect(missing).toEqual(denied);expect(denied).toMatchObject({statusCode:403,code:'CHILD_ACCESS_DENIED'});
  expect(await Operation.countDocuments()).toBe(0);expect(transport.post).not.toHaveBeenCalled();
});
test.each(['operationId','expectedCompletionVersion','expectedChecklistVersion'])('missing %s requires client upgrade before claim', async key => {
  const c=body();delete c[key];
  await expect(invoke(c)).rejects.toMatchObject({statusCode:400,code:'CLIENT_UPGRADE_REQUIRED'});
  expect(await Operation.countDocuments()).toBe(0);expect(transport.post).not.toHaveBeenCalled();
});
test.each([null,'check',[''],['repeat','repeat'],[null],new Array(1),['a','b','c','d','e','f']])(
  'invalid checklist shape %p preserves the contract code', async checkedItemIds => {
    await expect(invoke(body({checkedItemIds}))).rejects.toMatchObject({statusCode:400,code:'CHECKLIST_ITEM_INVALID'});
    expect(await Operation.countDocuments()).toBe(0);expect(transport.post).not.toHaveBeenCalled();
  });
test('case-distinct checklist IDs remain distinct and reordered checks replay the same command', async () => {
  await Task.updateOne({_id:task._id},{$set:{checklistVersion:1,checklistSnapshot:[
    {itemId:'A',label:'First'},{itemId:'a',label:'Second'}]}});
  const c=body({expectedChecklistVersion:1,checkedItemIds:['a','A']});const first=await invoke(c);
  expect((await readTask()).completionEvidence.checkedItemIds).toEqual(['A','a']);
  await expect(invoke({...c,checkedItemIds:['A','a']})).resolves.toEqual(first);
  expect((await readTask()).completionVersion).toBe(1);
});
