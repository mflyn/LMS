const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Mistake = require('../../models/FamilyMistake');
const Event = require('../../models/FamilyMistakeStateEvent');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createFamilyMistakeMediaService } = require('../../services/familyMistakeMediaService');
const id = () => String(new mongoose.Types.ObjectId());
const transactionRunner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
async function seed() {
  const familyId = id(), childId = id(), actorId = id(), memberId = id();
  await User.collection.insertMany([
    { _id: new mongoose.Types.ObjectId(actorId), role: 'parent' },
    { _id: new mongoose.Types.ObjectId(memberId), role: 'parent' },
    { _id: new mongoose.Types.ObjectId(childId), role: 'student', familyId: new mongoose.Types.ObjectId(familyId), childProfile: { tokenVersion: 0 } }
  ].map(user => ({ ...user, username: String(user._id), email: `${user._id}@example.invalid` })));
  await Family.create({ _id: familyId, familyName: 'Synthetic AI3 consumer', ownerParentId: actorId,
    memberParentIds: [actorId, memberId], childIds: [childId] });
  const mistake = await Mistake.create({ familyId, childId, subject: 'math', reason: 'careless',
    createdBy: actorId, updatedBy: actorId, corrected: true, parentNote: 'Preserve synthetic note',
    reviewReminderDate: '2026-10-01' });
  return { familyId, childId, actorId, memberId, targetId: String(mistake._id), mistake };
}
function mediaService(overrides = {}) {
  const client = Object.fromEntries(['prepare', 'commit', 'unbind'].map(action => [action,
    jest.fn(async q => q.references.map(r => ({ ...r, state: { prepare: 'prepared', commit: 'bound', unbind: 'released' }[action] }))) ]));
  Object.assign(client, overrides);
  return { client, service: createFamilyMistakeMediaService({ FamilyMistakeModel: Mistake,
    FamilyMistakeStateEventModel: Event, mediaReferenceClient: client, randomUUID, runTransaction: transactionRunner }) };
}
module.exports = { mongoose, id, randomUUID, Family, User, Mistake, Event, seed, transactionRunner, mediaService };
