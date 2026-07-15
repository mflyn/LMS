import axios from 'axios';
import { expireChildSession, loadChildSession } from './familySession';

const unwrap = (response) => response?.data?.data ?? response?.data;

const requireChildSession = () => {
  const session = loadChildSession();
  if (session) return session;

  const error = new Error('Child session is required');
  error.response = { status: 401, data: { error: { code: 'UNAUTHENTICATED' } } };
  throw error;
};

const childRequest = async (request, signal) => {
  try {
    const session = requireChildSession();
    const config = {
      headers: { Authorization: `Bearer ${session.token}` }
    };
    if (signal) config.signal = signal;
    return await request(config, session);
  } catch (error) {
    if (error?.response?.status === 401) expireChildSession();
    throw error;
  }
};

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

const childGet = async (path, params, allowedFields, signal) => {
  const response = await childRequest(
    (config) => axios.get(`${path}${queryString(params, allowedFields)}`, config),
    signal
  );
  return unwrap(response);
};

const childPatch = async (path, body, allowedFields, signal) => {
  const response = await childRequest(
    (config) => axios.patch(path, pick(body, allowedFields), config),
    signal
  );
  return unwrap(response);
};

const childDelete = async (path, signal) => {
  const response = await childRequest((config) => axios.delete(path, config), signal);
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
    (config, session) => axios.get(`/api/children/${encodeURIComponent(session.child.childId)}`, config),
    signal
  );
  return unwrap(response);
};

export const listOwnTasks = (params, signal) => childGet('/api/growth-tasks', params, [
  'scope',
  'status',
  'dimension',
  'page',
  'pageSize'
], signal);

export const getOwnTask = (taskId, signal) => childGet(
  `/api/growth-tasks/${encodeURIComponent(taskId)}`,
  undefined,
  [],
  signal
);

export const completeOwnTask = (taskId, payload, signal) => childPatch(
  `/api/growth-tasks/${encodeURIComponent(taskId)}/complete`,
  payload,
  ['actualMinutes', 'actualAmount', 'difficulty', 'needsHelp', 'childNote'],
  signal
);

const childPost = async (path, body, allowedFields) => {
  const response = await childRequest(
    (config) => axios.post(path, pick(body, allowedFields), config)
  );
  return unwrap(response);
};

export const createOwnMistake = (payload) => childPost('/api/mistakes', payload, [
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

export const reviewOwnMistake = (mistakeId, payload, signal) => childPatch(
  `/api/mistakes/${encodeURIComponent(mistakeId)}`,
  payload,
  ['childExplanation', 'reviewed', 'mastered', 'questionMediaIds', 'childAnswerMediaIds'],
  signal
);

export const uploadOwnPrivateMedia = async ({ file, purpose }, signal) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);
  const response = await childRequest((config) => axios.post('/api/media', formData, config), signal);
  return unwrap(response);
};

export const getOwnPrivateMediaAccess = (mediaId, signal) => childGet(
  `/api/media/${encodeURIComponent(mediaId)}/access`,
  undefined,
  [],
  signal
);

export const deleteOwnPrivateMedia = (mediaId, signal) => childDelete(
  `/api/media/${encodeURIComponent(mediaId)}`,
  signal
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
    const query = new URLSearchParams({ childId: session.child.childId });
    if (params?.date !== undefined && params.date !== null && params.date !== '') {
      query.append('date', String(params.date));
    }
    return axios.get(`/api/notifications/family?${query.toString()}`, config);
  }, signal);
  return unwrap(response);
};
