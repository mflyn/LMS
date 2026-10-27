import axios from 'axios';
import { requestWithSession, sessionRequestOptions } from './familySession';
import { dailyPlanPayload } from './dailyLearningPlan';

const unwrap = (response) => response?.data?.data ?? response?.data;

const parentRequest = (request, options) => requestWithSession('parent', request, options);

export const getMyFamily = async (options) => {
  const response = await parentRequest((config) => axios.get('/api/families/me', config), sessionRequestOptions(options));
  return unwrap(response);
};

export const createFamily = async ({ familyName, timezone = 'Asia/Shanghai' }) => {
  const response = await parentRequest((config) => axios.post('/api/families', { familyName, timezone }, config));
  return unwrap(response);
};

export const createParentInvitation = (familyId) => parentPost(
  `/api/families/${encodeURIComponent(familyId)}/parent-invitations`,
  {}
);

export const getActiveParentInvitation = (familyId, signal) => parentGet(
  `/api/families/${encodeURIComponent(familyId)}/parent-invitations/active`,
  undefined,
  signal
);

export const revokeParentInvitation = (familyId, invitationId) => parentDelete(
  `/api/families/${encodeURIComponent(familyId)}/parent-invitations/${encodeURIComponent(invitationId)}`
);

export const previewParentInvitation = (token) => parentPost(
  '/api/parent-invitations/preview',
  { token }
);

export const acceptParentInvitation = (token, familyRole) => parentPost(
  '/api/parent-invitations/accept',
  { token, familyRole }
);

export const leaveFamily = (familyId) => parentDelete(
  `/api/families/${encodeURIComponent(familyId)}/members/me`
);

export const removeFamilyMember = (familyId, parentId) => parentDelete(
  `/api/families/${encodeURIComponent(familyId)}/members/${encodeURIComponent(parentId)}`
);

export const transferFamilyOwnership = (familyId, newOwnerParentId) => parentPatch(
  `/api/families/${encodeURIComponent(familyId)}/owner`,
  { newOwnerParentId }
);

const queryString = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === 'familyId' || value === undefined || value === null || value === '') return;
    query.append(key, String(value));
  });

  const value = query.toString();
  return value ? `?${value}` : '';
};

const parentGet = async (path, params, signal, expectedSession) => {
  const options = sessionRequestOptions(signal, expectedSession);
  const response = await parentRequest((config) => axios.get(
    `${path}${queryString(params)}`,
    config
  ), options);
  return unwrap(response);
};

const mutationPayload = (body) => {
  if (!body || typeof body !== 'object' || body instanceof FormData) return body;
  const { familyId: _familyId, ...payload } = body;
  return payload;
};

const parentPost = async (path, body, options) => {
  const response = await parentRequest((config) => axios.post(
    path,
    mutationPayload(body),
    config
  ), options);
  return unwrap(response);
};

const parentPatch = async (path, body, options) => {
  const response = await parentRequest((config) => axios.patch(
    path,
    mutationPayload(body),
    config
  ), options);
  return unwrap(response);
};

const parentDelete = async (path, options) => {
  const response = await parentRequest((config) => axios.delete(path, config), options);
  return unwrap(response);
};

export const createChild = (payload) => parentPost('/api/children', payload);
export const updateChild = (childId, payload) => parentPatch(
  `/api/children/${encodeURIComponent(childId)}`,
  payload
);
export const setChildPin = (childId, pin) => parentPost(
  `/api/children/${encodeURIComponent(childId)}/pin`,
  { pin }
);

