const mongoose = require('mongoose');
const { Schema } = mongoose;
const { LOCAL_DATE_PATTERN } = require('../../../common/utils/familyDate');

const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ATTACHMENT_MEDIA = 100;

const attachmentBindingSchema = new Schema({
  mediaId: { type: Schema.Types.ObjectId, required: true },
  bindingOperationId: { type: String, required: true, match: OPERATION_ID_PATTERN }
}, { _id: false, strict: 'throw' });

const pendingTaskPatchSchema = new Schema({
  path: {
    type: String,
    required: true,
    enum: [
      'dimension', 'area', 'subject', 'title', 'taskType', 'description',
      'dueDate', 'estimatedMinutes', 'targetAmount', 'unit', 'priority'
    ]
  },
  value: { type: Schema.Types.Mixed }
}, { _id: false, strict: 'throw' });

const hasAtMostAttachmentLimit = (entries) => (
  entries == null || entries.length <= MAX_ATTACHMENT_MEDIA
);

const requireArrayInput = (path, { allowUndefined = false } = {}) => (value) => {
  if (Array.isArray(value) || (allowUndefined && value === undefined)) return value;
  throw new mongoose.Error.CastError('Array', value, path);
};

const growthTaskSchema = new Schema({
  childId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  familyId: {
    type: Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    index: true
  },
  createdByParentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dimension: {
    type: String,
    enum: ['moral', 'academic', 'physical', 'artistic', 'labor'],
    required: true,
    index: true
  },
  area: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  taskType: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  dueDate: {
    type: String,
    required: true,
    validate: {
      validator: (value) => {
        if (!LOCAL_DATE_PATTERN.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return parsed.toISOString().slice(0, 10) === value;
      },
      message: 'dueDate must be a valid YYYY-MM-DD LocalDate'
    }
  },
  estimatedMinutes: {
    type: Number,
    min: 0
  },
  actualMinutes: {
    type: Number,
    min: 0
  },
  targetAmount: {
    type: Number,
    min: 0
  },
  actualAmount: {
    type: Number,
    min: 0
  },
  unit: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'confirmed', 'cancelled', 'archived'],
    default: 'pending',
    index: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'normal', 'hard']
  },
  needsHelp: {
    type: Boolean,
    default: false
  },
  childNote: {
    type: String,
    trim: true,
    default: ''
  },
  parentFeedback: {
    type: String,
    trim: true,
    default: ''
  },
  starAwardState: {
    type: String,
    enum: ['not_applicable', 'pending', 'awarded'],
    default: 'not_applicable',
    required: true
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  attachmentMediaIds: {
    type: [{ type: Schema.Types.ObjectId }],
    default: [],
    set: requireArrayInput('attachmentMediaIds'),
    validate: {
      validator: hasAtMostAttachmentLimit,
      message: `attachmentMediaIds cannot exceed ${MAX_ATTACHMENT_MEDIA} entries`
    }
  },
  attachmentMediaBindings: {
    type: [attachmentBindingSchema],
    default: undefined,
    set: requireArrayInput('attachmentMediaBindings', { allowUndefined: true }),
    select: false
  },
  mediaReferenceState: {
    type: String,
    enum: ['none', 'pending', 'bound'],
    default: 'none',
    required: true
  },
  mediaBindingOperationId: {
    type: String,
    match: OPERATION_ID_PATTERN,
    select: false
  },
  attachmentMediaPendingIds: {
    type: [{ type: Schema.Types.ObjectId }],
    default: undefined,
    set: requireArrayInput('attachmentMediaPendingIds', { allowUndefined: true }),
    select: false,
    validate: {
      validator: hasAtMostAttachmentLimit,
      message: `attachmentMediaPendingIds cannot exceed ${MAX_ATTACHMENT_MEDIA} entries`
    }
  },
  attachmentMediaPreviousBindings: {
    type: [attachmentBindingSchema],
    default: undefined,
    set: requireArrayInput('attachmentMediaPreviousBindings', { allowUndefined: true }),
    select: false,
    validate: {
      validator: hasAtMostAttachmentLimit,
      message: `attachmentMediaPreviousBindings cannot exceed ${MAX_ATTACHMENT_MEDIA} entries`
    }
  },
  mediaBindingPhase: {
    type: String,
    enum: ['binding', 'unbinding'],
    select: false
  },
  mediaPendingTaskPatch: {
    type: [pendingTaskPatchSchema],
    default: undefined,
    set: requireArrayInput('mediaPendingTaskPatch', { allowUndefined: true }),
    select: false
  },
  mediaMutationKind: {
    type: String,
    enum: ['create', 'patch'],
    select: false
  },
  mediaRemoteOutcomeUncertain: {
    type: Boolean,
    select: false
  },
  completedAt: Date,
  confirmedAt: Date,
  confirmedByParentId: { type: Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date
}, {
  timestamps: true
});

