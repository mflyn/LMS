const Guard = require('../models/CompletionMediaGuard');
const { ID, matches, error, pending } = require('./growthTaskCompletionCommand');

const guardCollision = cause => cause?.code === 11000 && cause.keyPattern?.familyId === 1
  && cause.keyPattern?.childId === 1 && cause.keyPattern?.mediaId === 1;

const touchGuard = async (scope, session) => {
  if (!session?.inTransaction()) throw pending();
  const guard = await Guard.findOneAndUpdate(scope,
    { $setOnInsert: { state: 'available', retirementId: null, retiredAt: null }, $inc: { revision: 1 } },
    { session, upsert: true, new: true, runValidators: true });
  await guard.validate();
  return guard;
};

const touchCompletionMediaGuards = async ({ familyId, childId, mediaIds, session }) => {
  // A real write, shared with retirement, closes the read-then-claim race.
  // Sorted acquisition avoids opposite lock ordering for multi-image submissions.
  const ids = [...new Set(mediaIds.map(String))].sort();
  if (ids.some(id => !matches(id, ID))) throw pending();
  for (const mediaId of ids) {
    const guard = await touchGuard({ familyId, childId, mediaId }, session);
    if (guard.state === 'retired') throw error(404, 'RESOURCE_NOT_FOUND');
  }
};

module.exports = { guardCollision, touchGuard, touchCompletionMediaGuards };
