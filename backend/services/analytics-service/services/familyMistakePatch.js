const PARENT_CREATE_FIELDS = [
  'childId',
  'subject',
  'knowledgePointId',
  'knowledgePointName',
  'questionMediaIds',
  'questionMediaId',
  'childAnswerMediaIds',
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
  'questionMediaIds',
  'questionMediaId',
  'childAnswerMediaIds',
  'childAnswerMediaId',
  'childExplanation',
  'corrected',
  'reviewed',
  'mastered',
  'reviewReminderDate'
];

const PARENT_PATCH_FIELDS = PARENT_CREATE_FIELDS.filter((field) => field !== 'childId');

const CHILD_PATCH_FIELDS = [
  'questionMediaIds',
  'questionMediaId',
  'childAnswerMediaIds',
  'childAnswerMediaId',
  'childExplanation',
  'corrected',
  'reviewed',
  'mastered',
  'reviewReminderDate'
];

const STATE_FIELDS = ['reviewed', 'mastered', 'reviewReminderDate'];
const MEDIA_GROUPS = Object.freeze({
  questionMediaIds: 'questionMediaId',
  childAnswerMediaIds: 'childAnswerMediaId'
});
const MEDIA_FIELDS = Object.freeze(Object.keys(MEDIA_GROUPS));
const MEDIA_ID_PATTERN = /^[0-9a-f]{24}$/i;
const MAX_MEDIA_PER_GROUP = 10;

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

const normalizeMediaArray = (field, value) => {
  if (!Array.isArray(value)) {
    throw new FamilyMistakePatchError(
      'VALIDATION_ERROR',
      `${field} must be an array with at most ${MAX_MEDIA_PER_GROUP} items`,
      400
    );
  }
  if (value.length > MAX_MEDIA_PER_GROUP) {
    throw new FamilyMistakePatchError(
      'MEDIA_ATTACHMENT_LIMIT_EXCEEDED',
      `${field} must contain at most ${MAX_MEDIA_PER_GROUP} items`,
      400
    );
  }
  const normalized = [];
  const seen = new Set();
  value.forEach((mediaId) => {
    if (typeof mediaId !== 'string' || !MEDIA_ID_PATTERN.test(mediaId)) {
      throw new FamilyMistakePatchError('VALIDATION_ERROR', `Invalid ${field}`, 400);
    }
    const key = mediaId.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(mediaId);
    }
  });
  return normalized;
};

const normalizeMistakeMediaInput = (data = {}) => {
  const normalized = { ...data };
  Object.entries(MEDIA_GROUPS).forEach(([arrayField, aliasField]) => {
    const hasArray = hasOwn(data, arrayField);
    const hasAlias = hasOwn(data, aliasField);
    if (hasArray && hasAlias) {
      throw new FamilyMistakePatchError(
        'VALIDATION_ERROR',
        `${arrayField} cannot be combined with ${aliasField}`,
        400
      );
    }
    if (!hasArray && !hasAlias) return;
    normalized[arrayField] = hasArray
      ? normalizeMediaArray(arrayField, data[arrayField])
      : (data[aliasField] === null ? [] : normalizeMediaArray(arrayField, [data[aliasField]]));
    delete normalized[aliasField];
  });
  return normalized;
};

const parseFamilyMistakeInput = ({ body = {}, role, operation }) => {
  const allowed = allowedFieldsFor(role, operation);
  assertAllowedFields(body, allowed);

  const data = {};
  allowed.forEach((field) => {
    if (hasOwn(body, field)) data[field] = body[field];
  });
  return normalizeMistakeMediaInput(data);
};

const splitMediaPatch = (data) => {
  const mediaPatch = {};
  const mistakePatch = {};
  Object.entries(data).forEach(([field, value]) => {
    if (MEDIA_FIELDS.includes(field)) {
      mediaPatch[field] = value;
    } else {
      mistakePatch[field] = value;
    }
  });
  return {
    mistakePatch,
    mediaPatch,
    hasMediaMutation: Object.keys(mediaPatch).length > 0
  };
};

const stateChangedBy = (data) => STATE_FIELDS.some((field) => hasOwn(data, field));

const mediaPatchEntriesFor = (data) => MEDIA_FIELDS.flatMap((field) => {
  if (!hasOwn(data, field)) return [];
  const path = MEDIA_GROUPS[field];
  return data[field].length > 0
    ? data[field].map((value) => ({ path, value }))
    : [{ path, value: null }];
});

module.exports = {
  CHILD_CREATE_FIELDS,
  CHILD_PATCH_FIELDS,
  FamilyMistakePatchError,
  MEDIA_FIELDS,
  MEDIA_GROUPS,
  PARENT_CREATE_FIELDS,
  PARENT_PATCH_FIELDS,
  STATE_FIELDS,
  mediaPatchEntriesFor,
  normalizeMistakeMediaInput,
  parseFamilyMistakeInput,
  splitMediaPatch,
  stateChangedBy
};
