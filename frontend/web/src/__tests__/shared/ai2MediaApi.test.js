import { createAi2MediaApi } from '../../services/ai2MediaApi';
import { captureSession, saveChildSession, saveParentSession } from '../../services/familySession';

const id = 'a'.repeat(24), childId = 'c'.repeat(24);
const media = { mediaId: id, mimeType: 'image/png', sizeBytes: 5 };
const file = (type = 'image/png') => new File(['image'], 'work.png', { type });
const capability = (changes = {}) => {
  const expires = Math.floor(Date.now() / 1000) + 60;
  return { url: `/api/media/${id}/authenticated-content?expires=${expires}&nonce=11111111-1111-4111-8111-111111111111&signature=${'a'.repeat(64)}`,
    requiresAuthorization: true, expiresAt: new Date(expires * 1000).toISOString(), ...changes };
};
const response = (data, changes = {}) => ({ ok: true, status: 200, redirected: false,
  type: 'basic', url: '', json: async () => ({ success: true, data }), ...changes });
const save = (role, token = 'old') => role === 'parent'
  ? saveParentSession({ token, user: { id: 'b'.repeat(24), role } })
  : saveChildSession({ token, child: { childId, familyId: 'f'.repeat(24), name: 'Test' } });
const originalFetch = globalThis.fetch;
beforeEach(() => { localStorage.clear(); globalThis.fetch = jest.fn(); });
afterAll(() => { globalThis.fetch = originalFetch; });

test.each(['parent', 'student'])('%s fetches capability and bytes with captured Bearer, no-store and no redirects', async role => {
  save(role); const session = captureSession(role), signal = new AbortController().signal;
  const access = capability(), blob = new Blob(['image'], { type: 'image/png' });
  globalThis.fetch.mockResolvedValueOnce(response({ access, media }))
    .mockResolvedValueOnce(response(null, { blob: async () => blob }));
  const api = createAi2MediaApi(role);
  const result = await api.access(id, { session, signal });
  expect(result).toEqual({ access, media });
  expect(await api.content(result.access, id, { session, signal })).toBe(blob);
  expect(globalThis.fetch).toHaveBeenNthCalledWith(1, `/api/media/${id}/access`, expect.objectContaining({
    method: 'GET', headers: { Authorization: 'Bearer old' }, signal, redirect: 'error', cache: 'no-store', mode: 'same-origin'
  }));
  expect(globalThis.fetch).toHaveBeenNthCalledWith(2, access.url, expect.objectContaining({
    headers: { Authorization: 'Bearer old' }, redirect: 'error', credentials: 'omit'
  }));
});

