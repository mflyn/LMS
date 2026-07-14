#!/usr/bin/env node

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const trimBaseUrl = (value) => String(value || '').replace(/\/+$/, '');

const readJson = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json();
};

const requestData = async ({
  baseUrl,
  fetchImpl,
  path,
  expectedStatus,
  method = 'GET',
  token,
  json,
  body
}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: json === undefined ? body : JSON.stringify(json),
      signal: AbortSignal.timeout(15000)
    });
  } catch (_error) {
    throw new Error(`Family smoke transport failed: ${method} ${path}`);
  }

  const envelope = await readJson(response);
  if (response.status !== expectedStatus) {
    const code = envelope?.error?.code || 'UNEXPECTED_STATUS';
    throw new Error(`Family smoke ${method} ${path} returned ${response.status} (${code})`);
  }
  return envelope?.data;
};

const runFamilySmoke = async ({
  baseUrl = process.env.FAMILY_GATEWAY_BASE_URL || 'http://127.0.0.1:3000',
  fetchImpl = global.fetch,
  uniqueSuffix = `${Date.now().toString(36)}${process.pid.toString(36)}`
} = {}) => {
  if (typeof fetchImpl !== 'function') throw new Error('Family smoke requires fetch');
  if (typeof FormData !== 'function' || typeof Blob !== 'function') {
    throw new Error('Family smoke requires Node.js 22 FormData and Blob support');
  }

  const gatewayUrl = trimBaseUrl(baseUrl);
  const suffix = String(uniqueSuffix).replace(/[^a-zA-Z0-9]/g, '').slice(-20) || 'release';
  const registration = await requestData({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/auth/register',
    expectedStatus: 201,
    method: 'POST',
    json: {
      username: `rel_${suffix.slice(-16)}`,
      name: 'Release Gate Parent',
      email: `release-${suffix}@example.test`,
      password: 'FamilyPass123',
      role: 'parent'
    }
  });
  const token = registration?.token;
  if (!token) throw new Error('Family smoke registration did not return a token');

  const family = (await requestData({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/families',
    expectedStatus: 201,
    method: 'POST',
    token,
    json: { familyName: `Release Family ${suffix}`, timezone: 'Asia/Shanghai' }
  }))?.family;
  const child = (await requestData({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/children',
    expectedStatus: 201,
    method: 'POST',
    token,
    json: { name: '发布验证孩子', grade: 3 }
  }))?.child;
  if (!family?.familyId || !child?.childId) {
    throw new Error('Family smoke did not create the family relationship');
  }

  const upload = new FormData();
  upload.append('file', new Blob([TINY_PNG], { type: 'image/png' }), 'release-evidence.png');
  upload.append('purpose', 'task_attachment');
  upload.append('childId', child.childId);
  const media = (await requestData({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/media',
    expectedStatus: 201,
    method: 'POST',
    token,
    body: upload
  }))?.media;
  if (!media?.mediaId) throw new Error('Family smoke upload did not return mediaId');

  const task = (await requestData({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: '/api/growth-tasks',
    expectedStatus: 201,
    method: 'POST',
    token,
    json: {
      childId: child.childId,
      dimension: 'academic',
      title: '发布门禁媒体任务',
      taskType: 'practice',
      dueDate: '2099-12-31',
      attachmentMediaIds: [media.mediaId]
    }
  }))?.task;
  if (!task?.taskId || !task.attachmentMediaIds?.includes(media.mediaId)) {
    throw new Error('Family smoke task did not bind the uploaded media');
  }

  const access = (await requestData({
    baseUrl: gatewayUrl,
    fetchImpl,
    path: `/api/media/${media.mediaId}/access`,
    expectedStatus: 200,
    token
  }))?.access;
  if (!access?.url) throw new Error('Family smoke did not receive signed media access');

  const contentUrl = new URL(access.url, `${gatewayUrl}/`).toString();
  let contentResponse;
  try {
    contentResponse = await fetchImpl(contentUrl, { signal: AbortSignal.timeout(15000) });
  } catch (_error) {
    throw new Error('Family smoke signed media content request failed');
  }
  const contentType = contentResponse.headers.get('content-type') || '';
  const content = Buffer.from(await contentResponse.arrayBuffer());
  if (contentResponse.status !== 200 || !contentType.startsWith('image/png') || content.length === 0) {
    throw new Error('Family smoke signed media content was invalid');
  }

  return {
    familyId: family.familyId,
    childId: child.childId,
    mediaId: media.mediaId,
    taskId: task.taskId,
    mediaBytes: content.length
  };
};

if (require.main === module) {
  runFamilySmoke()
    .then((result) => {
      process.stdout.write(`Family media smoke passed (${result.mediaBytes} bytes)\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = { runFamilySmoke };
