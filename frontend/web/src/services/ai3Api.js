import axios from 'axios';
import { requestWithSession } from './familySession';
import { registerChildScopeReset } from './childScope';

let childRevision = 0;
registerChildScopeReset(() => { childRevision += 1; });
const segment = value => encodeURIComponent(value);
const envelope = response => {
  const value = response?.data;
  if (value?.success !== true || value.data === null || typeof value.data !== 'object' || Array.isArray(value.data)) {
    throw Object.assign(new Error('Unverified AI3 response'), { code: 'AI3_RESPONSE_UNVERIFIED' });
  }
  return value.data;
};
const pageQuery = (childId, page, commands = false, filters = {}) => new URLSearchParams({
  ...(childId === undefined ? {} : { childId }), ...(commands ? { scope: 'mine' } : {}), page, pageSize: 20,
  ...(filters.reviewFrom === undefined || filters.reviewFrom === '' ? {} : { reviewFrom: filters.reviewFrom }),
  ...(filters.reviewTo === undefined || filters.reviewTo === '' ? {} : { reviewTo: filters.reviewTo })
}).toString();

export const createAi3Api = role => {
  if (!['parent', 'student'].includes(role)) throw new TypeError('Session role must be parent or student');
  const request = (work, options) => {
    const revision = childRevision;
    const assertChild = () => {
      if (role === 'parent' && revision !== childRevision) throw Object.assign(new Error('Child scope changed'), { code: 'SESSION_CHANGED' });
    };
    return requestWithSession(role, async config => {
      try { const result = await work(config); assertChild(); return result; }
      catch (error) { assertChild(); throw error; }
    }, options).then(envelope);
  };
  const get = (path, options) => request(config => axios.get(path, config), options);
  const parentGet = (path, options) => role === 'parent' ? get(path, options)
    : Promise.reject(Object.assign(new Error('Parent history only'), { code: 'CHILD_ACCESS_DENIED' }));
  // Transport preserves the entire caller body. Only an explicit recovery action may send again.
  const post = (path, body, options) => request(config => axios.post(path, body, config), options);
  const rounds = '/api/ai3/practice-rounds', commands = '/api/ai3/commands';
  const round = id => `${rounds}/${segment(id)}`;
  const attempt = (id, attemptId) => `${round(id)}/attempts/${segment(attemptId)}`;
  return {
    rounds: (childId, page = 1, options, filters) => get(`${rounds}?${pageQuery(childId, page, false, filters)}`, options),
    detail: (id, options) => get(round(id), options),
    contents: (id, page = 1, options) => parentGet(`${round(id)}/contents?${pageQuery(undefined, page)}`, options),
    content: (id, contentId, options) => parentGet(`${round(id)}/contents/${segment(contentId)}`, options),
    generationPreview: (id, options) => get(`${round(id)}/generation-preview`, options),
    publicationPreview: (id, options) => get(`${round(id)}/publication-preview`, options),
    create: (body, options) => post(rounds, body, options),
    reviseContent: (id, body, options) => post(`${round(id)}/content-revisions`, body, options),
    rejectContent: (id, body, options) => post(`${round(id)}/reject-content`, body, options),
    publish: (id, body, options) => post(`${round(id)}/publish`, body, options),
    cancel: (id, body, options) => post(`${round(id)}/cancel`, body, options),
    withdraw: (id, body, options) => post(`${round(id)}/withdraw`, body, options),
    generate: (id, body, options) => post(`${round(id)}/generate`, body, options),
    submit: (id, body, options) => post(`${round(id)}/attempts`, body, options),
    review: (id, attemptId, body, options) => post(`${attempt(id, attemptId)}/review`, body, options),
    reviewContext: (id, attemptId, options) => get(`${attempt(id, attemptId)}/review-context`, options),
    commands: (childId, page = 1, options) => get(`${commands}?${pageQuery(childId, page, true)}`, options),
    command: (id, options) => get(`${commands}/${segment(id)}`, options),
    recover: (id, body, options) => post(`${commands}/${segment(id)}/recover`, body, options),
    attempts: (id, page = 1, options) => get(`${round(id)}/attempts?${pageQuery(undefined, page)}`, options),
    attempt: (id, attemptId, options) => get(attempt(id, attemptId), options)
  };
};
