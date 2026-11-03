import axios from 'axios';
import { requestWithSession } from './familySession';
import { tutorEnvelope } from './tutorResponse';

const segment = id => encodeURIComponent(id);
const get = (path, options) => requestWithSession('parent', config => axios.get(path, config), options)
  .then(tutorEnvelope);
const post = (path, body, options) => requestWithSession('parent', config => axios.post(path, body, config), options)
  .then(tutorEnvelope);
const pageQuery = (childId, page) => new URLSearchParams({ childId, page, pageSize: 20 }).toString();

// No retries or field projection: every mutation carries the original closed, versioned command.
export const tutorApi = {
  cycles: (childId, page = 1, options) => get(`/api/tutor-cycles?${pageQuery(childId, page)}`, options),
  jobs: (childId, page = 1, options) => get(`/api/tutor-jobs?childId=${segment(childId)}&scope=mine-unfinished&page=${page}&pageSize=20`, options),
  detail: (id, options) => get(`/api/tutor-cycles/${segment(id)}`, options),
  job: (id, options) => get(`/api/tutor-jobs/${segment(id)}`, options),
  artifact: (id, options) => get(`/api/tutor-artifacts/${segment(id)}`, options),
  create: (body, options) => post('/api/tutor-cycles', body, options),
  generate: (id, body, options) => post(`/api/tutor-cycles/${segment(id)}/explanation-jobs`, body, options),
  recover: (id, body, options) => post(`/api/tutor-jobs/${segment(id)}/recover`, body, options),
  revise: (id, body, options) => post(`/api/tutor-cycles/${segment(id)}/explanation-revisions`, body, options),
  review: (id, body, options) => post(`/api/tutor-cycles/${segment(id)}/explanation-review`, body, options),
  close: (id, body, options) => post(`/api/tutor-cycles/${segment(id)}/cancel`, body, options)
};
