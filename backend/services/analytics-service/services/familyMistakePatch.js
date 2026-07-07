const PARENT_CREATE_FIELDS = [
  'childId',
  'subject',
  'knowledgePointId',
  'knowledgePointName',
  'questionMediaId',
  'childAnswerMediaId',
  'correctAnswer',
  'parentNote',
  'childExplanation',
  'reason',
  'corrected',
  'reviewed',
  'mastered',
  'reviewReminderDate'
];

const CHILD_CREATE_FIELDS = [
  'childId',
  'subject',
  'reason',
  'childAnswerMediaId',
  'childExplanation',
  'corrected',
  'reviewed',
  'mastered',
  'reviewReminderDate'
];

const PARENT_PATCH_FIELDS = PARENT_CREATE_FIELDS.filter((field) => field !== 'childId');

const CHILD_PATCH_FIELDS = [
  'childAnswerMediaId',
  'childExplanation',
  'corrected',
  'reviewed',
  'mastered',
  'reviewReminderDate'
];

const STATE_FIELDS = ['reviewed', 'mastered', 'reviewReminderDate'];
const MEDIA_FIELDS = ['questionMediaId', 'childAnswerMediaId'];

class FamilyMistakePatchError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const allowedFieldsFor = (role, operation) => {
  if (role === 'student') {
    return operation === 'create' ? CHILD_CREATE_FIELDS : CHILD_PATCH_FIELDS;
  }
  if (role === 'parent') {
    return operation === 'create' ? PARENT_CREATE_FIELDS : PARENT_PATCH_FIELDS;
  }
  return [];
};

const assertAllowedFields = (body, allowed) => {
  const forbidden = Object.keys(body || {}).filter((field) => !allowed.includes(field));
  if (forbidden.length > 0) {
    throw new FamilyMistakePatchError(
      'FIELD_ACCESS_DENIED',
      'Request contains fields not allowed for this role',
      403
    );
  }
};

const parseFamilyMistakeInput = ({ body = {}, role, operation }) => {
  const allowed = allowedFieldsFor(role, operation);
  assertAllowedFields(body, allowed);

  const data = {};
  allowed.forEach((field) => {
    if (hasOwn(body, field)) data[field] = body[field];
  });
  return data;
};

const stateChangedBy = (data) => STATE_FIELDS.some((field) => hasOwn(data, field));

const mediaPatchEntriesFor = (data) => MEDIA_FIELDS
  .filter((field) => hasOwn(data, field))
  .map((field) => ({ path: field, value: data[field] || null }));

module.exports = {
  CHILD_CREATE_FIELDS,
  CHILD_PATCH_FIELDS,
  FamilyMistakePatchError,
  MEDIA_FIELDS,
  PARENT_CREATE_FIELDS,
  PARENT_PATCH_FIELDS,
  STATE_FIELDS,
  mediaPatchEntriesFor,
  parseFamilyMistakeInput,
  stateChangedBy
};
