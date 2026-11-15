import axios from 'axios';
import { requestWithSession } from './familySession';

const segment = value => encodeURIComponent(value);
const envelope = response => {
  const value = response?.data;
  if (value?.success !== true || value.data === null || typeof value.data !== 'object' || Array.isArray(value.data)) {
    throw Object.assign(new Error('Unverified AI2 response'), { code: 'AI2_RESPONSE_UNVERIFIED' });
  }
  return value.data;
};
const pageQuery = (childId, page, commands = false) => new URLSearchParams({
  ...(childId === undefined ? {} : { childId }), ...(commands ? { scope: 'mine' } : {}), page, pageSize: 20
}).toString();

export const createAi2Api = role => {
  if (!['parent', 'student'].includes(role)) throw new TypeError('Session role must be parent or student');
  const get = (path, options) => requestWithSession(role, config => axios.get(path, config), options).then(envelope);
  // Preserve the whole original command; neither transport retries nor field projection are safe here.
  const post = (path, body, options) => requestWithSession(role, config => axios.post(path, body, config), options).then(envelope);
  const packages = '/api/ai2/learning-packages', commands = '/api/ai2/commands';
  return {
    packages: (childId, page = 1, options) => get(`${packages}?${pageQuery(childId, page)}`, options),
    detail: (id, options) => get(`${packages}/${segment(id)}`, options),
    attempts: (id, page = 1, options) => get(`${packages}/${segment(id)}/attempts?${pageQuery(undefined, page)}`, options),
    attempt: (id, attemptId, options) => get(`${packages}/${segment(id)}/attempts/${segment(attemptId)}`, options),
    commands: (childId, page = 1, options) => get(`${commands}?${pageQuery(childId, page, true)}`, options),
    command: (id, options) => get(`${commands}/${segment(id)}`, options),
    preview: (cycleId, options) => get(`/api/ai2/publication-preview?cycleId=${segment(cycleId)}`, options),
    publish: (body, options) => post(packages, body, options),
    withdraw: (id, body, options) => post(`${packages}/${segment(id)}/withdraw`, body, options),
    submit: (id, body, options) => post(`${packages}/${segment(id)}/attempts`, body, options),
    review: (id, attemptId, body, options) => post(`${packages}/${segment(id)}/attempts/${segment(attemptId)}/review`, body, options),
    recover: (id, body, options) => post(`${commands}/${segment(id)}/recover`, body, options)
  };
};
