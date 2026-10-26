const { Schema } = require('mongoose');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const options = { _id: false, strict: 'throw' };
const integer = { type: Number, min: 0, validate: Number.isSafeInteger };
const actor = new Schema({ id: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['parent', 'student'], required: true } }, options);
const binding = new Schema({ mediaId: { type: Schema.Types.ObjectId, required: true },
  bindingOperationId: { type: String, required: true, match: UUID } }, options);
const owner = new Schema(Object.fromEntries([
  ...['familyId', 'childId', 'taskId', 'actorId'].map(key => [key, { type: Schema.Types.ObjectId, required: true }]),
  ['action', { type: String, enum: ['complete'], required: true }],
  ['operationId', { type: String, required: true, match: UUID }]
]), options);
const array = (type, max) => ({ type: [type], default: undefined, castNonArrays: false,
  validate: values => values == null || values.length <= max && Array.from(values).every(v => v != null) });
const patchFields = {
  checkedItemIds: array(String, 5), actualMinutes: { type: Number, min: 0 }, actualAmount: { type: Number, min: 0 },
  difficulty: { type: String, enum: ['easy', 'normal', 'hard'] }, needsHelp: Boolean, childNote: String,
  submittedByActor: { type: actor, required: true }
};
const pending = new Schema({
  phase: { type: String, enum: ['PREPUBLISH', 'PUBLISHED_CLEANUP'], required: true },
  version: { ...integer, required: true }, targetCompletionVersion: { ...integer, required: true, min: 1 },
  expectedCompletionVersion: { ...integer, required: true }, expectedChecklistVersion: { ...integer, required: true },
  commandHash: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
  patch: { type: new Schema(patchFields, options), required: true },
  mediaIds: array(Schema.Types.ObjectId, 10), previousBindings: array(binding, 10),
  additionIds: array(Schema.Types.ObjectId, 10), removalBindings: array(binding, 10),
  remoteOutcomeUncertain: { type: Boolean, required: true }
}, options);

// No defaults are written to legacy tasks; the dormant service supplies read projections.
module.exports = {
  checklistSnapshot: {
    ...array(new Schema({ itemId: { type: String, required: true, maxlength: 100 },
      label: { type: String, required: true, maxlength: 100 }, required: Boolean }, options), 5),
    validate: values => values === undefined || Array.isArray(values) && values.length <= 5
      && Array.from(values).every(value => value && typeof value.itemId === 'string' && value.itemId.trim()
        && typeof value.label === 'string' && value.label.trim())
      && new Set(values.map(value => value.itemId)).size === values.length
  },
  checklistVersion: integer,
  completionVersion: integer,
  completionEvidence: { type: new Schema({ ...patchFields,
    completionMediaIds: array(Schema.Types.ObjectId, 10), subjectChildId: { type: Schema.Types.ObjectId, required: true },
    childSubmittedAt: { type: Date, required: true } }, options), default: undefined },
  completionMediaReferenceState: { type: String, enum: ['stable', 'pending_recovery'] },
  completionMediaBindings: { ...array(binding, 10), select: false },
  activeCompletionOperation: { type: owner, default: undefined, select: false },
  completionPending: { type: pending, default: undefined, select: false }
};
