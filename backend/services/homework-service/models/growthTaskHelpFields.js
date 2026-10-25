const { Schema } = require('mongoose');
const HELP_TYPES = ['instruction_unclear', 'cannot_start', 'stuck_midway', 'uncertain_result', 'fatigued', 'other'];
const shortText = { type: String, validate: value => value === undefined || [...value].length <= 200 };
const actor = new Schema({ id: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['parent', 'student'], required: true } }, { _id: false, strict: 'throw' });
const record = new Schema({
  status: { type: String, enum: ['pending', 'resolved'], required: true },
  helpType: { type: String, enum: HELP_TYPES, required: true },
  note: shortText,
  requestedByActor: { type: actor, required: true }, requestedAt: { type: Date, required: true },
  parentResponse: shortText, resolvedByActor: { type: actor }, resolvedAt: Date
}, { _id: false, strict: 'throw' });
module.exports = { HELP_TYPES, fields: {
  helpVersion: { type: Number, min: 0, validate: Number.isSafeInteger },
  helpRequest: { type: record, default: undefined }
} };
