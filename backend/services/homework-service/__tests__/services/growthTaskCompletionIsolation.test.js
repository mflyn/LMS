const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { request, close: closeHttp } = createHttpTestHarness();
afterEach(closeHttp);
const {createProductionApp,createTask6MediaDependencies}=require('../../server');
const {createIdentityHeaders}=require('../../../../common/middleware/gatewayIdentity');
const Task=require('../../models/GrowthTask');
const User=require('../../../../common/models/User');
const Family=require('../../../../common/models/Family');
const mongoose=require('mongoose');
const id=()=>new mongoose.Types.ObjectId();
// Preserve legacy cold-loading assertions; enabled and maintenance have separate formal-chain coverage.
const env={COMPLETION_PROTOCOL_MODE:'legacy',RESOURCE_SERVICE_URL:'http://synthetic-unused',MEDIA_REFERENCE_SERVICE_TOKEN:'synthetic-isolation-token-32-characters',MEDIA_REFERENCE_TIMEOUT_MS:'1000'};
test('legacy composition adds only read-only sources and does not load the completion protocol',()=>{
  const deps=createTask6MediaDependencies({env});expect(Object.keys(deps)).toEqual(['attachmentMediaService']);
  const factory=jest.fn(()=>require('express').Router());createProductionApp({env,growthTaskRouterFactory:factory});
  expect(Object.keys(factory.mock.calls[0][0])).toEqual(['attachmentMediaService', 'sourceReader']);
  expect(Object.keys(factory.mock.calls[0][0].sourceReader)).toEqual(['require', 'describe']);
  expect(factory.mock.calls[0][0].sourceReader.require).toEqual(expect.any(Function));
  expect(factory.mock.calls[0][0].sourceReader.describe).toEqual(expect.any(Function));
  const excluded=['growthTaskCompletionService.js','growthTaskCompletionMediaService.js','growthTaskCompletionConfirmationService.js',
    'growthTaskCompletionMutationService.js','growthTaskCompletionMutation.js','growthTaskCompletionReadiness.js',
    'GrowthTaskCompletionOperation.js','completionMediaReferenceClient.js','growthTaskCompletion.js',
    'growthTaskCompletionReadService.js','growthTaskCompletionRead.js',
    'growthTaskCompletionParentAccess.js','growthTaskCompletionProduction.js'];
  expect(Object.keys(require.cache).filter(f=>excluded.some(name=>f.endsWith('/'+name)))).toEqual([]);
});
test('production GET does not expose or recover persisted completion intent',async()=>{
  const parent=id(),child=id();const family=await Family.create({familyName:'Synthetic',ownerParentId:parent,memberParentIds:[parent],childIds:[child]});
  await User.collection.insertMany([{_id:parent,role:'parent',username:String(parent),email:String(parent)+'@example.test'},
    {_id:child,role:'student',familyId:family._id,username:String(child),email:String(child)+'@example.test'}]);
  const task=await Task.create({familyId:family._id,childId:child,createdByParentId:parent,dimension:'academic',title:'Synthetic',taskType:'practice',dueDate:'2026-10-22'});
  await Task.collection.updateOne({_id:task._id},{$set:{completionPending:{patch:{childNote:'synthetic pending secret'}},
    activeCompletionOperation:{actorId:parent},completionMediaReferenceState:'pending_recovery'}});
  const before=await Task.collection.findOne({_id:task._id}),path='/api/growth-tasks/'+task._id;
  const headers=createIdentityHeaders({method:'GET',originalUrl:path,user:{id:String(parent),role:'parent'},secret:process.env.GATEWAY_IDENTITY_SECRET});
  const response=await (await request(createProductionApp({env}))).get(path).set(headers);
  expect(response.status).toBe(200);expect(JSON.stringify(response.body)).not.toMatch(/completionPending|activeCompletionOperation|synthetic pending secret/);
  expect(await Task.collection.findOne({_id:task._id})).toEqual(before);
});
