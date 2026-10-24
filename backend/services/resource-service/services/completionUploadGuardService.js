const Guard = require('../models/CompletionUploadGuard');
const { canonicalMetadata, hash } = require('./completionUploadRecord');

const identityFor = (asset, mediaId = asset._id) => ({ mediaId, familyId: asset.familyId, childId: asset.childId,
  storageKey: asset.storageKey, metadataHash: hash(canonicalMetadata(asset)) });
const matchesGuard = (guard, identity) => Object.entries(identity).every(([key, value]) => String(guard[key]) === String(value));

const retireUploadGuard = async (asset, session) => {
  if (!session?.inTransaction()) throw Error('Active upload retirement transaction required');
  const identity = identityFor(asset);
  const guard = await Guard.findOne({ mediaId: asset._id }).session(session);
  if (guard && !matchesGuard(guard, identity)) throw Error('Upload identity conflict');
  if (guard) await guard.validate();
  if (guard?.state === 'RETIRED') return;
  const updated = await Guard.findOneAndUpdate({ mediaId: asset._id },
    { $setOnInsert: identity, $set: { state: 'RETIRED' }, $inc: { revision: 1 } },
    { session, upsert: true, new: true, runValidators: true });
  await updated.validate();
};
module.exports = { identityFor, matchesGuard, retireUploadGuard };
