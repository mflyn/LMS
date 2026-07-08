const CREATE_FIELD_NAMES = [
  'childId', 'dimension', 'area', 'subject', 'title', 'taskType',
  'description', 'dueDate', 'estimatedMinutes', 'targetAmount',
  'unit', 'priority', 'attachmentMediaIds'
];
const PATCH_FIELD_NAMES = CREATE_FIELD_NAMES.filter((field) => field !== 'childId');
const EDITABLE_PATH_NAMES = PATCH_FIELD_NAMES.filter((field) => field !== 'attachmentMediaIds');

const CREATE_FIELDS = new Set(CREATE_FIELD_NAMES);
const PATCH_FIELDS = new Set(PATCH_FIELD_NAMES);
const EDITABLE_PATHS = new Set(EDITABLE_PATH_NAMES);
const REQUIRED_CREATE_FIELDS = ['childId', 'dimension', 'title', 'taskType', 'dueDate'];
const DIMENSIONS = new Set(['moral', 'academic', 'physical', 'artistic', 'labor']);
const TRIMMED_STRING_FIELDS = new Set(['area', 'subject', 'title', 'taskType', 'description', 'unit']);
const MEDIA_ID_PATTERN = /^[0-9a-f]{24}$/i;
const MAX_ATTACHMENT_MEDIA = 100;

const CANONICAL_PATHS = Object.freeze(Object.fromEntries(
  EDITABLE_PATH_NAMES.map((path) => [path, path])
));

const validationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = [];
  return error;
};

const isRequestBody = (body) => (
  body !== null
  && typeof body === 'object'
  && !Array.isArray(body)
  && (Object.getPrototypeOf(body) === Object.prototype || Object.getPrototypeOf(body) === null)
);

const assertAllowedBody = (body, allowedFields) => {
  if (!isRequestBody(body)) {
    throw validationError('Invalid growth task request');
  }
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw validationError('Invalid growth task request');
  }
};

const canonicalValue = (field, value) => (
  TRIMMED_STRING_FIELDS.has(field) && typeof value === 'string' ? value.trim() : value
);

const normalizeAttachmentMediaIds = (value) => {
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENT_MEDIA) {
    throw validationError('Invalid attachment media IDs');
  }

  const normalized = [];
  const seen = new Set();
  for (const mediaId of value) {
    if (typeof mediaId !== 'string' || !MEDIA_ID_PATTERN.test(mediaId)) {
      throw validationError('Invalid attachment media IDs');
    }
    const canonicalId = mediaId.toLowerCase();
    if (!seen.has(canonicalId)) {
      seen.add(canonicalId);
      normalized.push(canonicalId);
    }
  }
  return normalized;
};

const attachmentResult = (body) => {
  const hasAttachmentMutation = Object.prototype.hasOwnProperty.call(body, 'attachmentMediaIds');
  return {
    hasAttachmentMutation,
    attachmentMediaIds: hasAttachmentMutation
      ? normalizeAttachmentMediaIds(body.attachmentMediaIds)
      : undefined
  };
};

const parseGrowthTaskCreate = (body) => {
  assertAllowedBody(body, CREATE_FIELDS);

  const taskInput = {};
  for (const field of CREATE_FIELD_NAMES) {
    if (field === 'attachmentMediaIds' || !Object.prototype.hasOwnProperty.call(body, field)) continue;
    taskInput[field] = canonicalValue(field, body[field]);
  }

  if (REQUIRED_CREATE_FIELDS.some((field) => !taskInput[field])) {
    throw validationError('Required growth task fields are missing');
  }
  if (!DIMENSIONS.has(taskInput.dimension)) {
    throw validationError('Invalid growth task dimension');
  }

  return {
    taskInput,
    ...attachmentResult(body)
  };
};

const parseGrowthTaskPatch = (body) => {
  assertAllowedBody(body, PATCH_FIELDS);

  const entries = [];
  for (const path of EDITABLE_PATH_NAMES) {
    if (Object.prototype.hasOwnProperty.call(body, path)) {
      entries.push({ path: CANONICAL_PATHS[path], value: canonicalValue(path, body[path]) });
    }
  }

  return {
    entries,
    ...attachmentResult(body)
  };
};

const entriesToMongoSet = (entries) => {
  if (!Array.isArray(entries)) {
    throw validationError('Invalid growth task patch entries');
  }

  const valuesByPath = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw validationError('Invalid growth task patch entries');
    }
    const keys = Object.keys(entry);
    if (keys.length !== 2 || !keys.includes('path') || !keys.includes('value')
      || !EDITABLE_PATHS.has(entry.path) || valuesByPath.has(entry.path)) {
      throw validationError('Invalid growth task patch entries');
    }
    valuesByPath.set(entry.path, entry.value);
  }

  const mongoSet = {};
  for (const path of EDITABLE_PATH_NAMES) {
    if (valuesByPath.has(path)) {
      mongoSet[CANONICAL_PATHS[path]] = valuesByPath.get(path);
    }
  }
  return mongoSet;
};

module.exports = {
  parseGrowthTaskCreate,
  parseGrowthTaskPatch,
  entriesToMongoSet,
  normalizeAttachmentMediaIds
};