test('student upload uses only file, purpose and childId; privacy DELETE has no body', async () => {
  save('student'); const session = captureSession('student'), api = createAi2MediaApi('student'), image = file();
  globalThis.fetch.mockResolvedValueOnce(response({ media: { ...media, purpose: 'ai2_correction' } }, { status: 201 }))
    .mockResolvedValueOnce(response(null, { status: 204 }));
  expect(await api.upload({ childId, file: image, familyId: 'forged' }, { session })).toEqual({ media: { ...media, purpose: 'ai2_correction' } });
  const [path, init] = globalThis.fetch.mock.calls[0];
  expect(path).toBe('/api/media');
  expect([...init.body.keys()]).toEqual(['file', 'purpose', 'childId']);
  expect(init.body.get('purpose')).toBe('ai2_correction');
  expect(init.body.get('childId')).toBe(childId);
  expect(init.headers).toEqual({ Authorization: 'Bearer old' });
  await api.remove(id, { session });
  expect(globalThis.fetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  expect(globalThis.fetch.mock.calls[1][1].body).toBeUndefined();
});

test.each(['application/pdf', 'image/heic', 'image/svg+xml', ''])('rejects upload MIME %s before network', async type => {
  save('student');
  await expect(createAi2MediaApi('student').upload({ childId, file: file(type) })).rejects.toBeDefined();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test.each([0, 10 * 1024 * 1024 + 1])('rejects upload size %s before network', async size => {
  save('student'); const image = file(); Object.defineProperty(image, 'size', { value: size });
  await expect(createAi2MediaApi('student').upload({ childId, file: image })).rejects.toBeDefined();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test('parent or different child cannot upload; invalid role and IDs fail closed', async () => {
  save('parent');
  await expect(createAi2MediaApi('parent').upload({ childId, file: file() })).rejects.toBeDefined();
  save('student');
  await expect(createAi2MediaApi('student').upload({ childId: id, file: file() })).rejects.toBeDefined();
  await expect(createAi2MediaApi('student').access('../other')).rejects.toBeDefined();
  expect(() => createAi2MediaApi('child')).toThrow();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test.each([
  access => ({ ...access, requiresAuthorization: false }),
  access => ({ ...access, requiresAuthorization: undefined }),
  access => ({ ...access, url: `https://other.example${access.url}` }),
  access => ({ ...access, url: `//other.example${access.url}` }),
  access => ({ ...access, url: access.url.replace('authenticated-content', 'content') }),
  access => ({ ...access, url: access.url.replace(id, childId) }),
  access => ({ ...access, url: access.url.replace('/api/media/', '/api/../api/media/') }),
  access => ({ ...access, url: `${access.url}#fragment` }),
  access => ({ ...access, url: `${access.url}&signature=${'b'.repeat(64)}` }),
  access => ({ ...access, url: `${access.url}&unexpected=1` }),
  access => ({ ...access, url: access.url.split('?')[0] }),
  access => ({ ...access, expiresAt: '2000-01-01T00:00:00.000Z' }),
  access => ({ ...access, expiresAt: 'invalid' }),
  access => ({ ...access, unexpected: true })
])('invalid capability %# never fetches bytes', async change => {
  save('student');
  await expect(createAi2MediaApi('student').content(change(capability()), id)).rejects.toBeDefined();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test.each([
  { ...media, mimeType: 'application/pdf' }, { ...media, sizeBytes: 0 },
  { ...media, sizeBytes: 10485761 }, { ...media, mediaId: childId },
  { ...media, purpose: 'task_completion' }, { ...media, status: 'deleted' }, null
])('access rejects invalid image descriptor %#', async badMedia => {
  save('student'); globalThis.fetch.mockResolvedValue(response({ access: capability(), media: badMedia }));
  await expect(createAi2MediaApi('student').access(id)).rejects.toBeDefined();
});

test.each([
  { redirected: true }, { type: 'opaqueredirect' }, { status: 302, ok: false },
  { url: 'https://other.example/private' }, { url: `${window.location.origin}/api/unexpected` }
])('rejects redirected or unexpected response %#', async changes => {
  save('student'); globalThis.fetch.mockResolvedValue(response(null, { ...changes, blob: async () => new Blob(['image'], { type: 'image/png' }) }));
  await expect(createAi2MediaApi('student').content(capability(), id)).rejects.toBeDefined();
});

test.each(['application/pdf', 'image/svg+xml', 'text/html', ''])('content rejects non-image blob %s', async type => {
  save('student'); globalThis.fetch.mockResolvedValue(response(null, { blob: async () => new Blob(['image'], { type }) }));
  await expect(createAi2MediaApi('student').content(capability(), id)).rejects.toBeDefined();
});

test.each(['parent', 'student'])('%s late 401 cannot expire replacement identity', async role => {
  save(role); let resolve;
  globalThis.fetch.mockImplementation(() => new Promise(done => { resolve = done; }));
  const pending = createAi2MediaApi(role).content(capability(), id, { session: captureSession(role) });
  save(role, 'new'); resolve(response(null, { ok: false, status: 401 }));
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(captureSession(role).token).toBe('new');
});

test('session is rechecked after async Blob consumption; current 401 expires only current session', async () => {
  save('student'); let resolveBlob, started;
  const consuming = new Promise(done => { started = done; });
  globalThis.fetch.mockResolvedValue(response(null, { blob: () => new Promise(done => { resolveBlob = done; started(); }) }));
  const pending = createAi2MediaApi('student').content(capability(), id);
  await consuming;
  save('student', 'new'); resolveBlob(new Blob(['image'], { type: 'image/png' }));
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  globalThis.fetch.mockResolvedValue(response(null, { ok: false, status: 401 }));
  await expect(createAi2MediaApi('student').access(id)).rejects.toMatchObject({ response: { status: 401 } });
  expect(captureSession('student')).toBeNull();
});
