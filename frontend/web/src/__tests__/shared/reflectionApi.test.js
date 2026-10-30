import axios from 'axios';
import * as child from '../../services/childApi';
import * as parent from '../../services/familyApi';
import { captureSession, saveChildSession, saveParentSession } from '../../services/familySession';

jest.mock('axios');
const save = (role, token = 'a') => role === 'student'
  ? saveChildSession({ token, child: { childId: token, familyId: 'f', name: '合成孩子' } })
  : saveParentSession({ token, user: { id: token, role: 'parent' } });
beforeEach(() => { jest.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); });

test('child reflection create binds the actor and drops parent, audit, duration and foreign-child fields', async () => {
  save('student'); const session = captureSession('student'), signal = new AbortController().signal;
  axios.post.mockResolvedValue({ data: { success: true, data: { log: { logId: 'saved' } } } });
  const payload = { date: '2026-10-26', dimension: 'academic', subject: '数学', content: '练习', childReflection: '学会检查',
    childId: 'other', familyId: 'other', parentNote: 'forged', createdBy: 'forged', durationMinutes: 99 };
  await expect(child.createOwnGrowthLog(payload, signal, session)).resolves.toEqual({ log: { logId: 'saved' } });
  expect(axios.post).toHaveBeenCalledWith('/api/growth-logs', {
    childId: 'a', date: payload.date, dimension: payload.dimension, subject: payload.subject,
    content: payload.content, childReflection: payload.childReflection
  }, { signal, headers: { Authorization: 'Bearer a' } });
});

test('child list keeps pagination/date filters but never accepts another child or family', async () => {
  save('student'); axios.get.mockResolvedValue({ data: { data: { items: [] } } });
  await child.listOwnGrowthLogs({ from: '2026-10-26', to: '2026-11-01', page: 2, pageSize: 100,
    childId: 'other', familyId: 'other' });
  const [url, config] = axios.get.mock.calls[0];
  const query = new URL(url, 'http://synthetic.test').searchParams;
  expect(Object.fromEntries(query)).toEqual({ from: '2026-10-26', to: '2026-11-01', page: '2', pageSize: '100' });
  expect(config.headers.Authorization).toBe('Bearer a');
});

test('child reflection PATCH preserves explicit empty and cannot overwrite other record fields', async () => {
  save('student'); axios.patch.mockResolvedValue({ data: { data: { log: {} } } });
  await child.updateOwnGrowthLog('log/id', { childReflection: '', content: 'old', parentNote: 'forged', durationMinutes: 0 });
  expect(axios.patch).toHaveBeenCalledWith('/api/growth-logs/log%2Fid', { childReflection: '' },
    { headers: { Authorization: 'Bearer a' } });
});

const invoke = (role, method, session) => role === 'student'
  ? method === 'get' ? child.listOwnGrowthLogs({}, undefined, session)
    : method === 'post' ? child.createOwnGrowthLog({}, undefined, session)
      : child.updateOwnGrowthLog('log', { childReflection: 'note' }, undefined, session)
  : method === 'get' ? parent.listGrowthLogs({ childId: 'a' }, undefined, session)
    : method === 'post' ? parent.createGrowthLog({ childId: 'a' }, undefined, session)
      : parent.updateGrowthLog('log', { childReflection: 'note' }, undefined, session);

test.each(['parent', 'student'].flatMap(role => ['get', 'post', 'patch'].map(method => [role, method])))(
  '%s %s rejects a captured old session before any request', async (role, method) => {
    save(role); const old = captureSession(role); save(role, 'b');
    await expect(invoke(role, method, old)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(axios[method]).not.toHaveBeenCalled();
  }
);
test.each(['parent', 'student'].flatMap(role => [200, 401, 403].map(status => [role, status])))(
  '%s late write %s cannot return private data or expire replacement identity', async (role, status) => {
    save(role); let finish;
    axios.post.mockImplementation(() => new Promise((resolve, reject) => {
      finish = () => status === 200 ? resolve({ data: { data: { log: { content: 'private' } } } })
        : reject({ response: { status } });
    }));
    const request = invoke(role, 'post', captureSession(role));
    save(role, 'b'); finish();
    await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(captureSession(role).actorId).toBe('b');
  }
);
