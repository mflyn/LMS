const { createGrowthTaskCompletionMediaService } = require('../../services/growthTaskCompletionMediaService');
const UUID='7fe39b20-2bc9-45fb-b2d1-a91ff15a62d8', OLD='4d979020-09c5-4c94-8a9f-90b8fc8f0d55';
const op={familyId:'a'.repeat(24),childId:'b'.repeat(24),taskId:'c'.repeat(24),remoteOperationId:UUID,commandHash:'d'.repeat(64)};
const intent=()=>({additionIds:['e'.repeat(24)],removalBindings:[]});
const response=(state='COMMITTED')=>({operation:{operationId:UUID,commandHash:state==='ABSENT'?null:op.commandHash,state,
  leaseExpiresAt:state==='PREPARED'?'2026-10-22T00:15:00.000Z':null,leaseExpired:state==='PREPARED'?false:null,failureCode:null},
  references:[{mediaId:'e'.repeat(24),field:'completionMediaIds',state:state==='PREPARED'?'prepared':'bound',bindingOperationId:UUID,privacyDeletion:null}]});
let client,service;
beforeEach(()=>{
  client=Object.fromEntries(['prepare','commit','status','abort','unbind'].map(k=>[k,jest.fn().mockResolvedValue(response())]));
  service=createGrowthTaskCompletionMediaService({mediaReferenceClient:client});
});
test('empty additions and removals do not send empty commands',async()=>{
  expect(await service.prepareForPublish({operation:op,intent:{additionIds:[]}})).toEqual({kind:'publish'});
  await service.cleanup({operation:op,intent:{removalBindings:[]}});
  for(const fn of Object.values(client))expect(fn).not.toHaveBeenCalled();
});
test.each([
  ['remote mapping',r=>{r.operation.operationId=OLD;}],['hash',r=>{r.operation.commandHash='f'.repeat(64);}],
  ['sparse',r=>{r.references=new Array(1);}],['missing',r=>{r.references=[];}],
  ['wrong generation',r=>{r.references[0].bindingOperationId=OLD;}],
  ['released without proof',r=>{r.references[0].state='released';}],
  ['absent without proof',r=>{r.references[0].state='absent';delete r.references[0].bindingOperationId;}]
])('prepublish blocks %s evidence',async(_label,mutate)=>{
  const r=response();mutate(r);client.status.mockResolvedValue(r);
  await expect(service.prepareForPublish({operation:op,intent:intent()})).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
});
test.each([false,true])('prepared lease expired=%s chooses the correct terminal request',async expired=>{
  const r=response('PREPARED');r.operation.leaseExpired=expired;client.status.mockResolvedValue(r);
  await service.prepareForPublish({operation:op,intent:intent()});
  expect(client[expired?'abort':'commit']).toHaveBeenCalledTimes(1);expect(client[expired?'commit':'abort']).not.toHaveBeenCalled();
  expect(client.prepare).not.toHaveBeenCalled();
});
test('first prepare ABORTED and recovery ABORTED both require a matched terminal',async()=>{
  const r=response('ABORTED');r.operation.failureCode='MEDIA_OPERATION_EXPIRED';r.references[0].state='released';
  client.status.mockResolvedValue(r);client.prepare.mockResolvedValue(r);
  for(const firstPrepare of [true,false])expect(await service.prepareForPublish({operation:op,intent:intent(),firstPrepare})).toEqual({kind:'fail',code:'MEDIA_OPERATION_EXPIRED',status:409});
  expect(client.commit).not.toHaveBeenCalled();expect(client.abort).not.toHaveBeenCalled();
});
test.each(['prepared','other generation','sparse','missing'])('cleanup blocks %s without unbinding',async kind=>{
  const p={removalBindings:[{mediaId:'e'.repeat(24),bindingOperationId:OLD}]};
  const r={operation:null,references:[{mediaId:'e'.repeat(24),field:'completionMediaIds',state:'bound',bindingOperationId:OLD,privacyDeletion:null}]};
  if(kind==='prepared')r.references[0].state='prepared';if(kind==='other generation')r.references[0].bindingOperationId=UUID;
  if(kind==='sparse')r.references=new Array(1);if(kind==='missing')r.references=[];
  client.status.mockResolvedValue(r);
  await expect(service.cleanup({operation:op,intent:p})).rejects.toMatchObject({code:'MEDIA_REFERENCE_PENDING'});
  expect(client.unbind).not.toHaveBeenCalled();expect(client.abort).not.toHaveBeenCalled();
});
test('cleanup sends only same-generation bound rows, current mapping is audit only',async()=>{
  const ids=['e','f','a'].map(x=>x.repeat(24)),p={removalBindings:ids.map(mediaId=>({mediaId,bindingOperationId:OLD}))};
  client.status.mockResolvedValue({operation:null,references:ids.map((mediaId,i)=>({mediaId,field:'completionMediaIds',
    state:['bound','released','absent'][i],...(i===2?{}:{bindingOperationId:OLD}),privacyDeletion:null}))});
  client.unbind.mockResolvedValue({operation:null,references:[{mediaId:ids[0],field:'completionMediaIds',state:'released',bindingOperationId:OLD,privacyDeletion:null}]});
  await service.cleanup({operation:op,intent:p});
  expect(client.unbind).toHaveBeenCalledWith({familyId:op.familyId,childId:op.childId,resourceType:'growth_task',resourceId:op.taskId,
    remoteOperationId:UUID,references:[{mediaId:ids[0],field:'completionMediaIds',bindingOperationId:OLD}]});
  expect(client.status.mock.calls[0][0]).not.toHaveProperty('commandHash');
  expect(client.prepare).not.toHaveBeenCalled();expect(client.abort).not.toHaveBeenCalled();
});
