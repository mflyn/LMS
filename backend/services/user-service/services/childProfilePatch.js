const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const { CHILD_PROFILE_FIELDS } = require('../../../common/contracts/familyGrowthApi');

const FIELD_DEFINITIONS = [
  ['name', ['name', 'childProfile.nickname']],
  ['grade', ['grade', 'childProfile.grade']],
  ['school', ['childProfile.school']],
  ['textbookVersion', ['childProfile.textbookVersion']],
  ['interests', ['childProfile.interests']],
  ['weakSubjects', ['childProfile.weakSubjects']],
  ['sportsPreferences', ['childProfile.sportsPreferences']],
  ['artInterests', ['childProfile.artInterests']],
  ['laborHabits', ['childProfile.laborHabits']],
  ['moralGoals', ['childProfile.moralGoals']]
];
const PUBLIC_FIELDS = new Set(CHILD_PROFILE_FIELDS);
const CANONICAL_PATHS = new Set(FIELD_DEFINITIONS.flatMap(([, paths]) => paths));

const validationError = () => {
  const error = new Error('Invalid child profile patch');
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = [];
  return error;
};

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const buildChildProfilePatch = (body) => {
  if (!isPlainObject(body)) throw validationError();

  const keys = Object.keys(body);
  if (keys.some((key) => !PUBLIC_FIELDS.has(key))) throw validationError();

  const hasAvatarMutation = Object.prototype.hasOwnProperty.call(body, 'avatarMediaId');
  let requestedAvatarMediaId;
  if (hasAvatarMutation) {
    if (body.avatarMediaId !== null
      && (typeof body.avatarMediaId !== 'string'
        || !OBJECT_ID_PATTERN.test(body.avatarMediaId))) {
      throw validationError();
    }
    requestedAvatarMediaId = body.avatarMediaId === null
      ? null
      : body.avatarMediaId.toLowerCase();
  }

  const entries = [];
  FIELD_DEFINITIONS.forEach(([field, paths]) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) return;

    let value = body[field];
    if (field === 'name') {
      if (typeof value !== 'string' || !value.trim()) throw validationError();
      value = value.trim();
    }
    paths.forEach((path) => entries.push({ path, value }));
  });

  return { requestedAvatarMediaId, hasAvatarMutation, entries };
};

const entriesToMongoSet = (entries) => {
  if (!Array.isArray(entries)) throw validationError();

  return entries.reduce((set, entry) => {
    if (!isPlainObject(entry)
      || !CANONICAL_PATHS.has(entry.path)
      || !Object.prototype.hasOwnProperty.call(entry, 'value')
      || Object.prototype.hasOwnProperty.call(set, entry.path)) {
      throw validationError();
    }
    set[entry.path] = entry.value;
    return set;
  }, {});
};

const applyEntries = (document, entries) => {
  if (!document || typeof document.set !== 'function') throw validationError();
  const update = entriesToMongoSet(entries);
  Object.entries(update).forEach(([path, value]) => document.set(path, value));
  return document;
};

module.exports = {
  applyEntries,
  buildChildProfilePatch,
  entriesToMongoSet
};
