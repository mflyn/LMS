import axios from 'axios';
import { requestWithSession, sessionRequestOptions } from './familySession';
import { dailyPlanPayload } from './dailyLearningPlan';

const unwrap = (response) => response?.data?.data ?? response?.data;

const childRequest = (request, signal, expectedSession) => requestWithSession(
  'student', request, sessionRequestOptions(signal, expectedSession)
);

const queryString = (params, allowedFields) => {
  const query = new URLSearchParams();
  allowedFields.forEach((field) => {
    const value = params?.[field];
    if (value !== undefined && value !== null && value !== '') {
      query.append(field, String(value));
    }
  });
  const value = query.toString();
  return value ? `?${value}` : '';
};

const pick = (value, fields) => fields.reduce((payload, field) => {
  if (value?.[field] !== undefined) payload[field] = value[field];
  return payload;
}, {});

const childGet = async (path, params, allowedFields, signal, expectedSession) => {
  const response = await childRequest(
    (config) => axios.get(`${path}${queryString(params, allowedFields)}`, config),
    signal, expectedSession
  );
  return unwrap(response);
};

const childPatch = async (path, body, allowedFields, signal, expectedSession) => {
  const response = await childRequest(
    (config) => axios.patch(path, pick(body, allowedFields), config),
    signal, expectedSession
  );
  return unwrap(response);
};

const childDelete = async (path, signal, expectedSession) => {
  const response = await childRequest((config) => axios.delete(path, config), signal, expectedSession);
  return unwrap(response);
};

export const childPinLogin = async (credentials) => {
  const response = await axios.post('/api/auth/child-pin-login', pick(credentials, [
    'familyId',
    'childId',
    'pin'
  ]));
  return unwrap(response);
};

export const getOwnProfile = async (signal) => {
  const response = await childRequest(
    (config, session) => axios.get(`/api/children/${encodeURIComponent(session.actorId)}`, config),
    signal
  );
  return unwrap(response);
};

export const listOwnGrowthLogs = (params, signal, expectedSession) => childGet(
  '/api/growth-logs', params, ['from', 'to', 'dimension', 'page', 'pageSize'], signal, expectedSession
);

export const createOwnGrowthLog = async (payload, signal, expectedSession) => unwrap(
  await childRequest((config, session) => axios.post('/api/growth-logs', {
    ...pick(payload, ['date', 'dimension', 'subject', 'content', 'childReflection']),
    childId: session.actorId
  }, config), signal, expectedSession)
);

export const updateOwnGrowthLog = (logId, payload, signal, expectedSession) => childPatch(
  `/api/growth-logs/${encodeURIComponent(logId)}`, payload, ['childReflection'], signal, expectedSession
);

export const listOwnTasks = (params, signal) => childGet('/api/growth-tasks', params, [
  'scope',
  'status',
  'dimension',
  'page',
  'pageSize'
], signal);

export const getOwnDailyLearningPlan = async (localDate, signal, expectedSession) => unwrap(
  await childRequest((config, session) => axios.get(
    `/api/children/${encodeURIComponent(session.actorId)}/daily-learning-plans/${encodeURIComponent(localDate)}`, config
  ), signal, expectedSession)
);
export const saveOwnDailyLearningPlan = async (localDate, body, signal, expectedSession) => unwrap(
  await childRequest((config, session) => axios.put(
    `/api/children/${encodeURIComponent(session.actorId)}/daily-learning-plans/${encodeURIComponent(localDate)}`,
    dailyPlanPayload(body), config
  ), signal, expectedSession)
);

export const getOwnTask = (taskId, signal, expectedSession) => childGet(
  `/api/growth-tasks/${encodeURIComponent(taskId)}`,
  undefined,
  [],
  signal, expectedSession
);

export const completeOwnTask = (taskId, payload, signal, expectedSession) => childPatch(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/complete`,
  payload,
  ['operationId', 'expectedCompletionVersion', 'expectedChecklistVersion', 'checkedItemIds', 'completionMediaIds',
    'actualMinutes', 'actualAmount', 'difficulty', 'needsHelp', 'childNote'],
  signal, expectedSession
);

export const getOwnCompletionRecovery = (taskId, signal, expectedSession) => childGet(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/completion-recovery`, undefined, [], signal, expectedSession
);
export const updateOwnTaskHelp = (taskId, payload, signal, expectedSession) => childPatch(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/help`, payload,
  ['action', 'expectedHelpVersion', 'helpType', 'note'], signal, expectedSession
);
export const listOwnCompletionRecoveries = (params, signal, expectedSession) => childGet(
  '/api/growth-tasks/completion-recoveries', params, ['page', 'pageSize'], signal, expectedSession
);
export const recoverOwnTaskCompletion = async (taskId, operationId, signal, expectedSession) => unwrap(
  await childRequest(config => axios.post(
    `/api/growth-tasks/${encodeURIComponent(taskId)}/completion-operations/${encodeURIComponent(operationId)}/recover`, {}, config
  ), signal, expectedSession)
);

const childPost = async (path, body, allowedFields) => {
  const response = await childRequest(
    (config) => axios.post(path, pick(body, allowedFields), config)
  );
  return unwrap(response);
};

export const createOwnMistake = (payload) => childPost('/api/mistakes', payload, [
  'sourceTaskId',
  'subject',
  'reason',
  'childExplanation',
  'questionMediaIds',
  'childAnswerMediaIds'
]);

export const listOwnMistakes = (params, signal) => childGet('/api/mistakes', params, [
  'subject',
  'reason',
  'corrected',
  'reviewed',
  'mastered',
  'reviewStatus',
  'reviewReminderFrom',
  'reviewReminderTo',
  'page',
  'pageSize'
], signal);

export const getOwnMistake = (mistakeId, signal, expectedSession) => childGet(
  `/api/mistakes/${encodeURIComponent(mistakeId)}`, undefined, [], signal, expectedSession
);

export const reviewOwnMistake = (mistakeId, payload, signal) => childPatch(
  `/api/mistakes/${encodeURIComponent(mistakeId)}`,
  payload,
  ['childExplanation', 'reviewed', 'mastered', 'questionMediaIds', 'childAnswerMediaIds'],
  signal
);

export const uploadOwnPrivateMedia = async ({ file, purpose }, signal, expectedSession) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);
  const response = await childRequest((config) => axios.post('/api/media', formData, config), signal, expectedSession);
  return unwrap(response);
};

export const getOwnPrivateMediaAccess = (mediaId, signal, expectedSession) => childGet(
  `/api/media/${encodeURIComponent(mediaId)}/access`,
  undefined,
  [],
  signal, expectedSession
);

export const deleteOwnPrivateMedia = (mediaId, signal, expectedSession) => childDelete(
  `/api/media/${encodeURIComponent(mediaId)}`,
  signal, expectedSession
);

export const listOwnRewards = (params, signal) => childGet('/api/rewards', params, [
  'status',
  'rewardPage',
  'rewardPageSize',
  'ledgerPage',
  'ledgerPageSize'
], signal);

export const listOwnReminders = async (params, signal) => {
  const response = await childRequest((config, session) => {
    const query = new URLSearchParams({ childId: session.actorId });
    if (params?.date !== undefined && params.date !== null && params.date !== '') {
      query.append('date', String(params.date));
    }
    return axios.get(`/api/notifications/family?${query.toString()}`, config);
  }, signal);
  return unwrap(response);
};
