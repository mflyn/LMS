import axios from 'axios';
import { getOwnDailyLearningPlan, saveOwnDailyLearningPlan } from '../../services/childApi';
import { getDailyLearningPlan, saveDailyLearningPlan } from '../../services/familyApi';
import { captureSession, saveChildSession, saveParentSession } from '../../services/familySession';
jest.mock('axios');
const save = (role, token) => role === 'student'
  ? saveChildSession({ token, child: { childId: token, familyId: 'f', name: '合成孩子' } })
  : saveParentSession({ token, user: { id: token, role: 'parent' } });
beforeEach(() => { jest.resetAllMocks(); localStorage.clear(); });
const invoke = (role, method, body, signal, session) => role === 'student'
  ? method === 'get' ? getOwnDailyLearningPlan('2026-10-26', signal, session)
    : saveOwnDailyLearningPlan('2026-10-26', body, signal, session)
  : method === 'get' ? getDailyLearningPlan('a', '2026-10-26', signal, session)
    : saveDailyLearningPlan('a', '2026-10-26', body, signal, session);
test.each(['parent', 'student'])('%s uses exact CAS payload, keeps estimate on reorder, and captured identity', async role => {
  save(role, 'a'); const session = captureSession(role), signal = new AbortController().signal;
  axios.put.mockResolvedValue({ data: { success: true, data: { plan: { version: 2 } } } });
  const body = { expectedVersion: 1, items: [{ taskId: 'task', childEstimatedMinutes: 15,
    estimateRecordedBy: { actorId: 'forged' }, task: { title: 'not submitted' } }], familyId: 'forged', updatedByActor: 'forged' };
  await invoke(role, 'put', body, signal, session);
  expect(axios.put).toHaveBeenCalledWith('/api/children/a/daily-learning-plans/2026-10-26', {
    expectedVersion: 1, items: [{ taskId: 'task', childEstimatedMinutes: 15 }]
  }, { signal, headers: { Authorization: 'Bearer a' } });
  save(role, 'b'); await expect(invoke(role, 'put', body, signal, session)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(axios.put).toHaveBeenCalledTimes(1);
});
test.each(['parent', 'student'])('%s GET is private and late unauthorized result cannot expire replacement account', async role => {
  save(role, 'a'); let reject;
  axios.get.mockImplementation(() => new Promise((resolve, fail) => { reject = fail; }));
  const pending = invoke(role, 'get');
  expect(axios.get).toHaveBeenCalledWith('/api/children/a/daily-learning-plans/2026-10-26', { headers: { Authorization: 'Bearer a' } });
  save(role, 'b'); reject({ response: { status: 401 } });
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(captureSession(role).actorId).toBe('b');
});
test.each(['parent', 'student'].flatMap(role => [200, 401, 403].map(status => [role, status])))(
'%s PUT ignores a late %s after identity replacement using the real session wrapper', async (role, status) => {
  save(role, 'a'); let finish;
  axios.put.mockImplementation(() => new Promise((resolve, reject) => {
    finish = () => status === 200 ? resolve({ data: { success: true, data: { plan: { version: 9 } } } })
      : reject({ response: { status } });
  }));
  const pending = invoke(role, 'put', { expectedVersion: 0, items: [] });
  save(role, 'b'); finish();
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(captureSession(role).actorId).toBe('b');
  expect(axios.put).toHaveBeenCalledTimes(1);
});