export const listGrowthTasks = (params, signal) => parentGet('/api/growth-tasks', params, signal);
export const getDailyLearningPlan = (childId, localDate, signal, expectedSession) => parentGet(
  `/api/children/${encodeURIComponent(childId)}/daily-learning-plans/${encodeURIComponent(localDate)}`,
  undefined, signal, expectedSession
);
export const saveDailyLearningPlan = async (childId, localDate, body, signal, expectedSession) => unwrap(
  await parentRequest(config => axios.put(
    `/api/children/${encodeURIComponent(childId)}/daily-learning-plans/${encodeURIComponent(localDate)}`,
    dailyPlanPayload(body), config
  ), sessionRequestOptions(signal, expectedSession))
);
export const updateTaskHelp = (taskId, payload, signal, expectedSession) => parentPatch(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/help`,
  pick(payload, ['action', 'expectedHelpVersion', 'helpType', 'note', 'parentResponse']),
  sessionRequestOptions(signal, expectedSession)
);
// Preserve the existing (id, signal, session) GET form and the common four-position form.
const getOptions = (signal, expectedSession, fourth) => fourth !== undefined
  || (signal == null && expectedSession && (typeof expectedSession.addEventListener === 'function'
    || 'signal' in expectedSession || 'session' in expectedSession))
  ? sessionRequestOptions(expectedSession, fourth) : sessionRequestOptions(signal, expectedSession);
export const getGrowthTask = (taskId, signal, expectedSession, fourth) => parentGet(
  `/api/growth-tasks/${encodeURIComponent(taskId)}`, undefined, getOptions(signal, expectedSession, fourth)
);
export const createGrowthTask = (payload) => parentPost('/api/growth-tasks', payload);
export const updateGrowthTask = (taskId, payload) => parentPatch(`/api/growth-tasks/${taskId}`, payload);
const pick = (body, fields) => Object.fromEntries(fields.filter(field => body?.[field] !== undefined).map(field => [field, body[field]]));
export const completeGrowthTask = (taskId, payload, signal, expectedSession) => parentPatch(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/complete`,
  pick(payload, ['operationId', 'expectedCompletionVersion', 'expectedChecklistVersion', 'checkedItemIds', 'completionMediaIds',
    'actualMinutes', 'actualAmount', 'difficulty', 'needsHelp', 'childNote']), sessionRequestOptions(signal, expectedSession)
);
export const confirmGrowthTask = (taskId, payload, signal, expectedSession) => parentPatch(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/confirm`, pick(payload, ['expectedCompletionVersion', 'parentFeedback']),
  sessionRequestOptions(signal, expectedSession)
);
export const getCompletionRecovery = (taskId, signal, expectedSession, fourth) => parentGet(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/completion-recovery`, undefined, getOptions(signal, expectedSession, fourth)
);
export const listCompletionRecoveries = (params, signal, expectedSession) => parentGet(
  '/api/growth-tasks/completion-recoveries', pick(params, ['page', 'pageSize']), sessionRequestOptions(signal, expectedSession)
);
export const recoverTaskCompletion = (taskId, operationId, signal, expectedSession) => parentPost(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/completion-operations/${encodeURIComponent(operationId)}/recover`, {},
  sessionRequestOptions(signal, expectedSession)
);
export const cancelOrArchiveGrowthTask = (taskId) => parentDelete(`/api/growth-tasks/${taskId}`);

export const listGrowthLogs = (params, signal) => parentGet('/api/growth-logs', params, signal);
export const createGrowthLog = (payload) => parentPost('/api/growth-logs', payload);
export const updateGrowthLog = (logId, payload) => parentPatch(`/api/growth-logs/${logId}`, payload);

export const listKnowledgePoints = (params, signal) => parentGet('/api/knowledge-points', params, signal);
export const createKnowledgePoint = (payload) => parentPost('/api/knowledge-points', payload);
export const updateKnowledgePoint = (knowledgePointId, payload) => parentPatch(
  `/api/knowledge-points/${encodeURIComponent(knowledgePointId)}`,
  payload
);

export const listMistakes = (params, signal) => parentGet('/api/mistakes', params, signal);
export const getMistake = (mistakeId, signal, expectedSession) => parentGet(
  `/api/mistakes/${encodeURIComponent(mistakeId)}`, undefined, signal, expectedSession
);
export const createMistake = (payload) => parentPost('/api/mistakes', payload);
export const updateMistake = (mistakeId, payload) => parentPatch(`/api/mistakes/${mistakeId}`, payload);

export const getWeeklyReport = (params, signal) => parentGet('/api/reports/weekly', params, signal);
export const updateWeeklyReportFeedback = (reportId, payload) => parentPatch(
  `/api/reports/weekly/${reportId}/feedback`,
  payload
);

export const listFamilyReminders = (params, signal) => parentGet('/api/notifications/family', params, signal);
export const getNotificationSettings = (signal) => parentGet('/api/notifications/settings', undefined, signal);
export const updateNotificationSettings = (payload) => parentPatch('/api/notifications/settings', payload);

export const listRewards = (params, signal) => parentGet('/api/rewards', params, signal);
export const createReward = (payload) => parentPost('/api/rewards', payload);

export const redeemReward = async (rewardId, idempotencyKey) => {
  const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!key) throw new Error('Idempotency key is required');

  return parentPatch(`/api/rewards/${rewardId}/redeem`, {}, {
    headers: { 'Idempotency-Key': key }
  });
};

export const uploadPrivateMedia = ({ file, purpose, childId }, signal, expectedSession) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);
  if (childId) formData.append('childId', childId);
  return parentPost('/api/media', formData, sessionRequestOptions(signal, expectedSession));
};

export const getPrivateMediaAccess = (mediaId, signal, expectedSession) => parentGet(
  `/api/media/${mediaId}/access`, undefined, signal, expectedSession
);
export const deletePrivateMedia = (mediaId, signal, expectedSession) => parentDelete(
  `/api/media/${mediaId}`, sessionRequestOptions(signal, expectedSession)
);
