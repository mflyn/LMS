const { createHash } = require('crypto');
const Asset = require('../models/MediaAsset');
const { AppError } = require('../../../common/middleware/errorTypes');
const keys = ['familyId', 'childId', 'uploadedBy', 'purpose', 'mimeType', 'displayName', 'sizeBytes',
  'pageCount', 'storageKey', 'malwareScanStatus', 'malwareScannedAt'];
const fail = () => new AppError('MEDIA_UPLOAD_PENDING', 503, 'MEDIA_UPLOAD_PENDING', true, []);
const hash = metadata => createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
const canonicalMetadata = source => ({
  familyId: String(source.familyId).toLowerCase(), childId: String(source.childId).toLowerCase(), uploadedBy: String(source.uploadedBy).toLowerCase(),
  purpose: source.purpose, mimeType: source.mimeType, displayName: 'task-completion', sizeBytes: source.sizeBytes,
  pageCount: source.pageCount ?? null, storageKey: source.storageKey,
  malwareScanStatus: source.malwareScanStatus,
  malwareScannedAt: source.malwareScannedAt == null ? null : new Date(source.malwareScannedAt).toISOString()
});
const validateRecord = async record => {
  if (!record || Object.keys(record).sort().join(',') !== 'identity,mediaId,metadata,metadataHash,version'
    || record.version !== 1 || !/^[0-9a-f]{24}$/.test(record.mediaId || '')
    || !record.metadata || Object.keys(record.metadata).sort().join(',') !== [...keys].sort().join(',')
    || keys.some(key => record.metadata[key] === undefined)) throw fail();
  const metadata = canonicalMetadata(record.metadata);
  if (JSON.stringify(metadata) !== JSON.stringify(record.metadata) || hash(metadata) !== record.metadataHash
    || metadata.purpose !== 'task_completion' || !['image/jpeg', 'image/png', 'image/webp'].includes(metadata.mimeType)) throw fail();
  const identity = record.identity;
  if (!identity || !['parent', 'student'].includes(identity.role) || identity.id !== metadata.uploadedBy
    || Object.keys(identity).some(key => !['id', 'role', 'tokenVersion'].includes(key))
    || identity.role === 'student' && (!Number.isSafeInteger(identity.tokenVersion) || identity.tokenVersion < 0)) throw fail();
  await new Asset({ _id: record.mediaId, ...metadata }).validate();
  return record;
};
module.exports = { canonicalMetadata, hash, validateRecord };