growthTaskSchema.index({ familyId: 1, childId: 1, dueDate: 1 });
growthTaskSchema.index({ familyId: 1, childId: 1, dimension: 1, status: 1 });

growthTaskSchema.pre('validate', function validateMediaReferenceInvariants(next) {
  const publicIds = this.attachmentMediaIds || [];
  const currentBindings = this.attachmentMediaBindings || [];
  const state = this.mediaReferenceState;
  const pendingMetadata = [
    this.mediaBindingOperationId,
    this.attachmentMediaPendingIds,
    this.attachmentMediaPreviousBindings,
    this.mediaBindingPhase,
    this.mediaPendingTaskPatch,
    this.mediaMutationKind,
    this.mediaRemoteOutcomeUncertain
  ];
  const mediaIdStrings = (entries) => entries.map((entry) => String(entry.mediaId ?? entry));
  const hasUniqueIds = (entries) => {
    const ids = mediaIdStrings(entries);
    return new Set(ids).size === ids.length;
  };
  const bindingsMatchIds = (ids, bindings) => (
    ids.length === bindings.length
    && ids.every((id, index) => String(id) === String(bindings[index].mediaId))
  );
  const bindingsMatch = (left, right) => (
    left.length === right.length
    && left.every((entry, index) => (
      String(entry.mediaId) === String(right[index].mediaId)
      && entry.bindingOperationId === right[index].bindingOperationId
    ))
  );
  const invalidate = (message) => this.invalidate('mediaReferenceState', message);

  if (!hasUniqueIds(publicIds)
    || !hasUniqueIds(currentBindings)
    || !bindingsMatchIds(publicIds, currentBindings)) {
    invalidate('public attachment IDs and current bindings must be unique and ordered identically');
  }

  if (state === 'none') {
    if (publicIds.length > 0 || currentBindings.length > 0 || pendingMetadata.some((value) => value != null)) {
      invalidate('none media state cannot contain attachments or pending metadata');
    }
    return next();
  }

  if (state === 'bound') {
    if (publicIds.length === 0 || pendingMetadata.some((value) => value != null)) {
      invalidate('bound media state requires attachments and cannot contain pending metadata');
    }
    return next();
  }

  if (state === 'pending') {
    const pendingIds = this.attachmentMediaPendingIds;
    const previousBindings = this.attachmentMediaPreviousBindings;
    const hasCompleteMetadata = (
      typeof this.mediaBindingOperationId === 'string'
      && typeof this.mediaMutationKind === 'string'
      && typeof this.mediaBindingPhase === 'string'
      && Array.isArray(pendingIds)
      && Array.isArray(previousBindings)
      && Array.isArray(this.mediaPendingTaskPatch)
      && typeof this.mediaRemoteOutcomeUncertain === 'boolean'
    );

    if (!hasCompleteMetadata) {
      invalidate('pending media state requires complete recovery metadata');
      return next();
    }
    if (!hasUniqueIds(pendingIds) || !hasUniqueIds(previousBindings)) {
      invalidate('pending and previous attachment IDs must be unique');
    }
    if (this.mediaBindingPhase === 'binding'
      && !bindingsMatch(currentBindings, previousBindings)) {
      invalidate('binding phase must leave the previous public bindings current');
    }
    if (this.mediaBindingPhase === 'unbinding'
      && (!bindingsMatchIds(pendingIds, currentBindings)
        || pendingIds.some((id, index) => String(id) !== String(publicIds[index])))) {
      invalidate('unbinding phase must expose the desired attachment bindings');
    }
    if (this.mediaBindingPhase === 'unbinding') {
      const previousOperationByMediaId = new Map(previousBindings.map((entry) => (
        [String(entry.mediaId), entry.bindingOperationId]
      )));
      const hasValidGenerationProvenance = currentBindings.every((entry) => {
        const id = String(entry.mediaId);
        const expectedOperationId = previousOperationByMediaId.has(id)
          ? previousOperationByMediaId.get(id)
          : this.mediaBindingOperationId;
        return entry.bindingOperationId === expectedOperationId;
      });

      if (!hasValidGenerationProvenance) {
        invalidate('unbinding phase bindings must preserve their generation provenance');
      }
    }
    if (this.mediaPendingTaskPatch
      && this.mediaPendingTaskPatch.some((entry) => (
        !Object.prototype.hasOwnProperty.call(entry._doc, 'value')
      ))) {
      invalidate('every pending task patch entry must own a value');
    }
  }

  return next();
});

module.exports = mongoose.models.GrowthTask
  || mongoose.model('GrowthTask', growthTaskSchema);
