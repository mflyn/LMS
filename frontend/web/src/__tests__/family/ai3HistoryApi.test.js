import axios from 'axios';
import { createAi3Api } from '../../services/ai3Api';
import { captureSession, saveParentSession, saveChildSession } from '../../services/familySession';
import { resetChildScope } from '../../services/childScope';
const result = data => ({ data: { success: true, data } });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  saveParentSession({ token: 'synthetic-parent', user: { id: 'a'.repeat(24), role: 'parent' } });
});
test('parent history GETs encode identifiers, preserve DTO and use the current session and abort signal', async () => {
  const api = createAi3Api('parent'), signal = new AbortController().signal, session = captureSession('parent');
  const dto = { content: { reason: 'original reason', origin: 'ai_generation' } };
  axios.get.mockResolvedValue(result(dto));
  expect(await api.contents('round/id', 2, { session, signal })).toEqual(dto);
  expect(await api.content('round/id', 'old?id', { session, signal })).toEqual(dto);
  expect(axios.get.mock.calls).toEqual([
    ['/api/ai3/practice-rounds/round%2Fid/contents?page=2&pageSize=20', { signal, headers: { Authorization: 'Bearer synthetic-parent' } }],
    ['/api/ai3/practice-rounds/round%2Fid/contents/old%3Fid', { signal, headers: { Authorization: 'Bearer synthetic-parent' } }]
  ]);
  expect(axios.post).not.toHaveBeenCalled();
});
test('child history calls fail before network', async () => {
  saveChildSession({ token: 'synthetic-child', child: { childId: 'c'.repeat(24), familyId: 'b'.repeat(24), name: 'Synthetic' } });
  const api = createAi3Api('student');
  await expect(api.contents('round')).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  await expect(api.content('round','content')).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect(axios.get).not.toHaveBeenCalled();
});
test.each(['identity','child'])('late parent history after %s change never reaches the caller', async mode => {
  const pending = deferred(); axios.get.mockReturnValue(pending.promise);
  const reading = createAi3Api('parent').content('round','content');
  const assertion = expect(reading).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  if (mode === 'identity') saveParentSession({ token: 'replacement', user: { id: 'f'.repeat(24), role: 'parent' } });
  else resetChildScope({ previousChildId: 'c'.repeat(24), nextChildId: 'd'.repeat(24) });
  pending.resolve(result({ content: { reason: 'PRIVATE' } })); await assertion;
});
