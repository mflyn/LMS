import { requestWithSession } from './familySession';
import { IMAGE_MIME_TYPES, MAX_FILE_SIZE } from '../components/family/privateMediaRules';

export const isAi2MediaId = value => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value);
const invalid = () => Object.assign(new Error('Invalid AI2 media response or input'), { code: 'AI2_MEDIA_INVALID' });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const closed = (value, keys) => record(value) && Object.keys(value).every(key => keys.includes(key));
const validSize = size => Number.isSafeInteger(size) && size > 0 && size <= MAX_FILE_SIZE;
const assertId = id => { if (!isAi2MediaId(id)) throw invalid(); };

export const validateAi2MediaFile = file => {
  if (!(file instanceof Blob) || !IMAGE_MIME_TYPES.includes(file.type)) return '仅支持 JPEG、PNG 或 WebP 图片';
  if (!validSize(file.size)) return '图片不能为空且不能超过 10 MiB';
  return null;
};

export const assertAi2MediaEntry = (entry, { statusRequired = false } = {}) => {
  if (!closed(entry, ['mediaId', 'mimeType', 'sizeBytes', 'status', 'displayName', 'purpose'])
    || !isAi2MediaId(entry.mediaId) || !IMAGE_MIME_TYPES.includes(entry.mimeType) || !validSize(entry.sizeBytes)
    || (entry.status !== undefined && !['available', 'deleted'].includes(entry.status))
    || (statusRequired && entry.status === undefined)
    || (entry.purpose !== undefined && entry.purpose !== 'ai2_correction')
    || (entry.displayName !== undefined && typeof entry.displayName !== 'string')) throw invalid();
  return entry;
};

const capabilityUrl = (access, mediaId) => {
  assertId(mediaId);
  if (!closed(access, ['url', 'expiresAt', 'requiresAuthorization']) || access.requiresAuthorization !== true
    || typeof access.url !== 'string' || typeof access.expiresAt !== 'string') throw invalid();
  const path = `/api/media/${mediaId}/authenticated-content`;
  const origin = window.location.origin;
  // Check the raw prefix as well as parsed URL so normalization cannot admit dot segments or escapes.
  if (!access.url.startsWith(`${path}?`) && !access.url.startsWith(`${origin}${path}?`)) throw invalid();
  const url = new URL(access.url, origin);
  if (url.origin !== origin || url.pathname !== path || url.hash || url.username || url.password) throw invalid();
  const params = url.searchParams, keys = [...params.keys()];
  if (keys.length !== 3 || !['expires', 'nonce', 'signature'].every(key => params.getAll(key).length === 1)
    || !/^[1-9][0-9]*$/.test(params.get('expires'))
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.get('nonce'))
    || !/^[0-9a-f]{64}$/i.test(params.get('signature'))) throw invalid();
  const expires = Number(params.get('expires')) * 1000, now = Date.now();
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + 300000
    || Date.parse(access.expiresAt) !== expires) throw invalid();
  return access.url;
};

export const createAi2MediaApi = role => {
  if (!['parent', 'student'].includes(role)) throw new TypeError('AI2 role must be parent or student');
  const request = (path, method, options, consume, body, beforeRequest) => requestWithSession(role, async (config, session) => {
    beforeRequest?.(session);
    // XHR follows redirects in browsers; fetch's redirect:error prevents forwarding a credential at all.
    const response = await fetch(path, { method, headers: config.headers, signal: config.signal,
      mode: 'same-origin', credentials: 'omit', cache: 'no-store', redirect: 'error',
      ...(body === undefined ? {} : { body }) });
    if (response.redirected || ['opaqueredirect', 'opaque'].includes(response.type)
      || (response.status >= 300 && response.status < 400)
      || (response.url && response.url !== new URL(path, window.location.origin).href)) throw invalid();
    if (!response.ok) {
      throw Object.assign(new Error('AI2 media request failed'), {
        code: 'AI2_MEDIA_REQUEST_FAILED', response: { status: response.status }
      });
    }
    // Consume inside the session fence: a replacement identity must not receive a late body.
    return consume(response);
  }, { session: options?.session, signal: options?.signal });
  const json = async response => {
    const value = await response.json();
    if (!record(value) || value.success !== true || !record(value.data)) throw invalid();
    return value.data;
  };
  return {
    async upload({ childId, file }, options) {
      assertId(childId);
      if (role !== 'student' || validateAi2MediaFile(file)) throw invalid();
      const body = new FormData(); body.append('file', file); body.append('purpose', 'ai2_correction'); body.append('childId', childId);
      return request('/api/media', 'POST', options, async response => {
        const data = await json(response), media = assertAi2MediaEntry(data.media);
        if (media.purpose !== 'ai2_correction' || media.status === 'deleted') throw invalid();
        return { media };
      }, body, session => { if (session.actorId !== childId) throw invalid(); });
    },
    async access(mediaId, options) {
      assertId(mediaId);
      return request(`/api/media/${mediaId}/access`, 'GET', options, async response => {
        const data = await json(response), media = assertAi2MediaEntry(data.media);
        if (media.mediaId !== mediaId || media.status === 'deleted') throw invalid();
        capabilityUrl(data.access, mediaId);
        return { access: data.access, media };
      });
    },
    async content(access, mediaId, options) {
      const path = capabilityUrl(access, mediaId);
      return request(path, 'GET', options, async response => {
        const blob = await response.blob();
        if (validateAi2MediaFile(blob)) throw invalid();
        return blob;
      });
    },
    async remove(mediaId, options) {
      assertId(mediaId);
      return request(`/api/media/${mediaId}`, 'DELETE', options, response => {
        if (response.status !== 204) throw invalid();
      });
    }
  };
};
