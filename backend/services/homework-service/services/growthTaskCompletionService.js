const crypto = require('crypto');
const Task = require('../models/GrowthTask');
const Operation = require('../models/GrowthTaskCompletionOperation');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const { resolveChildAccess } = require('../../../common/utils/familyAccess');
const { createGrowthTaskCompletionMediaService } = require('./growthTaskCompletionMediaService');
const { guardCollision, touchCompletionMediaGuards } = require('./completionMediaGuardService');
const { assertIntent, ownerKeys } = require('./completionIntentValidation');
const { UUID, ID, PATCH_FIELDS, matches, error, pending, invalid, normalize, scopeFor, hashCommand,
  bindings, difference, unlockedFilter } = require('./growthTaskCompletionCommand');
const HIDDEN = '+activeCompletionOperation +completionPending +completionMediaBindings';
const copy = value => JSON.parse(JSON.stringify(value));
const versionFilter = (key, value) => value === 0 ? { $or: [{ [key]: 0 }, { [key]: { $exists: false } }] } : { [key]: value };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pendingMetadataUnset = { activeCompletionOperation: '', completionPending: '' };

const createGrowthTaskCompletionService = ({ transactionRunner, mediaReferenceClient, now = Date.now,
  randomUUID = crypto.randomUUID } = {}) => {
  if (typeof transactionRunner !== 'function' || typeof now !== 'function' || typeof randomUUID !== 'function') {
    throw new Error('Completion transaction runner, clock and UUID generator are required');
  }
  const media = createGrowthTaskCompletionMediaService({ mediaReferenceClient });
  const transact = (label, work) => transactionRunner(async session => {
    if (!session?.inTransaction()) throw new Error('Active completion transaction is required');
    return work(session);
  }, label);
  const authorize = async (identity, taskId, session) => {
    if (!identity || !matches(identity.id, ID) || !['parent', 'student'].includes(identity.role)) throw error(403, 'CHILD_ACCESS_DENIED');
    if (!matches(taskId, ID)) throw invalid();
    const task = await Task.findById(taskId).select(HIDDEN).session(session).lean();
    if (!task) throw error(403, 'CHILD_ACCESS_DENIED');
    const access = await resolveChildAccess(identity, String(task.childId), {
      FamilyModel: { findOne: query => Family.findOne(query).session(session) },
      UserModel: { findOne: query => User.findOne(query).session(session) }
    });
    const user = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
    if (!access || String(access.familyId) !== String(task.familyId) || !user
      || identity.role === 'student' && (!Number.isInteger(identity.tokenVersion)
        || user.childProfile?.tokenVersion !== identity.tokenVersion)) throw error(403, 'CHILD_ACCESS_DENIED');
    return task;
  };
  const checkMapping = op => {
    if (!op || !matches(op.remoteOperationId, UUID) || op.remoteOperationId !== op.remoteOperationId.toLowerCase()) throw pending();
  };
  const stateFor = async (identity, taskId, scope, session, command) => {
    const task = await authorize(identity, taskId, session);
    if (String(task.familyId) !== scope.familyId || String(task.childId) !== scope.childId
      || identity.id.toLowerCase() !== scope.actorId) throw error(403, 'CHILD_ACCESS_DENIED');
    const operation = await Operation.findOne(scope).session(session).lean();
    checkMapping(operation);
    if (command && operation.commandHash !== hashCommand(scope, command)) throw error(409, 'IDEMPOTENCY_KEY_REUSED');
    if (!['SUCCEEDED','FAILED'].includes(operation.phase)) assertIntent(task, operation, scope);
    return { task, operation, scope };
  };
  const pendingOrKnown = cause => {
    if (cause?.statusCode < 500) throw cause;
    throw pending();
  };
  const claim = async (identity, taskId, command) => {
    let candidate;
    for (let attempt=0;attempt<5;attempt+=1) {
      try {
        return await transact('claim', async session => {
          const task = await authorize(identity, taskId, session), scope = scopeFor(task, identity, command.operationId);
          const existing = await Operation.findOne(scope).session(session).lean();
          if (existing) return stateFor(identity, taskId, scope, session, command);
          if (task.activeCompletionOperation || task.completionPending || task.completionMediaReferenceState === 'pending_recovery'
            || task.mediaReferenceState === 'pending') throw pending();
          if (!['pending','completed'].includes(task.status)) throw error(409, 'TASK_STATE_CONFLICT');
          if ((task.completionVersion ?? 0) !== command.expectedCompletionVersion
            || (task.checklistVersion ?? 0) !== command.expectedChecklistVersion) throw error(409, 'VERSION_CONFLICT');
          if (command.checkedItemIds.some(item => !(task.checklistSnapshot || []).some(r=>r.itemId===item))) {
            throw error(400, 'CHECKLIST_ITEM_INVALID');
          }
          const previous = bindings(task.completionMediaBindings), oldIds = (task.completionEvidence?.completionMediaIds || []).map(String);
          if (!same(oldIds, previous.map(r=>r.mediaId)) || new Set(oldIds).size !== oldIds.length
            || previous.some(r=>!matches(r.bindingOperationId, UUID))) throw pending();
          await touchCompletionMediaGuards({ familyId: task.familyId, childId: task.childId,
            mediaIds: [...command.completionMediaIds, ...oldIds], session });
          const commandHash = hashCommand(scope, command), target = command.expectedCompletionVersion+1;
          candidate = candidate || randomUUID();
          if (!matches(candidate, UUID)) throw pending();
          candidate = candidate.toLowerCase();
          const patch = { checkedItemIds: command.checkedItemIds,
            ...Object.fromEntries(PATCH_FIELDS.filter(k=>command[k]!==undefined).map(k=>[k,command[k]])),
            submittedByActor: { id: scope.actorId, role: identity.role } };
          const intent = { phase:'PREPUBLISH',version:0,targetCompletionVersion:target,
            expectedCompletionVersion:command.expectedCompletionVersion,expectedChecklistVersion:command.expectedChecklistVersion,
            commandHash,patch,mediaIds:command.completionMediaIds,previousBindings:previous,
            ...difference(previous, command.completionMediaIds),remoteOutcomeUncertain:false };
          const changed = await Task.updateOne({ _id:task._id,familyId:task.familyId,childId:task.childId,
            ...unlockedFilter(),status:task.status,$and:[versionFilter('completionVersion',command.expectedCompletionVersion),
              versionFilter('checklistVersion',command.expectedChecklistVersion),versionFilter('__v',task.__v ?? 0)] },
          { $set:{activeCompletionOperation:scope,completionPending:intent,completionMediaReferenceState:'pending_recovery'},
            $inc:{__v:1} },{session,runValidators:true});
          if (changed.matchedCount!==1) throw pending();
          await Operation.create([{...scope,remoteOperationId:candidate,commandHash,targetCompletionVersion:target,
            phase:'PREPUBLISH',version:0}],{session});
          return stateFor(identity,taskId,scope,session,command);
        });
      } catch (cause) {
        if (cause.code === 11000) {
          if (guardCollision(cause)) continue;
          // Only a definite rolled-back unique collision may allocate a replacement mapping.
          if (cause.keyPattern?.remoteOperationId) candidate = undefined;
          else if (!cause.keyPattern?.operationId) throw pending();
          continue;
        }
        pendingOrKnown(cause);
      }
    }
    throw pending();
  };
  const ownerFilter = state => ({ _id:state.task._id,familyId:state.scope.familyId,childId:state.scope.childId,
    ...Object.fromEntries(ownerKeys.map(k=>['activeCompletionOperation.'+k,state.scope[k]])),
    'completionPending.phase':state.operation.phase,'completionPending.version':state.operation.version,
    'completionPending.targetCompletionVersion':state.operation.targetCompletionVersion,
    'completionPending.commandHash':state.operation.commandHash,completionMediaReferenceState:'pending_recovery',
    mediaReferenceState:{$ne:'pending'}, status:state.task.status,
    $and:[versionFilter('__v',state.task.__v ?? 0),versionFilter('completionVersion',state.task.completionVersion ?? 0),
      versionFilter('checklistVersion',state.task.checklistVersion ?? 0)] });
  const change = async (identity, prior, action, outcome) => {
    try {
      return await transact(action, async session => {
        const state = await stateFor(identity,String(prior.task._id),prior.scope,session);
        const op = state.operation, p = state.task.completionPending;
        if (op.version !== prior.operation.version || op.phase !== prior.operation.phase
          || !['PREPUBLISH','PUBLISHED_CLEANUP'].includes(op.phase)) throw pending();
        const version = op.version+1, opPatch = {}, set = {}, unset = {};
        if (action === 'mark') {
          if (op.phase!=='PREPUBLISH'||p.remoteOutcomeUncertain) throw pending();
          set['completionPending.remoteOutcomeUncertain']=true;set['completionPending.version']=version;
        } else if (action === 'publish') {
          if (op.phase!=='PREPUBLISH') throw pending();
          const completedAt=new Date(Number(now()));if(!Number.isFinite(completedAt.getTime())) throw pending();
          const ids=p.mediaIds.map(String), previous=bindings(p.previousBindings);
          const nextBindings=ids.map(mediaId=>previous.find(r=>r.mediaId===mediaId)||{mediaId,bindingOperationId:op.remoteOperationId});
          const phase=p.removalBindings.length?'PUBLISHED_CLEANUP':'SUCCEEDED';
          Object.assign(opPatch,{phase,successResponse:{success:true,data:{task:{taskId:String(state.task._id),status:'completed',
            checklistVersion:p.expectedChecklistVersion,completionVersion:op.targetCompletionVersion,completionMediaIds:ids,
            completionMediaReferenceState:'stable',parentConfirmed:false,completedAt}}}});
          Object.assign(set,{status:'completed',completedAt,completionVersion:op.targetCompletionVersion,
            completionMediaBindings:nextBindings,completionEvidence:{...p.patch,completionMediaIds:ids,
              subjectChildId:state.scope.childId,childSubmittedAt:completedAt},
            completionMediaReferenceState:phase==='SUCCEEDED'?'stable':'pending_recovery',
            ...Object.fromEntries(PATCH_FIELDS.filter(k=>p.patch[k]!==undefined).map(k=>[k,p.patch[k]]))});
          // Each completion is a full snapshot; compatibility fields must not retain older answers.
          Object.assign(unset, Object.fromEntries(PATCH_FIELDS.filter(k=>p.patch[k]===undefined).map(k=>[k,''])));
          if(phase==='SUCCEEDED')Object.assign(unset,pendingMetadataUnset);
          else {set['completionPending.phase']=phase;set['completionPending.version']=version;}
        } else if (action === 'fail') {
          if(op.phase!=='PREPUBLISH')throw pending();
          Object.assign(opPatch,{phase:'FAILED',failureCode:outcome.code,failureStatus:outcome.status});
          set.completionMediaReferenceState='stable';Object.assign(unset,pendingMetadataUnset);
        } else if (action === 'finalize') {
          if(op.phase!=='PUBLISHED_CLEANUP')throw pending();
          opPatch.phase='SUCCEEDED';set.completionMediaReferenceState='stable';Object.assign(unset,pendingMetadataUnset);
        } else throw pending();
        await Operation.hydrate({...op,...opPatch,version}).validate();
        const updated=await Operation.updateOne({...state.scope,remoteOperationId:op.remoteOperationId,
          phase:op.phase,version:op.version,commandHash:op.commandHash,targetCompletionVersion:op.targetCompletionVersion},
        {$set:opPatch,$inc:{version:1}},{session});
        if(updated.matchedCount!==1)throw pending();
        const changed=await Task.updateOne(ownerFilter(state),{$set:set,$inc:{__v:1},
          ...(Object.keys(unset).length?{$unset:unset}:{})},{session,runValidators:true});
        if(changed.matchedCount!==1)throw pending();
        return stateFor(identity,String(state.task._id),state.scope,session);
      });
    } catch(cause) { pendingOrKnown(cause); }
  };
  const finish = state => {
    if(state.operation.phase==='SUCCEEDED')return copy(state.operation.successResponse);
    if(state.operation.phase==='FAILED')throw error(state.operation.failureStatus,state.operation.failureCode);
    throw pending();
  };
  const converge = async (identity, initial) => {
    let state=initial;
    if(['SUCCEEDED','FAILED'].includes(state.operation.phase))return finish(state);
    try {
      if(state.operation.phase==='PREPUBLISH') {
        let firstPrepare=false;
        if(state.task.completionPending.additionIds.length && !state.task.completionPending.remoteOutcomeUncertain) {
          state=await change(identity,state,'mark');firstPrepare=true;
        }
        const outcome=await media.prepareForPublish({operation:state.operation,intent:state.task.completionPending,firstPrepare});
        state=await change(identity,state,outcome.kind==='publish'?'publish':'fail',outcome);
      }
      if(state.operation.phase==='PUBLISHED_CLEANUP') {
        await media.cleanup({operation:state.operation,intent:state.task.completionPending});
        state=await change(identity,state,'finalize');
      }
    } catch(cause) {
      if(cause.code==='CHILD_ACCESS_DENIED')throw cause;
      throw pending();
    }
    return finish(state);
  };
  const complete = async ({identity,taskId,body}={}) => {
    try { await transact('read',session=>authorize(identity,taskId,session)); } catch(cause){pendingOrKnown(cause);}
    const command=normalize(body);
    return converge(identity,await claim(identity,taskId,command));
  };
  const emptyInput = value => value === undefined || value !== null && typeof value === 'object'
    && !Array.isArray(value) && Object.keys(value).length === 0;
  const recover = async ({identity,taskId,operationId,body,query}={}) => {
    let state;
    try {
      state=await transact('read',async session=>{
        const task=await authorize(identity,taskId,session);
        if(!matches(operationId,UUID) || !emptyInput(body) || !emptyInput(query))throw invalid();
        const scope = scopeFor(task,identity,operationId.toLowerCase());
        if (!await Operation.findOne(scope).session(session).lean()) throw error(404, 'RESOURCE_NOT_FOUND');
        return stateFor(identity,taskId,scope,session);
      });
    } catch(cause){pendingOrKnown(cause);}
    return converge(identity,state);
  };
  const recoveryView = async (task, identity, session) => {
    const owner = task.activeCompletionOperation;
    const active = await Operation.find({ familyId: task.familyId, childId: task.childId, taskId: task._id,
      phase: { $nin: ['SUCCEEDED', 'FAILED'] } }).session(session).limit(2).lean();
    const none = { state: 'none', operationId: null, targetCompletionVersion: null };
    if (!owner && !task.completionPending && task.completionMediaReferenceState !== 'pending_recovery' && !active.length) return none;
    if (!owner || !matches(String(owner.actorId), ID) || !matches(owner.operationId, UUID)) throw pending();
    const scope = scopeFor(task, { id: String(owner.actorId) }, owner.operationId);
    const op = active[0];
    if (active.length !== 1 || ownerKeys.some(k => String(op[k]) !== scope[k])) throw pending();
    checkMapping(op);
    if (!['PREPUBLISH', 'PUBLISHED_CLEANUP'].includes(op.phase)
      || !Number.isSafeInteger(op.version) || op.version < 0
      || !Number.isSafeInteger(op.targetCompletionVersion) || op.targetCompletionVersion < 1) throw pending();
    assertIntent(task, op, scope);
    return scope.actorId === identity.id.toLowerCase()
      ? { state: 'recoverable', operationId: op.operationId, targetCompletionVersion: op.targetCompletionVersion }
      : { state: 'other_actor', operationId: null, targetCompletionVersion: null };
  };
  const discoverRecovery = async ({ identity, taskId, query } = {}) => {
    try {
      return await transact('read', async session => {
        const task = await authorize(identity, taskId, session);
        if (!emptyInput(query)) throw invalid();
        return { success: true, data: { recovery: await recoveryView(task, identity, session) } };
      });
    } catch (cause) { pendingOrKnown(cause); }
  };
  const listRecoveries = async ({ identity, query = {} } = {}) => {
    try {
      return await transact('read', async session => {
        if (!matches(identity?.id, ID) || !['parent', 'student'].includes(identity.role)) throw error(403, 'CHILD_ACCESS_DENIED');
        const actor = await User.findOne({ _id: identity.id, role: identity.role }).session(session).lean();
        if (!actor) throw error(403, 'CHILD_ACCESS_DENIED');
        let family, childIds;
        if (identity.role === 'student') {
          const access = await resolveChildAccess(identity, identity.id, {
            FamilyModel: { findOne: q => Family.findOne(q).session(session) },
            UserModel: { findOne: q => User.findOne(q).session(session) }
          });
          if (!access || !Number.isInteger(identity.tokenVersion) || actor.childProfile?.tokenVersion !== identity.tokenVersion) {
            throw error(403, 'CHILD_ACCESS_DENIED');
          }
          family = access.family; childIds = [actor._id];
        } else {
          family = await Family.findOne({ $or: [{ ownerParentId: actor._id }, { memberParentIds: actor._id }] }).session(session).lean();
          if (!family) throw error(403, 'CHILD_ACCESS_DENIED');
          const children = await User.find({ _id: { $in: family.childIds }, role: 'student', familyId: family._id })
            .select('_id').session(session).lean();
          childIds = children.map(child => child._id);
        }
        if (!query || typeof query !== 'object' || Array.isArray(query)
          || Object.keys(query).some(k => !['page', 'pageSize'].includes(k) || typeof query[k] !== 'string' || !/^[0-9]+$/.test(query[k]))) throw invalid();
        const page = query.page === undefined ? 1 : Number(query.page);
        const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize), skip = (page - 1) * pageSize;
        if (![page, pageSize].every(v => Number.isSafeInteger(v) && v > 0)
          || pageSize > 50 || !Number.isSafeInteger(skip)) throw invalid();
        // Include orphaned ledger intents even if both task-side markers were lost.
        // The lookup is service-local, read-only, scoped, and bounded to one existence row.
        const tasks = await Task.aggregate([
          { $match: { familyId: family._id, childId: { $in: childIds } } },
          { $lookup: { from: Operation.collection.name, let: { taskId: '$_id', childId: '$childId' }, pipeline: [
            { $match: { familyId: family._id, actorId: actor._id, phase: { $nin: ['SUCCEEDED', 'FAILED'] },
              $expr: { $and: [{ $eq: ['$taskId', '$$taskId'] }, { $eq: ['$childId', '$$childId'] }] } } },
            { $limit: 1 }, { $project: { _id: 1 } }
          ], as: 'recoveryCandidates' } },
          { $match: { $or: [{ 'activeCompletionOperation.actorId': actor._id },
            { 'completionPending.patch.submittedByActor.id': actor._id }, { 'recoveryCandidates.0': { $exists: true } }] } },
          { $sort: { _id: 1 } }, { $skip: skip }, { $limit: pageSize + 1 }
        ]).session(session);
        const items = [];
        for (const task of tasks) {
          const recovery = await recoveryView(task, identity, session);
          if (recovery.state !== 'recoverable') throw pending();
          items.push({ taskId: String(task._id), childId: String(task.childId),
            operationId: recovery.operationId, targetCompletionVersion: recovery.targetCompletionVersion });
        }
        return { success: true, data: { items: items.slice(0, pageSize), page, pageSize, hasMore: items.length > pageSize } };
      });
    } catch (cause) { pendingOrKnown(cause); }
  };
  const read = async ({identity,taskId}={}) => {
    try {
      const task=await transact('read',session=>authorize(identity,taskId,session));
      return {taskId:String(task._id),status:task.status,checklistVersion:task.checklistVersion??0,
        completionVersion:task.completionVersion??0,completionMediaIds:(task.completionEvidence?.completionMediaIds||[]).map(String),
        completionMediaReferenceState:task.completionMediaReferenceState||'stable',
        completionEvidence:task.completionEvidence?copy(task.completionEvidence):null};
    }catch(cause){pendingOrKnown(cause);}
  };
  return {complete,recover,read,discoverRecovery,listRecoveries};
};
module.exports = { createGrowthTaskCompletionService };
