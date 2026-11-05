import { createAi2MediaApi, assertAi2MediaEntry } from '../../services/ai2MediaApi';
import { saveChildSession, saveParentSession, captureSession } from '../../services/familySession';

const mediaId = 'a'.repeat(24), childId = 'c'.repeat(24), familyId = 'f'.repeat(24);
const media = { mediaId, mimeType: 'image/png', sizeBytes: 5, purpose: 'ai3_practice' };
const file = (type = 'image/png') => new File(['image'], 'synthetic.png', { type });
const login = (role = 'student', token = 'synthetic') => {
  if (role === 'parent') saveParentSession({ token, user: { id: mediaId, role } });
  else saveChildSession({ token, child: { childId, familyId, name: 'Synthetic' } });
  return captureSession(role);
};
const access = () => {
  const expires = Math.floor(Date.now() / 1000) + 60;
  return { url: `/api/media/${mediaId}/authenticated-content?expires=${expires}&nonce=11111111-1111-4111-8111-111111111111&signature=${'a'.repeat(64)}`,
    expiresAt: new Date(expires * 1000).toISOString(), requiresAuthorization: true };
};
const response = (data, changes = {}) => ({ ok: true, status: 200, type: 'basic', url: '', redirected: false,
  json: async () => ({ success: true, data }), ...changes });
const api = (role = 'student') => {
  expect(() => jest.requireActual('../../services/ai3MediaApi')).not.toThrow();
  return jest.requireActual('../../services/ai3MediaApi').createAi3MediaApi(role);
};
const originalFetch = globalThis.fetch;
beforeEach(() => { localStorage.clear(); globalThis.fetch = jest.fn(); login(); });
afterAll(() => { globalThis.fetch = originalFetch; });

test('AI3 upload locks purpose while AI2 default remains correction', async () => {
  globalThis.fetch.mockResolvedValueOnce(response({ media }, { status: 201 }))
    .mockResolvedValueOnce(response({ media: { ...media, purpose: 'ai2_correction' } }, { status: 201 }));
  await api().upload({ childId, file: file(), purpose: 'ai2_correction' });
  await createAi2MediaApi('student').upload({ childId, file: file() });
  expect(globalThis.fetch.mock.calls.map(([, init]) => init.body.get('purpose'))).toEqual(['ai3_practice', 'ai2_correction']);
  expect([...globalThis.fetch.mock.calls[0][1].body.keys()]).toEqual(['file', 'purpose', 'childId']);
});
test.each(['ai2_correction', 'task_completion', 'mistake_question'])('AI3 rejects cross-purpose response %s', async purpose => {
  globalThis.fetch.mockResolvedValue(response({ media: { ...media, purpose }, access: access() }));
  await expect(api().upload({ childId, file: file() })).rejects.toBeDefined();
  await expect(api().access(mediaId)).rejects.toBeDefined();
});
test('media profile is closed and AI2 descriptors cannot silently accept AI3', () => {
  expect(() => createAi2MediaApi('student', 'task_completion')).toThrow();
  expect(() => createAi2MediaApi('student', { purpose: 'ai3_practice' })).toThrow();
  expect(() => assertAi2MediaEntry(media)).toThrow();
  expect(() => assertAi2MediaEntry(media, { profile: 'other' })).toThrow();
});
test.each(['parent', 'student'])('AI3 %s capability and bytes remain authenticated, same origin, no-store and no redirect', async role => {
  const session = login(role), capability = access(), signal = new AbortController().signal;
  const blob = file(); globalThis.fetch.mockResolvedValueOnce(response({ media, access: capability }))
    .mockResolvedValueOnce(response(null, { blob: async () => blob }));
  const client = api(role); const value = await client.access(mediaId, { session, signal });
  expect(await client.content(value.access, mediaId, { session, signal })).toBe(blob);
  for (const [, init] of globalThis.fetch.mock.calls) expect(init).toMatchObject({ headers: { Authorization: 'Bearer synthetic' },
    signal, redirect: 'error', cache: 'no-store', credentials: 'omit', mode: 'same-origin' });
});
test.each(['application/pdf', 'image/heic', 'image/svg+xml', ''])('AI3 MIME %s fails before upload network', async type => {
  await expect(api().upload({ childId, file: file(type) })).rejects.toBeDefined(); expect(globalThis.fetch).not.toHaveBeenCalled();
});
test.each([0, 10485761])('AI3 size %s fails before upload network', async size => {
  const value = file(); Object.defineProperty(value, 'size', { value: size });
  await expect(api().upload({ childId, file: value })).rejects.toBeDefined(); expect(globalThis.fetch).not.toHaveBeenCalled();
});
test('AI3 parent and substituted child upload are rejected before network', async () => {
  login('parent'); await expect(api('parent').upload({ childId, file: file() })).rejects.toBeDefined();
  await expect(api().upload({ childId: mediaId, file: file() })).rejects.toBeDefined(); expect(globalThis.fetch).not.toHaveBeenCalled();
});
test.each(['anonymous', 'foreign', 'redirect', 'extra'])('AI3 rejects %s content capability/response', async change => {
  const capability = access();
  if (change === 'anonymous') capability.url = capability.url.replace('authenticated-content', 'content');
  if (change === 'foreign') capability.url = 'https://foreign.example' + capability.url;
  if (change === 'extra') capability.url += '&extra=1';
  globalThis.fetch.mockResolvedValue(response(null, { redirected: true, blob: async () => file() }));
  await expect(api().content(capability, mediaId)).rejects.toBeDefined();
  expect(globalThis.fetch).toHaveBeenCalledTimes(change === 'redirect' ? 1 : 0);
});
test.each(['success', '401'])('AI3 late %s after identity replacement never reaches new actor', async outcome => {
  let settle; globalThis.fetch.mockImplementation(() => new Promise(resolve => { settle = resolve; }));
  const pending = api().access(mediaId); login('student', 'replacement');
  settle(outcome === '401' ? response(null, { ok: false, status: 401 }) : response({ media, access: access() }));
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' }); expect(captureSession('student').token).toBe('replacement');
});
test('AI3 fences identity changes during asynchronous blob consumption and DELETE never retries', async () => {
  let resolveBlob, start; const started = new Promise(resolve => { start = resolve; });
  globalThis.fetch.mockResolvedValue(response(null, { blob: () => new Promise(resolve => { resolveBlob = resolve; start(); }) }));
  const pending = api().content(access(), mediaId); await started; login('student', 'replacement'); resolveBlob(file());
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  globalThis.fetch.mockReset().mockRejectedValue(Error('unknown deletion'));
  await expect(api().remove(mediaId)).rejects.toThrow('unknown deletion'); expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(globalThis.fetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  expect(globalThis.fetch.mock.calls[0][1].body).toBeUndefined();
});
