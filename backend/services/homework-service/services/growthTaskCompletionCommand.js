const { createHash } = require('crypto');
const { AppError } = require('../../../common/middleware/errorTypes');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[0-9a-f]{24}$/i;
const PATCH_FIELDS = ['actualMinutes', 'actualAmount', 'difficulty', 'needsHelp', 'childNote'];
const error = (status, code) => new AppError(code, status, code, true, []);
const pending = () => error(503, 'MEDIA_REFERENCE_PENDING');
const invalid = () => error(400, 'VALIDATION_ERROR');
const matches = (value, regex) => typeof value === 'string' && regex.test(value);
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = v => Number.isSafeInteger(v) && v >= 0;
const normalize = body => {
  const required = ['operationId', 'expectedCompletionVersion', 'expectedChecklistVersion', 'checkedItemIds', 'completionMediaIds'];
  if (!plain(body) || Object.keys(body).some(k => ![...required, ...PATCH_FIELDS].includes(k))) throw invalid();
  if (!required.slice(0, 3).every(k => Object.prototype.hasOwnProperty.call(body, k))) {
    throw error(400, 'CLIENT_UPGRADE_REQUIRED');
  }
  if (!matches(body.operationId, UUID)
    || !integer(body.expectedCompletionVersion) || !integer(body.expectedChecklistVersion)
    || body.expectedCompletionVersion === Number.MAX_SAFE_INTEGER) throw invalid();
  const ids = (list, max, valid, { foldCase = false, code = 'VALIDATION_ERROR', limitCode = code } = {}) => {
    if (!Array.isArray(list)) throw error(400, code);
    if (list.length > max) throw error(400, limitCode);
    const out = Array.from(list, v => { if (!valid(v)) throw error(400, code); return v; });
    if (new Set(out.map(v => foldCase ? v.toLowerCase() : v)).size !== out.length) throw error(400, code);
    return out;
  };
  const out = { operationId: body.operationId.toLowerCase(), expectedCompletionVersion: body.expectedCompletionVersion,
    expectedChecklistVersion: body.expectedChecklistVersion,
    checkedItemIds: ids(body.checkedItemIds, 5, v => typeof v === 'string' && v.length > 0 && v.length <= 100,
      { code: 'CHECKLIST_ITEM_INVALID' }).sort(),
    completionMediaIds: ids(body.completionMediaIds, 10, v => matches(v, ID),
      { foldCase: true, limitCode: 'MEDIA_ATTACHMENT_LIMIT_EXCEEDED' }).map(v => v.toLowerCase()) };
  for (const key of PATCH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const v = body[key];
    if ((['actualMinutes', 'actualAmount'].includes(key) && (typeof v !== 'number' || !Number.isFinite(v) || v < 0))
      || (key === 'difficulty' && !['easy', 'normal', 'hard'].includes(v))
      || (key === 'needsHelp' && typeof v !== 'boolean') || (key === 'childNote' && typeof v !== 'string')) throw invalid();
    out[key] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
};
const scopeFor = (task, identity, operationId) => ({ familyId: String(task.familyId), childId: String(task.childId),
  taskId: String(task._id), actorId: identity.id.toLowerCase(), action: 'complete', operationId });
const hashCommand = (scope, command) => createHash('sha256').update(JSON.stringify({ scope, command })).digest('hex');
const bindings = rows => Array.from(rows || [], r => ({ mediaId: String(r.mediaId), bindingOperationId: r.bindingOperationId }));
const difference = (previous, desired) => ({ additionIds: desired.filter(id => !previous.some(r => r.mediaId === id)),
  removalBindings: previous.filter(r => !desired.includes(r.mediaId)) });
const bodyFromPending = (op, p) => normalize({ operationId: op.operationId,
  expectedCompletionVersion: p.expectedCompletionVersion, expectedChecklistVersion: p.expectedChecklistVersion,
  checkedItemIds: p.patch.checkedItemIds, completionMediaIds: p.mediaIds.map(String),
  ...Object.fromEntries(PATCH_FIELDS.filter(k => p.patch[k] !== undefined).map(k => [k, p.patch[k]])) });
const unlockedFilter = () => ({ activeCompletionOperation: null, completionPending: null,
  completionMediaReferenceState: { $ne: 'pending_recovery' }, mediaReferenceState: { $ne: 'pending' } });
module.exports = { UUID, ID, PATCH_FIELDS, matches, error, pending, invalid, normalize, scopeFor, hashCommand,
  bindings, difference, bodyFromPending, unlockedFilter };
