const { createHash } = require('crypto');

const fieldFor = type => type === 'growth_task' ? 'completionMediaIds'
  : type === 'ai2_attempt' ? 'correctionMediaIds' : type === 'ai3_attempt' ? 'practiceMediaIds' : null;
const purposeFor = type => type === 'growth_task' ? 'task_completion'
  : type === 'ai2_attempt' ? 'ai2_correction' : type === 'ai3_attempt' ? 'ai3_practice' : null;
const validPair = (type, field) => fieldFor(type) !== null && fieldFor(type) === field;
const protocolFields = Object.freeze(['completionMediaIds', 'correctionMediaIds', 'practiceMediaIds']);
const protocolPurposes = Object.freeze(['task_completion', 'ai2_correction', 'ai3_practice']);
const isAttemptType = type => type === 'ai2_attempt' || type === 'ai3_attempt';
const isAttemptPurpose = purpose => purpose === 'ai2_correction' || purpose === 'ai3_practice';
const validAi2MediaMetadata = value => value != null && ['image/jpeg', 'image/png', 'image/webp'].includes(value.mimeType)
  && Number.isSafeInteger(value.sizeBytes) && value.sizeBytes >= 1 && value.sizeBytes <= 10 * 1024 * 1024;
const typedScope = command => isAttemptType(command.resourceType)
  ? { resourceType: command.resourceType, resourceId: String(command.resourceId), field: fieldFor(command.resourceType) } : {};
const referenceSetHash = command => {
  // Old task bytes are persisted evidence and must not be versioned retroactively.
  const value = command.resourceType === 'growth_task' ? command.references
    : { schemaVersion: command.resourceType === 'ai3_attempt' ? 'ai3-min-v1' : 'ai2-min-v1', ...typedScope(command), references: command.references };
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
};

module.exports = { fieldFor, purposeFor, validPair, protocolFields, protocolPurposes, typedScope, referenceSetHash,
  validAi2MediaMetadata, isAttemptType, isAttemptPurpose };
