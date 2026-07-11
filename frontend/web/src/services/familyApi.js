import axios from 'axios';
import { expireParentSession, loadParentSession } from './familySession';

const parentRequestConfig = () => {
  const session = loadParentSession();
  if (!session) {
    const error = new Error('Parent session is required');
    error.response = { status: 401, data: { error: { code: 'UNAUTHENTICATED' } } };
    throw error;
  }

  return {
    headers: {
      Authorization: `Bearer ${session.token}`
    }
  };
};

const unwrap = (response) => response?.data?.data ?? response?.data;

const parentRequest = async (request) => {
  try {
    return await request(parentRequestConfig());
  } catch (error) {
    if (error?.response?.status === 401) expireParentSession();
    throw error;
  }
};

export const getMyFamily = async () => {
  const response = await parentRequest((config) => axios.get('/api/families/me', config));
  return unwrap(response);
};

export const createFamily = async ({ familyName, timezone = 'Asia/Shanghai' }) => {
  const response = await parentRequest((config) => axios.post('/api/families', { familyName, timezone }, config));
  return unwrap(response);
};

const requestConfig = (config, { signal, headers } = {}) => {
  const nextConfig = {
    ...config,
    headers: {
      ...config.headers,
      ...headers
    }
  };

  if (signal) nextConfig.signal = signal;
  return nextConfig;
};

const queryString = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === 'familyId' || value === undefined || value === null || value === '') return;
    query.append(key, String(value));
  });

  const value = query.toString();
  return value ? `?${value}` : '';
};

const parentGet = async (path, params, signal) => {
  const response = await parentRequest((config) => axios.get(
    `${path}${queryString(params)}`,
    requestConfig(config, { signal })
  ));
  return unwrap(response);
};

const mutationPayload = (body) => {
  if (!body || typeof body !== 'object' || body instanceof FormData) return body;
  const { familyId, ...payload } = body;
  return payload;
};

const parentPost = async (path, body, options) => {
  const response = await parentRequest((config) => axios.post(
    path,
    mutationPayload(body),
    requestConfig(config, options)
  ));
  return unwrap(response);
};

const parentPatch = async (path, body, options) => {
  const response = await parentRequest((config) => axios.patch(
    path,
    mutationPayload(body),
    requestConfig(config, options)
  ));
  return unwrap(response);
};

const parentDelete = async (path, options) => {
  const response = await parentRequest((config) => axios.delete(path, requestConfig(config, options)));
  return unwrap(response);
};

export const listGrowthTasks = (params, signal) => parentGet('/api/growth-tasks', params, signal);
export const getGrowthTask = (taskId, signal) => parentGet(`/api/growth-tasks/${taskId}`, undefined, signal);
export const createGrowthTask = (payload) => parentPost('/api/growth-tasks', payload);
export const updateGrowthTask = (taskId, payload) => parentPatch(`/api/growth-tasks/${taskId}`, payload);
export const completeGrowthTask = (taskId, payload) => parentPatch(`/api/growth-tasks/${taskId}/complete`, payload);
export const confirmGrowthTask = (taskId, payload) => parentPatch(`/api/growth-tasks/${taskId}/confirm`, payload);
export const cancelOrArchiveGrowthTask = (taskId) => parentDelete(`/api/growth-tasks/${taskId}`);

export const listGrowthLogs = (params, signal) => parentGet('/api/growth-logs', params, signal);
export const createGrowthLog = (payload) => parentPost('/api/growth-logs', payload);
export const updateGrowthLog = (logId, payload) => parentPatch(`/api/growth-logs/${logId}`, payload);

export const listMistakes = (params, signal) => parentGet('/api/mistakes', params, signal);
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

export const uploadPrivateMedia = ({ file, purpose, childId }, signal) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);
  if (childId) formData.append('childId', childId);
  return parentPost('/api/media', formData, { signal });
};

export const getPrivateMediaAccess = (mediaId, signal) => parentGet(`/api/media/${mediaId}/access`, undefined, signal);
export const deletePrivateMedia = (mediaId) => parentDelete(`/api/media/${mediaId}`);
