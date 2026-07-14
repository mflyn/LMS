const FAMILY_CREATE_FIELDS = Object.freeze(['familyName', 'timezone', 'familyRole']);
const FAMILY_UPDATE_FIELDS = Object.freeze(['familyName', 'timezone']);
const CHILD_PROFILE_FIELDS = Object.freeze([
  'name',
  'avatarMediaId',
  'grade',
  'school',
  'textbookVersion',
  'interests',
  'weakSubjects',
  'sportsPreferences',
  'artInterests',
  'laborHabits',
  'moralGoals'
]);
const REMINDER_TYPE_ORDER = Object.freeze([
  'task_today',
  'task_overdue',
  'mistake_review',
  'dimension_physical',
  'dimension_moral',
  'dimension_labor',
  'weekly_report'
]);
const REMINDER_SEVERITY_ORDER = Object.freeze(['warning', 'info']);

module.exports = {
  CHILD_PROFILE_FIELDS,
  FAMILY_CREATE_FIELDS,
  FAMILY_UPDATE_FIELDS,
  REMINDER_SEVERITY_ORDER,
  REMINDER_TYPE_ORDER
};
